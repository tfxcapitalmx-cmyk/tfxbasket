// Vigilante de frescura: revisa la antigüedad de cada archivo de data/ y de la captura manual.
// GitHub solo avisa cuando un proceso falla; este script también detecta los que no corren o no traen datos nuevos.
// Escribe el informe en watchdog-report.md y termina con código 1 si hay algo atrasado. Run: node scripts/watchdog/check.mjs
import { readFile, writeFile } from 'node:fs/promises';

const R = async p => JSON.parse(await readFile(new URL(`../../data/${p}`, import.meta.url), 'utf8'));
const now = Date.now();
const MES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
const days = iso => (now - Date.parse(iso)) / 864e5;
const problems = [], ok = [];

// [archivo, campo de fecha, días máximos, proceso que lo genera]. Los máximos incluyen fines de semana y festivos.
const FILES = [
  ['macro.json', m => m.asof_iso, 4, 'Puntaje macro (FRED)'],
  ['charts.json', m => m.asof_iso, 35, 'Puntaje macro (FRED) · Gráficos solo cambia con datos mensuales'],
  ['dist.json', m => m.asof_iso, 10, 'Puntaje macro (FRED) · Distribución'],
  ['carry.json', m => m.datos, 14, 'Carry (BIS publica con 2–13 días de retraso)'],
  ['cot.json', m => m.asof, 13, 'COT CFTC (informe semanal)'],
  ['vol.json', m => m.asof, 5, 'Mercados (Yahoo Finance)'],
  ['seas.json', m => m.asof, 5, 'Mercados (Yahoo Finance)'],
  ['mkt-live.json', m => m.asof, 5, 'Mercados (Yahoo Finance)'],
];
for (const [f, get, max, who] of FILES) {
  try {
    const d = get(await R(f)), age = days(d);
    (age > max ? problems : ok).push(`\`${f}\` · datos al ${d} (${Math.floor(age)} ${Math.floor(age) === 1 ? 'día' : 'días'}; máximo ${max}) · ${who}`);
  } catch (e) { problems.push(`\`${f}\` no se pudo leer: ${e.message}`); }
}

// Captura manual: atrasada cuando ya debió publicarse el periodo siguiente (fin del mes siguiente + rezago + 4 días).
const LAG = { pmi: 3, nmi: 5, lei_6m: 25, cei_6m: 25 };
const man = await R('manual.json');
for (const [k, lag] of Object.entries(LAG)) {
  const p = man[k] && man[k].periodo; if (!p) continue;
  const [y, m] = p.split('-').map(Number), due = Date.UTC(y, m + 1, 0) + (lag + 4) * 864e5;
  (now > due ? problems : ok).push(`\`manual.json\` → ${k} · periodo ${p} (${man[k].fuente})${now > due ? ': ya debió publicarse el siguiente dato' : ''}`);
}
for (const k of ['umcsi', 'mich']) {
  const x = man[k]; if (!x || !x.preliminar) continue;
  const [y, m] = x.periodo.split('-').map(Number);
  if (now > Date.UTC(y, m, 0) + 4 * 864e5) problems.push(`\`manual.json\` → ${k} · ${x.periodo} sigue como preliminar (la lectura final ya salió)`);
}

// Módulos que siguen congelados en data/snapshot.json (Catalizador y Modelos): se reportan sin bloquear.
const snap = (await R('snapshot.json')).snap, sd = /^(\d{1,2})-([a-z]{3})-(\d{4})$/.exec(snap.asof || '');
const frozen = sd ? `Catalizador y Modelos siguen siendo manuales (datos al ${snap.asof}, ${Math.floor((now - Date.UTC(+sd[3], MES[sd[2]], +sd[1])) / 864e5)} días).` : '';

const today = new Date(now).toISOString().slice(0, 10);
const md = [
  `Revisión del ${today}. ${problems.length ? `**${problems.length} con atraso**` : 'Todo al día.'}`,
  ...(problems.length ? ['', '### Atrasados', ...problems.map(p => `- ${p}`)] : []),
  '', '### Al día', ...ok.map(p => `- ${p}`),
  ...(frozen ? ['', `_${frozen}_`] : []),
  '', 'Qué hacer: abrir GitHub → Actions y revisar el proceso indicado (o volver a lanzarlo con *Run workflow*); para la captura manual, editar `data/manual.json`. Este aviso se cierra solo cuando todo vuelve a estar al día.',
].join('\n');
await writeFile('watchdog-report.md', md);
console.log(md);
process.exit(problems.length ? 1 : 0);
