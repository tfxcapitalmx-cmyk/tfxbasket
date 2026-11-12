// Informative cards of Resumen / Cuantitativo (D.snap.info) that FRED publishes: retail sales, PPI final demand,
// ADP private payrolls and real GDP. The ISM components stay as stored (licensed data, loaded by hand).
// Pure: input = previous cards + FRED observations [[date, value], …]. Same wording and thresholds as the original cards.

export const INFO_SERIES = ['RSAFS', 'CPIAUCSL', 'PPIFIS', 'ADPMNUSNERSA', 'GDPC1'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mLab = d => `${MES[+d.slice(5, 7) - 1]}-${d.slice(0, 4)}`;
const qLab = d => `T${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}-${d.slice(0, 4)}`;
const sg = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const back = (obs, n) => obs[obs.length - 1 - n];
const yoyAt = (obs, i) => { const d = obs[i][0], p = obs.find(([x]) => x === `${+d.slice(0, 4) - 1}${d.slice(4)}`); return p ? (obs[i][1] / p[1] - 1) * 100 : null; };

export function buildInfo(prev, O, manual) {
  const out = prev.map(c => ({ ...c }));
  const set = (prefix, f) => { const c = out.find(x => x.name.startsWith(prefix)); if (c) Object.assign(c, f(c)); };

  // ISM components (licensed): data/manual.json → ism_componentes. When the period advances, the stored reading
  // becomes the previous one. Same thresholds as the original cards (≥ 52 expansion, < 48 contraction).
  const ic = manual && manual.ism_componentes;
  if (ic && /^\d{4}-\d{2}$/.test(ic.periodo || '')) {
    const lab = mLab(`${ic.periodo}-01`), st = v => (v >= 52 ? 'hot' : v < 48 ? 'cold' : 'flat');
    for (const [prefix, k] of [['ISM Manufactura · Nuevas', 'nuevas_ordenes'], ['ISM Manufactura · Empleo', 'empleo'], ['ISM Manufactura · Precios', 'precios'], ['ISM Servicios · Actividad', 'servicios_actividad']]) {
      const v = ic[k]; if (typeof v !== 'number' || v < 20 || v > 90) continue;
      set(prefix, c => (c.date === lab ? { val: v.toFixed(1), state: st(v) }
        : { val: v.toFixed(1), prev: `${c.date.slice(0, 3)} ${c.val}`, date: lab, state: st(v), src: 'ISM (captura manual)' }));
    }
  }

  const R = O.RSAFS, C = O.CPIAUCSL;
  if (R && R.length > 13) {
    const i = R.length - 1, mm = (R[i][1] / R[i - 1][1] - 1) * 100, yy = yoyAt(R, i);
    const ci = C && C.findIndex(([d]) => d === R[i][0]), cy = ci >= 0 ? yoyAt(C, ci) : null;
    const real = yy != null && cy != null ? ((1 + yy / 100) / (1 + cy / 100) - 1) * 100 : null;
    set('Ventas minoristas', () => ({ val: `${sg(mm)}%`, prev: `a/a ${sg(yy)}%${real != null ? ` · real ${sg(real)}%` : ''}`, date: mLab(R[i][0]),
      state: mm > 0.4 ? 'hot' : mm < 0 ? 'cold' : 'flat', src: 'FRED RSAFS' }));
  }
  const P = O.PPIFIS;
  if (P && P.length > 2) {
    const mm = k => (back(P, k)[1] / back(P, k + 1)[1] - 1) * 100, v = mm(0);
    set('PPI general', () => ({ val: `${sg(v)}%`, prev: `${MES[+back(P, 1)[0].slice(5, 7) - 1]} ${sg(mm(1))}%`, date: mLab(back(P, 0)[0]),
      state: v > 0.3 ? 'hot' : v < 0 ? 'cold' : 'flat', src: 'FRED PPIFIS' }));
  }
  const A = O.ADPMNUSNERSA;   // thousands of jobs (level)
  if (A && A.length > 2) {
    const ch = k => (back(A, k)[1] - back(A, k + 1)[1]) / 1000, v = ch(0);
    set('ADP', () => ({ val: `${sg(v, 0)}k`, prev: `${MES[+back(A, 1)[0].slice(5, 7) - 1]} ${sg(ch(1), 0)}k`, date: mLab(back(A, 0)[0]),
      state: v >= 310 ? 'hot' : v < 151 ? 'cold' : 'flat', src: 'FRED ADPMNUSNERSA' }));
  }
  const G = O.GDPC1;
  if (G && G.length > 5) {
    const i = G.length - 1, qq = ((G[i][1] / G[i - 1][1]) ** 4 - 1) * 100, yy = (G[i][1] / G[i - 4][1] - 1) * 100, q = qLab(G[i][0]);
    const st = v => (v >= 2 ? ['hot', 1] : v < 1 ? ['cold', -1] : ['flat', 0]);
    set('PIB real · t/t', () => ({ val: `${sg(qq)}%`, prev: `a/a ${sg(yy)}%`, date: q, state: st(qq)[0], pts: st(qq)[1], src: 'FRED GDPC1' }));
    set('PIB real · a/a', () => ({ val: `${sg(yy)}%`, prev: q, date: q, state: st(yy)[0], pts: st(yy)[1], src: 'FRED GDPC1' }));
  }
  return out;
}

export function validateInfo(info) {
  const e = [];
  if (!Array.isArray(info) || info.length < 9) e.push('faltan tarjetas informativas');
  for (const c of info || []) {
    if (!c.val || !/\d/.test(c.val)) e.push(`${c.name}: sin valor`);
    if (!/^([a-z]{3}|T[1-4])-\d{4}$/.test(c.date || '')) e.push(`${c.name}: fecha inválida (${c.date})`);
    if (!['hot', 'cold', 'flat'].includes(c.state)) e.push(`${c.name}: estado inválido`);
  }
  return e;
}
