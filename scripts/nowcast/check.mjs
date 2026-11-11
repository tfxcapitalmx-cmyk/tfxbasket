// Reproduction check: rebuilds the nowcast with the data known on 2026-10-16 (ALFRED vintages in .cache/fred/<ID>_v1016.json)
// and compares it with the values stored in data/snapshot.json (built in earlier chats). Run: node scripts/nowcast/check.mjs
import { readFile } from 'node:fs/promises';
import { NC_SERIES, NC_ORDER, buildNowcast } from './core.mjs';
const R = p => readFile(new URL(`../../${p}`, import.meta.url), 'utf8');
const old = JSON.parse(await R('data/snapshot.json')).snap.nowcast, obs = {};
for (const id of NC_SERIES) obs[id] = JSON.parse(await R(`.cache/fred/${id}_v1016.json`)).filter(([d]) => d <= '2026-10-16');
const cons = { 'PPI m/m|2026-09': 0.5, 'PPI core m/m|2026-09': 0.3 };
const t0 = Date.now();
const nc = buildNowcast(obs, { asofMonth: '2026-10', event: (key, name, ref) => ({ t: null, cons: cons[`${name}|${ref}`] ?? null }) });
const f = (v, d = 3) => (v == null ? '—' : (+v).toFixed(d));
for (const k of NC_ORDER) {
  const a = nc[k], b = old[k];
  console.log(`\n${k}: ref ${a.ref} (antes ${b.ref}) · central ${a.central} (antes ${b.central}) · variante "${a.reg.name}" (antes "${b.reg.name}") · ARIMA ${a.arima.order} (antes ${b.arima.order}) · GARCH ${a.garch.ok} (antes ${b.garch.ok})`);
  console.log(`  pred ${f(a.pred)} (antes ${f(b.pred)}) · regresión ${f(a.reg.pred)} (${f(b.reg.pred)}) · ARIMA ${f(a.arima.pred)} (${f(b.arima.pred)}) · w ${f(a.w)} (${f(b.w)})`);
  console.log('  RMSE  ' + a.table.map((r, i) => `${r[0].split(' ')[0]} ${f(r[1])} (${f(b.table[i][1])})`).join(' · '));
  console.log(`  MC arriba/en línea/abajo ${f(a.mc.above, 2)}/${f(a.mc.inline, 2)}/${f(a.mc.below, 2)} (antes ${f(b.mc.above, 2)}/${f(b.mc.inline, 2)}/${f(b.mc.below, 2)}) · p5–p95 ${f(a.mc.p5, 2)}–${f(a.mc.p95, 2)} (${f(b.mc.p5, 2)}–${f(b.mc.p95, 2)}) · escala ${f(a.mc.scale, 2)} (${f(b.mc.scale, 2)})`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
