// Carry module — pure transforms shared by the Node updater and the browser tests.
// Policy rates: BIS WS_CBPOL (official, all banks in one dataset; lags decisions by a few days), Fed from FRED.
// Prices: ECB euro reference rates (official, daily ~14:15 CET), crossed through EUR.

export const BIS_URL = start => `https://stats.bis.org/api/v1/data/WS_CBPOL/D.US+XM+JP+GB+CA+CH+AU+NZ?startPeriod=${start}&format=csv&detail=dataonly`;
export const ECB_FX_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+JPY+GBP+CHF+AUD+CAD+NZD.EUR.SP00.A?lastNObservations=5&format=csvdata';
export const FRED_IDS = ['DFF', 'DFEDTARL', 'DFEDTARU'];

export const BANKS = [
  { ccy: 'USD', area: 'US', pais: 'Estados Unidos', g7: true, banco: 'Reserva Federal' },
  { ccy: 'EUR', area: 'XM', pais: 'Zona euro', g7: true, banco: 'BCE', tipo: 'facilidad de depósito' },
  { ccy: 'JPY', area: 'JP', pais: 'Japón', g7: true, banco: 'Banco de Japón', tipo: 'call a un día' },
  { ccy: 'GBP', area: 'GB', pais: 'Reino Unido', g7: true, banco: 'Banco de Inglaterra', tipo: 'Bank Rate' },
  { ccy: 'CAD', area: 'CA', pais: 'Canadá', g7: true, banco: 'Banco de Canadá', tipo: 'objetivo a un día' },
  { ccy: 'CHF', area: 'CH', pais: 'Suiza', g7: false, banco: 'Banco Nacional Suizo', tipo: 'policy rate' },
  { ccy: 'AUD', area: 'AU', pais: 'Australia', g7: false, banco: 'Banco de la Reserva de Australia', tipo: 'cash rate' },
  { ccy: 'NZD', area: 'NZ', pais: 'Nueva Zelanda', g7: false, banco: 'Banco de la Reserva de Nueva Zelanda', tipo: 'OCR' },
];

// The 28 crosses in market quoting order; `tfx` marks the pairs of the desk's DoR book.
export const PAIRS = [
  ['AUDCHF', 1], ['USDCHF', 0], ['GBPCHF', 1], ['AUDJPY', 1], ['NZDCHF', 0], ['USDJPY', 0], ['GBPJPY', 1], ['EURCHF', 1],
  ['AUDCAD', 1], ['CADCHF', 0], ['EURAUD', 1], ['AUDNZD', 1], ['USDCAD', 0], ['GBPCAD', 1], ['NZDJPY', 0], ['EURUSD', 1],
  ['EURGBP', 1], ['EURJPY', 1], ['CHFJPY', 0], ['NZDUSD', 0], ['GBPNZD', 1], ['CADJPY', 0], ['GBPAUD', 1], ['AUDUSD', 1],
  ['NZDCAD', 0], ['EURNZD', 1], ['EURCAD', 1], ['GBPUSD', 1],
].map(([p, t]) => ({ p, tfx: !!t }));

const r2 = x => Math.round(x * 100) / 100;
const pct = x => `${x.toFixed(2)}%`;
const dmy = iso => iso.split('-').reverse().join('-');

export function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(','), at = k => cols.indexOf(k);
  return { rows: lines.map(l => l.split(',')), at };
}

// BIS rows → { US: [[date, value], ...] } without weekend gaps (NaN).
export function bisSeries(text) {
  const { rows, at } = parseCsv(text), a = at('REF_AREA'), t = at('TIME_PERIOD'), v = at('OBS_VALUE'), out = {};
  for (const r of rows) { const x = +r[v]; if (!Number.isFinite(x)) continue; (out[r[a]] = out[r[a]] || []).push([r[t], x]); }
  for (const k in out) out[k].sort((p, q) => (p[0] < q[0] ? -1 : 1));
  return out;
}

// ECB rows → { date, perEur: { USD: 1.16, JPY: …, EUR: 1 } } for the latest date that has every currency.
export function ecbRates(text) {
  const { rows, at } = parseCsv(text), c = at('CURRENCY'), t = at('TIME_PERIOD'), v = at('OBS_VALUE'), byDate = {};
  for (const r of rows) { const x = +r[v]; if (Number.isFinite(x)) (byDate[r[t]] = byDate[r[t]] || {})[r[c]] = x; }
  const need = ['USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD'];
  const date = Object.keys(byDate).sort().reverse().find(d => need.every(k => byDate[d][k]));
  return date ? { date, perEur: { EUR: 1, ...byDate[date] } } : null;
}

