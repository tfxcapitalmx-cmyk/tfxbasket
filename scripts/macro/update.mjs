// Daily macro scorecard refresh: FRED API + data/manual.json → validate → data/macro.json.
// Run with `FRED_API_KEY=… node scripts/macro/update.mjs` (Node 20+). Exit code 1 = keep the previous file.
import { readFile, writeFile } from 'node:fs/promises';
import { SERIES, buildMacro, rollHistory, validateMacro, validateManual, fromApi } from './core.mjs';
import { CHART_SERIES, computeCharts, mergeCharts, validateCharts } from './charts.mjs';

const OUT = new URL('../../data/macro.json', import.meta.url);
const CHARTS = new URL('../../data/charts.json', import.meta.url);
const MANUAL = new URL('../../data/manual.json', import.meta.url);
const KEY = process.env.FRED_API_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fred(id, tries = 3) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=2000-01-01`;
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const obs = fromApi(await res.json());
      if (obs.length < 24) throw new Error(`solo ${obs.length} observaciones`);
      return obs;
    } catch (e) {
      last = e;
      if (i < tries - 1) await sleep(5000 * (i + 1));
    }
  }
  throw new Error(`${id}: ${last.message}`); // never echo the URL: it carries the key
}

async function main() {
  if (!KEY) throw new Error('Falta el secreto FRED_API_KEY');
  const man = JSON.parse(await readFile(MANUAL, 'utf8'));
  const manErr = validateManual(man);
  if (manErr.length) { console.error('data/manual.json tiene errores:\n- ' + manErr.join('\n- ')); process.exit(1); }

  const prev = JSON.parse(await readFile(OUT, 'utf8'));
  const obs = {};
  for (const id of [...SERIES, ...CHART_SERIES]) { obs[id] = await fred(id); console.log(`${id}: último ${obs[id][obs[id].length - 1][0]}`); }

  const today = new Date().toISOString().slice(0, 10);
  const next = buildMacro(obs, man, today);
  const problems = validateMacro(next);
  if (problems.length) { console.error('Validación fallida; se conserva el archivo anterior:\n- ' + problems.join('\n- ')); process.exit(1); }
  next.hist = rollHistory(prev.hist, prev, today);

  // Gráficos: same observations, merged onto the stored history; its state comes from the scorecard rows.
  const prevCharts = JSON.parse(await readFile(CHARTS, 'utf8'));
  const charts = mergeCharts(prevCharts.charts, computeCharts(obs, man), next.rows);
  const chartErr = validateCharts(charts, prevCharts.charts);
  if (chartErr.length) { console.error('Gráficos: validación fallida; se conservan los archivos anteriores:\n- ' + chartErr.join('\n- ')); process.exit(1); }

  // Only the content counts as a change, not the date of the check.
  const strip = m => JSON.stringify({ ...m, asof: null, asof_iso: null });
  if (JSON.stringify(prevCharts.charts) !== JSON.stringify(charts)) {
    await writeFile(CHARTS, JSON.stringify({ asof_iso: today, charts }));
    console.log('Gráficos actualizados.');
  }
  if (strip(prev) === strip(next)) { console.log('Sin datos nuevos en el puntaje.'); return; }
  await writeFile(OUT, JSON.stringify(next));
  console.log(`Actualizado: compuesto ${prev.composite.toFixed(2)} → ${next.composite.toFixed(2)}`);

  const stale = ['DGS2', 'DGS10', 'DFF'].filter(id => (Date.parse(today) - Date.parse(obs[id][obs[id].length - 1][0])) / 864e5 > 10);
  if (stale.length) { console.error(`Series diarias sin datos en más de 10 días: ${stale.join(', ')}`); process.exit(1); }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
