// ═══════════════════════════════════════════════════════════════
//  TFX CAPITAL · SENTIMENT PROXY — DEBUG VERSION
// ═══════════════════════════════════════════════════════════════

const CFTC_BASE  = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
const CFTC_CODES = {
  EUR: '099741', GBP: '096742', JPY: '097741',
  AUD: '232741', NZD: '112741', CAD: '090741', CHF: '092741',
};
const SENTIMENT_PAIRS = ['EURUSD','GBPUSD','USDJPY','AUDUSD','NZDUSD','USDCAD','USDCHF','XAUUSD'];

async function fetchCOT(contractCode) {
  const url = `${CFTC_BASE}?cftc_contract_market_code=${contractCode}&$order=report_date_as_yyyy_mm_dd DESC&$limit=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CFTC ${contractCode} HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows || !rows.length) return null;
  const cur = rows[0], prev = rows[1] || null;
  const longNC  = parseInt(cur.noncomm_positions_long_all  || 0);
  const shortNC = parseInt(cur.noncomm_positions_short_all || 0);
  const net     = longNC - shortNC;
  let prevNet = 0;
  if (prev) prevNet = parseInt(prev.noncomm_positions_long_all||0) - parseInt(prev.noncomm_positions_short_all||0);
  return {
    long: longNC, short: shortNC, net, prev_net: prevNet,
    change: net - prevNet, oi: parseInt(cur.open_interest_all||0),
    report_date: cur.report_date_as_yyyy_mm_dd || '',
    market_name: cur.market_and_exchange_names || '',
  };
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const EMAIL    = process.env.MYFXBOOK_EMAIL    || '';
  const PASSWORD = process.env.MYFXBOOK_PASSWORD || '';

  const result = {
    timestamp: new Date().toISOString(),
    sentiment: {}, cot: {},
    sources: { myfxbook: 'pending', cftc: 'pending' },
    errors: [], debug: {}
  };

  // ── Myfxbook ────────────────────────────────────────────────
  if (EMAIL && PASSWORD) {
    try {
      // Step 1: Login
      const loginUrl = `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`;
      result.debug.login_url_preview = `login.json?email=${EMAIL.slice(0,4)}***&password=***`;

      const loginRes = await fetch(loginUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/plain, */*' }
      });

      const loginText = await loginRes.text();
      result.debug.login_status = loginRes.status;
      result.debug.login_raw    = loginText.slice(0, 300);

      let loginData;
      try { loginData = JSON.parse(loginText); }
      catch(e) { throw new Error(`Login parse error: ${loginText.slice(0,100)}`); }

      if (loginData.error === true || loginData.error === 1 || loginData.error === 'true') {
        throw new Error(`Login failed: ${loginData.message}`);
      }
      if (!loginData.session) {
        throw new Error(`No session field. Response: ${loginText.slice(0,200)}`);
      }

      const session = loginData.session;
      result.debug.session_preview = session.slice(0,8) + '...';

      // Step 2: Get outlook — add small delay to avoid immediate session rejection
      await new Promise(r => setTimeout(r, 500));

      const outlookUrl = `https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`;
      const outlookRes = await fetch(outlookUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/plain, */*' }
      });

      const outlookText = await outlookRes.text();
      result.debug.outlook_status = outlookRes.status;
      result.debug.outlook_raw    = outlookText.slice(0, 300);

      let outlookData;
      try { outlookData = JSON.parse(outlookText); }
      catch(e) { throw new Error(`Outlook parse error: ${outlookText.slice(0,100)}`); }

      if (outlookData.error === true || outlookData.error === 1 || outlookData.error === 'true') {
        throw new Error(`Outlook failed: ${outlookData.message} | session_used: ${session.slice(0,8)}`);
      }

      const symbols = outlookData.symbols || [];
      result.debug.symbols_count = symbols.length;

      const lookup = {};
      symbols.forEach(s => { lookup[(s.name||'').toUpperCase().replace('/','')]=s; });

      SENTIMENT_PAIRS.forEach(pair => {
        const s = lookup[pair];
        if (s) result.sentiment[pair] = {
          longPct:  parseFloat(s.longPercentage  || 50),
          shortPct: parseFloat(s.shortPercentage || 50),
          longPos:  parseInt(s.longPositions  || 0),
          shortPos: parseInt(s.shortPositions || 0),
        };
      });

      result.sources.myfxbook = `active · ${symbols.length} pares`;

    } catch(e) {
      result.errors.push(`Myfxbook: ${e.message}`);
      result.sources.myfxbook = `error: ${e.message}`;
    }
  } else {
    result.sources.myfxbook = 'variables no configuradas';
    result.debug.email_len = EMAIL.length;
    result.debug.pass_len  = PASSWORD.length;
  }

  // ── CFTC COT ────────────────────────────────────────────────
  try {
    await Promise.all(Object.entries(CFTC_CODES).map(async ([cur, code]) => {
      try {
        const data = await fetchCOT(code);
        if (data) result.cot[cur] = data;
      } catch(e) { result.errors.push(`CFTC ${cur}: ${e.message}`); }
    }));
    const n = Object.keys(result.cot).length;
    const d = Object.values(result.cot)[0]?.report_date || '?';
    result.sources.cftc = n > 0 ? `active · ${n} divisas · reporte: ${d}` : 'sin datos';
  } catch(e) {
    result.errors.push(`CFTC: ${e.message}`);
    result.sources.cftc = `error: ${e.message}`;
  }

  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
};
