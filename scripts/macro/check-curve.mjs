// Reproduction check for Cuantitativo → Rendimientos de los bonos: rebuilds D.snap.curve and D.snap.yields with the data
// known on 2026-10-14 and compares every value with data/snapshot.json (built in earlier chats).
// Needs .cache/fred/<ID>.json ([[date, value], …], full history) for the 10 DGS series. Run: node scripts/macro/check-curve.mjs
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import { CURVE_SERIES, buildCurve } from './curve.mjs';

const R = p => readFile(new URL(`../../${p}`, import.meta.url), 'utf8');
const snap = JSON.parse(await R('data/snapshot.json')).snap;
const ref = JSON.parse(await R('scripts/reference/snapshot-2026-10-16.json')).series;
const CUT = '2026-10-14';
const daily = {};
for (const id of CURVE_SERIES) daily[id] = JSON.parse(await R(`.cache/fred/${id}.json`)).filter(([d]) => d <= CUT);
const M = (s, h) => new Map(s.h[h].dates.map((d, i) => [d.slice(0, 7), s.h[h].values[i]]));
// Fed funds and unemployment as the original generator had them (libro A.E.); CPI a/a from the FRED indexes up to sep-2026.
const yoy = id => { const m = new Map(JSON.parse(fs.readFileSync(new URL(`../../.cache/fred/${id}.json`, import.meta.url), 'utf8')).filter(([d]) => d < '2026-10').map(([d, v]) => [d.slice(0, 7), v])), r = new Map();
  for (const [k, v] of m) { const p = m.get(`${+k.slice(0, 4) - 1}${k.slice(4)}`); if (p) r.set(k, (v / p - 1) * 100); } return r; };
const { curve, yields } = buildCurve(daily, { ff: M(ref.ff, 'LVL'), core: yoy('CPILFESL'), cpi: yoy('CPIAUCSL'), un: M(ref.unrate, 'LVL') });

let n = 0, ok = 0; const bad = [];
const SKIP = new Set(['base_ff', 'base_k', 'base_u']);   // not shown in the page
function cmp(path, a, b) {
  if (typeof b === 'number') { n++; const tol = Math.max(1e-6, Math.abs(b) * 1e-6); if (typeof a === 'number' && Math.abs(a - b) <= tol) ok++; else bad.push(`${path}: ${a} ≠ ${b}`); return; }
  if (typeof b === 'string') { n++; if (a === b) ok++; else bad.push(`${path}: ${a} ≠ ${b}`); return; }
  if (Array.isArray(b)) { b.forEach((x, i) => cmp(`${path}[${i}]`, a?.[i], x)); return; }
  if (b && typeof b === 'object') for (const k of Object.keys(b)) { if (!SKIP.has(k)) cmp(`${path}.${k}`, a?.[k], b[k]); }
}
cmp('curve', curve, snap.curve); cmp('yields', yields, snap.yields);
console.log(bad.join('\n'));
console.log(`\nCoinciden ${ok} de ${n} valores (${(ok / n * 100).toFixed(2)} %).`);
