// Pure calculation for Volatilidad (D.snap.vol) and Estacionalidad (D.snap.seas): no network, no disk.
// Inputs are daily/monthly OHLC candles. Candle row = [yyyymmdd, open, high, low, close].
// Reproduces the figures that were calculated in earlier chats (verified by scripts/markets/check.mjs).

// ---------- Instruments: terminal name → Yahoo Finance symbol ----------
export const YAHOO = {
  AUDUSD: 'AUDUSD=X', AUDNZD: 'AUDNZD=X', AUDCHF: 'AUDCHF=X', AUDCAD: 'AUDCAD=X', AUDJPY: 'AUDJPY=X',
  EURUSD: 'EURUSD=X', EURJPY: 'EURJPY=X', EURCHF: 'EURCHF=X', EURCAD: 'EURCAD=X', EURAUD: 'EURAUD=X',
  EURGBP: 'EURGBP=X', EURNZD: 'EURNZD=X', GBPUSD: 'GBPUSD=X', GBPAUD: 'GBPAUD=X', GBPJPY: 'GBPJPY=X',
  GBPCHF: 'GBPCHF=X', GBPCAD: 'GBPCAD=X', GBPNZD: 'GBPNZD=X',
  NAS100: '^NDX', SPX500: '^GSPC', US30: '^DJI', VIX: '^VIX',
  WTI: 'CL=F', XAGUSD: 'SI=F', XAUUSD: 'GC=F'
};
export const INSTRUMENTS = Object.keys(YAHOO);
// Cash indices and the VIX match the stored Investing.com candles exactly; FX differs ~0.1 % (another close cut);
// WTI, gold and silver are front-month futures on Yahoo (stored data is spot/CFD), so they differ ~0.3-0.6 %.
export const MATCH_TOL = { index: 0.0005, fx: 0.01, futures: 0.05 };
export const kindOf = p => (['NAS100', 'SPX500', 'US30', 'VIX'].includes(p) ? 'index' : ['WTI', 'XAGUSD', 'XAUUSD'].includes(p) ? 'futures' : 'fx');

// ---------- Stored candles (data/markets.json, delta base-36 encoding, same as app.js MKSEED) ----------
export function decodeSeries(e) {
  const sc = e[0], d0 = e[1], o0 = e[2], parts = e[3].split(';');
  let dt = Date.UTC(Math.floor(d0 / 10000), Math.floor(d0 / 100) % 100 - 1, d0 % 100), pc = null;
  const rows = new Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const a = parts[i].split(',');
    dt += parseInt(a[0], 36) * 864e5;
    const o = pc === null ? o0 : pc + parseInt(a[1], 36);
    const h = o + parseInt(a[2], 36), l = o - parseInt(a[3], 36), c = o + parseInt(a[4], 36);
    pc = c;
    const d = new Date(dt);
    rows[i] = [d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(), o / sc, h / sc, l / sc, c / sc];
  }
  return rows; // ascending
}

// ---------- Merging stored history with the live (Yahoo) layer ----------
// Stored candles are kept as they are; live candles only extend the series after the last stored date.
export function mergeDaily(stored, live) {
  const last = stored.length ? stored[stored.length - 1][0] : 0;
  return stored.concat((live || []).filter(r => r[0] > last).sort((a, b) => a[0] - b[0]));
}

// Monthly closes: stored monthly candles before `rebuildFrom` (yyyymm), daily-derived closes from that month on.
// rebuildFrom = null → use the stored monthly series untouched (used to verify the reproduction).
export function monthlyCloses(storedM, daily, rebuildFrom) {
  const out = storedM.map(r => [Math.floor(r[0] / 100), r[4]]);
  if (rebuildFrom == null) return out;
  const keep = out.filter(r => r[0] < rebuildFrom);
  const byM = new Map();
  for (const r of daily) { const ym = Math.floor(r[0] / 100); if (ym >= rebuildFrom) byM.set(ym, r[4]); }
  return keep.concat([...byM.entries()].sort((a, b) => a[0] - b[0]));
}

// ---------- Statistics helpers ----------
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quant = (a, f) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
};
const slope = (x, y) => {
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  return sxy / sxx;
};
const rnd = (x, d) => { const k = 10 ** d; return Math.round(x * k) / k; };
const iso = ymd => `${String(ymd).slice(0, 4)}-${String(ymd).slice(4, 6)}-${String(ymd).slice(6, 8)}`;

