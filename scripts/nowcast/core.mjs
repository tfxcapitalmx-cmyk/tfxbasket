// Modelos → Nowcast TFX Macro (CPI, core CPI, PPI, core PPI, NFP) and the CPI event study of Catalizador → Escenarios.
// Pure: input = FRED observations + agenda (release time, consensus) + daily prices; output = D.snap.nowcast / nc_order / evt.
// Rebuilt from the specification stored in data/snapshot.json (regressors, variants, ARIMA orders); method in
// docs/data-pipeline.md and docs/decisions.md. Check: node scripts/nowcast/check.mjs.
import { mean, rmse, quantile, ols, olsPredict, arimaFit, arimaSelect, arimaForecast, garchFit, garchPath, archLM, rng } from './stats.mjs';

export const NC_SERIES = ['CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PPIFES', 'PAYEMS', 'ICSA', 'MICH', 'GASREGW'];
export const NC_ORDER = ['cpi', 'core', 'ppi', 'ppic', 'nfp'];
const OOS_FROM = '2016-01', TRAIN_FROM = '2000-01', H = 6, DRAWS = 20000;
const COVID = k => k >= '2020-03' && k <= '2021-12';   // excluded from the NFP models (outliers of ±20 million jobs)

const LAB = {
  gas: 'Gasolina m/m (ajust.)', core3_l: 'Core CPI 3m (rezago)', core12_l: 'Core CPI 12m (rezago)', mich_l: 'Expectativa UMich (rezago)',
  dmich_l: 'Cambio expectativa UMich (rezago)', ppic3_l2: 'Core PPI 3m (rezago 2)', ppic3_l: 'Core PPI 3m (rezago)', ppic_l: 'Core PPI mes previo',
  ppi_l: 'PPI mes previo', ppi3_l: 'PPI 3m (rezago)', cpi_t: 'CPI m/m del mes', core_t: 'Core CPI m/m del mes',
  nfp3_l: 'NFP promedio 3m previo', nfp_l: 'NFP mes previo', dclaims: 'Cambio solicitudes (miles)', claims_lvl: 'Nivel solicitudes (miles)',
};
const TARGETS = {
  cpi: { name: 'CPI', unit: '%', y: 'HM', ev: ['cpi', 'CPI m/m'], variants: [['base', ['gas', 'core3_l']], ['+UMich Δ', ['gas', 'core3_l', 'dmich_l']], ['+UMich nivel', ['gas', 'core3_l', 'mich_l']]] },
  core: { name: 'Core CPI', unit: '%', y: 'CM', ev: ['cpi', 'CPI core m/m'], variants: [['base', ['core3_l', 'core12_l']], ['+core PPI', ['core3_l', 'core12_l', 'ppic3_l2']], ['+UMich nivel', ['core3_l', 'core12_l', 'mich_l']]] },
  ppi: { name: 'PPI', unit: '%', y: 'PM', ev: ['ppi', 'PPI m/m'], variants: [['CPI + PPI previo', ['cpi_t', 'ppi_l']], ['+gasolina', ['cpi_t', 'ppi_l', 'gas']], ['+gasolina, PPI 3m', ['cpi_t', 'gas', 'ppi3_l']]] },
  ppic: { name: 'Core PPI', unit: '%', y: 'PCM', ev: ['ppi', 'PPI core m/m'], variants: [['core CPI + core PPI 3m', ['core_t', 'ppic3_l']], ['+core PPI previo', ['core_t', 'ppic3_l', 'ppic_l']], ['+CPI general', ['core_t', 'ppic3_l', 'cpi_t']]] },
  nfp: { name: 'NFP', unit: 'k', y: 'ND', ev: ['nfp', 'Nóminas no agrícolas (NFP)'], recent: true, covid: true, windows: [null, 36, 60],
    variants: [['NFP 3m + Δ solicitudes', ['nfp3_l', 'dclaims']], ['+NFP previo', ['nfp3_l', 'nfp_l', 'dclaims']], ['NFP 3m + nivel solicitudes', ['nfp3_l', 'claims_lvl']]] },
};

