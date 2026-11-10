// Reproduction check for Distribución → Datos macroeconómicos: rebuilds D.series and compares it, date by date,
// with the reference series in scripts/reference/snapshot-2026-10-16.json (built in earlier chats).
// Needs FRED observations in .cache/fred/<ID>.json ([[date, value], …], full history). Run: node scripts/macro/check-dist.mjs
import { readFile } from 'node:fs/promises';
import { DIST_SERIES, buildDist } from './dist.mjs';
import { decodeSeries } from '../markets/core.mjs';

const R = p => readFile(new URL(`../../${p}`, import.meta.url), 'utf8');
const stored = JSON.parse(await R('scripts/reference/snapshot-2026-10-16.json')).series;
const charts = JSON.parse(await R('data/charts.json')).charts;
const mk = JSON.parse(await R('data/markets.json'));
const spx = decodeSeries(mk.SPX500.M).map(r => [`${String(r[0]).slice(0, 4)}-${String(r[0]).slice(4, 6)}`, r[4]]);
const obs = {};
for (const id of DIST_SERIES) obs[id] = JSON.parse(await R(`.cache/fred/${id}.json`));

const next = buildDist(stored, obs, charts, spx);
let total = 0, same = 0;
const rows = [];
for (const [k, s] of Object.entries(stored)) {
  for (const [hk, H] of Object.entries(s.h)) {
    const N = next[k].h[hk], m = new Map(N.dates.map((d, i) => [d, N.values[i]]));
    const dec = Math.max(...H.values.slice(-200).map(v => (String(v).split('.')[1] || '').length));
    const tol = 0.5 * 10 ** -dec + 1e-9;
    let n = 0, ok = 0, last = null, first = null;
    H.dates.forEach((d, i) => { const v = m.get(d); if (v == null) return; n++; if (Math.abs(v - H.values[i]) <= tol) ok++; else { first = first || d; last = d; } });
    const lost = H.dates.filter(d => !m.has(d)).length;
    total += n; same += ok;
    rows.push(`${(k + '.' + hk).padEnd(14)} ${String(ok).padStart(6)}/${String(n).padEnd(6)} ${lost ? `sin calcular ${lost}` : ''}${first ? ` difiere ${first} → ${last}` : ''} · nuevo hasta ${N.dates[N.dates.length - 1]}`);
  }
}
console.log(rows.join('\n'));
console.log(`\nCoinciden ${same} de ${total} valores (${(same / total * 100).toFixed(2)} %). Las diferencias son revisiones de FRED o datos del libro A.E. que FRED publica distinto.`);
