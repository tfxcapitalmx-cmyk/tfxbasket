// Catalizador → agenda: FRED (dates, actual, previous) + ForexFactory (consensus, exact time) + data/manual.json → data/calendar.json.
// Run with `FRED_API_KEY=… node scripts/calendar/update.mjs` (Node 20+). Exit code 1 = keep the previous file.
// FRED_CACHE=.cache/fred reads the observations from disk instead (local tests without the key).
import { readFile, writeFile } from 'node:fs/promises';
import { RELEASES, SERIES, buildCalendar, validateCalendar } from './core.mjs';

const OUT = new URL('../../data/calendar.json', import.meta.url);
const R = p => readFile(new URL(`../../${p}`, import.meta.url), 'utf8');
const KEY = process.env.FRED_API_KEY, CACHE = process.env.FRED_CACHE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

async function main() {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const dates = {}, obs = {};
  if (CACHE) {
    const d = JSON.parse(await R(`${CACHE}/_dates.json`));
    for (const [k, id] of Object.entries(RELEASES)) dates[k] = d[id] || [];
    for (const id of SERIES) obs[id] = JSON.parse(await R(`${CACHE}/${id}.json`));
  } else {
    if (!KEY) throw new Error('Falta el secreto FRED_API_KEY');
    for (const [k, id] of Object.entries(RELEASES)) {
      const j = await fred(`release/dates?release_id=${id}&realtime_start=${since}&realtime_end=9999-12-31&include_release_dates_with_no_data=true&sort_order=asc&limit=1000`);
      dates[k] = j.release_dates.map(x => x.date);
    }
    for (const id of SERIES) {
      const j = await fred(`series/observations?series_id=${id}&observation_start=2024-01-01`);
      obs[id] = j.observations.filter(o => o.value !== '.').map(o => [o.date, +o.value]);
    }
  }
  // ForexFactory is optional: without it the agenda keeps the consensus already recorded.
  let ff = null;
  try {
    const r = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { headers: { 'User-Agent': 'Mozilla/5.0 (tfx-terminal)' }, signal: AbortSignal.timeout(20000) });
    if (r.ok) ff = await r.json(); else console.warn(`ForexFactory: HTTP ${r.status}; se conserva el consenso guardado`);
  } catch (e) { console.warn(`ForexFactory no respondió (${e.message}); se conserva el consenso guardado`); }

  const manual = JSON.parse(await R('data/manual.json')), fomc = JSON.parse(await R('scripts/calendar/fomc.json')).fechas;
  let prevFile = null; try { prevFile = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const prev = prevFile ? prevFile.events : JSON.parse(await R('data/snapshot.json')).snap.calendar;

  const cal = buildCalendar({ dates, obs, ff, manual, fomc, prev, now });
  const err = validateCalendar(cal, now);
  if (err.length) { console.error('Agenda: validación fallida; se conserva el archivo anterior:\n- ' + err.join('\n- ')); process.exit(1); }
  cal.ff = ff ? now : (prevFile && prevFile.ff) || null;   // last time the consensus could be refreshed
  if (prevFile && JSON.stringify(prevFile.events) === JSON.stringify(cal.events)) { console.log('Agenda sin cambios.'); return; }
  await writeFile(OUT, JSON.stringify(cal));
  const fut = cal.events.filter(e => e.t > now);
  console.log(`Agenda: ${cal.events.length} eventos (${fut.length} próximos); siguiente: ${fut[0] ? `${fut[0].name} ${fut[0].t}` : '—'}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