// ---------- months ----------
export const sh = (k, n) => { let y = +k.slice(0, 4), m = +k.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
const range = (a, b) => { const r = []; for (let k = a; k <= b; k = sh(k, 1)) r.push(k); return r; };
const monthly = o => new Map(o.map(([d, v]) => [d.slice(0, 7), v]));
const mavg = o => { const s = new Map(); for (const [d, v] of o) { const k = d.slice(0, 7), a = s.get(k) || [0, 0]; a[0] += v; a[1]++; s.set(k, a); } return new Map([...s].map(([k, [t, n]]) => [k, t / n])); };
const pctCh = M => { const r = new Map(); for (const [k, v] of M) { const p = M.get(sh(k, -1)); if (p) r.set(k, (v / p - 1) * 100); } return r; };
const avgOf = (M, k, from, n, min = n) => { const v = []; for (let i = from; i < from + n; i++) { const x = M.get(sh(k, -i)); if (x != null) v.push(x); } return v.length >= min ? mean(v) : null; };
// Index with missing months (e.g. CPI Oct-2025, US government shutdown) filled geometrically — only for the ARIMA
// recursion and the a/a base of the fan chart; the regressions and the published values never use filled months.
function fillIndex(M) {
  const ks = [...M.keys()].sort(), out = new Map(M);
  for (let k = ks[0]; k <= ks[ks.length - 1]; k = sh(k, 1)) if (!out.has(k)) {
    let a = sh(k, -1), n = 1; while (!M.has(a)) { a = sh(a, -1); n++; }
    let b = sh(k, 1), m = 1; while (!M.has(b)) { b = sh(b, 1); m++; }
    out.set(k, M.get(a) * (M.get(b) / M.get(a)) ** (n / (n + m)));
  }
  return out;
}

// ---------- features ----------
export function buildData(obs, asofMonth, manual) {
  const HI = monthly(obs.CPIAUCSL), CI = monthly(obs.CPILFESL), PI = monthly(obs.PPIFIS), PCI = monthly(obs.PPIFES), N = monthly(obs.PAYEMS);
  const S = { HI, CI, PI, PCI, HM: pctCh(HI), CM: pctCh(CI), PM: pctCh(PI), PCM: pctCh(PCI), MICH: monthly(obs.MICH) };
  S.ND = new Map([...N].filter(([k]) => N.has(sh(k, -1))).map(([k, v]) => [k, v - N.get(sh(k, -1))]));
  S.IA = new Map([...mavg(obs.ICSA)].map(([k, v]) => [k, v / 1000]));
  // Gasoline: monthly average of the weekly retail price; seasonally adjusted by removing the average change of the
  // same calendar month in previous years (the month in progress uses the weeks published so far).
  const G = pctCh(mavg(obs.GASREGW)); S.GAS = new Map();
  for (const [k, v] of G) { const prior = [...G].filter(([kk]) => kk.slice(5) === k.slice(5) && kk.slice(0, 4) < k.slice(0, 4)).map(([, x]) => x); if (prior.length >= 3) S.GAS.set(k, v - mean(prior)); }
  if (manual && manual.mich && manual.mich.periodo && !S.MICH.has(manual.mich.periodo)) S.MICH.set(manual.mich.periodo, manual.mich.valor);
  S.asof = asofMonth;
  return S;
}
export function features(S, k, extra = {}) {
  const g = (M, i) => M.get(sh(k, -i));
  // Month being forecast: weekly series (claims, gasoline) may not have a week of the month yet → latest month available.
  if (extra.now) {
    const f = features(S, k), last = M => [...M.keys()].sort().pop();
    if (f.claims_lvl == null) { const l = last(S.IA); f.claims_lvl = S.IA.get(l); f.dclaims = S.IA.get(l) - (S.IA.get(sh(l, -1)) ?? NaN); }
    if (f.gas == null) f.gas = S.GAS.get(last(S.GAS));
    if (f.mich_l == null) f.mich_l = S.MICH.get(last(S.MICH));
    if (f.dmich_l == null) { const l = last(S.MICH); f.dmich_l = S.MICH.get(l) - (S.MICH.get(sh(l, -1)) ?? NaN); }
    if (f.cpi_t == null) f.cpi_t = extra.cpi_t; if (f.core_t == null) f.core_t = extra.core_t;
    return f;
  }
  return {
    gas: S.GAS.get(k), core3_l: avgOf(S.CM, k, 1, 3), core12_l: avgOf(S.CM, k, 1, 12, 10), mich_l: g(S.MICH, 1), dmich_l: g(S.MICH, 1) != null && g(S.MICH, 2) != null ? g(S.MICH, 1) - g(S.MICH, 2) : null,
    ppic3_l2: avgOf(S.PCM, k, 2, 3), ppic3_l: avgOf(S.PCM, k, 1, 3), ppic_l: g(S.PCM, 1), ppi_l: g(S.PM, 1), ppi3_l: avgOf(S.PM, k, 1, 3),
    cpi_t: S.HM.get(k) ?? extra.cpi_t, core_t: S.CM.get(k) ?? extra.core_t,
    nfp3_l: avgOf(S.ND, k, 1, 3), nfp_l: g(S.ND, 1), dclaims: S.IA.get(k) != null && g(S.IA, 1) != null ? S.IA.get(k) - g(S.IA, 1) : null, claims_lvl: S.IA.get(k),
  };
}

// ---------- one target ----------
function regRow(S, Y, k, vars, extra) { const f = features(S, k, extra), x = vars.map(v => f[v]); return x.some(v => v == null || !Number.isFinite(v)) ? null : x; }
function fitPredict(S, T, Y, vars, win, k, extra) {
  const rows = [], ys = [];
  for (const j of Y.keys()) {
    if (j >= k || j < TRAIN_FROM || (win && j < sh(k, -win)) || (T.covid && COVID(j))) continue;
    const x = regRow(S, Y, j, vars); if (x) { rows.push(x); ys.push(Y.get(j)); }
  }
  if (rows.length < vars.length + 12) return null;
  const b = ols(rows, ys), x = regRow(S, Y, k, vars, extra);
  return b && x ? { b, x, pred: olsPredict(b, x), n: rows.length } : null;
}
function arimaSeries(S, T, upTo) {
  // contiguous series for the ARIMA recursion: price targets from the filled index; NFP without the COVID months
  if (T.y === 'ND') return [...S.ND].filter(([k]) => k >= '2010-01' && k < upTo && !COVID(k)).map(([, v]) => v);
  const idx = { HM: S.HI, CM: S.CI, PM: S.PI, PCM: S.PCI }[T.y], F = fillIndex(idx), y = [];
  for (const k of [...F.keys()].sort()) if (k >= TRAIN_FROM && k < upTo && F.has(sh(k, -1))) y.push((F.get(k) / F.get(sh(k, -1)) - 1) * 100);
  return y;
}

function runTarget(key, S, ctx) {
  const T = TARGETS[key], Y = S[T.y], pct = T.unit === '%', r1 = v => (pct ? Math.round(v * 10) / 10 : Math.round(v));
  const lastY = [...Y.keys()].sort().pop(), ref = sh(lastY, 1);
  const oosMonths = range(OOS_FROM, lastY).filter(k => Y.has(k) && !(T.covid && COVID(k)));
  const extra = { ...(ctx.extra || {}), now: true };

  // Regression variants (each with its windows): out-of-sample one month ahead from 2016, refit every month.
  const variants = [];
  for (const [vname, vars] of T.variants) for (const win of T.windows || [null]) {
    const name = win ? `${vname} · ventana ${win}m` : vname, preds = [], acts = [], dates = [];
    for (const k of oosMonths) { const r = fitPredict(S, T, Y, vars, win, k); if (r) { preds.push(r.pred); acts.push(Y.get(k)); dates.push(k); } }
    const now = fitPredict(S, T, Y, vars, win, ref, extra);
    if (!now || preds.length < 36) continue;
    variants.push({ name, vars, win, preds, acts, dates, now, rmse: rmse(preds, acts), rmse36: rmse(preds.slice(-36), acts.slice(-36)) });
  }
  const crit = v => (T.recent ? v.rmse36 : v.rmse);
  if (!variants.length) throw new Error(`${key}: ninguna variante de la regresión tiene datos para ${ref}`);
  const best = variants.reduce((a, b) => (crit(b) < crit(a) ? b : a));

  // ARIMA: order by AIC on the full sample, then refit every month for the out-of-sample record.
  const order = arimaSelect(arimaSeries(S, T, ref)).order, arPred = new Map();
  for (const k of best.dates) { const m = arimaFit(arimaSeries(S, T, k), order[0], order[2]); arPred.set(k, arimaForecast(m, 1)[0]); }
  const arNow = arimaFit(arimaSeries(S, T, ref), order[0], order[2]), fc = arimaForecast(arNow, H);

  // Ensemble: inverse-MSE weights from the errors known before each month.
  const D = best.dates, A = best.acts, R = best.preds, AR = D.map(k => arPred.get(k)), ENS = [];
  for (let i = 0; i < D.length; i++) {
    let w = 0.5; if (i >= 12) { const er = mean(R.slice(0, i).map((v, j) => (v - A[j]) ** 2)), ea = mean(AR.slice(0, i).map((v, j) => (v - A[j]) ** 2)); w = (1 / er) / (1 / er + 1 / ea); }
    ENS.push(w * R[i] + (1 - w) * AR[i]);
  }
  const mseR = mean(R.map((v, i) => (v - A[i]) ** 2)), mseA = mean(AR.map((v, i) => (v - A[i]) ** 2)), w = (1 / mseR) / (1 / mseR + 1 / mseA);
  const NAIVE = A.map((v, i) => (i ? A[i - 1] : Y.get(sh(D[0], -1))));
  const dir = p => { let c = 0, n = 0; for (let i = 1; i < A.length; i++) { const da = A[i] - A[i - 1]; if (da === 0) continue; n++; if (Math.sign(p[i] - A[i - 1]) === Math.sign(da)) c++; } return c / n * 100; };
  const r36 = p => rmse(p.slice(-36), A.slice(-36));
  const models = { reg: { p: R, now: best.now.pred }, arima: { p: AR, now: fc[0] }, ens: { p: ENS, now: w * best.now.pred + (1 - w) * fc[0] } };
  const central = Object.keys(models).reduce((a, b) => ((T.recent ? r36(models[b].p) : rmse(models[b].p, A)) < (T.recent ? r36(models[a].p) : rmse(models[a].p, A)) ? b : a));
  const pred = models[central].now;

  // Volatility of the error: GARCH(1,1)-t when the errors show ARCH effects, constant otherwise.
  const err = models[central].p.map((v, i) => A[i] - v), sdRes = Math.sqrt(mean(err.map(e => (e - mean(err)) ** 2)));
  const lmP = archLM(err), g = lmP < 0.05 ? garchFit(err) : null, ok = !!g && g.persist < 0.99;
  const sig = ok ? garchPath(g, H) : Array(H).fill(sdRes), condvol = ok ? g.condvol : err.map(() => sdRes), nu = ok ? g.nu : 8;
  // Calibration: the 90% band of the simulation must cover 90% of the past errors (Student-t with the same ν).
  const Gt = rng(99), tq = quantile(Array.from({ length: 20000 }, () => Math.abs(Gt.tstd(nu))).sort((a, b) => a - b), 0.9);
  const scale = quantile(err.map((e, i) => Math.abs(e) / condvol[i]).sort((a, b) => a - b), 0.9) / tq;

  // Monte Carlo of the coming release and of the next six months.
  const ev = ctx.event(T.ev[0], T.ev[1], ref), cons = ev && ev.cons != null ? ev.cons : null;
  const prevPub = r1(Y.get(lastY)), refv = cons != null ? cons : prevPub;
  // Base of "up": same month a year earlier (m/m); if that month does not exist (CPI Nov-2025, shutdown), the average of
  // the last 12 months published. NFP: average of the last three months.
  const baseMM = pct ? (Y.get(sh(ref, -12)) ?? avgOf(Y, ref, 1, 12, 9)) : avgOf(Y, ref, 1, 3);
  const G = rng(20261016 + NC_ORDER.indexOf(key)), draws = new Float64Array(DRAWS), sig1 = sig[0] * scale;
  let ab = 0, inl = 0, be = 0, up = 0;
  for (let i = 0; i < DRAWS; i++) {
    const d = pred + sig1 * G.tstd(nu); draws[i] = d;
    if (pct) { const r = r1(d); if (r > refv + 1e-9) ab++; else if (r < refv - 1e-9) be++; else inl++; }
    else { if (d > refv + 10) ab++; else if (d < refv - 10) be++; else inl++; }
    if (baseMM != null && d > baseMM) up++;
  }
  const sorted = Array.from(draws).sort((a, b) => a - b), q = p => quantile(sorted, p);
  const bins = new Map();
  for (const d of draws) { const b = pct ? r1(d) : Math.floor(d / 25) * 25 + 12.5; bins.set(b, (bins.get(b) || 0) + 1); }
  const dist = [...bins].map(([b, n]) => [Math.round(b * 1000) / 1000, n / DRAWS]).filter(([, p]) => p >= 0.005).sort((a, b) => a[0] - b[0]);

  // Fan chart: a/a for prices (compounding the simulated m/m on the index), m/m for NFP.
  const months = range(ref, sh(ref, H - 1)), idx = pct ? fillIndex({ HM: S.HI, CM: S.CI, PM: S.PI, PCM: S.PCI }[T.y]) : null;
  const paths = months.map(() => new Float64Array(4000)), G2 = rng(7 + NC_ORDER.indexOf(key));
  for (let i = 0; i < 4000; i++) {
    let lv = pct ? idx.get(lastY) : 0;
    for (let h = 0; h < H; h++) {
      const c = h === 0 ? pred : fc[h], d = c + sig[h] * scale * G2.tstd(nu);
      if (pct) { lv *= 1 + d / 100; paths[h][i] = (lv / idx.get(sh(months[h], -12)) - 1) * 100; } else paths[h][i] = d;
    }
  }
  const fan = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  for (const p of paths) { const s = Array.from(p).sort((a, b) => a - b); for (const [k, v] of [['p5', 0.05], ['p25', 0.25], ['p50', 0.5], ['p75', 0.75], ['p95', 0.95]]) fan[k].push(quantile(s, v)); }
  const histK = range(sh(lastY, -35), lastY);
  // a/a of a published month; when the base month does not exist (CPI Oct/Nov-2025, shutdown) the base is the
  // interpolated index, as the page says under the chart. The month itself must be published.
  const yIdx = pct ? S[{ HM: 'HI', CM: 'CI', PM: 'PI', PCM: 'PCI' }[T.y]] : null, yBase = pct ? fillIndex(yIdx) : null;
  const yoyAt = k => (yIdx.has(k) && yBase.has(sh(k, -12)) ? +((yIdx.get(k) / yBase.get(sh(k, -12)) - 1) * 100).toFixed(3) : null);
  const hist = histK.map(k => (pct ? yoyAt(k) : Y.get(k) ?? null));

  const r3 = v => (v == null ? null : Math.round(v * 1000) / 1000);
  const coef = { const: best.now.b[0] }, x = {}, lab = {};
  best.vars.forEach((v, i) => { coef[v] = best.now.b[i + 1]; x[v] = best.now.x[i]; lab[v] = LAB[v]; });
  const yprev = pct ? (yoyAt(lastY) == null ? null : Math.round(yoyAt(lastY) * 10) / 10) : baseMM;
  return {
    name: T.name, unit: T.unit, ref, actual: null, pred_pub: null, cons, prev: prevPub, refv, consKind: cons != null ? 'consenso' : 'dato previo',
    central, pred, w, table: [[`Regresión (${best.name})`, rmse(R, A), dir(R)], [`ARIMA(${order[0]}, 0, ${order[2]})`, rmse(AR, A), dir(AR)], ['Ensamble', rmse(ENS, A), dir(ENS)], ['Dato anterior (ingenuo)', rmse(NAIVE, A), dir(NAIVE)]],
    base_mm: baseMM, yprev,
    reg: { name: best.name, win: best.win, pred: best.now.pred, rmse: best.rmse, coef, x, lab, variants: variants.map(v => ({ name: v.name, rmse: v.rmse, rmse36: v.rmse36, n: v.preds.length, pred: v.now.pred })) },
    recent: !!T.recent, rmse36: { reg: r36(R), arima: r36(AR), ens: r36(ENS), naive: r36(NAIVE) },
    arima: { order, pred: fc[0], params: { const: arNow.mu, ...Object.fromEntries(arNow.phi.map((v, i) => [`ar.L${i + 1}`, v])), ...Object.fromEntries(arNow.th.map((v, i) => [`ma.L${i + 1}`, v])), sigma2: arNow.sigma2 }, fc, rmse: rmse(AR, A) },
    garch: { ok, arch_lm_p: lmP, alpha: ok ? g.alpha : 0, beta: ok ? g.beta : 0, nu, persist: ok ? g.persist : 0, sig, uncond: ok ? g.uncond : sdRes, sd_res: sdRes, condvol: condvol.slice(-36), cv_dates: D.slice(-36) },
    oos: { dates: D, actual: A.map(r3), reg: R.map(r3), ar: AR.map(r3), ens: ENS.map(r3) },
    mc: { months, fan, fan_lab: pct ? 'a/a' : 'm/m', hist_dates: histK, hist, above: ab / DRAWS, inline: inl / DRAWS, below: be / DRAWS, up: baseMM != null ? up / DRAWS : null,
      mean: mean(Array.from(draws)), p5: q(0.05), p25: q(0.25), p75: q(0.75), p95: q(0.95), dist, sig1, scale },
    release: ev ? ev.t : null,
  };
}

// ---------- event study: market reaction on CPI days by surprise against the model ----------
export function eventStudy(nc, cpiDates, prices) {
  const surpCol = { cpi_surp: nc.cpi, core_surp: nc.core }, U = { dxy: '%', d2: 'pb', spx: '%', xau: '%' }, assets = {};
  for (const [a, unit] of Object.entries(U)) {
    const P = prices[a]; if (!P) continue;
    const days = [...P.keys()].sort(), react = d => { const i = days.findIndex(x => x >= d); if (i < 1 || days[i] !== d) return null; const v = P.get(d), p = P.get(days[i - 1]); return unit === 'pb' ? (v - p) * 100 : (v / p - 1) * 100; };
    const surp = {};
    for (const [col, N] of Object.entries(surpCol)) {
      const model = N.oos[N.central === 'arima' ? 'ar' : N.central], ev = [];
      N.oos.dates.forEach((k, i) => { const d = cpiDates[k]; if (!d) return; const r = react(d); if (r != null) ev.push({ s: N.oos.actual[i] - model[i], r }); });
      ev.sort((x, y) => x.s - y.s);
      const n = ev.length, cut = [0, Math.round(n / 3), Math.round(2 * n / 3), n], terc = {};
      ['fria', 'media', 'caliente'].forEach((t, j) => {
        const g = ev.slice(cut[j], cut[j + 1]), rs = g.map(e => e.r).sort((a, b) => a - b);
        terc[t] = { n: g.length, mean: mean(rs), med: quantile(rs, 0.5), up: g.filter(e => e.r > 0).length / g.length, surp: mean(g.map(e => e.s)) };
      });
      surp[col] = { terc };
    }
    assets[a] = { unit, surp };
  }
  return { assets };
}

export function buildNowcast(obs, ctx) {
  const S = buildData(obs, ctx.asofMonth, ctx.manual), nc = {};
  for (const key of ['cpi', 'core']) nc[key] = runTarget(key, S, ctx);
  // PPI uses the CPI of the same month: published value if it is out, else the CPI nowcast of that month.
  const extra = { cpi_t: nc.cpi.ref === sh([...S.PM.keys()].sort().pop(), 1) ? nc.cpi.pred : undefined, core_t: nc.core.ref === sh([...S.PCM.keys()].sort().pop(), 1) ? nc.core.pred : undefined };
  for (const key of ['ppi', 'ppic']) nc[key] = runTarget(key, S, { ...ctx, extra });
  nc.nfp = runTarget('nfp', S, ctx);
  return nc;
}

export function validateNowcast(nc) {
  const e = [];
  for (const k of NC_ORDER) {
    const N = nc[k]; if (!N) { e.push(`${k}: falta`); continue; }
    if (!Number.isFinite(N.pred)) e.push(`${k}: predicción no numérica`);
    const lim = N.unit === '%' ? 3 : 1500; if (Math.abs(N.pred) > lim) e.push(`${k}: predicción fuera de rango (${N.pred})`);
    if (N.oos.dates.length < 60) e.push(`${k}: solo ${N.oos.dates.length} meses de prueba`);
    const p = N.mc.above + N.mc.inline + N.mc.below; if (Math.abs(p - 1) > 1e-6) e.push(`${k}: probabilidades no suman 1`);
    if (!(N.table[0][1] > 0)) e.push(`${k}: error de la regresión inválido`);
  }
  return e;
}
