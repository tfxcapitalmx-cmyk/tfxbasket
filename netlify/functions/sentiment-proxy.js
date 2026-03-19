// ═══════════════════════════════════════════════════════════════
//  TFX CAPITAL · SENTIMENT PROXY
//  Netlify Function: /api/sentiment
//
//  Fuentes:
//  ├─ Myfxbook API  → Sentimiento Retail (longPct / shortPct)
//  └─ CFTC API      → COT Non-Commercial Net Positions (G7 FX)
// ═══════════════════════════════════════════════════════════════

const MYFXBOOK_LOGIN_URL   = 'https://www.myfxbook.com/api/login.json';
const MYFXBOOK_OUTLOOK_URL = 'https://www.myfxbook.com/api/get-community-outlook.json';
const CFTC_BASE            = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

const SENTIMENT_PAIRS = [
  'EURUSD','GBPUSD','USDJPY','AUDUSD',
  'NZDUSD','USDCAD','USDCHF','XAUUSD'
];

const CFTC_CODES = {
  EUR: '099741', GBP: '096742', JPY: '097741',
  AUD: '232741', NZD: '112741', CAD: '090741', CHF: '092741',
};

// ── Myfxbook: Login with retry ───────────────────────────────────
async function myfxbookLogin(email, password) {
  // Some accounts need the password URL-encoded differently
  // Try plain first, then encoded
  const attempts = [
    `${MYFXBOOK_LOGIN_URL}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    `${MYFXBOOK_LOGIN_URL}?email=${email}&password=${encodeURIComponent(password)}`,
  ];

  let lastError = null;
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept':     'application/json',
          'User-Agent': 'TFXCapital-Dashboard/1.0',
        }
      });

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      // Myfxbook returns XML or JSON depending on URL
      const text = await res.text();

      // Try JSON parse
      let data;
      try {
        data = JSON.parse(text);
      } catch(e) {
        // Try to extract session from XML/text
        const match = text.match(/session["\s:>]+([a-zA-Z0-9]+)/);
        if (match) return match[1];
        lastError = new Error(`Invalid response format: ${text.slice(0,100)}`);
        continue;
      }

      // Check for error field (can be boolean or number)
      if (data.error === true || data.error === 1) {
        lastError = new Error(`Myfxbook: ${data.message || 'Login failed'}`);
        continue;
      }

      if (data.session) return data.session;
      lastError = new Error(`No session in response: ${JSON.stringify(data).slice(0,100)}`);

    } catch(e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Login failed after all attempts');
}

// ── Myfxbook: Community Outlook ──────────────────────────────────
async function myfxbookOutlook(session) {
  const url = `${MYFXBOOK_OUTLOOK_URL}?session=${encodeURIComponent(session)}`;
  const res = await fetch(url, {
    headers: {
      'Accept':     'application/json',
      'User-Agent': 'TFXCapital-Dashboard/1.0',
    }
  });
  if (!res.ok) throw new Error(`Outlook HTTP ${res.status}`);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch(e) {
    throw new Error(`Outlook invalid JSON: ${text.slice(0,100)}`);
  }

  if (data.error === true || data.error === 1) {
    throw new Error(`Outlook error: ${data.message}`);
  }

  return data.symbols || [];
}

// ── CFTC: COT latest 2 weeks ─────────────────────────────────────
async function fetchCOT(contractCode) {
  const url = `${CFTC_BASE}?cftc_contract_market_code=${contractCode}&$order=report_date_as_yyyy_mm_dd DESC&$limit=2`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
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
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const MFX_EMAIL    = process.env.MYFXBOOK_EMAIL;
  const MFX_PASSWORD = process.env.MYFXBOOK_PASSWORD;

  const result = {
    timestamp: new Date().toISOString(),
    sentiment: {},
    cot:       {},
    sources:   { myfxbook: 'pending', cftc: 'pending' },
    errors:    [],
    debug:     {},
  };

  // ── STEP 1: Myfxbook Sentiment ─────────────────────────────────
  if (MFX_EMAIL && MFX_PASSWORD) {
    try {
      result.debug.mfx_email_len = MFX_EMAIL.length;
      result.debug.mfx_pass_len  = MFX_PASSWORD.length;

      const session = await myfxbookLogin(MFX_EMAIL, MFX_PASSWORD);
      result.debug.session_obtained = true;

      const symbols = await myfxbookOutlook(session);
      result.debug.symbols_count = symbols.length;

      const lookup = {};
      symbols.forEach(s => {
        const name = (s.name || '').toUpperCase().replace('/', '');
        lookup[name] = s;
      });

      SENTIMENT_PAIRS.forEach(pair => {
        const s = lookup[pair];
        if (s) {
          result.sentiment[pair] = {
            longPct:  parseFloat(s.longPercentage  || 50),
            shortPct: parseFloat(s.shortPercentage || 50),
            longPos:  parseInt(s.longPositions  || 0),
            shortPos: parseInt(s.shortPositions || 0),
          };
        }
      });

      result.sources.myfxbook = `active · ${symbols.length} pares`;
    } catch(e) {
      result.errors.push(`Myfxbook: ${e.message}`);
      result.sources.myfxbook = `error: ${e.message}`;
      result.debug.mfx_error = e.message;
    }
  } else {
    result.sources.myfxbook = 'variables de entorno no configuradas';
  }

  // ── STEP 2: CFTC COT ───────────────────────────────────────────
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
    const firstDate = Object.values(result.cot)[0]?.report_date || '?';
    result.sources.cftc = cotCount > 0
      ? `active · ${cotCount} divisas · reporte: ${firstDate}`
      : 'sin datos';
  } catch(e) {
    result.errors.push(`CFTC: ${e.message}`);
    result.sources.cftc = `error: ${e.message}`;
  }

  return {
    statusCode: 200,
    headers:    HEADERS,
    body:       JSON.stringify(result),
  };
};
