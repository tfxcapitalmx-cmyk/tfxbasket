// Checks the classification rules of the report library. Run: node scripts/reports/check.mjs
import { classify, titleOf, dateOf, slugName } from './core.mjs';

const CASES = [
  ['Briefing_PT_2026-11-12.html', '<title>Briefing diario Prime Terminal</title><p>Research de Goldman, UBS, Citi, JPM y Barclays.</p>', 'diarios', '2026-11-12'],
  ['semanal 09-11-2026.pdf', '', 'semanales', '2026-11-09'],
  ['20261110_weekly.md', '# Semana', 'semanales', '2026-11-10'],
  ['GS_FX_Outlook.pdf', '', 'bancarios', null],
  ['TFX Macro Research 12-11-2026.docx', '', 'bancarios', '2026-11-12'],
  ['banco-ubs.md', '# Resumen', 'bancarios', null],
  ['reporte.html', '<title>Outlook semanal de divisas</title>', 'semanales', null],
  ['analisis.html', '<title>Notas</title><p>Goldman dice. JPMorgan dice. UBS dice. Citi dice. Barclays dice.</p>', 'bancarios', null],
  ['nota.html', '<title>Nota de mercado</title><p>Goldman espera recortes.</p>', 'diarios', null],
  ['cierre.html', '<title>Cierre de mercados</title><p>El dólar subió.</p>', 'diarios', null],
];
let bad = 0;
for (const [name, text, cat, date] of CASES) {
  const c = classify(name, text), d = dateOf(name), okk = c.cat === cat && d === date;
  if (!okk) bad++;
  console.log(`${okk ? 'ok  ' : 'FALLA'} ${name.padEnd(38)} → ${c.cat.padEnd(10)} (${c.why}) · ${d || 'sin fecha'} · "${titleOf(name, text)}" · ${slugName(name, d || '2026-01-01')}`);
}
console.log(bad ? `${bad} caso(s) fallan` : 'Todas las reglas pasan');
process.exit(bad ? 1 : 0);
