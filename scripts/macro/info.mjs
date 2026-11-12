// Informative cards of Resumen / Cuantitativo (D.snap.info) that FRED publishes: retail sales, PPI final demand,
// ADP private payrolls and real GDP. The ISM components stay as stored (licensed data, loaded by hand).
// Pure: input = previous cards + FRED observations [[date, value], …]. Same wording and thresholds as the original cards.

export const INFO_SERIES = ['RSAFS', 'CPIAUCSL', 'PPIFIS', 'ADPMNUSNERSA', 'GDPC1'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mLab = d => `${MES[+d.slice(5, 7) - 1]}-${d.slice(0, 4)}`;
const qLab = d => `T${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}-${d.slice(0, 4)}`;
const sg = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const back = (obs, n) => obs[obs.length - 1 - n];
// Value of a monthly series at `iso`; a missing month (Oct-2025, shutdown) is interpolated geometrically between its
// neighbours (at most 3 months apart), the same convention as the scorecard and the nowcast.
const mIdx = d => +d.slice(0, 4) * 12 + +d.slice(5, 7);
function baseAt(obs, iso) {
  const e = obs.find(([x]) => x === iso); if (e) return { v: e[1], interp: false };
  const t = mIdx(iso), a = [...obs].reverse().find(([x]) => mIdx(x) < t), b = obs.find(([x]) => mIdx(x) > t);
  if (!a || !b || mIdx(b[0]) - mIdx(a[0]) > 3) return null;
  return { v: a[1] * (b[1] / a[1]) ** ((t - mIdx(a[0])) / (mIdx(b[0]) - mIdx(a[0]))), interp: true };
}
const yoyAt = (obs, i) => { const d = obs[i][0], p = baseAt(obs, `${+d.slice(0, 4) - 1}${d.slice(4)}`); return p ? (obs[i][1] / p.v - 1) * 100 : null; };
const yoyInterp = (obs, i) => { const d = obs[i][0], p = baseAt(obs, `${+d.slice(0, 4) - 1}${d.slice(4)}`); return !!(p && p.interp); };

// ISM components: [key, card name, what it anticipates, rule]. Rule 'up' = ≥ 52 heats / < 48 cools (diffusion index);
// 'deliv' = slower deliveries (> 50) signal strong demand; 'low' = customers' inventories too low (< 50) push future
// production up; 'high' = inventories "too high" (> 50) weigh on future orders.
const ISM = {
  manufactura: [
    ['nuevas_ordenes', 'Nuevas órdenes', 'Pedidos nuevos de manufactura: demanda futura de la industria.', 'up'],
    ['produccion', 'Producción', 'Producción industrial del mes; sobre 52 suele coincidir con alza de la producción industrial de la Fed.', 'up'],
    ['empleo', 'Empleo', 'Contratación en manufactura: adelanta el empleo industrial.', 'up'],
    ['entregas', 'Entregas de proveedores', 'Índice invertido: sobre 50 = entregas más lentas, típico de demanda fuerte o cuellos de botella.', 'deliv'],
    ['inventarios', 'Inventarios', 'Inventarios propios de materias primas.', 'up'],
    ['inventarios_clientes', 'Inventarios de clientes', 'Bajo 50 = "muy bajos": los clientes tendrán que reponer, positivo para la producción futura.', 'low'],
    ['precios', 'Precios', 'Precios que pagan las fábricas: presión de costos que llega al PPI y al CPI.', 'up'],
    ['pedidos_pendientes', 'Pedidos pendientes', 'Órdenes acumuladas sin entregar: sostienen la producción de los próximos meses.', 'up'],
    ['exportaciones', 'Nuevas órdenes de exportación', 'Demanda externa de manufacturas de EE.UU.', 'up'],
    ['importaciones', 'Importaciones', 'Compras de insumos del exterior: actividad y demanda de materiales.', 'up'],
  ],
  servicios: [
    ['actividad', 'Actividad empresarial', 'Producción del sector servicios: el pulso actual del sector más grande.', 'up'],
    ['nuevas_ordenes', 'Nuevas órdenes', 'Demanda futura de servicios.', 'up'],
    ['empleo', 'Empleo', 'Contratación en servicios: adelanta el empleo privado.', 'up'],
    ['entregas', 'Entregas de proveedores', 'Índice invertido: sobre 50 = entregas más lentas.', 'deliv'],
    ['inventarios', 'Inventarios', 'Inventarios de las empresas de servicios.', 'up'],
    ['precios', 'Precios', 'Precios que pagan las empresas de servicios: la inflación más persistente.', 'up'],
    ['pedidos_pendientes', 'Pedidos pendientes', 'Trabajo acumulado sin terminar.', 'up'],
    ['exportaciones', 'Nuevas órdenes de exportación', 'Demanda externa de servicios.', 'up'],
    ['importaciones', 'Importaciones', 'Compras de servicios e insumos del exterior.', 'up'],
    ['sentimiento_inventarios', 'Sentimiento de inventarios', 'Sobre 50 = las empresas sienten sus inventarios "muy altos": frena pedidos futuros.', 'high'],
  ],
};
const RULES = {
  up: { st: v => (v >= 52 ? 'hot' : v < 48 ? 'cold' : 'flat'), stable: '48–51.9', hot: '≥ 52', cold: '< 48' },
  deliv: { st: v => (v >= 52 ? 'hot' : v < 48 ? 'cold' : 'flat'), stable: '48–51.9', hot: '≥ 52 (más lentas)', cold: '< 48 (más rápidas)' },
  low: { st: v => (v < 45 ? 'hot' : v > 55 ? 'cold' : 'flat'), stable: '45–55', hot: '< 45 (muy bajos)', cold: '> 55 (muy altos)' },
  high: { st: v => (v > 55 ? 'cold' : v < 45 ? 'hot' : 'flat'), stable: '45–55', hot: '< 45 (muy bajos)', cold: '> 55 (muy altos)' },
};
export function ismCards(ic) {
  const lab = mLab(`${ic.periodo}-01`), p = ic.previo || {}, plab = p.periodo ? MES[+p.periodo.slice(5, 7) - 1] : '';
  const cards = [];
  for (const [sector, list] of Object.entries(ISM)) for (const [k, nm, what, rule] of list) {
    const v = (ic[sector] || {})[k]; if (typeof v !== 'number' || v < 10 || v > 95) continue;
    const pv = (p[sector] || {})[k], R = RULES[rule];
    cards.push({ side: 'Líder', block: 'Componentes ISM', name: `ISM ${sector === 'manufactura' ? 'Manufactura' : 'Servicios'} · ${nm}`, val: v.toFixed(1),
      prev: typeof pv === 'number' ? `${plab} ${pv.toFixed(1)} (${Math.abs(v - pv) < 0.05 ? 'sin cambio' : `${v > pv ? '+' : '−'}${Math.abs(v - pv).toFixed(1)}`})` : '', date: lab, what,
      state: R.st(v), stable: R.stable, hot: R.hot, cold: R.cold, pts: null, src: 'ISM (captura manual)' });
  }
  return cards;
}

export function buildInfo(prev, O, manual) {
  const out = prev.map(c => ({ ...c }));
  const set = (prefix, f) => { const c = out.find(x => x.name.startsWith(prefix)); if (c) Object.assign(c, f(c)); };

  // ISM components (licensed): data/manual.json → ism_componentes {periodo, manufactura, servicios, previo}. The cards
  // are rebuilt from the capture every run, all 21 components of both reports.
  const ic = manual && manual.ism_componentes;
  if (ic && /^\d{4}-\d{2}$/.test(ic.periodo || '') && ic.manufactura) {
    const cards = ismCards(ic);
    const rest = out.filter(c => c.block !== 'Componentes ISM');
    out.length = 0; out.push(...cards, ...rest);
  }

  const R = O.RSAFS, C = O.CPIAUCSL;
  if (R && R.length > 13) {
    const i = R.length - 1, mm = (R[i][1] / R[i - 1][1] - 1) * 100, yy = yoyAt(R, i);
    const ci = C && C.findIndex(([d]) => d === R[i][0]), cy = ci >= 0 ? yoyAt(C, ci) : null;
    const real = yy != null && cy != null ? ((1 + yy / 100) / (1 + cy / 100) - 1) * 100 : null;
    set('Ventas minoristas', () => ({ val: `${sg(mm)}%`, prev: `a/a ${sg(yy)}%${real != null ? ` · real ${sg(real)}%` : ''}`, date: mLab(R[i][0]),
      state: mm > 0.4 ? 'hot' : mm < 0 ? 'cold' : 'flat', src: 'FRED RSAFS' }));
  }
  // CPI general (all items): informative, the score already carries core CPI. Inserted before the PPI card.
  if (C && C.length > 13) {
    if (!out.some(x => x.name.startsWith('CPI general'))) {
      const at = out.findIndex(x => x.name.startsWith('PPI general'));
      out.splice(at < 0 ? out.length : at, 0, { side: 'Coincidente', block: 'Inflación', name: 'CPI general · a/a',
        what: 'Precios al consumidor con alimentos y energía, variación anual: el dato de inflación que mueve titulares y expectativas. No pondera: el core CPI ya está en el puntaje.',
        stable: '2–2.9%', hot: '≥ 3%', cold: '< 2%', pts: null, src: '' });
    }
    const i = C.length - 1, yy = yoyAt(C, i), mm = (C[i][1] / C[i - 1][1] - 1) * 100, py = yoyAt(C, i - 1);
    if (yy != null) set('CPI general', () => ({ val: `${sg(yy)}%`, prev: `m/m ${sg(mm)}%${py != null ? ` · ${MES[+C[i - 1][0].slice(5, 7) - 1]} ${sg(py)}%` : ''}${yoyInterp(C, i) ? ' · base interpolada (oct-2025 sin dato)' : ''}`,
      date: mLab(C[i][0]), state: yy >= 3 ? 'hot' : yy < 2 ? 'cold' : 'flat', src: 'FRED CPIAUCSL' }));
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
