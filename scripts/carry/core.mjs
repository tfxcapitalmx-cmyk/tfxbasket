// Carry module — pure transforms shared by the Node updater and the browser tests.
// Policy rates: BIS WS_CBPOL (official, all banks in one dataset; lags decisions by a few days), Fed from FRED.
// Output: the 28 major and minor pairs of the eight currencies with the direction of the positive swap.

export const BIS_URL = start => `https://stats.bis.org/api/v1/data/WS_CBPOL/D.US+XM+JP+GB+CA+CH+AU+NZ?startPeriod=${start}&format=csv&detail=dataonly`;
export const FRED_IDS = ['DFF'];

export const BANKS = [
  { ccy: 'USD', area: 'US', banco: 'Reserva Federal' },
  { ccy: 'EUR', area: 'XM', banco: 'BCE' },
  { ccy: 'JPY', area: 'JP', banco: 'Banco de Japón' },
  { ccy: 'GBP', area: 'GB', banco: 'Banco de Inglaterra' },
  { ccy: 'CAD', area: 'CA', banco: 'Banco de Canadá' },
  { ccy: 'CHF', area: 'CH', banco: 'Banco Nacional Suizo' },
  { ccy: 'AUD', area: 'AU', banco: 'Banco de la Reserva de Australia' },
  { ccy: 'NZD', area: 'NZ', banco: 'Banco de la Reserva de Nueva Zelanda' },
];

// Market quoting order. Majors are the seven pairs against the dollar; the rest are minors (crosses).
export const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD', 'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
  'AUDJPY', 'AUDCHF', 'AUDCAD', 'AUDNZD', 'NZDJPY', 'NZDCHF', 'NZDCAD', 'CADJPY', 'CADCHF', 'CHFJPY'];

const r2 = x => Math.round(x * 100) / 100;

// BIS rows → { US: [[date, value], ...] } without weekend gaps (NaN).
export function bisSeries(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(','), a = cols.indexOf('REF_AREA'), t = cols.indexOf('TIME_PERIOD'), v = cols.indexOf('OBS_VALUE'), out = {};
  for (const l of lines) { const r = l.split(','), x = +r[v]; if (!Number.isFinite(x)) continue; (out[r[a]] = out[r[a]] || []).push([r[t], x]); }
  for (const k in out) out[k].sort((p, q) => (p[0] < q[0] ? -1 : 1));
  return out;
}

// Date on which the current level started.
function since(obs) {
  const cur = obs[obs.length - 1][1];
  let j = obs.length - 1; while (j > 0 && obs[j - 1][1] === cur) j--;
  return j > 0 ? obs[j][0] : '';
}

export function buildCarry({ bis, fred, overrides = {} }) {
  const cb = BANKS.map(b => {
    if (b.ccy === 'USD') return { ccy: b.ccy, banco: b.banco, tasa: r2(fred.DFF[fred.DFF.length - 1][1]), desde: '', src: 'FRED', dato: fred.DFF[fred.DFF.length - 1][0] };
    const o = bis[b.area], ov = overrides[b.ccy];
    let tasa = r2(o[o.length - 1][1]), desde = since(o), src = 'BIS';
    // A manual override wins only when it is newer than BIS's last change (BIS lags decisions by days).
    if (ov && ov.desde > desde) { tasa = ov.tasa; desde = ov.desde; src = 'Manual'; }
    return { ccy: b.ccy, banco: b.banco, tasa, desde, src, dato: o[o.length - 1][0] };
  });
  const rate = Object.fromEntries(cb.map(b => [b.ccy, b.tasa]));
  const pairs = PAIRS.map((p, i) => {
    const base = p.slice(0, 3), quote = p.slice(3), rb = rate[base], rq = rate[quote], diff = r2(rb - rq);
    return { p, base, quote, grupo: i < 7 ? 'Mayor' : 'Menor', rb, rq, diff, dir: diff > 0 ? 'compra' : diff < 0 ? 'venta' : '—' };
  });
  // Freshness: the oldest of the latest observations, so one lagging bank is enough to flag the panel.
  const datos = cb.map(b => b.dato).sort()[0];
  return { cb, pairs, datos, meta: { tasas: 'BIS WS_CBPOL · Fed: FRED DFF' } };
}

export function validateOverrides(ov) {
  const err = [];
  for (const [ccy, o] of Object.entries(ov || {})) {
    if (!BANKS.some(b => b.ccy === ccy && b.ccy !== 'USD')) err.push(`manual.tasas.${ccy}: moneda no admitida (USD sale de FRED)`);
    if (typeof o.tasa !== 'number' || !(o.tasa >= -2 && o.tasa <= 30)) err.push(`manual.tasas.${ccy}.tasa fuera de rango`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.desde || '')) err.push(`manual.tasas.${ccy}.desde debe ser AAAA-MM-DD`);
  }
  return err;
}

export function validateCarry(c, todayIso) {
  const err = [];
  for (const b of c.cb) {
    if (!(b.tasa >= -2 && b.tasa <= 30)) err.push(`${b.ccy}: tasa fuera de rango (${b.tasa})`);
    if ((Date.parse(todayIso) - Date.parse(b.dato)) / 864e5 > 21) err.push(`${b.ccy}: sin dato desde ${b.dato}`);
  }
  if (c.pairs.length !== 28) err.push(`Se esperaban 28 pares y hay ${c.pairs.length}`);
  return err;
}