// Two-sided p-value of a t statistic (regularised incomplete beta).
function lgam(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015;
  for (const k of c) s += k / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}
function betacf(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgam(a + b) - lgam(a) - lgam(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
const tPvalue = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);

// ---------- Estacionalidad (D.snap.seas) ----------
const WINDOWS = [0, 5, 10, 15, 20];            // 0 = whole sample; N = last N complete years
const REL_MIN_PRIOR = { 5: 5, 10: 10, 15: 14, 20: 19 }; // prior years needed to score a year out of sample (rule of the original build)
const REL_MIN_YEARS = 10;                       // an instrument needs at least this many scored years for a window
const GRID_YEARS = 25;

function monthlyReturns(closes) { // closes: [[yyyymm, close]] ascending → Map(yyyymm → % return)
  const out = new Map();
  for (let i = 1; i < closes.length; i++) out.set(closes[i][0], (closes[i][1] / closes[i - 1][1] - 1) * 100);
  return out;
}

function windowStats(ret, ly, w) {
  const st = [];
  for (let m = 1; m <= 12; m++) {
    const v = [];
    for (const [k, x] of ret) { const y = Math.floor(k / 100); if (k % 100 !== m || y >= ly) continue; if (w && y < ly - w) continue; v.push(x); }
    if (v.length < 2) { st.push(null); continue; }
    const mu = mean(v), s = sd(v), t = mu / (s / Math.sqrt(v.length));
    st.push({ m, n: v.length, mean: rnd(mu, 2), med: rnd(med(v), 2), pos: rnd(v.filter(x => x > 0).length / v.length, 3), sd: rnd(s, 2), best: rnd(Math.max(...v), 2), worst: rnd(Math.min(...v), 2), p: rnd(tPvalue(t, v.length - 1), 3) });
  }
  return st;
}

// Out-of-sample reliability: each year is "predicted" with the same-month mean of the previous w years.
function reliability(ret, ly, w) {
  const ys = [...new Set([...ret.keys()].map(k => Math.floor(k / 100)))].filter(y => y < ly).sort((a, b) => a - b);
  const rows = [];
  for (const Y of ys) {
    const prior = ys.filter(y => y < Y && y >= Y - w);
    if (prior.length < REL_MIN_PRIOR[w]) continue;
    const P = [], A = [];
    for (let m = 1; m <= 12; m++) {
      const a = ret.get(Y * 100 + m); if (a == null) continue;
      const v = prior.map(y => ret.get(y * 100 + m)).filter(x => x != null); if (!v.length) continue;
      P.push(mean(v)); A.push(a);
    }
    if (P.length >= 6) rows.push({ c: corr(P, A), h: P.filter((p, i) => Math.sign(p) === Math.sign(A[i])).length / P.length });
  }
  if (rows.length < REL_MIN_YEARS) return null;
  return { n: rows.length, corr: rnd(mean(rows.map(r => r.c)), 3), hit: rnd(mean(rows.map(r => r.h)), 3) };
}

export function buildSeasonInstrument(closes) {
  const ret = monthlyReturns(closes);
  const lastYm = closes[closes.length - 1][0], ly = Math.floor(lastYm / 100);
  const grid = [];
  for (let y = ly; y > ly - GRID_YEARS; y--) {
    const v = [], f = [];
    for (let m = 1; m <= 12; m++) { const x = ret.get(y * 100 + m); v.push(x == null ? null : rnd(x, 2)); if (x != null) f.push(x); }
    if (!f.length) continue;
    grid.push({ y, v, tot: rnd((f.reduce((p, x) => p * (1 + x / 100), 1) - 1) * 100, 2) });
  }
  const st = {}, paths = {}, rel = {};
  for (const w of WINDOWS) {
    const s = windowStats(ret, ly, w);
    if (w && !s.some(Boolean)) continue;
    st[w] = s;
    let c = 0; paths[w] = s.map(q => rnd(c += q ? q.mean : 0, 2));
    if (w) { const r = reliability(ret, ly, w); if (r) rel[w] = r; }
  }
  const cur = []; let acc = 0;
  for (let m = 1; m <= 12; m++) { const x = ret.get(ly * 100 + m); if (x == null) cur.push(null); else cur.push(rnd(acc += x, 2)); }
  const all = [...ret.values()];
  return { ly, desde: Math.floor(closes[0][0] / 100), n: all.length, grid, st, paths, cur, rel, posm: rnd(all.filter(x => x > 0).length / all.length, 3) };
}

export function buildSeason(closesByInstrument) {
  const ins = {};
  for (const p of INSTRUMENTS) if (closesByInstrument[p]) ins[p] = buildSeasonInstrument(closesByInstrument[p]);
  const glob = {};
  for (const w of [5, 10, 15, 20]) {
    const r = Object.values(ins).map(i => i.rel[w]).filter(Boolean);
    if (r.length) glob[w] = { k: r.length, corr: rnd(mean(r.map(x => x.corr)), 3), hit: rnd(mean(r.map(x => x.hit)), 3) };
  }
  return { ins, glob, ms: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] };
}

