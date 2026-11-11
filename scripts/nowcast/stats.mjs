// Small statistics toolkit for the nowcast (pure JS, no dependencies): OLS, Nelder–Mead, ARIMA(p,0,q) by conditional
// sum of squares, GARCH(1,1) with Student-t errors, ARCH-LM test and a seeded random generator for Monte Carlo.

export const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
export const rmse = (p, a) => Math.sqrt(mean(p.map((x, i) => (x - a[i]) ** 2)));
export function quantile(sorted, q) { const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }

// ---------- OLS with intercept ----------
function solve(A, b) {   // Gaussian elimination with partial pivoting
  const n = A.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
/** X: rows of regressors (without intercept); returns [const, b1, b2, …] or null. */
export function ols(X, y) {
  const k = X[0].length + 1, XtX = Array.from({ length: k }, () => Array(k).fill(0)), Xty = Array(k).fill(0);
  for (let i = 0; i < y.length; i++) { const r = [1, ...X[i]]; for (let a = 0; a < k; a++) { Xty[a] += r[a] * y[i]; for (let b = 0; b < k; b++) XtX[a][b] += r[a] * r[b]; } }
  return solve(XtX, Xty);
}
export const olsPredict = (b, x) => b[0] + x.reduce((s, v, i) => s + v * b[i + 1], 0);

// ---------- Nelder–Mead ----------
export function nelderMead(f, x0, { step = 0.1, iters = 2000, tol = 1e-10 } = {}) {
  const n = x0.length; let S = [x0.slice()];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += x[i] !== 0 ? step * Math.abs(x[i]) + step / 10 : step; S.push(x); }
  let F = S.map(f);
  for (let it = 0; it < iters; it++) {
    const o = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); S = o.map(i => S[i]); F = o.map(i => F[i]);
    if (Math.abs(F[n] - F[0]) < tol * (Math.abs(F[0]) + tol)) break;
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
    const at = t => c.map((v, j) => v + t * (S[n][j] - v));
    const xr = at(-1), fr = f(xr);
    if (fr < F[0]) { const xe = at(-2), fe = f(xe); if (fe < fr) { S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; } }
    else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
    else { const xc = at(0.5), fc = f(xc); if (fc < F[n]) { S[n] = xc; F[n] = fc; } else { for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); F[i] = f(S[i]); } } }
  }
  const b = F.indexOf(Math.min(...F)); return { x: S[b], f: F[b] };
}

// ---------- ARIMA(p,0,q) with mean, conditional sum of squares ----------
const stable2 = (a1, a2) => Math.abs(a2) < 1 && a1 + a2 < 1 && a2 - a1 < 1;   // AR(2) / MA(2) region
function okPoly(c) { if (c.length === 0) return true; if (c.length === 1) return Math.abs(c[0]) < 0.995; return stable2(c[0], c[1]) && Math.abs(c[1]) < 0.995; }
function cssResid(y, mu, phi, th) {
  const e = new Array(y.length).fill(0); let ss = 0, n = 0;
  for (let t = 0; t < y.length; t++) {
    let f = mu; for (let i = 0; i < phi.length; i++) if (t - i - 1 >= 0) f += phi[i] * (y[t - i - 1] - mu);
    for (let j = 0; j < th.length; j++) if (t - j - 1 >= 0) f += th[j] * e[t - j - 1];
    e[t] = y[t] - f; if (t >= phi.length) { ss += e[t] ** 2; n++; }
  }
  return { e, ss, n };
}
export function arimaFit(y, p, q) {
  const m0 = mean(y), sd = Math.sqrt(mean(y.map(v => (v - m0) ** 2))) || 1;
  const unpack = x => ({ mu: x[0] * sd + m0, phi: x.slice(1, 1 + p), th: x.slice(1 + p) });
  const f = x => { const { mu, phi, th } = unpack(x); if (!okPoly(phi) || !okPoly(th.map(v => -v))) return 1e12; return cssResid(y, mu, phi, th).ss; };
  let best = null;
  for (const start of [0, 0.3, -0.3]) { const r = nelderMead(f, [0, ...Array(p).fill(start), ...Array(q).fill(start / 2)], { step: 0.2, iters: 3000 }); if (!best || r.f < best.f) best = r; }
  const { mu, phi, th } = unpack(best.x), { e, ss, n } = cssResid(y, mu, phi, th), sigma2 = ss / n;
  return { order: [p, 0, q], mu, phi, th, e, sigma2, aic: n * Math.log(sigma2) + 2 * (1 + p + q + 1), n, y };
}
export function arimaForecast(m, h) {
  const y = m.y.slice(), e = m.e.slice(), out = [];
  for (let s = 0; s < h; s++) {
    const t = y.length; let f = m.mu;
    for (let i = 0; i < m.phi.length; i++) f += m.phi[i] * (y[t - i - 1] - m.mu);
    for (let j = 0; j < m.th.length; j++) f += m.th[j] * (e[t - j - 1] || 0);
    y.push(f); e.push(0); out.push(f);
  }
  return out;
}
export function arimaSelect(y, maxP = 2, maxQ = 2) {
  let best = null;
  for (let p = 0; p <= maxP; p++) for (let q = 0; q <= maxQ; q++) { const m = arimaFit(y, p, q); if (!best || m.aic < best.aic - 1e-9) best = m; }
  return best;
}

