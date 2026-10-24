// TFX macro scorecard — pure transforms shared by the Node updater and the browser tests.
// Input: FRED observations per series ([[ 'YYYY-MM-DD', number ], ...] oldest first) + data/manual.json.
// Output: the fields of D.snap that Resumen and Cuantitativo read (rows, blocks, sub, composite, …).

export const SERIES = ['CPILFESL', 'CPIAUCSL', 'PPIFES', 'UNRATE', 'ICSA', 'PAYEMS', 'USALOLITOAASTSAM', 'UMCSENT',
  'PERMIT', 'MICH', 'T5YIE', 'DCOILWTICO', 'DFF', 'DGS2', 'DGS10', 'M2SL'];

export const WEIGHTS = { 'Inflación': 0.3, 'Empleo': 0.25, 'Actividad': 0.2, 'Precios y expectativas': 0.1, 'Tasas y liquidez': 0.15 };
export const SIDE = { 'Inflación': 'Coincidente', 'Empleo': 'Coincidente', 'Actividad': 'Líder', 'Precios y expectativas': 'Líder', 'Tasas y liquidez': 'Líder' };

// Manual inputs: ISM and the Conference Board LEI are licensed and not on FRED; UMich appears on FRED a month late,
// so a newer manual reading (preliminary) wins over FRED.
export const MANUAL = {
  pmi: { min: 20, max: 80 }, nmi: { min: 20, max: 80 }, lei_6m: { min: -20, max: 20 },
  umcsi: { min: 20, max: 120 }, mich: { min: -5, max: 20 },
};

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mlab = iso => `${MES[+iso.slice(5, 7) - 1]}-${iso.slice(0, 4)}`;
const dlab = iso => `${iso.slice(8, 10)}-${mlab(iso)}`;
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const sgn = (x, d) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const fmtK = x => Math.round(x).toLocaleString('en-US');

// Bucket scorer: cuts ascending; a value equal to a cut moves up unless `eqDown` keeps it below.
function bucket(x, cuts, pts, eqDown = false) {
  let i = 0;
  while (i < cuts.length && (eqDown ? x > cuts[i] : x >= cuts[i])) i++;
  return pts[i];
}
const P5 = [-2, -1, 0, 1, 2];
// "Tabla TFX" implied-GDP scale shared by NFP, ISM, UMCSI and permits.
const implPts = g => bucket(g, [0, 1, 2, 3], P5);

function addMonths(iso, k) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 10);
}
// Last observation on or before a date.
function asOf(obs, iso) {
  let lo = 0, hi = obs.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (obs[m][0] <= iso) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans < 0 ? null : obs[ans];
}
const last = obs => obs[obs.length - 1];
const back = (obs, k) => obs[obs.length - 1 - k][1];
// Monthly maths go by calendar date, not by row count: FRED has gaps (e.g. no October 2025 CPI or
// unemployment because of the US government shutdown), and counting rows would silently shift the base.
const atM = (obs, k) => { const r = asOf(obs, addMonths(last(obs)[0], k)); return r ? r[1] : NaN; };
const yoyM = obs => (back(obs, 0) / atM(obs, -12) - 1) * 100;
const ann3 = obs => ((back(obs, 0) / atM(obs, -3)) ** 4 - 1) * 100;
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
const avg3M = (obs, endIso) => { const want = [0, -1, -2].map(k => addMonths(endIso, k)); return avg(obs.filter(x => want.includes(x[0])).map(x => x[1])); };

function manualOrFred(man, key, fredObs) {
  const m = man && man[key];
  const f = fredObs && fredObs.length ? { periodo: last(fredObs)[0].slice(0, 7), valor: last(fredObs)[1], fuente: 'FRED' } : null;
  if (m && (!f || m.periodo >= f.periodo)) return { ...m, fuente: 'manual' };
  return f;
}

export function validateManual(man) {
  const err = [];
  for (const [k, lim] of Object.entries(MANUAL)) {
    const m = man[k];
    if (!m) { if (k !== 'umcsi' && k !== 'mich') err.push(`manual.${k}: falta`); continue; }
    if (!/^\d{4}-\d{2}$/.test(m.periodo || '')) err.push(`manual.${k}.periodo debe ser AAAA-MM`);
    if (typeof m.valor !== 'number' || !Number.isFinite(m.valor) || m.valor < lim.min || m.valor > lim.max) err.push(`manual.${k}.valor fuera de rango (${lim.min} a ${lim.max})`);
  }
  return err;
}

