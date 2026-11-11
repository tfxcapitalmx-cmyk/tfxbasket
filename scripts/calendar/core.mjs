// Catalizador → agenda económica de EE.UU. Pure: no network, no disk.
// Dates: FRED release dates (official, from each agency), ISM by business-day rule, FOMC from scripts/calendar/fomc.json.
// Actual / previous: FRED observations (current vintage); "(rev.)" when the previous period no longer matches what this
// calendar recorded when it was published. Consensus and the exact time of the current week: ForexFactory weekly feed
// (unofficial, personal use; see docs/data-sources.md). ISM and UMich actuals: data/manual.json (licensed data).

export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const RELEASES = { cpi: 10, ppi: 46, retail: 9, nfp: 50, claims: 180, gdp: 53, pce: 54, eci: 11, jolts: 192 };
export const SERIES = ['CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PPIFES', 'RSAFS', 'PAYEMS', 'UNRATE', 'ICSA', 'GDPC1', 'PCEPI', 'ECIALLCIV', 'JTSJOL', 'DFEDTARL', 'DFEDTARU'];

// key → items published together. calc: mm (m/m %), yy (a/a %), diff (change, thousands), lvl, qqa (q/q annualized %), qq (q/q %).
// fmt: how the original agenda wrote each value. ff: ForexFactory title(s) of the same figure.
const SPECS = {
  cpi: { et: '08:30', lag: 1, items: [
    { name: 'CPI m/m', id: 'CPIAUCSL', calc: 'mm', fmt: 'pct', major: true, ff: ['CPI m/m'] },
    { name: 'CPI core m/m', id: 'CPILFESL', calc: 'mm', fmt: 'pct', ff: ['Core CPI m/m'] },
    { name: 'CPI a/a', id: 'CPIAUCSL', calc: 'yy', fmt: 'pct', ff: ['CPI y/y'] },
    { name: 'CPI core a/a', id: 'CPILFESL', calc: 'yy', fmt: 'pct', ff: ['Core CPI y/y'] }] },
  ppi: { et: '08:30', lag: 1, items: [
    { name: 'PPI m/m', id: 'PPIFIS', calc: 'mm', fmt: 'spct', major: true, ff: ['PPI m/m'] },
    { name: 'PPI core m/m', id: 'PPIFES', calc: 'mm', fmt: 'spct', ff: ['Core PPI m/m'] }] },
  retail: { et: '08:30', lag: 1, items: [{ name: 'Ventas minoristas m/m', id: 'RSAFS', calc: 'mm', fmt: 'spct', major: true, ff: ['Retail Sales m/m'] }] },
  nfp: { et: '08:30', lag: 1, items: [
    { name: 'Nóminas no agrícolas (NFP)', id: 'PAYEMS', calc: 'diff', fmt: 'sk', major: true, ff: ['Non-Farm Employment Change'] },
    { name: 'Tasa de desempleo', key: 'un', id: 'UNRATE', calc: 'lvl', fmt: 'pct', ff: ['Unemployment Rate'] }] },
  claims: { et: '08:30', weekly: true, items: [{ name: 'Solicitudes iniciales', id: 'ICSA', calc: 'lvl', fmt: 'k', ff: ['Unemployment Claims'] }] },
  gdp: { et: '08:30', quarterly: true, items: [{ name: 'PIB t/t anualizado', id: 'GDPC1', calc: 'qqa', fmt: 'spct', major: true, ff: ['Advance GDP q/q', 'Prelim GDP q/q', 'Final GDP q/q'] }] },
  pce: { et: '08:30', lag: 1, items: [{ name: 'PCE deflactor a/a', id: 'PCEPI', calc: 'yy', fmt: 'pct', major: true, ff: ['PCE Price Index y/y'] }] },
  eci: { et: '08:30', quarterly: true, items: [{ name: 'Costo del empleo (ECI)', id: 'ECIALLCIV', calc: 'qq', fmt: 'spct', ff: ['Employment Cost Index q/q'] }] },
  jolts: { et: '10:00', lag: 2, items: [{ name: 'Vacantes JOLTS', id: 'JTSJOL', calc: 'lvl', fmt: 'M', ff: ['JOLTS Job Openings'] }] },
  ism: { et: '10:00', lag: 1, bday: 1, items: [{ name: 'ISM manufactura', manual: 'pmi', fmt: 'idx', major: true, ff: ['ISM Manufacturing PMI'] }] },
  nmi: { et: '10:00', lag: 1, bday: 3, items: [{ name: 'ISM servicios', manual: 'nmi', fmt: 'idx', major: true, ff: ['ISM Services PMI'] }] },
  umich: { et: '10:00', lag: 0, ffOnly: true, items: [{ name: 'Sentimiento UMich (prel.)', manual: 'umcsi', fmt: 'idx', ff: ['Prelim UoM Consumer Sentiment'] }] },
  lei: { et: '10:00', lag: 1, ffOnly: true, items: [{ name: 'LEI Conference Board', fmt: 'spct', ff: ['CB Leading Index m/m'] }] },
  fomc: { et: '14:00', items: [{ name: 'Decisión FOMC', fmt: 'range', major: true, ff: ['Federal Funds Rate'] }] },
};
const FF_TITLE = {};
for (const [key, s] of Object.entries(SPECS)) for (const it of s.items) for (const t of it.ff) FF_TITLE[t] = [key, it];

