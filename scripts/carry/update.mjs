// Daily carry refresh: BIS policy rates + FRED (Fed) + ECB reference rates → validate → data/carry.json.
// Run with `FRED_API_KEY=… node scripts/carry/update.mjs` (Node 20+). Exit code 1 = keep the previous file.
import { readFile, writeFile } from 'node:fs/promises';
import { BIS_URL, ECB_FX_URL, FRED_IDS, bisSeries, ecbRates, buildCarry, validateCarry, validateOverrides } from './core.mjs';
import { fromApi } from '../macro/core.mjs';

const OUT = new URL('../../data/carry.json', import.meta.url);
const CAL = new URL('../../data/cb-calendar.json', import.meta.url);
const MANUAL = new URL('../../data/manual.json', import.meta.url);
const KEY = process.env.FRED_API_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(label, url, as = 'text', tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === 'json' ? await res.json() : await res.text();
    } catch (e) { last = e; if (i < tries - 1) await sleep(5000 * (i + 1)); }
  }
  throw new Error(`${label}: ${last.message}`); // label only: the FRED URL carries the key
}

async function main() {
  if (!KEY) throw new Error('Falta el secreto FRED_API_KEY');
  const today = new Date().toISOString().slice(0, 10);
  const start = `${+today.slice(0, 4) - 10}-01-01`; // enough history to find when each current level started
  const bis = bisSeries(await get('BIS', BIS_URL(start)));
  const fx = ecbRates(await get('BCE', ECB_FX_URL));
  if (!fx) throw new Error('BCE: no hay una fecha con todos los tipos de cambio');
  const fred = {};
  for (const id of FRED_IDS) fred[id] = fromApi(await get(id, `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}`, 'json'));
  const calendar = JSON.parse(await readFile(CAL, 'utf8'));
  const overrides = JSON.parse(await readFile(MANUAL, 'utf8')).tasas || {};
  const ovErr = validateOverrides(overrides);
  if (ovErr.length) { console.error('data/manual.json tiene errores:\n- ' + ovErr.join('\n- ')); process.exit(1); }

  const next = buildCarry({ bis, fred, fx, calendar, overrides }, today);
  const problems = validateCarry(next, today);
  if (problems.length) { console.error('Validación fallida; se conserva el archivo anterior:\n- ' + problems.join('\n- ')); process.exit(1); }

  const noProx = next.cb.filter(b => !b.prox).map(b => b.ccy);
  if (noProx.length) console.warn(`Aviso: sin próxima reunión en data/cb-calendar.json para ${noProx.join(', ')}`);

  let prev = null; try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const strip = c => JSON.stringify({ ...c, asof: null });
  if (prev && strip(prev) === strip(next)) { console.log('Sin cambios.'); return; }
  await writeFile(OUT, JSON.stringify(next));
  console.log(`Actualizado: precios del ${next.pxdate}; tasas ${next.cb.map(b => `${b.ccy} ${b.tasa}`).join(' · ')}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