// Static descriptions of each scorecard row (what the terminal shows next to the reading).
const TXT = {
  core: { what: 'Precios al consumidor sin alimentos ni energía, variación anual.', rule: '<1.5 −2 · 1.5–1.8 −1 · 1.8–2.5 0 · 2.5–3.0 +1 · ≥3.0 +2', stable: '1.8–2.5%', hot: '≥ 2.5%', cold: '< 1.8%' },
  core3: { what: 'Impulso reciente del core: los últimos tres meses llevados a tasa anual.', rule: 'Igual escala que core a/a', stable: '1.8–2.5%', hot: '≥ 2.5%', cold: '< 1.8%' },
  ppi3: { what: 'Costos del productor sin alimentos ni energía; llegan al consumidor en uno a tres meses.', rule: '<1 −2 · 1–2 −1 · 2–3 0 · 3–4 +1 · ≥4 +2', stable: '2–3%', hot: '≥ 3%', cold: '< 2%' },
  un: { what: 'Variación de la tasa de desempleo frente al mismo mes del año previo.', rule: '≥+0.5 −2 · +0.2/+0.5 −1 · −0.1/+0.2 0 · −0.5/−0.1 +1 · ≤−0.5 +2', stable: '−0.1 a +0.2 pp', hot: '< −0.1 pp (baja)', cold: '> +0.2 pp (sube)' },
  claims: { what: 'Promedio de 4 semanas frente al promedio de 52 semanas de las solicitudes iniciales de subsidio.', rule: '≥+10% −2 · +3/+10 −1 · ±3 0 · −10/−3 +1 · ≤−10% +2', stable: '±3%', hot: '< −3%', cold: '> +3%' },
  nfp: { what: 'Creación de empleo no agrícola, promedio de los últimos tres meses.', rule: 'Tabla TFX: NFP m/m % × 10 = PIB impl. · PIB impl. <0 −2 · 0–0.9 −1 · 1–1.9 0 · 2–2.9 +1 · ≥3 +2' },
  pmi: { what: 'Encuesta a gerentes de compras de manufactura; sobre 50 = expansión.', rule: 'Tabla TFX: PIB impl. = 0.3 × (PMI − 48) · PIB impl. <0 −2 · 0–0.9 −1 · 1–1.9 0 · 2–2.9 +1 · ≥3 +2', stable: '51.2–54.4', hot: '≥ 54.5', cold: '≤ 51.1' },
  nmi: { what: 'Encuesta a gerentes de compras de servicios; sobre 50 = expansión.', rule: 'Tabla TFX: PIB impl. = 0.3 × (NMI − 50) · PIB impl. <0 −2 · 0–0.9 −1 · 1–1.9 0 · 2–2.9 +1 · ≥3 +2', stable: '53.2–56.4', hot: '≥ 56.5', cold: '≤ 53.1' },
  cli: { what: 'Indicador líder compuesto de la OCDE: anticipa el ciclo de 6 a 9 meses.', rule: '<100 bajando −2 · <100 subiendo −1 · >100 bajando 0 · >100 subiendo +1 · >101 subiendo +2', stable: '> 100 y bajando', hot: '> 100 y subiendo', cold: '< 100' },
  lei: { what: 'Índice líder de The Conference Board, variación de seis meses.', rule: '≤−2 −2 · −2/−0.5 −1 · ±0.5 0 · 0.5–1.5 +1 · ≥1.5 +2', stable: '±0.5%', hot: '> +0.5%', cold: '< −0.5%' },
  umcsi: { what: 'Confianza del consumidor de la Universidad de Michigan.', rule: 'Tabla TFX: PIB impl. = 0.2 × (UMCSI − 70) · PIB impl. <0 −2 · 0–0.9 −1 · 1–1.9 0 · 2–2.9 +1 · ≥3 +2', stable: '74.8–79.7', hot: '≥ 79.8', cold: '≤ 74.7' },
  permits: { what: 'Permisos de construcción de vivienda, tasa anual: adelantan la actividad residencial.', rule: 'Tabla TFX Permits → PIB implícito: (permisos − 900) / 200 · <0 −2 · 0–0.9 −1 · 1–1.9 0 · 2–2.9 +1 · ≥3 +2', stable: '1,100–1,299k', hot: '≥ 1,300k', cold: '< 1,100k' },
  mich: { what: 'Inflación que los hogares esperan para los próximos doce meses.', rule: '<2.3 −2 · 2.3–2.8 −1 · 2.8–3.3 0 · 3.3–4.0 +1 · ≥4.0 +2', stable: '2.8–3.3%', hot: '≥ 3.3%', cold: '< 2.8%' },
  be5: { what: 'Inflación que descuentan los bonos a cinco años (nominal menos TIPS).', rule: '<1.6 −2 · 1.6–1.9 −1 · 1.9–2.3 0 · 2.3–2.6 +1 · ≥2.6 +2', stable: '1.9–2.3%', hot: '≥ 2.3%', cold: '< 1.9%' },
  wti: { what: 'Precio del petróleo frente a hace un año: presión de costos de energía.', rule: '≤−20 −2 · −20/−5 −1 · ±5 0 · 5–20 +1 · ≥20 +2', stable: '±5%', hot: '> +5%', cold: '< −5%' },
  real: { what: 'Fed funds efectiva menos inflación subyacente: qué tan restrictiva es la política.', rule: '≥1.5 −1 · 0.5–1.5 0 · 0–0.5 +1 · <0 +2', stable: '0.5–1.5 pp', hot: '< 0.5 pp (laxa)', cold: '≥ 1.5 pp (restrictiva)' },
  ust: { rule: '≤−0.5 −2 · −0.5/−0.25 −1 · ±0.25 0 · +0.25/+0.5 +1 · ≥+0.5 +2', stable: '±0.25 pp', hot: '≥ +0.25 pp', cold: '≤ −0.25 pp' },
  m2: { what: 'Crecimiento anual de la masa monetaria: liquidez disponible en la economía.', rule: '<0 −2 · 0–3 −1 · 3–7 0 · 7–10 +1 · ≥10 +2', stable: '3–7%', hot: '≥ 7%', cold: '< 3%' },
};