// ---------- Volatilidad (D.snap.vol) ----------
const SQ252 = Math.sqrt(252), EABS = Math.sqrt(2 / Math.PI); // E|Z| = 0.7979
const BUCKETS = [['<12', 0, 12], ['12-15', 12, 15], ['15-20', 15, 20], ['20-25', 20, 25], ['25-30', 25, 30], ['30-40', 30, 40], ['>40', 40, 1e9]];
const ROLL = 252;

// vix, spx: daily candle rows. Only days present in both are used (as in the original build).
export function buildVol(vix, spx) {
  const sm = new Map(spx.map(r => [r[0], r]));
  const al = vix.filter(r => sm.has(r[0])).map(r => ({ d: r[0], v: r[4], s: sm.get(r[0])[4], sh: sm.get(r[0])[2], sl: sm.get(r[0])[3] }));
  const rs = [], dv = [];
  for (let i = 1; i < al.length; i++) { rs.push((al[i].s / al[i - 1].s - 1) * 100); dv.push((al[i].v / al[i - 1].v - 1) * 100); }
  const upI = [], dnI = [];
  rs.forEach((r, i) => { if (r > 0) upI.push(i); else if (r < 0) dnI.push(i); });
  const sel = (ix, a) => ix.map(i => a[i]);

  // Rolling 252-session correlation, one point per week (last session of each week).
  const rc = [];
  for (let i = ROLL; i <= rs.length; i++) rc.push({ i, d: al[i].d, c: corr(rs.slice(i - ROLL, i), dv.slice(i - ROLL, i)) });
  // The week is labelled by the month of its Sunday (as in the original build), the value is the week's last session.
  const weekEndMonth = d => { const t = new Date(Date.UTC(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100)); t.setUTCDate(t.getUTCDate() + (7 - t.getUTCDay()) % 7); return t.toISOString().slice(0, 7); };
  const wk = d => { const t = Date.UTC(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100); return Math.floor((t / 864e5 + 3) / 7); };
  const weekly = rc.filter((r, k) => k === rc.length - 1 || wk(r.d) !== wk(rc[k + 1].d));

  const buckets = BUCKETS.map(([lab, lo, hi]) => {
    const ix = []; for (let i = 0; i < al.length - 1; i++) if (al[i].v >= lo && al[i].v < hi) ix.push(i);
    const nxt = ix.map(i => Math.abs((al[i + 1].s / al[i].s - 1) * 100)), imp = ix.map(i => al[i].v / SQ252);
    const rng = ix.map(i => (al[i + 1].sh - al[i + 1].sl) / al[i + 1].sl * 100); // high-low range over the low, as in the original build
    return { lab, n: ix.length, vix: rnd(mean(ix.map(i => al[i].v)), 1), imp: rnd(mean(imp), 2), med: rnd(med(nxt), 2), p75: rnd(quant(nxt, 0.75), 2), p90: rnd(quant(nxt, 0.9), 2), rng: rnd(mean(rng), 2), cov: rnd(nxt.filter((x, k) => x <= imp[k]).length / nxt.length, 3), ratio: rnd(mean(nxt) / mean(imp) / EABS, 2) };
  });
  const nxtAll = [], impAll = [];
  for (let i = 0; i < al.length - 1; i++) { nxtAll.push(Math.abs((al[i + 1].s / al[i].s - 1) * 100)); impAll.push(al[i].v / SQ252); }

  // VIX: monthly average of the closes. S&P 500: last close of the month.
  const monthly = (key, how) => {
    const g = new Map();
    for (const r of al) { const k = iso(r.d).slice(0, 7); (g.get(k) || g.set(k, []).get(k)).push(r[key]); }
    return { d: [...g.keys()], v: [...g.values()].map(a => rnd(how === 'avg' ? mean(a) : a[a.length - 1], 2)) };
  };
  const last = al[al.length - 1];
  const c252 = rc[rc.length - 1].c;
  return {
    asof: iso(last.d), vix: rnd(last.v, 2), spx: rnd(last.s, 2), n: al.length, desde: iso(al[0].d),
    corr: rnd(corr(rs, dv), 3), corr_min: rnd(Math.min(...rc.map(r => r.c)), 2), corr_max: rnd(Math.max(...rc.map(r => r.c)), 2), corr_now: rnd(c252, 2),
    beta_dn: rnd(slope(sel(dnI, rs), sel(dnI, dv)), 2), beta_up: rnd(slope(sel(upI, rs), sel(upI, dv)), 2),
    dv_up: rnd(mean(sel(upI, dv)), 2), dv_dn: rnd(mean(sel(dnI, dv)), 2),
    ratio: rnd(mean(nxtAll) / mean(impAll) / EABS, 3), cov: rnd(nxtAll.filter((x, k) => x <= impAll[k]).length / nxtAll.length, 3),
    buckets,
    rollc: { d: weekly.map(r => weekEndMonth(r.d)), v: weekly.map(r => rnd(r.c, 3)) },
    scat: rs.map((r, i) => [rnd(r, 2), rnd(dv[i], 1)]).filter((_, i) => i % 3 === 0),
    vixm: monthly('v', 'avg'), spxm: monthly('s', 'last')
  };
}

