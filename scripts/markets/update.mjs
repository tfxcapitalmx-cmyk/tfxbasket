// Daily refresh of Volatilidad and Estacionalidad: Yahoo Finance daily candles → data/mkt-live.json, data/vol.json, data/seas.json.
// Run with `node scripts/markets/update.mjs` (Node 20+, no key). Exit code 1 = keep the previous files.
// Stored history (data/markets.json, Investing.com) is never modified: live candles only extend it after its last date.
import { readFile, writeFile } from 'node:fs/promises';
import { INSTRUMENTS, YAHOO, kindOf, decodeSeries, mergeDaily, monthlyCloses, buildSeason, buildVol, validateSeason, validateVol, checkOverlap } from './core.mjs';

const U = p => new URL(`../../data/${p}`, import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ymd = t => { const d = new Date(t); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
const toTs = y => Date.UTC(Math.floor(y / 10000), Math.floor(y / 100) % 100 - 1, y % 100);
const MAX_AGE_DAYS = 6; // weekends and holidays included

// Yahoo's chart endpoint is unofficial: retry, try both hosts, never echo more than the symbol.
// Price decimals as quoted (same as the stored Investing.com candles).
const decimals = p => (p.endsWith('JPY') ? 3 : kindOf(p) === 'fx' ? 5 : p === 'XAGUSD' ? 3 : 2);

async function yahoo(sym, fromTs, toTsx, dec, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    const host = i % 2 ? 'query2' : 'query1';
    const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${Math.floor(fromTs / 1000)}&period2=${Math.floor(toTsx / 1000)}&interval=1d&includeAdjustedClose=false`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; tfx-data-bot)' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const r = j.chart && j.chart.result && j.chart.result[0];
      if (!r) throw new Error(`sin resultado (${j.chart && j.chart.error ? j.chart.error.description : 'respuesta vacía'})`);
      const t = r.timestamp || [], q = r.indicators.quote[0], off = (r.meta.gmtoffset || 0) * 1000, rows = [];
      for (let k = 0; k < t.length; k++) {
        if ([q.open[k], q.high[k], q.low[k], q.close[k]].some(x => x == null || !Number.isFinite(x))) continue;
        const [o, h, l, c] = [q.open[k], q.high[k], q.low[k], q.close[k]].map(x => +x.toFixed(dec));
        rows.push([ymd(t[k] * 1000 + off), o, Math.max(o, h, c), Math.min(o, l, c), c]); // Yahoo sometimes leaves the close a tick outside the high-low
      }
      return rows;
    } catch (e) { last = e; if (i < tries - 1) await sleep(4000 * (i + 1)); }
  }
  throw new Error(`${sym}: ${last.message}`);
}

async function main() {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10), todayYmd = ymd(now);
  const mk = JSON.parse(await readFile(U('markets.json'), 'utf8'));
  let prevLive = { live: {} };
  try { prevLive = JSON.parse(await readFile(U('mkt-live.json'), 'utf8')); } catch { /* first run */ }

  const storedD = {}, storedM = {}, live = {}, problems = [];
  for (const p of INSTRUMENTS) {
    storedD[p] = decodeSeries(mk[p].D); storedM[p] = decodeSeries(mk[p].M);
    const have = (prevLive.live[p] || []);
    // Re-read the last two weeks every run: the latest candle can be revised and the previous run may have caught a partial one.
    const from = toTs((have.length ? have[have.length - 1][0] : storedD[p][storedD[p].length - 1][0])) - 14 * 864e5;
    let rows = await yahoo(YAHOO[p], from, now + 2 * 864e5, decimals(p));
    // A candle dated today is still forming unless the market has closed (FX stays in progress until midnight GMT and is kept: it is the live price).
    const closed = new Date(now).getUTCHours() >= 22;
    if (kindOf(p) !== 'fx' && !closed) rows = rows.filter(r => r[0] < todayYmd);
    const bad = checkOverlap(p, storedD[p], rows); if (bad) problems.push(bad);
    const lastStored = storedD[p][storedD[p].length - 1][0];
    const merged = new Map(have.filter(r => r[0] > lastStored && r[0] < ymd(from)).map(r => [r[0], r]));
    for (const r of rows) if (r[0] > lastStored) merged.set(r[0], r);
    live[p] = [...merged.values()].sort((a, b) => a[0] - b[0]);
    console.log(`${p}: histórico hasta ${lastStored} · vivo ${live[p].length} velas hasta ${live[p].length ? live[p][live[p].length - 1][0] : '—'}`);
    await sleep(350);
  }
  if (problems.length) { console.error('Yahoo no coincide con el histórico; se conservan los archivos anteriores:\n- ' + problems.join('\n- ')); process.exit(1); }

  const daily = {}, closes = {};
  for (const p of INSTRUMENTS) {
    daily[p] = mergeDaily(storedD[p], live[p]);
    const lastM = storedM[p][storedM[p].length - 1][0];
    closes[p] = monthlyCloses(storedM[p], daily[p], Math.floor(lastM / 100));
    const lastD = daily[p][daily[p].length - 1][0], age = (now - toTs(lastD)) / 864e5;
    if (age > MAX_AGE_DAYS) problems.push(`${p}: último dato ${lastD}, ${Math.floor(age)} días de atraso`);
  }
  if (problems.length) { console.error('Datos atrasados; se conservan los archivos anteriores:\n- ' + problems.join('\n- ')); process.exit(1); }

  const vol = buildVol(daily.VIX, daily.SPX500);
  const seas = buildSeason(closes);
  const oldest = Math.min(...INSTRUMENTS.map(p => daily[p][daily[p].length - 1][0])); // the stamp shows the least up-to-date instrument
  seas.asof = `${String(oldest).slice(0, 4)}-${String(oldest).slice(4, 6)}-${String(oldest).slice(6, 8)}`;
  const errs = [...validateVol(vol, today), ...validateSeason(seas, today)];
  if (errs.length) { console.error('Validación fallida; se conservan los archivos anteriores:\n- ' + errs.join('\n- ')); process.exit(1); }

  // Only content counts as a change, not the date of the check.
  const out = [['mkt-live.json', { asof: today, source: 'Yahoo Finance', live }, o => ({ ...o, asof: null })], ['vol.json', vol, o => o], ['seas.json', seas, o => o]];
  let changed = 0;
  for (const [file, next, norm] of out) {
    let prev = null; try { prev = JSON.parse(await readFile(U(file), 'utf8')); } catch { /* first run */ }
    if (prev && JSON.stringify(norm(prev)) === JSON.stringify(norm(next))) continue;
    await writeFile(U(file), JSON.stringify(next)); changed++; console.log(`Actualizado ${file}`);
  }
  console.log(changed ? `Listo: VIX ${vol.vix} · S&P ${vol.spx} · datos al ${vol.asof}` : 'Sin datos nuevos.');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
