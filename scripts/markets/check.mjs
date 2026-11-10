// Reproduction check: rebuilds D.snap.vol and D.snap.seas from the STORED candles (data/markets.json, no Yahoo)
// and compares them with the figures of scripts/reference/snapshot-2026-10-16.json (calculated in earlier chats).
// Run: node scripts/markets/check.mjs   (Node 20+, no network). Exit 1 if anything differs.
import { readFile } from 'node:fs/promises';
import { INSTRUMENTS, decodeSeries, monthlyCloses, buildSeason, buildVol } from './core.mjs';

const mk = JSON.parse(await readFile(new URL('../../data/markets.json', import.meta.url), 'utf8'));
const snap = JSON.parse(await readFile(new URL('../../scripts/reference/snapshot-2026-10-16.json', import.meta.url), 'utf8')).snap;

const closes = {};
for (const p of INSTRUMENTS) closes[p] = monthlyCloses(decodeSeries(mk[p].M), [], null);
const seas = buildSeason(closes);
const vol = buildVol(decodeSeries(mk.VIX.D), decodeSeries(mk.SPX500.D));

const diffs = [];
const cmp = (path, a, b, tol) => {
  if (a == null || b == null) { if (a !== b) diffs.push(`${path}: guardado ${JSON.stringify(a)} · calculado ${JSON.stringify(b)}`); return; }
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > tol) diffs.push(`${path}: guardado ${a} · calculado ${b}`); return; }
  if (typeof a !== 'object') { if (a !== b) diffs.push(`${path}: guardado ${a} · calculado ${b}`); return; }
  if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== b.length)) { diffs.push(`${path}: forma distinta (${Array.isArray(a) ? a.length : 'obj'} vs ${Array.isArray(b) ? b.length : 'obj'})`); return; }
  for (const k of Object.keys(a)) cmp(`${path}.${k}`, a[k], b[k], tol);
};

for (const p of INSTRUMENTS) { // seasonality: monthly returns and statistics to the cent
  const a = snap.seas.ins[p], b = seas.ins[p];
  for (const k of ['ly', 'desde', 'n', 'posm']) cmp(`seas.${p}.${k}`, a[k], b[k], 0.0015);
  cmp(`seas.${p}.grid`, a.grid, b.grid, 0.0051);
  cmp(`seas.${p}.st`, a.st, b.st, 0.0051);
  cmp(`seas.${p}.paths`, a.paths, b.paths, 0.0151);
  cmp(`seas.${p}.cur`, a.cur, b.cur, 0.0151);
  cmp(`seas.${p}.rel`, a.rel, b.rel, 0.0015);
}
cmp('seas.glob', snap.seas.glob, seas.glob, 0.0015);
for (const k of ['asof', 'vix', 'spx', 'n', 'desde', 'corr', 'corr_min', 'corr_max', 'corr_now', 'beta_dn', 'beta_up', 'dv_up', 'dv_dn', 'ratio', 'cov', 'buckets', 'rollc', 'scat', 'vixm', 'spxm'])
  cmp(`vol.${k}`, snap.vol[k], vol[k], k === 'scat' ? 0.0051 : k === 'buckets' ? 0.0151 : 0.0151);

console.log(`Estacionalidad: ${INSTRUMENTS.length} instrumentos · Volatilidad: ${vol.n} sesiones (${vol.desde} → ${vol.asof})`);
if (diffs.length) { console.log(`${diffs.length} diferencias (primeras 40):\n- ` + diffs.slice(0, 40).join('\n- ')); process.exit(1); }
console.log('Reproducción exacta: todos los valores coinciden con los de referencia (16-oct-2026).');
