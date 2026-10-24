// Ciclo económico — OECD CLI phases and their historical frequencies (D.snap.cycle and D.snap.cycproj).
// Phase rule (OECD convention, the same one app.js uses for PHM): CLI ≥ 100 and rising = expansión, ≥ 100 and
// falling = desaceleración, < 100 and falling = contracción, < 100 and rising = recuperación.
// Reproduces the original generator exactly (checked against the 2026-08 snapshot).

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const PH = ['EXP', 'DES', 'CON', 'REC'];
const SINCE = '1955-01-01';

const phaseOf = (v, prev) => (v >= 100 ? (v - prev >= 0 ? 'EXP' : 'DES') : (v - prev >= 0 ? 'REC' : 'CON'));
function quantile(sorted, p) { const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
const share = (list) => { const out = {}; for (const x of list) out[x] = (out[x] || 0) + 1; for (const k in out) out[k] /= list.length; return out; };

export function buildCycle(cliObs, man) {
  const obs = cliObs.filter(x => x[0] >= SINCE);
  const dates = obs.map(x => x[0].slice(0, 7)), vals = obs.map(x => x[1]), n = vals.length;
  const P = vals.map((v, i) => (i ? phaseOf(v, vals[i - 1]) : null));
  const runAt = P.map(() => 0);
  P.forEach((p, i) => { runAt[i] = !p ? 0 : i && P[i - 1] === p ? runAt[i - 1] + 1 : 1; });
  const phase = P[n - 1], run = runAt[n - 1];

  // Spells (consecutive months in one phase); the current one is still open.
  const spells = []; let s = null;
  P.forEach(p => { if (!p) return; if (s && s.p === p) s.len++; else { if (s) spells.push(s); s = { p, len: 1 }; } });
  const closed = spells, all = [...spells, s];
  const freq = {}, avgdur = {};
  for (const k of PH) {
    freq[k] = P.filter(p => p === k).length / (n - 1);
    const L = all.filter(x => x.p === k).map(x => x.len);
    avgdur[k] = L.reduce((a, b) => a + b, 0) / L.length;
  }
  // Which phase has historically followed the current one.
  const after = []; for (let i = 0; i < all.length - 1; i++) if (all[i].p === phase) after.push(all[i + 1].p);
  const trans = share(after);

  // Projection: months in the same phase with at least the current run, and the phase h months later.
  // dist2 adds the condition of today's momentum falling (second difference of the CLI below zero).
  const d = vals.map((v, i) => (i ? v - vals[i - 1] : null)), acc = d.map((x, i) => (i > 1 ? x - d[i - 1] : null));
  const h = {};
  for (const hz of [3, 6, 12]) {
    const base = [], down = [];
    for (let i = 1; i < n - hz; i++) {
      if (P[i] !== phase || runAt[i] < run) continue;
      base.push(P[i + hz]); if (acc[i] < 0) down.push(P[i + hz]);
    }
    h[hz] = { n: base.length, dist: share(base), n2: down.length, dist2: share(down) };
  }
  const rem = closed.filter(x => x.p === phase && x.len >= run).map(x => x.len - run).sort((a, b) => a - b);

  const lei = man.lei_6m, cei = man.cei_6m;
  const cycle = {
    cli: dates.slice(-5).map((dt, i) => [MES[+dt.slice(5, 7) - 1], Math.round(vals[n - 5 + i] * 1e5) / 1e5]),
    lei_6m: lei.valor, lei_6m_prev: lei.previo ?? null, lei_periodo: lei.periodo,
    cei_6m: cei ? cei.valor : null, cei_periodo: cei ? cei.periodo : null,
    dates, vals: vals.map(v => Math.round(v * 1e4) / 1e4), phase, run, freq, avgdur, trans,
  };
  const cycproj = {
    cur: phase, run, acc: acc[n - 1], dec3: [0, 1, 2].filter(k => d[n - 1 - k] < d[n - 2 - k]).length, h,
    rem_med: rem.length ? quantile(rem, 0.5) : null, rem_mean: rem.length ? rem.reduce((a, b) => a + b, 0) / rem.length : null,
    rem_n: rem.length, rem_q: rem.length ? [quantile(rem, 0.25), quantile(rem, 0.75)] : null,
    nxt: trans, last: dates[n - 1], since: SINCE.slice(0, 4),
  };
  return { cycle, cycproj };
}

export function validateCycle({ cycle, cycproj }) {
  const err = [];
  if (cycle.vals.length < 800) err.push(`Ciclo: historial corto (${cycle.vals.length} meses)`);
  if (cycle.vals.some(v => !(v > 80 && v < 120))) err.push('Ciclo: valores del CLI fuera de rango');
  if (!PH.includes(cycle.phase)) err.push('Ciclo: fase actual inválida');
  if (!(cycproj.h[3].n > 0)) err.push('Ciclo: sin casos históricos para la proyección');
  return err;
}
