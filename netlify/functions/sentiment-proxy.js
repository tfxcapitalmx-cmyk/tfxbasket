// ═══════════════════════════════════════════════════════════════
//  TFX CAPITAL · SENTIMENT PROXY
//  Netlify Function: /api/sentiment
//
//  Fuentes:
//  ├─ Myfxbook API  → Sentimiento Retail (longPct / shortPct)
//  └─ CFTC API      → COT Non-Commercial Net Positions (G7 FX)
//
//  Variables de entorno requeridas en Netlify:
//    MYFXBOOK_EMAIL
//    MYFXBOOK_PASSWORD
// ═══════════════════════════════════════════════════════════════

const MYFXBOOK_LOGIN_URL   = 'https://www.myfxbook.com/api/login.json';
const MYFXBOOK_OUTLOOK_URL = 'https://www.myfxbook.com/api/get-community-outlook.json';
const CFTC_BASE            = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

// Pares que mostramos en el panel de sentimiento retail
const SENTIMENT_PAIRS = [
  'EURUSD','GBPUSD','USDJPY','AUDUSD',
  'NZDUSD','USDCAD','USDCHF','XAUUSD'
];

// Códigos CFTC para futuros FX en CME (Non-Commercial = Institucionales)
const CFTC_CODES = {
  EUR: '099741',
  GBP: '096742',
  JPY: '097741',
  AUD: '232741',
  NZD: '112741',
  CAD: '090741',
  CHF: '092741',
};

// ── Myfxbook: Login → session ────────────────────────────────────
async function myfxbookLogin(email, password) {
  const url = `${MYFXBOOK_LOGIN_URL}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Myfxbook login HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Myfxbook: ${data.message}`);
  return data.session;
}

// ── Myfxbook: Community Outlook ──────────────────────────────────
async function myfxbookOutlook(session) {
  const url = `${MYFXBOOK_OUTLOOK_URL}?session=${encodeURIComponent(session)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Myfxbook outlook HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Myfxbook outlook: ${data.message}`);
  return data.symbols || [];
}

// ── CFTC: COT latest 2 weeks for one contract ────────────────────
async function fetchCOT(contractCode) {
  const url = `${CFTC_BASE}?cftc_contract_market_code=${contractCode}&$order=report_date_as_yyyy_mm_dd DESC&$limit=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CFTC ${contractCode} HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows || !rows.length) return null;

  const cur  = rows[0];
  const prev = rows[1] || null;

  const longNC  = parseInt(cur.noncomm_positions_long_all  || 0);
  const shortNC = parseInt(cur.noncomm_positions_short_all || 0);
  const net     = longNC - shortNC;

  let prevNet = 0;
  if (prev) {
    prevNet = parseInt(prev.noncomm_positions_long_all  || 0)
            - parseInt(prev.noncomm_positions_short_all || 0);
  }

  return {
    long:        longNC,
    short:       shortNC,
    net:         net,
    prev_net:    prevNet,
    change:      net - prevNet,
    oi:          parseInt(cur.open_interest_all || 0),
    report_date: cur.report_date_as_yyyy_mm_dd || '',
    market_name: cur.market_and_exchange_names || '',
  };
}

// ── Main Handler ─────────────────────────────────────────────────
exports.handler = async function(event, context) {

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  const HEADERS = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
  };

  const MFX_EMAIL    = process.env.MYFXBOOK_EMAIL;
  const MFX_PASSWORD = process.env.MYFXBOOK_PASSWORD;

  const result = {
    timestamp:  new Date().toISOString(),
    sentiment:  {},   // par → { long, short, longPct, shortPct }
    cot:        {},   // currency → { long, short, net, change, oi, report_date }
    sources:    { myfxbook: 'pending', cftc: 'pending' },
    errors:     [],
  };

  // ── STEP 1: Myfxbook Sentiment ─────────────────────────────────
  if (MFX_EMAIL && MFX_PASSWORD) {
    try {
      const session = await myfxbookLogin(MFX_EMAIL, MFX_PASSWORD);
      const symbols = await myfxbookOutlook(session);

      // Build lookup by symbol name (uppercase, no slash)
      const lookup = {};
      symbols.forEach(s => {
        const name = (s.name || '').toUpperCase().replace('/', '');
        lookup[name] = s;
      });

      SENTIMENT_PAIRS.forEach(pair => {
        const s = lookup[pair];
        if (s) {
          const longPct  = parseFloat(s.longPercentage  || 50);
          const shortPct = parseFloat(s.shortPercentage || 50);
          result.sentiment[pair] = {
            long:      parseInt(s.longPositions  || 0),
            short:     parseInt(s.shortPositions || 0),
            longPct:   longPct,
            shortPct:  shortPct,
            longVol:   parseFloat(s.longVolume   || 0),
            shortVol:  parseFloat(s.shortVolume  || 0),
          };
        }
      });

      result.sources.myfxbook = `active · ${symbols.length} pares · ${new Date().toISOString()}`;
    } catch(e) {
      result.errors.push(`Myfxbook: ${e.message}`);
      result.sources.myfxbook = `error: ${e.message}`;
    }
  } else {
    result.sources.myfxbook = 'no configurado — agrega MYFXBOOK_EMAIL y MYFXBOOK_PASSWORD en Netlify';
  }

  // ── STEP 2: CFTC COT — All G7 FX in parallel ───────────────────
  try {
    const cotFetches = Object.entries(CFTC_CODES).map(async ([currency, code]) => {
      try {
        const data = await fetchCOT(code);
        if (data) result.cot[currency] = data;
      } catch(e) {
        result.errors.push(`CFTC ${currency}: ${e.message}`);
      }
    });
    await Promise.all(cotFetches);

    const cotCount = Object.keys(result.cot).length;
    result.sources.cftc = cotCount > 0
      ? `active · ${cotCount} divisas · reporte: ${Object.values(result.cot)[0]?.report_date || '?'}`
      : 'error: sin datos';
  } catch(e) {
    result.errors.push(`CFTC general: ${e.message}`);
    result.sources.cftc = `error: ${e.message}`;
  }

  return {
    statusCode: 200,
    headers:    HEADERS,
    body:       JSON.stringify(result),
  };
};
