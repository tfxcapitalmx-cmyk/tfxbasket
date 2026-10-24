// COT (CFTC Traders in Financial Futures) — pure transforms shared by the Node updater and the browser tests.
// No I/O here: input is the API rows, output is the object written to data/cot.json.

export const DATASET = 'gpe5-46if'; // TFF, futures only
export const API = `https://publicreporting.cftc.gov/resource/${DATASET}.json`;
export const SOURCE = 'CFTC · Traders in Financial Futures (futuros únicamente)';

// The dollar side uses ICE's USD INDEX contract, as the terminal always has.
export const CURRENCIES = [
  { ccy: 'AUD', code: '232741', name: 'AUSTRALIAN DOLLAR' },
  { ccy: 'CAD', code: '090741', name: 'CANADIAN DOLLAR' },
  { ccy: 'CHF', code: '092741', name: 'SWISS FRANC' },
  { ccy: 'EUR', code: '099741', name: 'EURO FX' },
  { ccy: 'GBP', code: '096742', name: 'BRITISH POUND' },
  { ccy: 'JPY', code: '097741', name: 'JAPANESE YEN' },
  { ccy: 'MXN', code: '095741', name: 'MEXICAN PESO' },
  { ccy: 'NZD', code: '112741', name: 'NZ DOLLAR' },
  { ccy: 'USD', code: '098662', name: 'USD INDEX' },
];

const F = {
  d: 'report_date_as_yyyy_mm_dd',
  OI: 'open_interest_all',
  L: 'lev_money_positions_long',
  S: 'lev_money_positions_short',
  aL: 'asset_mgr_positions_long',
  aS: 'asset_mgr_positions_short',
  nL: 'nonrept_positions_long_all',
  nS: 'nonrept_positions_short_all',
};

export function queryUrl(code) {
  const q = new URLSearchParams({
    $select: Object.values(F).join(','),
    $where: `cftc_contract_market_code='${code}'`,
    $order: `${F.d} ASC`,
    $limit: '5000',
  });
  return `${API}?${q}`;
}

