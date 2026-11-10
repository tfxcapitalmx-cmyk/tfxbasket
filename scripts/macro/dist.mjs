// Distribución → Datos macroeconómicos (D.series): 23 series and their horizons rebuilt from FRED,
// the charts already maintained by this pipeline (ISM and UMich, with the manual capture) and the S&P 500 monthly closes.
// Pure: no network, no disk. Definitions reproduce the original build (checked with scripts/macro/check-dist.mjs).

// FRED series this module needs (full history: the distributions use every observation).
export const DIST_SERIES = ['CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PPIFES', 'DCOILWTICO', 'T5YIE', 'T10Y2Y', 'UNRATE', 'ICSA',
  'USALOLITOAASTSAM', 'MICH', 'DGS2', 'DGS10', 'PAYEMS', 'GDPC1', 'M2SL', 'FEDFUNDS', 'PERMIT', 'RSAFS'];

// Horizon recipes. [kind, arg, decimals]
//  monthly: pct n = % change vs n months earlier · ann3 = 3-month change annualised · diff n (×k) = change in units · lvl
//  daily:   dpct / dpb = change vs previous observation · wpct/wpb, mpct/mpb = change of the last close of the week (Friday key)
//           or calendar month, with the high-low range of the period · mavg n = % change of the monthly average · dlvl
//  weekly (ICSA): wk = % change vs previous week · a4y = 4-week average vs the same 4 weeks 52 weeks earlier
//  quarterly (GDP): qa = q/q annualised · qy = vs 4 quarters earlier
const SPEC = {
  cpi: { src: 'CPIAUCSL', h: { MOM: ['pct', 1, 4], YOY: ['pct', 12, 4], A3: ['ann3', 3, 4] } },
  core: { src: 'CPILFESL', h: { MOM: ['pct', 1, 4], YOY: ['pct', 12, 4], A3: ['ann3', 3, 4] } },
  ppi: { src: 'PPIFIS', h: { MOM: ['pct', 1, 4], YOY: ['pct', 12, 4], A3: ['ann3', 3, 4] } },
  ppic: { src: 'PPIFES', h: { MOM: ['pct', 1, 4], YOY: ['pct', 12, 4], A3: ['ann3', 3, 4] } },
  wti: { src: 'DCOILWTICO', h: { D: ['dpct', 1, 4], W: ['wpct', 1, 4], M: ['mpct', 1, 4], MOM: ['mavg', 1, 4], YOY: ['mavg', 12, 4] } },
  t5yie: { src: 'T5YIE', h: { LVL: ['dlvl', 1, 2], D: ['dpb', 1, 2], M: ['mpb', 1, 2] } },
  t10y2y: { src: 'T10Y2Y', h: { LVL: ['mavgx100', 1, 4], D: ['dpb', 1, 2], M: ['mpb', 1, 2] } },
  unrate: { src: 'UNRATE', h: { LVL: ['lvl', 1, 1], MOM: ['diff', 1, 1], YOY: ['diff', 12, 1] } },
  icsa: { src: 'ICSA', h: { LVL: ['wlvlk', 1, 0], W: ['wk', 1, 2], A4Y: ['a4y', 52, 2] } },
  cli: { src: 'USALOLITOAASTSAM', h: { LVL: ['lvl', 1, 3], MOM: ['diff', 1, 3] } },
  mich: { src: 'chart:mich', h: { LVL: ['lvl', 1, 1], MOM: ['diff', 1, 1], YOY: ['diff', 12, 1] } },
  dgs2: { src: 'DGS2', h: { LVL: ['dlvl', 1, 2], D: ['dpb', 1, 2], W: ['wpb', 1, 2], M: ['mpb', 1, 2] } },
  dgs10: { src: 'DGS10', h: { LVL: ['dlvl', 1, 2], D: ['dpb', 1, 2], W: ['wpb', 1, 2], M: ['mpb', 1, 2] } },
  nfp: { src: 'PAYEMS', h: { MK: ['diff', 1, 0], MOM: ['pct', 1, 3], YOY: ['pct', 12, 2] } },
  pmi: { src: 'chart:pmi', h: { LVL: ['lvl', 1, 1], MOM: ['diff', 1, 1], YOY: ['diff', 12, 1] } },
  nmi: { src: 'chart:nmi', h: { LVL: ['lvl', 1, 1], MOM: ['diff', 1, 1], YOY: ['diff', 12, 1] } },
  gdp: { src: 'GDPC1', h: { QA: ['qa', 1, 2], QY: ['qy', 4, 2] } },
  umcsi: { src: 'chart:umcsi', h: { LVL: ['lvl', 1, 1], MOM: ['diff', 1, 1], YOY: ['diff', 12, 1] } },
  m2: { src: 'M2SL', h: { MOM: ['pct', 1, 3], YOY: ['pct', 12, 2] } },
  ff: { src: 'FEDFUNDS', h: { LVL: ['lvl', 1, 2], MOM: ['diffx100', 1, 2], YOY: ['diffx100', 12, 2] } },
  permits: { src: 'PERMIT', h: { LVL: ['lvl', 1, 0], MOM: ['pct', 1, 4], YOY: ['pct', 12, 4] } },
  retail: { src: 'RSAFS', h: { MOM: ['pct', 1, 4], YOY: ['pct', 12, 4], RYY: ['real', 12, 4], A3: ['ann3', 3, 4] } },
  spx: { src: 'spx', h: { MOM: ['pct', 1, 4], YOY: ['pct', 12, 4], A3: ['ann3', 3, 4] } }
};
// Label shown as the source of each series.
const SOURCE = { mich: 'FRED MICH + lectura preliminar manual', pmi: 'ISM (captura manual)', nmi: 'ISM (captura manual)', umcsi: 'FRED UMCSENT + lectura preliminar manual', spx: 'Investing.com (histórico) + Yahoo Finance' };