// ---------- dates ----------
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T12:00:00Z') + n * 864e5));
export function shiftMonth(p, n) { let y = +p.slice(0, 4), m = +p.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; }
// US daylight saving: second Sunday of March to first Sunday of November.
function nthSunday(y, m, n) { const d = new Date(Date.UTC(y, m, 1)); return 1 + ((7 - d.getUTCDay()) % 7) + (n - 1) * 7; }
export function etToUtc(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  const dst = (m > 3 && m < 11) || (m === 3 && d >= nthSunday(y, 2, 2)) || (m === 11 && d < nthSunday(y, 10, 1));
  return new Date(Date.UTC(y, m - 1, d, h + (dst ? 4 : 5), mi)).toISOString().replace('.000Z', 'Z');
}
// n-th business day of a month (weekends, New Year's Day and Labor Day skipped), as ISM publishes.
function businessDay(p, n) {
  const [y, m] = p.split('-').map(Number), labor = m === 9 ? nthMonday(y, 8, 1) : 0;
  let d = 0, c = 0;
  while (c < n) { d++; const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); if (wd === 0 || wd === 6 || (m === 1 && d === 1) || d === labor) continue; c++; }
  return `${p}-${String(d).padStart(2, '0')}`;
}
function nthMonday(y, m, n) { const d = new Date(Date.UTC(y, m, 1)); return 1 + ((8 - d.getUTCDay()) % 7) + (n - 1) * 7; }
const qLabel = p => `T${Math.floor((+p.slice(5, 7) - 1) / 3) + 1}`;
// Reference period of a release published on `date`.
function refOf(key, s, date) {
  const p = date.slice(0, 7);
  if (s.weekly) return { refp: addDays(date, -5), ref: 'semana' };            // week ending the Saturday before
  if (key === 'fomc') return { refp: p, ref: MES[+p.slice(5, 7) - 1] };
  if (s.quarterly) { const m = +p.slice(5, 7), qEnd = shiftMonth(p, -(((m - 1) % 3) + 1)); return { refp: shiftMonth(qEnd, -2), ref: qLabel(qEnd), est: (m - 1) % 3 }; }
  const r = shiftMonth(p, -s.lag); return { refp: r, ref: MES[+r.slice(5, 7) - 1] };
}

// ---------- values ----------
const NUM = { '−': '-' };
export function parseNum(s) { if (s == null || s === '') return null; const m = String(s).replace('−', '-').match(/-?\d+(\.\d+)?/); return m ? +m[0] * (/k$/i.test(String(s).trim()) ? 1 : 1) : null; }
const sgn = (v, d) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(d);
const neg = (v, d) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export function fmt(kind, v) {
  if (v == null || !Number.isFinite(v)) return '';
  switch (kind) {
    case 'pct': return `${neg(v, 1)}%`;
    case 'spct': return `${sgn(v, 1)}%`;
    case 'sk': return `${sgn(Math.round(v), 0)}k`;
    case 'k': return `${Math.round(v / 1000)}k`;
    case 'M': return `${(v / 1000).toFixed(2)}M`;
    case 'idx': return v.toFixed(1);
    default: return String(v);
  }
}
// ForexFactory forecast ("0.3%", "194K", "7.20M", "50K") → number in the same unit as the FRED calculation.
function ffValue(it, s) {
  const v = parseNum(s); if (v == null) return null;
  if (it.fmt === 'k') return v * 1000;            // claims: FRED in persons
  if (it.fmt === 'M') return v * 1000;            // JOLTS: FRED in thousands
  return v;                                       // %, thousands (NFP), index
}
const obsMap = o => new Map((o || []).map(([d, v]) => [d.slice(0, 10), v]));
function calcAt(it, M, refp, weekly) {
  const k = weekly ? refp : `${refp}-01`, v = M.get(k); if (v == null) return null;
  const at = n => M.get(weekly ? addDays(refp, -7 * n) : `${shiftMonth(refp, -n)}-01`);
  switch (it.calc) {
    case 'mm': { const p = at(1); return p ? (v / p - 1) * 100 : null; }
    case 'yy': { const p = at(12); return p ? (v / p - 1) * 100 : null; }
    case 'diff': { const p = at(1); return p != null ? v - p : null; }
    case 'qqa': { const p = at(3); return p ? ((v / p) ** 4 - 1) * 100 : null; }
    case 'qq': { const p = at(3); return p ? (v / p - 1) * 100 : null; }
    default: return v;
  }
}
const prevPeriod = (it, s, refp) => (s.weekly ? addDays(refp, -7) : shiftMonth(refp, s.quarterly ? -3 : -1));

