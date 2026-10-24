// Gráficos module — monthly chart series rebuilt from FRED (+ manual ISM / UMich) and merged onto the stored history.
// Pure: input is the same observations the scorecard uses, the previous charts and the scorecard rows.

export const CHART_SERIES = ['T10Y2Y', 'GDPC1', 'RSAFS', 'SP500', 'FEDFUNDS'];

// Scorecard row that gives each chart its current state. Charts without a row have no rule yet.
const ROW = {
  pmi: 'ISM Manufactura (PMI)', nmi: 'ISM Servicios (NMI)', cli: 'OECD CLI (EE.UU.)', umcsi: 'Sentimiento del consumidor (UMCSI)',
  mich: 'Expectativa de inflación 1 año (UMich)', be5: 'Inflación implícita 5 años', d2: 'UST 2 años · cambio 6m', d10: 'UST 10 años · cambio 6m',
  m2: 'Masa monetaria M2 a/a', real: 'Tasa real (Fed funds − core a/a)', corey: 'Core CPI a/a', unrate: 'Desempleo · cambio 12m (prom. 3m)',
  nfp3: 'Nóminas NFP · promedio 3 meses', claims: 'Solicitudes iniciales · 4 sem vs 52 sem', wti: 'Petróleo WTI a/a', permits: 'Permisos de construcción',
};
// Wording family of each chart: activity, inflation or financial conditions.
const FAM = { cpiy: 'I', corey: 'I', ppicy: 'I', mich: 'I', be5: 'I', wti: 'I', real: 'F', d2: 'F', d10: 'F', m2: 'F', curve: 'F', ff: 'F' };
const SLAB = { A: ['Expansión', 'Neutral', 'Contracción'], I: ['Calentamiento', 'Estable', 'Enfriamiento'], F: ['Restrictiva', 'Neutral', 'Expansiva'] };

// Months of stored history that are recomputed on every run, so revisions reach the charts.
export const REFRESH_MONTHS = 36;

const ym = d => d.slice(0, 7);
const r3 = x => Math.round(x * 1000) / 1000;
function shift(k, n) { let y = +k.slice(0, 4), m = +k.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; }
const mon = o => { const m = {}; for (const [d, v] of o) m[ym(d)] = v; return m; }; // last observation of each month
const mAvg = o => { const s = {}, n = {}; for (const [d, v] of o) { const k = ym(d); s[k] = (s[k] || 0) + v; n[k] = (n[k] || 0) + 1; } const m = {}; for (const k in s) m[k] = s[k] / n[k]; return m; };
const yoy = m => { const r = {}; for (const k in m) { const p = m[shift(k, -12)]; if (p) r[k] = (m[k] / p - 1) * 100; } return r; };
const map = (m, f) => { const r = {}; for (const k in m) { const v = f(m[k], k); if (v != null && Number.isFinite(v)) r[k] = v; } return r; };
const withManual = (m, man) => (man ? { ...m, [man.periodo]: man.valor } : m);

// Same definitions as the original generator (checked month by month against it).
export function computeCharts(O, man) {
  const C = {};
  C.pmi = withManual({}, man.pmi);
  C.nmi = withManual({}, man.nmi);
  C.cli = mon(O.USALOLITOAASTSAM);
  // UMich: FRED is a month late; a newer manual (preliminary) reading is added on top.
  C.umcsi = withManual(mon(O.UMCSENT), man.umcsi);
  C.mich = withManual(mon(O.MICH), man.mich);
  C.be5 = mAvg(O.T5YIE); C.d2 = mAvg(O.DGS2); C.d10 = mAvg(O.DGS10); C.curve = mAvg(O.T10Y2Y);
  C.m2 = yoy(mon(O.M2SL));
  // Fed funds: official monthly average, except the latest published month, which shows today's effective rate.
  C.ff = mon(O.FEDFUNDS);
  C.ff[Object.keys(C.ff).sort().pop()] = O.DFF[O.DFF.length - 1][1];
  C.cpiy = yoy(mon(O.CPIAUCSL)); C.corey = yoy(mon(O.CPILFESL)); C.ppicy = yoy(mon(O.PPIFES));
  C.real = map(C.ff, (v, k) => (C.corey[k] != null ? v - C.corey[k] : null));
  C.unrate = mon(O.UNRATE);
  const pay = mon(O.PAYEMS);
  C.nfp3 = map(pay, (v, k) => (pay[shift(k, -3)] != null ? (v - pay[shift(k, -3)]) / 3 : null));
  C.claims = map(mAvg(O.ICSA), v => v / 1000);
  C.gdpy = yoy(mon(O.GDPC1));
  C.wti = mAvg(O.DCOILWTICO);
  C.permits = mon(O.PERMIT);
  const rs = mon(O.RSAFS), cpi = mon(O.CPIAUCSL);
  C.retail = map(rs, v => v / 1000);
  C.retailr = yoy(map(rs, (v, k) => (cpi[k] ? v / cpi[k] : null)));
  C.spx = mon(O.SP500); C.spxy = yoy(C.spx);
  return C;
}

// Stored history is kept; the last REFRESH_MONTHS are replaced by fresh values and newer months are appended.
export function mergeCharts(prev, C, rows) {
  const out = {};
  for (const [k, P] of Object.entries(prev)) {
    const m = {}; P.s.d.forEach((d, i) => { m[d] = P.s.v[i]; });
    const fresh = C[k] || {}, last = Object.keys(fresh).sort().pop() || P.s.d[P.s.d.length - 1];
    const from = shift(last, -REFRESH_MONTHS);
    for (const [d, v] of Object.entries(fresh)) if (d >= from && Number.isFinite(v)) m[d] = r3(v);
    const d = Object.keys(m).sort();
    const row = ROW[k] && rows.find(r => r.name === ROW[k]);
    const fam = SLAB[FAM[k] || 'A'], pts = row ? row.pts : null;
    out[k] = {
      ...P, s: { d, v: d.map(x => m[x]) }, pts,
      state: pts == null ? null : pts > 0 ? 'Crecimiento' : pts < 0 ? 'Contracción' : 'Neutral',
      slab: pts == null ? 'Sin regla definida' : pts > 0 ? fam[0] : pts < 0 ? fam[2] : fam[1],
    };
  }
  return out;
}

export function validateCharts(next, prev) {
  const err = [];
  for (const [k, X] of Object.entries(next)) {
    const { d, v } = X.s;
    if (d.length < (prev[k] ? prev[k].s.d.length : 1)) err.push(`${k}: el historial se acortó`);
    if (d.some((x, i) => i && x <= d[i - 1])) err.push(`${k}: meses fuera de orden`);
    if (v.some(x => !Number.isFinite(x))) err.push(`${k}: valores no numéricos`);
    if (prev[k] && d[d.length - 1] < prev[k].s.d[prev[k].s.d.length - 1]) err.push(`${k}: el último mes retrocedió`);
  }
  return err;
}
