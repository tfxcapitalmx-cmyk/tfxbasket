// Weekly COT refresh: CFTC API → validate → data/cot.json. Run with `node scripts/cot/update.mjs` (Node 20+).
// Exit code 1 means "do not publish": the previous file is left untouched and GitHub emails the failure.
import { readFile, writeFile } from 'node:fs/promises';
import { CURRENCIES, queryUrl, buildCot, validate, daysSince } from './core.mjs';

const OUT = new URL('../../data/cot.json', import.meta.url);
const STALE_DAYS = 17; // two missed Friday releases plus a holiday margin
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  const headers = process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {};
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      if (i < tries - 1) await sleep(10000 * (i + 1));
    }
  }
  throw last;
}

async function main() {
  let prev = null;
  try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }

  const rows = {};
  for (const cfg of CURRENCIES) {
    rows[cfg.ccy] = await getJson(queryUrl(cfg.code));
    console.log(`${cfg.ccy}: ${rows[cfg.ccy].length} informes`);
  }

  const next = buildCot(rows, new Date().toISOString());
  const problems = validate(next, prev);
  if (problems.length) {
    console.error('Validación fallida; se conserva el archivo anterior:\n- ' + problems.join('\n- '));
    process.exit(1);
  }

  const same = prev && prev.asof === next.asof && JSON.stringify(prev.ccy) === JSON.stringify(next.ccy);
  if (same) console.log(`Sin informe nuevo (corte ${next.asof}).`);
  else {
    await writeFile(OUT, JSON.stringify(next));
    console.log(`Actualizado: corte ${prev ? prev.asof : '—'} → ${next.asof}`);
  }

  const age = daysSince(next.asof);
  if (age > STALE_DAYS) {
    console.error(`El último informe de la CFTC tiene ${age} días. Revisar la fuente.`);
    process.exit(1);
  }
}

main().catch(e => { console.error('Error al consultar la CFTC:', e.message); process.exit(1); });
