// DEV ONLY (se borra al terminar): descarga series de FRED a .cache/fred/ para reconstruir Distribución sin la clave en la PC.
import { mkdir, writeFile } from 'node:fs/promises';
const KEY = process.env.FRED_API_KEY;
const IDS = ['CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PPIFES', 'DCOILWTICO', 'T5YIE', 'T10Y2Y', 'UNRATE', 'ICSA', 'USALOLITOAASTSAM', 'MICH', 'DGS2', 'DGS10', 'PAYEMS', 'UMCSENT', 'GDPC1', 'M2SL', 'FEDFUNDS', 'DFF', 'PERMIT', 'RSAFS', 'SP500'];
await mkdir('.cache/fred', { recursive: true });
for (const id of IDS) {
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=1900-01-01`);
  if (!r.ok) { console.log(id, 'HTTP', r.status); continue; }
  const j = await r.json(); const obs = j.observations.filter(o => o.value !== '.').map(o => [o.date, +o.value]);
  await writeFile(`.cache/fred/${id}.json`, JSON.stringify(obs)); console.log(id, obs.length, obs[0][0], obs.at(-1)[0]);
  await new Promise(s => setTimeout(s, 300));
}
// DEV ONLY: dispara el ensayo 2026-11-10T01:47:40
// reintento
