// Modelos → nowcast: FRED + data/calendar.json (release time, consensus) + daily prices → data/nowcast.json.
// Run with `FRED_API_KEY=… node scripts/nowcast/update.mjs` (Node 20+). Exit code 1 = keep the previous file.
// FRED_CACHE=.cache/fred reads the series from disk instead (local tests without the key).
import { readFile, writeFile } from 'node:fs/promises';
import { NC_SERIES, NC_ORDER, buildNowcast, eventStudy, validateNowcast } from './core.mjs';
import { decodeSeries, mergeDaily } from '../markets/core.mjs';

const OUT = new URL('../../data/nowcast.json', import.meta.url);
const R = p => readFile(new URL(`../../${p}`, import.meta.url), 'utf8');
const KEY = process.env.FRED_API_KEY, CACHE = process.env.FRED_CACHE;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EXTRA = ['DTWEXBGS', 'DGS2'];   // event study: broad dollar index and 2-year yield

async function fred(path, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://api.stlouisfed.org/fred/${path}&api_key=${KEY}&file_type=json`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { last = e; if (i < tries - 1) await sleep(4000 * (i + 1)); }
  }
  throw new Error(`${path.split('?')[0]}: ${last.message}`); // never echo the URL: it carries the key
}
const series = async id => (CACHE ? JSON.parse(await R(`${CACHE}/${id}.json`))
  : (await fred(`series/observations?series_id=${id}&observation_start=1990-01-01`)).observations.filter(o => o.value !== '.').map(o => [o.date, +o.value]));

async function main() {
  if (!CACHE && !KEY) throw new Error('Falta el secreto FRED_API_KEY');
  const obs = {};
  for (const id of [...NC_SERIES, ...EXTRA]) obs[id] = await series(id);

  // Agenda: release time and consensus of the coming figure.
  let events = [];
  try { events = JSON.parse(await R('data/calendar.json')).events; } catch { console.warn('Sin data/calendar.json: el nowcast se calcula sin consenso ni hora de publicación'); }
  const num = s => { if (!s) return null; const m = String(s).replace('−', '-').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
  const event = (key, name, ref) => { const e = events.find(x => x.key === key && x.name.startsWith(name) && x.refp === ref); return e ? { t: e.t, cons: num(e.cons) } : null; };

  const now = new Date().toISOString().slice(0, 10);
  const manual = JSON.parse(await R('data/manual.json'));
  const nc = buildNowcast(obs, { asofMonth: now.slice(0, 7), event, manual });
  const err = validateNowcast(nc);
  if (err.length) { console.error('Nowcast: validación fallida; se conserva el archivo anterior:\n- ' + err.join('\n- ')); process.exit(1); }

  // Event study: CPI release days since 2016 (FRED release dates) and the market reaction that day.
  let evt = null;
  try {
    const dates = CACHE ? JSON.parse(await R(`${CACHE}/_cpi_dates.json`))
      : (await fred('release/dates?release_id=10&realtime_start=2015-12-01&realtime_end=9999-12-31&include_release_dates_with_no_data=false&sort_order=asc&limit=1000')).release_dates.map(x => x.date);
    const cpiDates = {};
    for (const d of dates) { const [y, m] = d.split('-').map(Number), ref = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; if (!cpiDates[ref]) cpiDates[ref] = d; }
    const mk = JSON.parse(await R('data/markets.json'));
    let live = {}; try { live = JSON.parse(await R('data/mkt-live.json')).live || {}; } catch { /* stored candles only */ }
    const closes = sym => new Map(mergeDaily(decodeSeries(mk[sym].D), live[sym]).map(r => { const s = String(r[0]); return [`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, r[4]]; }));
    const prices = { dxy: new Map(obs.DTWEXBGS), d2: new Map(obs.DGS2), spx: closes('SPX500'), xau: closes('XAUUSD') };
    evt = eventStudy(nc, cpiDates, prices);
  } catch (e) { console.warn(`Estudio de evento no actualizado: ${e.message}`); }

  let prev = null; try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const out = { asof: now, nowcast: nc, nc_order: NC_ORDER, evt: evt || (prev && prev.evt) || null };
  if (prev && JSON.stringify({ ...prev, asof: null }) === JSON.stringify({ ...out, asof: null })) { console.log('Nowcast sin cambios.'); return; }
  await writeFile(OUT, JSON.stringify(out));
  console.log('Nowcast: ' + NC_ORDER.map(k => `${k} ${nc[k].ref} ${nc[k].pred.toFixed(nc[k].unit === '%' ? 2 : 0)}${nc[k].unit}`).join(' · '));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
