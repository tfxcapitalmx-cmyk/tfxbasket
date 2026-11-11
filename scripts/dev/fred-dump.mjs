// DEV ONLY (se borra al terminar): series para reconstruir el nowcast, actuales y tal como se conocian el 2026-10-16 (ALFRED).
import { mkdir, writeFile } from 'node:fs/promises';
const KEY = process.env.FRED_API_KEY, B = 'https://api.stlouisfed.org/fred';
await mkdir('.cache/fred', { recursive: true });
const get = async p => { const r = await fetch(`${B}/${p}&api_key=${KEY}&file_type=json`); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const IDS = ['CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PPIFES', 'PAYEMS', 'ICSA', 'MICH', 'GASREGW', 'CUSR0000SETB01', 'CUUR0000SETB01', 'DTWEXBGS', 'DGS2'];
for (const id of IDS) {
  for (const [tag, rt] of [['', ''], ['_v1016', '&realtime_start=2026-10-16&realtime_end=2026-10-16']]) {
    try { const j = await get(`series/observations?series_id=${id}&observation_start=1990-01-01${rt}`); const o = j.observations.filter(x => x.value !== '.').map(x => [x.date, +x.value]); await writeFile(`.cache/fred/${id}${tag}.json`, JSON.stringify(o)); console.log(id + tag, o.length, o.at(-1)); }
    catch (e) { console.log(id + tag, e.message); }
    await new Promise(s => setTimeout(s, 300));
  }
}