export function buildMacro(obsBySeries, man, todayIso) {
  const O = obsBySeries, rows = [], S = {};
  const add = (block, name, key, val, date, pts, extra = {}) => {
    const t = TXT[key] || {};
    rows.push({ block, cat: block, side: SIDE[block], name, val, date, pts, rule: t.rule || null, stable: t.stable || '', hot: t.hot || '', cold: t.cold || '', what: t.what || '', ...extra });
  };

  // Inflación
  const core = O.CPILFESL, ppi = O.PPIFES, cpi = O.CPIAUCSL;
  S.core_yy = r1(yoyM(core)); S.cpi_yy = r1(yoyM(cpi)); S.core3 = ann3(core); S.core_ppi3 = ann3(ppi);
  const coreCuts = [1.5, 1.8, 2.5, 3.0];
  add('Inflación', 'Core CPI a/a', 'core', `${S.core_yy.toFixed(1)}%`, mlab(last(core)[0]), bucket(S.core_yy, coreCuts, P5));
  add('Inflación', 'Core CPI 3m anualizado', 'core3', `≈${S.core3.toFixed(1)}%`, mlab(last(core)[0]), bucket(S.core3, coreCuts, P5));
  add('Inflación', 'Core PPI 3m anualizado', 'ppi3', `${S.core_ppi3.toFixed(2)}%`, mlab(last(ppi)[0]), bucket(S.core_ppi3, [1, 2, 3, 4], P5));

  // Empleo
  const un = O.UNRATE, u3 = k => avg3M(un, addMonths(last(un)[0], -k));
  S.unrate = back(un, 0); S.u_chg = u3(0) - u3(12);
  let mn = Infinity; for (let k = 1; k <= 12; k++) mn = Math.min(mn, u3(k));
  S.sahm = Math.max(0, r2(u3(0) - mn));
  const uc = r2(S.u_chg);
  add('Empleo', 'Desempleo · cambio 12m (prom. 3m)', 'un', `${S.unrate.toFixed(1)}% · ${sgn(uc, 2)} pp`, mlab(last(un)[0]),
    uc <= -0.5 ? 2 : uc < -0.1 ? 1 : uc <= 0.2 ? 0 : uc < 0.5 ? -1 : -2);
  const cl = O.ICSA.map(x => x[1]), cn = cl.length;
  S.claims4 = avg(cl.slice(cn - 4)); S.claims_ratio = (S.claims4 / avg(cl.slice(cn - 52)) - 1) * 100;
  const cr = S.claims_ratio;
  add('Empleo', 'Solicitudes iniciales · 4 sem vs 52 sem', 'claims', `${Math.round(S.claims4 / 1000)}k · ${sgn(r1(cr), 1)}%`, dlab(last(O.ICSA)[0]),
    cr <= -10 ? 2 : cr < -3 ? 1 : cr <= 3 ? 0 : cr < 10 ? -1 : -2);
  const pay = O.PAYEMS, L = back(pay, 0);
  S.nfp1 = L - atM(pay, -1); S.nfp3 = (L - atM(pay, -3)) / 3;
  const gNfp = r1(S.nfp3 / L * 1000);
  const kLo = Math.ceil(0.95 * L / 1000), kHi = Math.ceil(1.95 * L / 1000);
  add('Empleo', 'Nóminas NFP · promedio 3 meses', 'nfp', `${sgn(Math.round(S.nfp3), 0)}k · ${MES[+last(pay)[0].slice(5, 7) - 1]} ${sgn(S.nfp1, 0)}k`, mlab(last(pay)[0]), implPts(gNfp),
    { stable: `≈ ${kLo}k–${kHi - 1}k`, hot: `≥ ${kHi}k`, cold: `< ${kLo}k` });

  // Actividad
  const pmi = man.pmi, nmi = man.nmi, lei = man.lei_6m;
  S.pmi = pmi.valor; S.nmi = nmi.valor;
  add('Actividad', 'ISM Manufactura (PMI)', 'pmi', pmi.valor.toFixed(1), mlab(pmi.periodo + '-01'), implPts(r1(0.3 * (pmi.valor - 48))), { src: 'manual' });
  add('Actividad', 'ISM Servicios (NMI)', 'nmi', nmi.valor.toFixed(1), mlab(nmi.periodo + '-01'), implPts(r1(0.3 * (nmi.valor - 50))), { src: 'manual' });
  const cli = O.USALOLITOAASTSAM, cv = back(cli, 0), up = cv > back(cli, 1);
  add('Actividad', 'OECD CLI (EE.UU.)', 'cli', `${cv.toFixed(2)} ${up ? '↑' : '↓'}`, mlab(last(cli)[0]),
    cv < 100 ? (up ? -1 : -2) : cv > 101 && up ? 2 : up ? 1 : 0);
  add('Actividad', 'LEI Conference Board, 6m', 'lei', `${sgn(lei.valor, 1)}%`, mlab(lei.periodo + '-01'),
    lei.valor <= -2 ? -2 : lei.valor < -0.5 ? -1 : lei.valor <= 0.5 ? 0 : lei.valor < 1.5 ? 1 : 2, { src: 'manual' });
  const um = manualOrFred(man, 'umcsi', O.UMCSENT);
  S.umcsi = um.valor;
  add('Actividad', 'Sentimiento del consumidor (UMCSI)', 'umcsi', um.valor.toFixed(1), mlab(um.periodo + '-01') + (um.preliminar ? ' (prel.)' : ''),
    implPts(r1(0.2 * (um.valor - 70))), { src: um.fuente });
  const per = O.PERMIT; S.permits = back(per, 0);
  add('Actividad', 'Permisos de construcción', 'permits', `${fmtK(S.permits)}k`, mlab(last(per)[0]), implPts((S.permits - 900) / 200));

  // Precios y expectativas
  const mi = manualOrFred(man, 'mich', O.MICH); S.mich = mi.valor;
  add('Precios y expectativas', 'Expectativa de inflación 1 año (UMich)', 'mich', `${mi.valor.toFixed(1)}%`, mlab(mi.periodo + '-01') + (mi.preliminar ? ' (prel.)' : ''),
    bucket(mi.valor, [2.3, 2.8, 3.3, 4.0], P5), { src: mi.fuente });
  const be = last(O.T5YIE); S.be = be[1];
  add('Precios y expectativas', 'Inflación implícita 5 años', 'be5', `${be[1].toFixed(2)}%`, dlab(be[0]), bucket(be[1], [1.6, 1.9, 2.3, 2.6], P5));
  const w = last(O.DCOILWTICO), w1 = asOf(O.DCOILWTICO, addMonths(w[0], -12));
  S.wti = w[1]; S.wti_yy = (w[1] / w1[1] - 1) * 100;
  const wy = S.wti_yy;
  add('Precios y expectativas', 'Petróleo WTI a/a', 'wti', `${sgn(Math.round(wy), 0)}%`, dlab(w[0]),
    wy <= -20 ? -2 : wy < -5 ? -1 : wy <= 5 ? 0 : wy < 20 ? 1 : 2);

  // Tasas y liquidez
  const ff = O.DFF; S.ff = back(ff, 0);
  let j = ff.length - 1; while (j > 0 && ff[j][1] === S.ff) j--;
  S.ff_prev = ff[j][1]; S.ff6 = S.ff - asOf(ff, addMonths(last(ff)[0], -6))[1];
  S.real = S.ff - S.core_yy;
  add('Tasas y liquidez', 'Tasa real (Fed funds − core a/a)', 'real', `${sgn(r2(S.real), 2)} pp`, mlab(last(core)[0]),
    S.real >= 1.5 ? -1 : S.real >= 0.5 ? 0 : S.real >= 0 ? 1 : 2);
  for (const [sid, key, lab] of [['DGS2', 'd2', 'UST 2 años'], ['DGS10', 'd10', 'UST 10 años']]) {
    const o = O[sid], l = last(o), b = asOf(o, addMonths(l[0], -6)), ch = r2(l[1] - b[1]);
    S[key] = l[1];
    add('Tasas y liquidez', `${lab} · cambio 6m`, 'ust', `${l[1].toFixed(2)}% · ${sgn(ch, 2)} pp`, dlab(l[0]),
      ch <= -0.5 ? -2 : ch <= -0.25 ? -1 : ch < 0.25 ? 0 : ch < 0.5 ? 1 : 2,
      { what: `Rendimiento del Tesoro a ${key === 'd2' ? 'dos años (expectativa de tasas de la Fed)' : 'diez años (costo del crédito de largo plazo)'} frente a hace seis meses.` });
  }
  const m2 = O.M2SL; S.m2yy = yoyM(m2);
  add('Tasas y liquidez', 'Masa monetaria M2 a/a', 'm2', `${sgn(r1(S.m2yy), 1)}%`, mlab(last(m2)[0]), bucket(S.m2yy, [0, 3, 7, 10], P5));

  // Agregación: promedio por bloque, ponderado por grupo y total.
  const blocks = {};
  for (const b of Object.keys(WEIGHTS)) blocks[b] = avg(rows.filter(r => r.block === b).map(r => r.pts));
  const grp = side => { const bs = Object.keys(WEIGHTS).filter(b => SIDE[b] === side), wt = bs.reduce((a, b) => a + WEIGHTS[b], 0); return bs.reduce((a, b) => a + WEIGHTS[b] * blocks[b], 0) / wt; };
  const composite = Object.keys(WEIGHTS).reduce((a, b) => a + WEIGHTS[b] * blocks[b], 0);
  const breadth = { hot: rows.filter(r => r.pts > 0).length, cold: rows.filter(r => r.pts < 0).length, flat: rows.filter(r => r.pts === 0).length, n: rows.length };

  return { asof: dlab(todayIso), asof_iso: todayIso, rows, blocks, weights: WEIGHTS, side: SIDE, sub: { coin: grp('Coincidente'), lead: grp('Líder') }, composite, breadth, ...S };
}