// Matches the rounding of the original offline generator (checked against the 2026-10-13 snapshot).
const r = (x, k) => Number(x.toFixed(k));
const ymd = s => +String(s).slice(0, 10).replace(/-/g, '');
const iso = n => { const s = String(n); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
const addDays = (n, k) => { const t = Date.UTC(+String(n).slice(0, 4), +String(n).slice(4, 6) - 1, +String(n).slice(6, 8)) + k * 864e5; return new Date(t).toISOString().slice(0, 10); };

function median(sorted) {
  const i = (sorted.length - 1) / 2, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Percentile = share of the window at or below today; z uses the sample standard deviation.
function windowStats(v, years) {
  const w = years === 'all' ? v : v.slice(-52 * years), n = w.length, cur = v[v.length - 1];
  const m = w.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  const s = [...w].sort((a, b) => a - b);
  return {
    y: years, n,
    pct: r(100 * w.filter(x => x <= cur).length / n, 1),
    z: sd ? r((cur - m) / sd, 2) : 0,
    mn: r(s[0], 1), mx: r(s[n - 1], 1), med: r(median(s), 1),
  };
}

export function buildCurrency(cfg, rows) {
  const byDate = new Map();
  for (const row of rows) byDate.set(ymd(row[F.d]), row); // last one wins if the API ever repeats a week
  const dates = [...byDate.keys()].sort((a, b) => a - b);
  const col = k => dates.map(d => Number(byDate.get(d)[F[k]]));
  const X = { ccy: cfg.ccy, name: cfg.name, code: cfg.code, d: dates };
  for (const k of ['L', 'S', 'OI', 'nL', 'nS', 'aL', 'aS']) X[k] = col(k);
  const i = dates.map((_, j) => j);
  X.npoi = i.map(j => r((X.L[j] - X.S[j]) / X.OI[j] * 100, 2));
  X.nnpoi = i.map(j => r((X.nL[j] - X.nS[j]) / X.OI[j] * 100, 2));
  X.anpoi = i.map(j => r((X.aL[j] - X.aS[j]) / X.OI[j] * 100, 2));
  X.shL = i.map(j => r(X.L[j] / (X.L[j] + X.S[j]) * 100, 1));
  X.nshL = i.map(j => r(X.nL[j] / (X.nL[j] + X.nS[j]) * 100, 1));
  delete X.aL; delete X.aS; // only the normalised asset-manager net is charted
  // Stats and changes run on the unrounded net so they are not shifted by display rounding.
  const raw = i.map(j => (X.L[j] - X.S[j]) / X.OI[j] * 100);

  const a = dates.length - 1, b = a - 1, at = (k, j) => byDate.get(dates[j])[F[k]] * 1;
  const net = j => at('L', j) - at('S', j), nnet = j => at('nL', j) - at('nS', j), anet = j => at('aL', j) - at('aS', j);
  X.now = {
    f: iso(dates[a]), L: X.L[a], S: X.S[a], OI: X.OI[a], net: net(a), npoi: X.npoi[a], shL: X.shL[a],
    dnet: net(a) - net(b), dL: X.L[a] - X.L[b], dS: X.S[a] - X.S[b], d4: r(raw[a] - raw[a - 4], 2),
    nL: X.nL[a], nS: X.nS[a], nnet: nnet(a), nnpoi: X.nnpoi[a], nshL: X.nshL[a], dnnet: nnet(a) - nnet(b),
    anet: anet(a), anpoi: X.anpoi[a], danet: anet(a) - anet(b),
  };
  X.st = {};
  for (const y of [1, 3, 5, 10, 'all']) X.st[y] = windowStats(raw, y);
  X.desde = iso(dates[0]);
  X.n = dates.length;
  return X;
}

// Report = Tuesday positions; CFTC publishes them Friday 15:30 New York (later after US holidays).
export function buildCot(rowsByCcy, fetchedAt) {
  const ccy = {};
  for (const cfg of CURRENCIES) ccy[cfg.ccy] = buildCurrency(cfg, rowsByCcy[cfg.ccy] || []);
  const last = Math.max(...Object.values(ccy).map(x => x.d[x.d.length - 1]));
  return {
    asof: iso(last),
    fuente: SOURCE,
    meta: {
      dataset: DATASET,
      url: API,
      fetched_at: fetchedAt,
      published_est: addDays(last, 3),
      next_report: addDays(last, 7),
      next_publish_est: addDays(last, 10),
    },
    ccy,
  };
}

// Returns a list of problems; an empty list means the file is safe to publish.
export function validate(next, prev) {
  const err = [];
  for (const cfg of CURRENCIES) {
    const X = next.ccy[cfg.ccy];
    if (!X || X.n < 260) { err.push(`${cfg.ccy}: historial insuficiente (${X ? X.n : 0} semanas)`); continue; }
    for (let j = 0; j < X.n; j++) {
      if (j && X.d[j] <= X.d[j - 1]) { err.push(`${cfg.ccy}: fechas fuera de orden en ${X.d[j]}`); break; }
      const vals = [X.L[j], X.S[j], X.OI[j], X.nL[j], X.nS[j]];
      if (vals.some(v => !Number.isFinite(v) || v < 0) || X.OI[j] <= 0) { err.push(`${cfg.ccy}: valores inválidos el ${X.d[j]}`); break; }
      if (X.L[j] > X.OI[j] || X.S[j] > X.OI[j]) { err.push(`${cfg.ccy}: posiciones mayores que el interés abierto el ${X.d[j]}`); break; }
    }
    if (iso(X.d[X.n - 1]) !== next.asof) err.push(`${cfg.ccy}: último informe ${iso(X.d[X.n - 1])} distinto del corte general ${next.asof}`);
    const P = prev && prev.ccy && prev.ccy[cfg.ccy];
    if (P && X.n < P.n) err.push(`${cfg.ccy}: el historial bajó de ${P.n} a ${X.n} semanas`);
  }
  if (prev && prev.asof && next.asof < prev.asof) err.push(`El corte nuevo (${next.asof}) es anterior al publicado (${prev.asof})`);
  return err;
}

export function daysSince(isoDate, now = new Date()) {
  return Math.floor((now - new Date(isoDate + 'T00:00:00Z')) / 864e5);
}