/**
 * @param o.dates   { cpi: ['2026-11-10', …], … } FRED release dates (RELEASES)
 * @param o.obs     { CPIAUCSL: [[date, value], …], … } FRED observations (SERIES)
 * @param o.ff      ForexFactory weekly feed (array) or null
 * @param o.manual  data/manual.json
 * @param o.fomc    ['2026-12-09', …]
 * @param o.prev    previous data/calendar.json events (or the hand-built agenda) to keep consensus and published values
 * @param o.now     ISO timestamp
 */
export function buildCalendar({ dates, obs, ff, manual, fomc, prev = [], now }) {
  const nowMs = Date.parse(now), from = addDays(now.slice(0, 10), -60), to = addDays(now.slice(0, 10), 120);
  const M = {}; for (const id of SERIES) M[id] = obsMap(obs[id]);
  const ev = new Map();
  const add = (key, s, it, date, refx, extra = {}) => {
    const r = refx || refOf(key, s, date);
    const name = s.quarterly && key === 'gdp' ? `${it.name} (${['avance', '2ª est.', 'final'][r.est]})` : it.name;
    const id = `${it.key || key}|${it.name}|${r.refp}`;
    if (ev.has(id)) return ev.get(id);
    const e = { id, t: etToUtc(date, s.et), key: it.key || key, name, ref: r.ref, refp: r.refp, country: 'Estados Unidos', major: !!it.major, actual: '', cons: '', prev: '', _it: it, _s: s, ...extra };
    ev.set(id, e); return e;
  };

  // 1. Official schedule.
  for (const [key, rid] of Object.entries(RELEASES)) for (const d of dates[key] || []) if (d >= from && d <= to) for (const it of SPECS[key].items) add(key, SPECS[key], it, d);
  for (const key of ['ism', 'nmi']) for (let n = -2; n <= 4; n++) {
    const d = businessDay(shiftMonth(now.slice(0, 7), n), SPECS[key].bday);
    if (d >= from && d <= to) add(key, SPECS[key], SPECS[key].items[0], d);
  }
  for (const d of fomc) if (d >= from && d <= to) add('fomc', SPECS.fomc, SPECS.fomc.items[0], d);

  // 2. ForexFactory: exact time of this week (holiday moves) and consensus; adds the events FRED does not schedule.
  for (const f of ff || []) {
    if (f.country !== 'USD' || !FF_TITLE[f.title]) continue;
    const [key, it] = FF_TITLE[f.title], s = SPECS[key], t = new Date(f.date).toISOString().replace('.000Z', 'Z'), day = t.slice(0, 10);
    let e = [...ev.values()].find(x => x._it === it && Math.abs(Date.parse(x.t.slice(0, 10)) - Date.parse(day)) <= 3 * 864e5);
    if (!e) e = add(key, s, it, new Date(new Date(f.date).getTime() - 5 * 3600e3).toISOString().slice(0, 10));
    e.t = t;
    if (f.forecast) { const v = it.fmt === 'range' ? null : ffValue(it, f.forecast); e.cons = it.fmt === 'range' ? f.forecast : fmt(it.fmt, v); }
    if (!e.prev && f.previous && it.fmt !== 'range') e.ffprev = fmt(it.fmt, ffValue(it, f.previous));
  }

  // 3. Actual and previous from FRED (and the manual capture for ISM / UMich), keeping what earlier runs recorded.
  const old = new Map(prev.map(p => [p.id || legacyId(p), p]));
  const published = new Map();   // item name + period → value as first published (for "(rev.)")
  for (const p of prev) if (p.actual) { const [, item, refp] = (p.id || legacyId(p)).split('|'); published.set(`${item}|${refp}`, p.actual); }
  for (const e of ev.values()) {
    const it = e._it, s = e._s, o = old.get(e.id);
    if (o && o.cons && !e.cons) e.cons = o.cons;
    const due = Date.parse(e.t) <= nowMs;
    if (it.id) {
      const a = calcAt(it, M[it.id], e.refp, s.weekly), pv = calcAt(it, M[it.id], prevPeriod(it, s, e.refp), s.weekly);
      // A past event keeps the value as first published; the revision shows up as "(rev.)" in the next one.
      if (due && a != null) e.actual = (o && o.actual) || fmt(it.fmt, a);
      if (pv != null) {
        e.prev = fmt(it.fmt, pv);
        const first = published.get(`${it.name}|${prevPeriod(it, s, e.refp)}`);
        if (first && first.replace(/ \(rev\.\)$/, '') !== e.prev) e.prev += ' (rev.)';
      }
    } else if (it.manual && manual && manual[it.manual]) {
      const m = manual[it.manual];
      if (due && m.periodo === e.refp) e.actual = fmt(it.fmt, m.valor);
    } else if (it.fmt === 'range') {
      const range = d => { const lo = lastOn(M.DFEDTARL, d), hi = lastOn(M.DFEDTARU, d); return lo != null && hi != null ? `${lo.toFixed(2)}–${hi.toFixed(2)}%` : ''; };
      const day = e.t.slice(0, 10);
      e.prev = range(addDays(day, -1));
      if (due && M.DFEDTARU.has(addDays(day, 1))) e.actual = range(addDays(day, 1));
    }
    if (!e.actual && o && o.actual && due) e.actual = o.actual;
    if (!e.prev && o && o.prev) e.prev = o.prev;
    if (!e.prev && e.ffprev) e.prev = e.ffprev;
    // The previous period of an item that has no FRED series comes from the event before it.
    if (!e.prev && !it.id && it.fmt !== 'range') { const b = [...ev.values()].filter(x => x._it === it && x.t < e.t).sort((x, y) => (x.t < y.t ? 1 : -1))[0]; if (b && b.actual) e.prev = b.actual; }
  }
  // Events from earlier runs inside the window that the sources no longer list (e.g. a past FF-only event) are kept.
  for (const p of prev) { const id = p.id || legacyId(p); if (!ev.has(id) && p.t >= from + 'T' && p.t <= to + 'T23:59Z') ev.set(id, { ...p, id }); }

  const events = [...ev.values()].map(({ _it, _s, ffprev, ...e }) => e).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.name < b.name ? -1 : 1));
  return { asof: now, events };
}
function lastOn(M, d) { let v = null; for (const [k, x] of M) if (k <= d) v = x; return v; }
// The hand-built agenda had no ids: rebuild them from the release date (same rules as above).
export function legacyId(p) {
  const s = SPECS[p.key] || SPECS[p.key === 'un' ? 'nfp' : 'cpi'], it = (s.items.find(i => p.name.startsWith(i.name)) || s.items[0]);
  const r = refOf(p.key === 'un' ? 'nfp' : p.key, s, p.t.slice(0, 10));
  return `${p.key}|${it.name}|${r.refp}`;
}

export function validateCalendar(cal, now) {
  const e = [], ev = cal.events, nowMs = Date.parse(now);
  if (!Array.isArray(ev) || ev.length < 20) e.push(`agenda con solo ${ev ? ev.length : 0} eventos`);
  const ids = new Set();
  for (const x of ev || []) {
    if (!x.id || ids.has(x.id)) e.push(`evento duplicado o sin id: ${x.id}`); ids.add(x.id);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(x.t || '')) e.push(`${x.id}: fecha inválida (${x.t})`);
    if (!x.name || !x.key || !x.ref) e.push(`${x.id}: faltan campos`);
  }
  const fut = (ev || []).filter(x => Date.parse(x.t) > nowMs);
  for (const k of ['cpi', 'nfp']) if (!fut.some(x => x.key === k && Date.parse(x.t) - nowMs < 45 * 864e5)) e.push(`no hay ${k.toUpperCase()} en los próximos 45 días`);
  if (fut.length < 10) e.push(`solo ${fut.length} eventos futuros`);
  return e;
}