const rnd = (x, d) => { const k = 10 ** d; return Math.round(x * k) / k + 0; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const shiftYm = (k, n) => { let y = +k.slice(0, 4), m = +k.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
const friday = d => { const t = Date.parse(d + 'T00:00:00Z'), w = new Date(t).getUTCDay(); return new Date(t + ((5 - w + 7) % 7) * 864e5).toISOString().slice(0, 10); };
const monthEnd = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).toISOString().slice(0, 10);
// Monthly aggregates of daily data only use complete months (as in the original build); weeks include the current one.
const lastWeekday = d => { const t = new Date(monthEnd(d) + 'T00:00:00Z'); while ([0, 6].includes(t.getUTCDay())) t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
const completeMonths = obs => { if (!obs.length) return obs; const last = obs[obs.length - 1][0]; return last >= lastWeekday(last) ? obs : obs.filter(o => o[0].slice(0, 7) < last.slice(0, 7)); };
const group = (obs, key) => { const g = new Map(); for (const [d, v] of obs) { const k = key(d); (g.get(k) || g.set(k, []).get(k)).push(v); } return [...g.entries()]; };

// Monthly map 'YYYY-MM' → value from observations dated 'YYYY-MM-DD'.
const monthly = obs => new Map(obs.map(([d, v]) => [d.slice(0, 7), v]));

function monthlyHorizon(m, [kind, n], extra) {
  const out = [];
  for (const k of [...m.keys()].sort()) {
    const x = m.get(k), p = m.get(shiftYm(k, -n));
    let v = null;
    if (kind === 'lvl') v = x;
    else if (p == null) continue;
    else if (kind === 'pct') v = (x / p - 1) * 100;
    else if (kind === 'ann3') v = ((x / p) ** 4 - 1) * 100;
    else if (kind === 'diff') v = x - p;
    else if (kind === 'diffx100') v = (x - p) * 100;
    else if (kind === 'real') { const c = extra.get(k), cp = extra.get(shiftYm(k, -n)); if (c == null || cp == null) continue; v = ((x / c) / (p / cp) - 1) * 100; }
    if (v != null && Number.isFinite(v)) out.push([k + '-01', v]);
  }
  return out;
}

function dailyHorizon(obs, [kind]) {
  const pct = /pct$/.test(kind);
  const chg = (c, p) => (pct ? (c / p - 1) * 100 : (c - p) * 100);
  if (kind === 'dlvl') return { pts: obs.map(([d, v]) => [d, v]) };
  if (kind === 'dpct' || kind === 'dpb') { const pts = []; for (let i = 1; i < obs.length; i++) pts.push([obs[i][0], chg(obs[i][1], obs[i - 1][1])]); return { pts }; }
  if (kind === 'mavg' || kind === 'mavgx100') {
    const g = group(completeMonths(obs), d => d.slice(0, 7)).map(([k, a]) => [k, mean(a)]);
    return { g };
  }
  const key = kind[0] === 'w' ? friday : monthEnd;
  const g = group(kind[0] === 'm' ? completeMonths(obs) : obs, key).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const pts = [], rng = [];
  for (let i = 0; i < g.length; i++) {
    const [k, a] = g[i], hi = Math.max(...a), lo = Math.min(...a);
    rng.push([k, pct ? (hi - lo) / lo * 100 : (hi - lo) * 100]);
    if (i) pts.push([k, chg(a[a.length - 1], g[i - 1][1][g[i - 1][1].length - 1])]);
  }
  return { pts, rng };
}

const toH = (pts, unit, d) => ({ values: pts.map(p => rnd(p[1], d)), dates: pts.map(p => p[0]), unit });

// prev: previous D.series (data/dist.json or data/snapshot.json). obs: FRED observations by id.
// charts: data/charts.json → charts (monthly ISM / UMich with the manual capture). spx: [['YYYY-MM', close], …].
export function buildDist(prev, obs, charts, spx) {
  const out = {};
  for (const [key, spec] of Object.entries(SPEC)) {
    const P = prev[key];
    if (!P) continue;
    let src = null;
    if (spec.src === 'spx') src = spx && spx.length ? new Map(spx) : null;
    else if (spec.src.startsWith('chart:')) { const c = charts[spec.src.slice(6)]; src = c && c.s ? new Map(c.s.d.map((d, i) => [d, c.s.v[i]])) : null; }
    else src = obs[spec.src] && obs[spec.src].length ? obs[spec.src] : null;
    if (!src) { out[key] = P; continue; } // source missing: keep the last valid series

    const h = {};
    for (const [hk, recipe] of Object.entries(spec.h)) {
      const old = P.h[hk]; if (!old) continue;
      const [kind, n, d] = recipe;
      let H;
      if (spec.src === 'GDPC1') {
        const q = src; const pts = [];
        for (let i = n; i < q.length; i++) pts.push([q[i][0], kind === 'qa' ? ((q[i][1] / q[i - 1][1]) ** 4 - 1) * 100 : (q[i][1] / q[i - n][1] - 1) * 100]);
        H = toH(pts, old.unit, d);
      } else if (spec.src === 'ICSA') {
        const w = src, pts = [];
        if (kind === 'wlvlk') for (const [dt, v] of w) pts.push([dt, v / 1000]);
        if (kind === 'wk') for (let i = 1; i < w.length; i++) pts.push([w[i][0], (w[i][1] / w[i - 1][1] - 1) * 100]);
        if (kind === 'a4y') for (let i = n + 3; i < w.length; i++) pts.push([w[i][0], (mean(w.slice(i - 3, i + 1).map(x => x[1])) / mean(w.slice(i - n - 3, i - n + 1).map(x => x[1])) - 1) * 100]);
        H = toH(pts, old.unit, d);
      } else if (/^(d|w|m)(pct|pb|lvl)$|^mavg/.test(kind) && Array.isArray(src)) {
        const r = dailyHorizon(src, recipe);
        if (r.g) {
          const m = new Map(r.g), pts = [];
          for (const [k, v] of r.g) {
            if (kind === 'mavgx100') { pts.push([monthEnd(k + '-01'), v * 100]); continue; }
            const p = m.get(shiftYm(k, -n)); if (p != null) pts.push([monthEnd(k + '-01'), (v / p - 1) * 100]);
          }
          H = toH(pts, old.unit, d);
        } else {
          H = toH(r.pts, old.unit, d);
          if (old.rng && r.rng) H.rng = toH(r.rng, old.rng.unit, d);
        }
      } else {
        const m = src instanceof Map ? src : monthly(src);
        H = toH(monthlyHorizon(m, recipe, spec.h[hk][0] === 'real' ? monthly(obs.CPIAUCSL || []) : null), old.unit, d);
      }
      // History before the first computable date (older book data) is kept as it was.
      if (H.dates.length && old.dates.length && old.dates[0] < H.dates[0]) {
        const k = old.dates.findIndex(x => x >= H.dates[0]), cut = k < 0 ? old.dates.length : k;
        H.dates = old.dates.slice(0, cut).concat(H.dates); H.values = old.values.slice(0, cut).concat(H.values);
      }
      if (!H.dates.length) H = old;
      h[hk] = H;
    }
    for (const hk of Object.keys(P.h)) if (!h[hk]) h[hk] = P.h[hk];
    // Last observation: the daily horizon when there is one (week and month keys are period labels, not data dates).
    const last = h.D ? h.D.dates[h.D.dates.length - 1] : Object.values(h).map(x => x.dates[x.dates.length - 1]).sort().pop();
    out[key] = { ...P, fred: SOURCE[key] || spec.src, last, h };
  }
  for (const k of Object.keys(prev)) if (!out[k]) out[k] = prev[k];
  return out;
}

// A series may not shrink, go backwards or carry impossible values; otherwise the run keeps the previous file.
export function validateDist(next, prev) {
  const p = [];
  for (const [k, s] of Object.entries(prev)) {
    const n = next[k];
    if (!n) { p.push(`dist ${k}: falta la serie`); continue; }
    for (const [hk, H] of Object.entries(s.h)) {
      const N = n.h[hk];
      if (!N) { p.push(`dist ${k}.${hk}: falta el horizonte`); continue; }
      if (N.values.length !== N.dates.length) p.push(`dist ${k}.${hk}: fechas y valores no cuadran`);
      if (N.values.length < H.values.length * 0.97) p.push(`dist ${k}.${hk}: el historial se encoge (${H.values.length} → ${N.values.length})`);
      if (N.dates[N.dates.length - 1] < H.dates[H.dates.length - 1]) p.push(`dist ${k}.${hk}: la última fecha retrocede (${H.dates[H.dates.length - 1]} → ${N.dates[N.dates.length - 1]})`);
      if (N.values.some(v => !Number.isFinite(v))) p.push(`dist ${k}.${hk}: valores no numéricos`);
      for (let i = 1; i < N.dates.length; i++) if (N.dates[i] <= N.dates[i - 1]) { p.push(`dist ${k}.${hk}: fechas fuera de orden en ${N.dates[i]}`); break; }
    }
  }
  return p;
}
