// DEV ONLY (se borra al terminar): descarga series de FRED a .cache/fred/ para reconstruir bonos, curva y tarjetas sin la clave en la PC.
import { mkdir, writeFile } from 'node:fs/promises';
const KEY = process.env.FRED_API_KEY;
const IDS = ['DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30', 'FEDFUNDS', 'DFF', 'DFEDTARU', 'CPILFESL', 'CPIAUCSL', 'UNRATE', 'RSAFS', 'PPIFIS', 'GDPC1', 'ADPMNUSNERSA', 'ADPWNUSNERSA', 'NPPTTL', 'UMCSENT'];
await mkdir('.cache/fred', { recursive: true });
for (const id of IDS) {
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=1900-01-01`);
  if (!r.ok) { console.log(id, 'HTTP', r.status); continue; }
  const j = await r.json(); const obs = j.observations.filter(o => o.value !== '.').map(o => [o.date, +o.value]);
  await writeFile(`.cache/fred/${id}.json`, JSON.stringify(obs)); console.log(id, obs.length, obs[0][0], obs.at(-1)[0]);
  await new Promise(s => setTimeout(s, 300));
}
