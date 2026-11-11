// Cuantitativo → Rendimientos de los bonos: curve by tenor, spreads, curve regimes (D.snap.curve) and the
// UST 2Y / 10Y six-month-change tables (D.snap.yields). Pure: no network, no disk.
// Definitions rebuilt from the values stored on 2026-10-14 and checked with `node scripts/macro/check-curve.mjs`.
//
// - Monthly yield = average of the daily FRED observations of the month (curve table: rounded to 2 decimals, like
//   FRED's monthly GS series; the month in progress keeps the unrounded average of the days published so far).
// - Six-month bucket: ≤ −75 pb, −75/−25, ±25, +25/+75, ≥ +75 pb (yield change against the same month 6 months earlier).
// - Outcomes 6/12 months later: Fed funds (pb; a move counts when it exceeds 12.5 pb), core and headline CPI a/a (pp),
//   unemployment rate (pp). A month enters a table only when all its outcomes for that horizon are published.
// - Curve regime (6 months): level = average of 2Y and 10Y, slope = 10Y − 2Y. |level| < 25 pb = stable level;
//   otherwise steepening / flattening when the slope moves more than 10 pb, parallel when it does not.

export const CURVE_SERIES = ['DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30'];
const TENORS = [['3M', 'DGS3MO', 'Corto'], ['6M', 'DGS6MO', 'Corto'], ['1Y', 'DGS1', 'Corto'], ['2Y', 'DGS2', 'Corto'], ['3Y', 'DGS3', 'Intermedio'],
  ['5Y', 'DGS5', 'Intermedio'], ['7Y', 'DGS7', 'Intermedio'], ['10Y', 'DGS10', 'Largo'], ['20Y', 'DGS20', 'Largo'], ['30Y', 'DGS30', 'Largo']];
const SPREADS = [['10Y−2Y', 'DGS10', 'DGS2', 'Crecimiento frente a política monetaria.'], ['10Y−3M', 'DGS10', 'DGS3MO', 'Señal de recesión de la Fed de NY.'],
  ['30Y−5Y', 'DGS30', 'DGS5', 'Prima por plazo del tramo largo.'], ['2Y−3M', 'DGS2', 'DGS3MO', 'Alzas o recortes esperados a 2 años.']];
const REGIMES = [
  ['Bear steepening', 'Suben las tasas y más el tramo largo: inflación o prima por plazo.'],
  ['Bear flattening', 'Suben las tasas y más el tramo corto: la Fed aprieta.'],
  ['Alza paralela', 'Toda la curva sube parejo: se reprecia el nivel de tasas.'],
  ['Nivel estable', 'El nivel de tasas casi no cambia en 6 meses.'],
  ['Baja paralela', 'Toda la curva baja parejo.'],
  ['Bull flattening', 'Bajan las tasas y más el tramo largo: menor crecimiento o refugio.'],
  ['Bull steepening', 'Bajan las tasas y más el tramo corto: el mercado anticipa recortes.'],
];
export const BUCKETS = ['Bajan fuerte', 'Bajan', 'Estables', 'Suben', 'Suben fuerte'];
// The yields tables and the regimes start in 1977, the first full year of the 2Y (as the original tables).
const FROM = '1977-01';
const FF_MOVE = 0.125;

export const bucket = x => (x <= -0.75 ? 'Bajan fuerte' : x <= -0.25 ? 'Bajan' : x < 0.25 ? 'Estables' : x < 0.75 ? 'Suben' : 'Suben fuerte');
export function shift(k, n) { let y = +k.slice(0, 4), m = +k.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; }
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const share = (a, f) => (a.length ? a.filter(f).length / a.length : null);
const r2 = x => Math.round(x * 100) / 100;

// Daily [[date, value], …] → Map month → average (`m`: 2 decimals except the month in progress; `raw`: unrounded) and
// the number of days in the month in progress. The curve table uses `m`; the 2Y/10Y tables use `raw` (as the original).
export function monthly(daily) {
  const s = new Map();
  for (const [d, v] of daily) { const k = d.slice(0, 7), a = s.get(k) || [0, 0]; a[0] += v; a[1]++; s.set(k, a); }
  const keys = [...s.keys()], last = keys[keys.length - 1], m = new Map(), raw = new Map();
  for (const k of keys) { const [t, n] = s.get(k), v = t / n; raw.set(k, v); m.set(k, k === last ? v : r2(v)); }
  return { m, raw, cur: last, nobs: s.get(last)[1] };
}