// ---------- Student-t ----------
function lgamma(x) {   // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
// log density of a standardized (unit-variance) Student-t
const ltstd = (z, nu) => lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(Math.PI * (nu - 2)) - ((nu + 1) / 2) * Math.log(1 + z * z / (nu - 2));

// ---------- GARCH(1,1) with Student-t errors on a zero-mean residual series ----------
export function garchFit(r) {
  const v0 = mean(r.map(x => x * x));
  // persistence = alpha + beta in (0, 0.995); alpha = share of the persistence; omega from the sample variance target.
  const sig = v => 1 / (1 + Math.exp(-v));
  const unpack = x => { const p = 0.995 * sig(x[0]), a = p * sig(x[1]); return { omega: v0 * (1 - p) * Math.exp(x[2]), alpha: a, beta: p - a, nu: 2.05 + Math.exp(x[3]) }; };
  const nll = x => {
    const { omega, alpha, beta, nu } = unpack(x); if (Math.abs(x[2]) > 5) return 1e12;
    let s2 = v0, L = 0;
    for (let t = 0; t < r.length; t++) { if (t > 0) s2 = omega + alpha * r[t - 1] ** 2 + beta * s2; L += -0.5 * Math.log(s2) + ltstd(r[t] / Math.sqrt(s2), nu); }
    return -L;
  };
  let r0 = null;
  for (const s of [[1, -1.5], [2.5, -2], [0, -1]]) { const r = nelderMead(nll, [s[0], s[1], 0, Math.log(6)], { step: 0.5, iters: 4000 }); if (!r0 || r.f < r0.f) r0 = r; }
  const P = unpack(r0.x), cv = []; let s2 = v0;
  for (let t = 0; t < r.length; t++) { if (t > 0) s2 = P.omega + P.alpha * r[t - 1] ** 2 + P.beta * s2; cv.push(Math.sqrt(s2)); }
  const next = P.omega + P.alpha * r[r.length - 1] ** 2 + P.beta * s2;
  return { ...P, condvol: cv, next, persist: P.alpha + P.beta, uncond: Math.sqrt(P.omega / (1 - P.alpha - P.beta)) };
}
export function garchPath(g, h) { const out = []; let s2 = g.next; for (let i = 0; i < h; i++) { out.push(Math.sqrt(s2)); s2 = g.omega + g.persist * s2; } return out; }

// ---------- ARCH-LM test: regress e² on its lags; LM = n·R² ~ χ²(q) ----------
function gammaincUpper(s, x) {   // regularized upper incomplete gamma Q(s, x)
  if (x <= 0) return 1;
  if (x < s + 1) { let sum = 1 / s, term = sum; for (let n = 1; n < 500; n++) { term *= x / (s + n); sum += term; if (term < sum * 1e-14) break; } return 1 - sum * Math.exp(-x + s * Math.log(x) - lgamma(s)); }
  let b = x + 1 - s, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - s); b += 2; d = an * d + b; d = Math.abs(d) < 1e-300 ? 1e-300 : d; c = b + an / c; c = Math.abs(c) < 1e-300 ? 1e-300 : c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
  return Math.exp(-x + s * Math.log(x) - lgamma(s)) * h;
}
export function archLM(e, q = 6) {
  const e2 = e.map(v => v * v), X = [], y = [];
  for (let t = q; t < e2.length; t++) { X.push(Array.from({ length: q }, (_, i) => e2[t - i - 1])); y.push(e2[t]); }
  const b = ols(X, y); if (!b) return 1;
  const yh = X.map(x => olsPredict(b, x)), my = mean(y);
  const r2 = 1 - y.reduce((s, v, i) => s + (v - yh[i]) ** 2, 0) / y.reduce((s, v) => s + (v - my) ** 2, 0);
  return gammaincUpper(q / 2, (y.length * r2) / 2);
}

// ---------- seeded random numbers ----------
export function rng(seed = 20261016) {
  let s = seed >>> 0;
  const u = () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const norm = () => { let a = 0; while (a === 0) a = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u()); };
  const chi2 = k => { let x = 0; for (let i = 0; i < Math.floor(k); i++) x += norm() ** 2; const fr = k - Math.floor(k); if (fr > 0) x += fr * norm() ** 2; return x; };
  // standardized Student-t (unit variance)
  const tstd = nu => (nu > 60 ? norm() : norm() / Math.sqrt(chi2(nu) / nu) * Math.sqrt((nu - 2) / nu));
  return { u, norm, tstd };
}