// Monthly history: when the month changes, the last value computed in the previous month is appended.
export function rollHistory(hist, prev, nowIso) {
  const H = JSON.parse(JSON.stringify(hist));
  if (!prev || !prev.asof_iso) return H;
  const pm = prev.asof_iso.slice(0, 7);
  if (pm < nowIso.slice(0, 7) && !H.d.includes(pm) && pm > H.d[H.d.length - 1]) {
    const r3 = x => Math.round(x * 1e3) / 1e3;
    H.d.push(pm); H.v.push(r3(prev.composite)); H.coin.push(r3(prev.sub.coin)); H.lead.push(r3(prev.sub.lead));
    for (const b of Object.keys(H.blocks)) H.blocks[b].push(r3(prev.blocks[b]));
  }
  return H;
}

export function validateMacro(m) {
  const err = [];
  if (m.rows.length !== 19) err.push(`Se esperaban 19 indicadores y hay ${m.rows.length}`);
  for (const r of m.rows) if (![-2, -1, 0, 1, 2].includes(r.pts)) err.push(`${r.name}: puntos inválidos (${r.pts})`);
  if (!(Math.abs(m.composite) <= 2)) err.push(`Compuesto fuera de rango: ${m.composite}`);
  const sane = { core_yy: [-5, 20], cpi_yy: [-5, 25], unrate: [1, 30], d2: [-2, 25], d10: [-2, 25], ff: [-1, 25], be: [-3, 10], wti: [0, 400], permits: [100, 4000] };
  for (const [k, [lo, hi]] of Object.entries(sane)) if (!(m[k] >= lo && m[k] <= hi)) err.push(`${k} fuera de rango plausible: ${m[k]}`);
  return err;
}

// CSV (fredgraph) and API (fred/series/observations) both normalise to [[date, value], ...].
export function fromCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map(l => l.split(',')).filter(([, v]) => v !== '' && v !== '.').map(([d, v]) => [d, +v]);
}
export function fromApi(json) {
  return json.observations.filter(o => o.value !== '.').map(o => [o.date, +o.value]);
}
