// Daily macro scorecard refresh: FRED API + data/manual.json → validate → data/macro.json.
// Run with `FRED_API_KEY=… node scripts/macro/update.mjs` (Node 20+). Exit code 1 = keep the previous file.
import { readFile, writeFile } from 'node:fs/promises';
import { SERIES, buildMacro, rollHistory, validateMacro, validateManual, fromApi } from './core.mjs';
import { CHART_SERIES, computeCharts, mergeCharts, validateCharts } from './charts.mjs';
import { buildCycle, validateCycle } from './cycle.mjs';
import { DIST_SERIES, buildDist, validateDist } from './dist.mjs';
import { decodeSeries, mergeDaily, monthlyCloses } from '../markets/core.mjs';

const OUT = new URL('../../data/macro.json', import.meta.url);
const CHARTS = new URL('../../data/charts.json', import.meta.url);
const MANUAL = new URL('../../data/manual.json', import.meta.url);
const DIST = new URL('../../data/dist.json', import.meta.url);
const REFERENCE = new URL('../../scripts/reference/snapshot-2026-10-16.json', import.meta.url);
const MARKETS = new URL('../../data/markets.json', import.meta.url);
const MKT_LIVE = new URL('../../data/mkt-live.json', import.meta.url);
const KEY = process.env.FRED_API_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The cycle statistics use the whole OECD CLI history since 1955; everything else needs only recent years.
const START = { USALOLITOAASTSAM: '1955-01-01' };

async function fred(id, tries = 3, start = START[id] || '2000-01-01') {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}`;
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

  // Ciclo: OECD CLI phases → D.snap.cycle and D.snap.cycproj.
  const cyc = buildCycle(obs.USALOLITOAASTSAM, man);
  const cycErr = validateCycle(cyc);
  if (cycErr.length) { console.error('Ciclo: validación fallida; se conserva el archivo anterior:\n- ' + cycErr.join('\n- ')); process.exit(1); }
  Object.assign(next, cyc);

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
  // Distribución → Datos macroeconómicos: full FRED history + the charts above (ISM, UMich) + S&P 500 monthly closes.
  const distObs = {};
  for (const id of DIST_SERIES) distObs[id] = await fred(id, 3, '1900-01-01');
  const mk = JSON.parse(await readFile(MARKETS, 'utf8'));
  let live = {}; try { live = JSON.parse(await readFile(MKT_LIVE, 'utf8')).live || {}; } catch { /* no live candles yet */ }
  const spxM = decodeSeries(mk.SPX500.M), spxD = mergeDaily(decodeSeries(mk.SPX500.D), live.SPX500);
  const spx = monthlyCloses(spxM, spxD, Math.floor(spxM[spxM.length - 1][0] / 100)).map(([k, c]) => [`${String(k).slice(0, 4)}-${String(k).slice(4, 6)}`, c]);
  let prevDist = null; try { prevDist = JSON.parse(await readFile(DIST, 'utf8')); } catch { /* first run: start from the hand-built series */ }
  const base = prevDist ? prevDist.series : JSON.parse(await readFile(REFERENCE, 'utf8')).series;
  const dist = buildDist(base, distObs, charts, spx);
  const distErr = validateDist(dist, base);
  if (distErr.length) { console.error('Distribución: validación fallida; se conserva el archivo anterior:
- ' + distErr.join('
- ')); process.exit(1); }
  if (!prevDist || JSON.stringify(prevDist.series) !== JSON.stringify(dist)) {
    await writeFile(DIST, JSON.stringify({ asof_iso: today, series: dist }));
    console.log('Distribución actualizada.');
  }

  if (strip(prev) === strip(next)) { console.log('Sin datos nuevos en el puntaje.'); return; }
  await writeFile(OUT, JSON.stringify(next));
  console.log(`Actualizado: compuesto ${prev.composite.toFixed(2)} → ${next.composite.toFixed(2)}`);

  const stale = ['DGS2', 'DGS10', 'DFF'].filter(id => (Date.parse(today) - Date.parse(obs[id][obs[id].length - 1][0])) / 864e5 > 10);
  if (stale.length) { console.error(`Series diarias sin datos en más de 10 días: ${stale.join(', ')}`); process.exit(1); }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
