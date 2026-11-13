// Report library: files dropped in reports/entrada/ are classified (diarios, semanales, bancarios), renamed with
// their date and moved to their folder; then data/reports.json is rebuilt from the three folders.
// Runs in .github/workflows/reports.yml on every push that touches reports/. Local run: node scripts/reports/update.mjs
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { CATS, classify, titleOf, dateOf, slugName, typeOf, isText } from './core.mjs';

const ROOT = 'reports', INBOX = path.join(ROOT, 'entrada'), OUT = 'data/reports.json';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
const skip = f => f.startsWith('.') || /^readme\.md$/i.test(f);
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
// Date the file entered the repository; empty when it is not committed yet or git is not available.
const gitDate = p => { try { return execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%cs', '-1', '--', p], { encoding: 'utf8' }).trim(); } catch (e) { return ''; } };

for (const d of [INBOX, ...CATS.map(c => path.join(ROOT, c))]) fs.mkdirSync(d, { recursive: true });

// 1) Inbox → category folder.
let moved = 0;
for (const f of fs.readdirSync(INBOX)) {
  const src = path.join(INBOX, f);
  if (skip(f) || !fs.statSync(src).isFile()) continue;
  if (!typeOf(f)) { console.log(`Se deja en entrada (tipo no admitido): ${f}`); continue; }
  const text = isText(f) ? read(src) : '';
  const { cat, why } = classify(f, text), date = dateOf(f) || today();
  let name = slugName(f, date), n = 2;
  while (fs.existsSync(path.join(ROOT, cat, name))) name = slugName(f, date).replace(/(\.[a-z0-9]+)$/, `-${n++}$1`);
  fs.renameSync(src, path.join(ROOT, cat, name));
  console.log(`${f} → ${cat}/${name} (${why})`);
  moved++;
}

// 2) Index of the three folders. A file placed by hand in a folder keeps that folder.
const items = [];
for (const cat of CATS) {
  for (const f of fs.readdirSync(path.join(ROOT, cat))) {
    const p = path.join(ROOT, cat, f);
    if (skip(f) || !fs.statSync(p).isFile() || !typeOf(f)) continue;
    const text = isText(f) ? read(p) : '';
    items.push({ id: `${cat}/${f}`, cat, title: titleOf(f, text), date: dateOf(f) || gitDate(p) || today(),
      file: `${ROOT}/${cat}/${f}`, type: typeOf(f), kb: Math.max(1, Math.round(fs.statSync(p).size / 1024)) });
  }
}
items.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'es'));

let prev = null; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
if (prev && JSON.stringify(prev.items) === JSON.stringify(items)) console.log(`Índice sin cambios (${items.length} reportes).`);
else {
  fs.writeFileSync(OUT, JSON.stringify({ asof: new Date().toISOString(), items }, null, 1) + '\n');
  console.log(`Índice actualizado: ${items.length} reportes (${CATS.map(c => `${c} ${items.filter(i => i.cat === c).length}`).join(', ')}); ${moved} clasificados ahora.`);
}
