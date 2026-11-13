// Pure helpers for the report library: classification, title, date and file names.
// No file system here, so the rules can be tested by importing this module.

export const CATS = ['diarios', 'semanales', 'bancarios'];
export const TYPES = { html: 'html', htm: 'html', pdf: 'pdf', md: 'md', markdown: 'md', txt: 'txt', docx: 'docx', doc: 'docx',
  xlsx: 'xlsx', xls: 'xlsx', pptx: 'pptx', png: 'img', jpg: 'img', jpeg: 'img', webp: 'img' };
const TEXT = new Set(['html', 'md', 'txt']);

export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const extOf = name => (/\.([a-z0-9]+)$/i.exec(name) || [, ''])[1].toLowerCase();
export const typeOf = name => TYPES[extOf(name)] || null;
export const isText = name => TEXT.has(typeOf(name));

const BANK = /\b(goldman|gs|research|jp ?morgan|jpm|morgan stanley|ubs|citi(group|bank)?|bofa|bank of america|merrill|barclays|deutsche|hsbc|nomura|bnp|paribas|soc(iete)? ?gen(erale)?|ing bank|ing think|wells fargo|mufg|credit agricole|scotiabank|td securities|rbc|danske|commerzbank|rabobank|santander|bbva|standard chartered|natwest|unicredit|mizuho|macquarie|jefferies|bancari[oa]s?|research bancario|bank research|sell ?side)\b/g;
const WEEK = /\b(semanal(es)?|weekly|semana|week ahead|week in review|outlook semanal)\b/;
const DAY = /\b(diari[oa]s?|daily|briefing|morning|apertura|cierre del dia|prime terminal)\b/;

// Words of a file name, with separators as spaces: "semanal_2026-11-09.html" → "semanal 2026 11 09 html".
const words = name => norm(name).replace(/[^a-z0-9]+/g, ' ').trim();
const byWords = w => /^(banc|bank|research)/.test(w) ? 'bancarios' : /^(semanal|weekly)/.test(w) ? 'semanales' : /^(diari|daily|briefing)/.test(w) ? 'diarios' : null;
const scan = t => { BANK.lastIndex = 0; return BANK.test(t) ? 'bancarios' : WEEK.test(t) ? 'semanales' : DAY.test(t) ? 'diarios' : null; };

/** Category of a report. Order: name prefix → words in the name → title → body. Default: diarios. */
export function classify(name, text = '') {
  const w = words(name.replace(/\.[a-z0-9]+$/i, ''));
  const pre = byWords(w); if (pre) return { cat: pre, why: 'prefijo del nombre' };
  const inName = scan(w); if (inName) return { cat: inName, why: 'nombre del archivo' };
  if (text) {
    const ti = scan(norm(titleOf(name, text))); if (ti) return { cat: ti, why: 'título' };
    const body = norm(text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, ' ')).slice(0, 20000);
    if (WEEK.test(body.slice(0, 1500))) return { cat: 'semanales', why: 'contenido' };
    if (DAY.test(body.slice(0, 1500))) return { cat: 'diarios', why: 'contenido' };
    // A daily note may quote a bank or two; a bank research digest names them over and over.
    BANK.lastIndex = 0; const hits = (body.match(BANK) || []).length;
    if (hits >= 4) return { cat: 'bancarios', why: `contenido (${hits} menciones de bancos)` };
  }
  return { cat: 'diarios', why: 'sin señales: sección por defecto' };
}

const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
/** Title: <title> or first <h1> (HTML), first heading (Markdown), otherwise the file name. */
export function titleOf(name, text = '') {
  let t = '';
  if (text) {
    const ty = typeOf(name);
    if (ty === 'html') { const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text) || /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text); if (m) t = strip(m[1]); }
    else if (ty === 'md') { const m = /^#{1,2}\s+(.+)$/m.exec(text); if (m) t = m[1].replace(/[*_`#]/g, '').trim(); }
    else if (ty === 'txt') { t = (text.split(/\r?\n/).find(l => l.trim()) || '').trim(); }
  }
  if (!t) t = name.replace(/\.[a-z0-9]+$/i, '').replace(/20\d\d[-_.]?\d\d[-_.]?\d\d|\d\d[-_.]\d\d[-_.]20\d\d/g, ' ').replace(/[-_]+/g, ' ').trim();
  t = t.replace(/\s+/g, ' ');
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 140) || name;
}

const ok = (y, m, d) => y >= 2015 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
/** Date in the file name: YYYY-MM-DD, YYYYMMDD or DD-MM-YYYY (also with _ or .). Null when there is none. */
export function dateOf(name) {
  let m = /(20\d\d)[-_.]?(\d\d)[-_.]?(\d\d)/.exec(name);
  if (m && ok(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d\d)[-_.](\d\d)[-_.](20\d\d)/.exec(name);
  if (m && ok(+m[3], +m[2], +m[1])) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** File name used inside a category folder: date + slug of the original name (without its date). */
export function slugName(name, date) {
  const ext = extOf(name);
  const base = norm(name.replace(/\.[a-z0-9]+$/i, '')).replace(/20\d\d[-_.]?\d\d[-_.]?\d\d|\d\d[-_.]\d\d[-_.]20\d\d/g, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'reporte';
  return `${date}-${base}.${ext}`;
}