// Value of the change of `M` from k to k+h, or null when either month is missing.
const fwd = (M, k, h) => (M.has(k) && M.has(shift(k, h)) ? M.get(shift(k, h)) - M.get(k) : null);
// Share of the previous 120 months at or below the current value (10-year percentile).
function pct10(M, cur) { const v = M.get(cur), prev = [...M.keys()].filter(k => k < cur).slice(-120).map(k => M.get(k)); return prev.length ? prev.filter(x => x <= v).length / prev.length : null; }

/**
 * @param daily  { DGS3MO: [[date, value], …], … } FRED daily yields (full history)
 * @param m      { ff, core, cpi, un }: Map month → Fed funds level, core CPI a/a, CPI a/a, unemployment rate
 */
export function buildCurve(daily, m) {
  const M = {}, last = {};
  for (const [, id] of TENORS) { M[id] = monthly(daily[id]); last[id] = daily[id][daily[id].length - 1]; }
  const cur = M.DGS10.cur, date = last.DGS10[0];

  // Outcomes of month k at horizon h; null when any of them is not published yet.
  const out = (k, h) => {
    const ff = fwd(m.ff, k, h), kk = fwd(m.core, k, h), c = fwd(m.cpi, k, h), u = fwd(m.un, k, h);
    return { ff, kk, c, u };
  };

  const rows = TENORS.map(([t, id, tramo]) => {
    const Y = M[id].m, avg = Y.get(cur), d = h => avg - Y.get(shift(cur, -h));
    const hist = [...Y.keys()].filter(k => k < cur && Y.has(shift(k, -6)));
    const g = hist.filter(k => bucket(Y.get(k) - Y.get(shift(k, -6))) === bucket(d(6)));
    const o = g.map(k => out(k, 12)).filter(x => x.ff != null && x.kk != null && x.u != null);
    const all = hist.map(k => out(k, 12));
    const ffs = all.filter(x => x.ff != null).map(x => x.ff), ks = all.filter(x => x.kk != null).map(x => x.kk), us = all.filter(x => x.u != null).map(x => x.u);
    return {
      t, tramo, last: last[id][1], avg, d1: d(1), d3: d(3), d6: d(6), d12: d(12), b: bucket(d(6)), pct10: pct10(Y, cur), n: o.length,
      ff12: mean(o.map(x => x.ff)) * 100, ffup: share(o, x => x.ff > FF_MOVE), ffdn: share(o, x => x.ff < -FF_MOVE),
      k12: mean(o.map(x => x.kk)), kup: share(o, x => x.kk > 0), u12: mean(o.map(x => x.u)), uup: share(o, x => x.u > 0),
      since: hist[0].slice(0, 4), base_ff: mean(ffs) * 100, base_k: mean(ks), base_u: mean(us),
    };
  });

  const lastOn = (id, dt) => { const a = daily[id]; for (let i = a.length - 1; i >= 0; i--) if (a[i][0] <= dt) return a[i][1]; return null; };
  const spreads = SPREADS.map(([lab, a, b, what]) => {
    const S = new Map([...M[a].m.keys()].filter(k => M[b].m.has(k)).map(k => [k, M[a].m.get(k) - M[b].m.get(k)]));
    return { lab, what, last: lastOn(a, date) - lastOn(b, date), d6: S.get(cur) - S.get(shift(cur, -6)), d12: S.get(cur) - S.get(shift(cur, -12)), pct10: pct10(S, cur) };
  });

  const A = M.DGS2.m, B = M.DGS10.m, lv = k => (A.get(k) + B.get(k)) / 2, sl = k => B.get(k) - A.get(k);
  const cls = (dl, ds) => (Math.abs(dl) < 0.25 ? 'Nivel estable' : dl > 0 ? (ds > 0.1 ? 'Bear steepening' : ds < -0.1 ? 'Bear flattening' : 'Alza paralela')
    : (ds > 0.1 ? 'Bull steepening' : ds < -0.1 ? 'Bull flattening' : 'Baja paralela'));
  const rk = [...A.keys()].filter(k => k >= FROM && k < cur && B.has(k) && A.has(shift(k, -6)) && B.has(shift(k, -6)));
  const regimes = REGIMES.map(([lab, what]) => {
    const o = rk.filter(k => cls(lv(k) - lv(shift(k, -6)), sl(k) - sl(shift(k, -6))) === lab)
      .map(k => ({ ...out(k, 12), y: fwd(B, k, 12), s: B.has(shift(k, 12)) && A.has(shift(k, 12)) ? sl(shift(k, 12)) - sl(k) : null }))
      .filter(x => x.ff != null && x.kk != null && x.u != null && x.y != null);
    return { lab, what, n: o.length, ff12: mean(o.map(x => x.ff)) * 100, ffup: share(o, x => x.ff > FF_MOVE), ffdn: share(o, x => x.ff < -FF_MOVE),
      k12: mean(o.map(x => x.kk)), u12: mean(o.map(x => x.u)), uup: share(o, x => x.u > 0), y10: mean(o.map(x => x.y)) * 100, s12: mean(o.map(x => x.s)) * 100 };
  });
  const dl = lv(cur) - lv(shift(cur, -6)), ds = sl(cur) - sl(shift(cur, -6));
  const shape = { ten: TENORS.map(([t]) => t), hoy: TENORS.map(([, id]) => last[id][1]) };
  for (const h of [1, 6, 12]) shape['m' + h] = TENORS.map(([, id]) => r2(M[id].m.get(shift(cur, -h))));

  const curve = { rows, spreads, regimes, now: { reg: cls(dl, ds), dl, ds }, shape, date, nobs: M.DGS10.nobs, since_reg: FROM.slice(0, 4) };

  // UST 2Y / 10Y: bucket of the six-month change of the monthly average; current = last daily vs the same day 6 months earlier.
  const yields = {};
  for (const [key, id] of [['d2', 'DGS2'], ['d10', 'DGS10']]) {
    const Y = M[id].raw, ks = [...Y.keys()].filter(k => k >= FROM && k < cur && Y.has(shift(k, -6)));
    const rowsY = BUCKETS.map(lab => {
      const g = ks.filter(k => bucket(Y.get(k) - Y.get(shift(k, -6))) === lab), r = { lab, n: g.length };
      for (const h of [6, 12]) {
        const o = g.map(k => out(k, h)).filter(x => x.ff != null && x.kk != null && x.c != null);
        Object.assign(r, { ['ff' + h]: mean(o.map(x => x.ff)) * 100, ['ffup' + h]: share(o, x => x.ff > FF_MOVE), ['ffdn' + h]: share(o, x => x.ff < -FF_MOVE),
          ['k' + h]: mean(o.map(x => x.kk)), ['kup' + h]: share(o, x => x.kk > 0), ['c' + h]: mean(o.map(x => x.c)), ['cup' + h]: share(o, x => x.c > 0), ['n' + h]: o.length });
      }
      return r;
    });
    const ld = last[id][0], back = `${shift(ld.slice(0, 7), -6)}${ld.slice(7)}`, c = last[id][1] - lastOn(id, back);
    yields[key] = { rows: rowsY, cur: c, curb: bucket(c), last: last[id][1], date: ld, since: FROM.slice(0, 4) };
  }
  return { curve, yields };
}