// ---------- Validation ----------
export function validateVol(v, today) {
  const p = [];
  if (!v) return ['vol: vacío'];
  if (v.n < 7000) p.push(`vol: solo ${v.n} sesiones alineadas`);
  if (!(v.vix > 5 && v.vix < 150)) p.push(`vol: VIX fuera de rango (${v.vix})`);
  if (!(v.spx > 500 && v.spx < 100000)) p.push(`vol: S&P fuera de rango (${v.spx})`);
  if (!(v.corr < -0.5 && v.corr > -0.95)) p.push(`vol: correlación VIX/S&P inverosímil (${v.corr})`);
  if (v.buckets.length !== 7 || v.buckets.some(b => !(b.n > 0))) p.push('vol: tramos de VIX vacíos');
  if (v.buckets.reduce((s, b) => s + b.n, 0) !== v.n - 1) p.push('vol: los tramos no suman las sesiones');
  if (today && (Date.parse(today) - Date.parse(v.asof)) / 864e5 > 6) p.push(`vol: último dato ${v.asof}, más de 6 días de atraso`);
  return p;
}

export function validateSeason(s, today) {
  const p = [];
  if (!s || !s.ins) return ['seas: vacío'];
  for (const k of INSTRUMENTS) {
    const i = s.ins[k];
    if (!i) { p.push(`seas: falta ${k}`); continue; }
    if (i.n < 200) p.push(`seas ${k}: solo ${i.n} meses`);
    for (const w of WINDOWS) {
      const st = i.st[w]; if (!st) { if (w === 0) p.push(`seas ${k}: sin muestra completa`); continue; }
      for (const m of st) if (m && (!Number.isFinite(m.mean) || Math.abs(m.mean) > 40 || m.p < 0 || m.p > 1)) p.push(`seas ${k}: estadístico fuera de rango (${w}, mes ${m.m})`);
    }
    for (const r of i.grid) for (const x of r.v) if (x != null && Math.abs(x) > 250) p.push(`seas ${k}: retorno mensual inverosímil ${x}% en ${r.y}`);
  }
  if (today) {
    const ly = +today.slice(0, 4);
    for (const k of INSTRUMENTS) if (s.ins[k] && ly - s.ins[k].ly > 0 && +today.slice(5, 7) > 1) p.push(`seas ${k}: el año en curso no está cargado`);
  }
  return p;
}

// Compares a Yahoo candle with a stored one on the overlap: aborts the run if the source changed meaning
// (a wrong symbol, a split, a unit change) instead of publishing a broken series.
export function checkOverlap(p, stored, live) {
  const sm = new Map(stored.map(r => [r[0], r])); const d = [];
  for (const r of live) { const s = sm.get(r[0]); if (s) d.push(Math.abs(r[4] / s[4] - 1)); }
  if (d.length < 3) return null; // no overlap to judge
  d.sort((a, b) => a - b);
  const m = d[d.length >> 1], tol = MATCH_TOL[kindOf(p)];
  return m > tol ? `${p}: Yahoo difiere ${(m * 100).toFixed(2)} % del histórico guardado (tolerancia ${(tol * 100).toFixed(2)} %)` : null;
}