// Date on which the current level started.
function since(obs) {
  const cur = obs[obs.length - 1][1];
  let j = obs.length - 1; while (j > 0 && obs[j - 1][1] === cur) j--;
  return j > 0 ? obs[j][0] : '';
}

export function buildCarry({ bis, fred, fx, calendar, overrides = {} }, todayIso) {
  const cb = BANKS.map(b => {
    let tasa, lab, desde, src;
    if (b.ccy === 'USD') {
      const lo = fred.DFEDTARL[fred.DFEDTARL.length - 1][1], hi = fred.DFEDTARU[fred.DFEDTARU.length - 1][1];
      tasa = r2(fred.DFF[fred.DFF.length - 1][1]);
      lab = `${lo.toFixed(2)} – ${hi.toFixed(2)}% (efectiva ${tasa.toFixed(2)}%)`;
      desde = since(fred.DFEDTARU); src = 'Fed · FRED';
    } else {
      const o = bis[b.area];
      tasa = r2(o[o.length - 1][1]); desde = since(o); src = 'BIS';
      const ov = overrides[b.ccy];
      // A manual override wins only when it is newer than BIS's last change (BIS lags decisions by days).
      if (ov && ov.desde > desde) { tasa = ov.tasa; desde = ov.desde; src = 'Manual'; }
      lab = `${pct(tasa)} (${b.tipo})`;
    }
    const prox = (calendar[b.ccy] || []).filter(d => d >= todayIso).sort()[0] || '';
    return { ccy: b.ccy, pais: b.pais, g7: b.g7, banco: b.banco, tasa, lab, desde, prox, src };
  });
  const fed = cb.find(b => b.ccy === 'USD').tasa;
  cb.forEach(b => { b.vsfed = r2(b.tasa - fed); });
  const rate = Object.fromEntries(cb.map(b => [b.ccy, b.tasa]));

  // Price of 1 base in quote currency, and USD value of 1 base, both crossed through EUR.
  const E = fx.perEur, px = (b, q) => E[q] / E[b], usdPer = c => E.USD / E[c];
  const pairs = PAIRS.map(({ p, tfx }) => {
    const base = p.slice(0, 3), quote = p.slice(3), rb = rate[base], rq = rate[quote], diff = r2(rb - rq);
    const price = px(base, quote);
    return {
      p, base, quote, rb, rq, diff, dir: diff > 0 ? 'compra' : diff < 0 ? 'venta' : '—',
      px: +price.toFixed(quote === 'JPY' ? 3 : 5),
      day: r2(1e5 * Math.abs(diff) / 100 / 360 * usdPer(base)), tfx,
    };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    cb, pairs, fed, pxdate: dmy(fx.date),
    g7note: 'Alemania, Francia e Italia comparten la tasa del BCE: para carry el bloque euro es una sola moneda.',
    asof: todayIso, rank: [...cb].sort((a, b) => b.tasa - a.tasa).map(b => ({ ccy: b.ccy, tasa: b.tasa, vsfed: b.vsfed })),
    meta: { tasas: 'BIS WS_CBPOL · Fed: FRED DFF/DFEDTARL/DFEDTARU', precios: 'BCE, tipos de referencia', bis_last: Object.fromEntries(BANKS.filter(b => b.area !== 'US').map(b => [b.ccy, bis[b.area][bis[b.area].length - 1][0]])) },
  };
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
  const err = [], days = d => (Date.parse(todayIso) - Date.parse(d)) / 864e5;
  for (const b of c.cb) if (!(b.tasa >= -2 && b.tasa <= 30)) err.push(`${b.ccy}: tasa fuera de rango (${b.tasa})`);
  for (const [ccy, d] of Object.entries(c.meta.bis_last)) if (days(d) > 21) err.push(`${ccy}: el BIS no publica desde ${d}`);
  if (days(c.pxdate.split('-').reverse().join('-')) > 7) err.push(`Tipos de cambio del BCE con más de 7 días (${c.pxdate})`);
  if (c.pairs.length !== 28 || c.pairs.some(p => !(p.px > 0) || !Number.isFinite(p.day))) err.push('Pares incompletos o sin precio');
  return err;
}
