// DEV ONLY (se borra al terminar): fechas de publicación de FRED y series para construir el Catalizador.
import { mkdir, writeFile } from 'node:fs/promises';
const KEY = process.env.FRED_API_KEY, B = 'https://api.stlouisfed.org/fred';
await mkdir('.cache/fred', { recursive: true });
const get = async (p) => { const r = await fetch(`${B}/${p}&api_key=${KEY}&file_type=json`); if (!r.ok) throw new Error(p.split('?')[0] + ' HTTP ' + r.status); return r.json(); };
const rel = await get('releases?limit=1000');
await writeFile('.cache/fred/_releases.json', JSON.stringify(rel.releases.map(r => [r.id, r.name])));
const dates = {};
for (const id of [9, 10, 11, 46, 50, 53, 54, 91, 101, 180, 192]) { const d = await get(`release/dates?release_id=${id}&realtime_start=2026-01-01&realtime_end=9999-12-31&include_release_dates_with_no_data=true&sort_order=asc&limit=1000`); dates[id] = d.release_dates.map(x => x.date); console.log(id, dates[id].filter(x => x >= '2026-10-15').slice(0, 6).join(' ')); }
await writeFile('.cache/fred/_dates.json', JSON.stringify(dates));
const IDS = ['PAYEMS', 'UNRATE', 'CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PPIFES', 'RSAFS', 'ICSA', 'GDPC1', 'PCEPI', 'PCEPILFE', 'ECIALLCIV', 'JTSJOL', 'UMCSENT', 'DFEDTARU', 'DFEDTARL'];
for (const id of IDS) {
  try { const j = await get(`series/observations?series_id=${id}&observation_start=2024-01-01`); const o = j.observations.filter(x => x.value !== '.').map(x => [x.date, +x.value]); await writeFile(`.cache/fred/${id}.json`, JSON.stringify(o)); console.log(id, o.at(-1)); }
  catch (e) { console.log(id, e.message); }
}
// Vintages (ALFRED) del NFP: para marcar "(rev.)" en el dato previo.
const v = await get('series/observations?series_id=PAYEMS&observation_start=2026-06-01&realtime_start=2026-08-01&realtime_end=9999-12-31');
await writeFile('.cache/fred/_PAYEMS_vintages.json', JSON.stringify(v.observations));
const ff = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { headers: { 'User-Agent': 'Mozilla/5.0' } });
console.log('ForexFactory desde Actions:', ff.status);
if (ff.ok) await writeFile('.cache/fred/_ff.json', await ff.text());