// Errors that must stop the publication (the page keeps the previous file).
export function validateCurve({ curve, yields }, today) {
  const e = [], fin = x => typeof x === 'number' && Number.isFinite(x);
  if (curve.rows.length !== 10) e.push('la curva no tiene 10 plazos');
  for (const r of curve.rows) {
    if (!fin(r.last) || r.last < -1 || r.last > 25) e.push(`${r.t}: rendimiento fuera de rango (${r.last})`);
    if (!(r.n >= 30)) e.push(`${r.t}: solo ${r.n} meses en su tramo`);
    for (const k of ['avg', 'd1', 'd6', 'd12', 'ff12', 'k12', 'u12', 'pct10']) if (!fin(r[k])) e.push(`${r.t}: ${k} no numérico`);
  }
  for (const s of curve.spreads) if (!fin(s.last) || !fin(s.d6)) e.push(`${s.lab}: diferencial no numérico`);
  if (curve.regimes.reduce((a, r) => a + r.n, 0) < 500) e.push('regímenes de la curva con menos de 500 meses');
  if (!curve.regimes.some(r => r.lab === curve.now.reg)) e.push('régimen actual desconocido');
  for (const [k, Y] of Object.entries(yields)) {
    if (Y.rows.reduce((a, r) => a + r.n, 0) < 500) e.push(`${k}: menos de 500 meses`);
    if (!fin(Y.cur) || !Y.rows.some(r => r.lab === Y.curb)) e.push(`${k}: cambio de 6 meses inválido`);
  }
  if (today && (Date.parse(today) - Date.parse(curve.date)) / 864e5 > 10) e.push(`la curva lleva más de 10 días sin datos (${curve.date})`);
  return e;
}
