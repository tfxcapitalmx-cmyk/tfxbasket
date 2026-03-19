// ═══════════════════════════════════════════════════════════════════
//  TFX CAPITAL · MACRO BASKET ENGINE — DATA PROXY
//  Netlify Function: /api/claude
//
//  Fuentes de datos:
//  ┌─ FRED API  → USD: CPI, Desempleo, GDP, Retail Sales, Fed Funds Rate
//  ├─ BIS API   → G8 Tasas CB (confirmación / cross-check)
//  └─ Claude    → Stance CB, PMI fallback, narrativa macro
//
//  Flujo:
//  1. FRED + BIS se llaman EN PARALELO (Promise.all)
//  2. Claude recibe los datos reales como contexto
//  3. Claude solo infiere: stance, PMI, GDP no-USD, retail no-USD
//  4. Se fusionan: datos reales sobrescriben inferencias de Claude
//  5. Se devuelve JSON unificado al frontend
// ═══════════════════════════════════════════════════════════════════

const FRED_KEY = process.env.FRED_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const BIS_BASE  = 'https://stats.bis.org/api/v1/data';

// ── FRED Series IDs ─────────────────────────────────────────────
const FRED_SERIES = {
  FEDFUNDS: { field: 'rate',   label: 'Federal Funds Rate',     transform: null },
  CPIAUCSL: { field: 'cpi',    label: 'CPI All Urban (Level)',   transform: 'yoy' },
  UNRATE:   { field: 'unemp',  label: 'Unemployment Rate',       transform: null },
  GDPC1:    { field: 'gdp',    label: 'Real GDP (Quarterly)',    transform: 'qoq' },
  RSAFS:    { field: 'retail', label: 'Retail Sales (Level)',    transform: 'mom' },
};

// ── BIS Policy Rate Series (CB_POLICY_RATE dataset) ─────────────
// Format: BIS/CB_POLICY_RATE/Q:XX:D:N
const BIS_CURRENCIES = {
  USD: 'US', EUR: 'XM', GBP: 'GB', JPY: 'JP',
  AUD: 'AU', NZD: 'NZ', CAD: 'CA', CHF: 'CH',
};

// ── Fetch single FRED series (latest 2 observations) ────────────
async function fetchFRED(seriesId) {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=13`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);
  const json = await res.json();
  const obs = (json.observations || []).filter(o => o.value !== '.');
  return obs;
}

// ── Fetch BIS policy rate for one country ───────────────────────
async function fetchBISRate(countryCode) {
  // BIS SDMX REST API — policy rate dataset
  const url = `${BIS_BASE}/CB_POLICY_RATE/M.${countryCode}.?startPeriod=2024-01&format=jsondata`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  try {
    const series = json.data?.dataSets?.[0]?.series;
    if (!series) return null;
    const key = Object.keys(series)[0];
    const obs = series[key]?.observations;
    if (!obs) return null;
    // Get latest non-null observation
    const sorted = Object.entries(obs).sort((a,b) => parseInt(b[0]) - parseInt(a[0]));
    for (const [, vals] of sorted) {
      if (vals[0] !== null) return parseFloat(vals[0]);
    }
    return null;
  } catch { return null; }
}

// ── Compute YoY % from level series ─────────────────────────────
function computeYoY(obs) {
  if (obs.length < 13) return null;
  const latest = parseFloat(obs[0].value);
  const yearAgo = parseFloat(obs[12].value);
  if (isNaN(latest) || isNaN(yearAgo) || yearAgo === 0) return null;
  return parseFloat(((latest - yearAgo) / yearAgo * 100).toFixed(2));
}

// ── Compute MoM % from level series ─────────────────────────────
function computeMoM(obs) {
  if (obs.length < 2) return null;
  const latest = parseFloat(obs[0].value);
  const prev   = parseFloat(obs[1].value);
  if (isNaN(latest) || isNaN(prev) || prev === 0) return null;
  return parseFloat(((latest - prev) / prev * 100).toFixed(2));
}

// ── Compute QoQ % growth from quarterly GDP ──────────────────────
function computeQoQ(obs) {
  if (obs.length < 2) return null;
  const latest = parseFloat(obs[0].value);
  const prev   = parseFloat(obs[1].value);
  if (isNaN(latest) || isNaN(prev) || prev === 0) return null;
  return parseFloat(((latest - prev) / prev * 100).toFixed(2));
}

// ── Main Handler ─────────────────────────────────────────────────
exports.handler = async function(event, context) {

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // ── STEP 1: Fetch FRED data for USD (parallel requests) ────────
  const fredResults = {};
  const fredErrors  = [];
  let fredAvailable = false;

  if (FRED_KEY) {
    try {
      const fredFetches = Object.entries(FRED_SERIES).map(async ([sid, meta]) => {
        try {
          const obs = await fetchFRED(sid);
          if (!obs.length) return;
          let value;
          if (meta.transform === 'yoy')  value = computeYoY(obs);
          else if (meta.transform === 'mom') value = computeMoM(obs);
          else if (meta.transform === 'qoq') value = computeQoQ(obs);
          else value = parseFloat(obs[0].value);
          if (value !== null) {
            fredResults[meta.field] = value;
            fredResults[`${meta.field}_date`] = obs[0].date;
            fredResults[`${meta.field}_source`] = `FRED · ${sid}`;
          }
        } catch(e) {
          fredErrors.push(`${sid}: ${e.message}`);
        }
      });
      await Promise.all(fredFetches);
      fredAvailable = Object.keys(fredResults).length > 0;
    } catch(e) {
      fredErrors.push(`FRED general: ${e.message}`);
    }
  }

  // ── STEP 2: Fetch BIS rates for all G8 (parallel) ──────────────
  const bisResults = {};
  const bisErrors  = [];
  let bisAvailable = false;

  try {
    const bisFetches = Object.entries(BIS_CURRENCIES).map(async ([currency, code]) => {
      try {
        const rate = await fetchBISRate(code);
        if (rate !== null) bisResults[currency] = rate;
      } catch(e) {
        bisErrors.push(`BIS ${currency}: ${e.message}`);
      }
    });
    await Promise.all(bisFetches);
    bisAvailable = Object.keys(bisResults).length > 0;
  } catch(e) {
    bisErrors.push(`BIS general: ${e.message}`);
  }

  // ── STEP 3: Build context for Claude ───────────────────────────
  // Give Claude the real data we already have so it only needs to fill gaps
  const realDataContext = {
    USD: {
      rate:   fredResults.rate   ?? bisResults.USD ?? null,
      cpi:    fredResults.cpi    ?? null,
      unemp:  fredResults.unemp  ?? null,
      gdp:    fredResults.gdp    ?? null,
      retail: fredResults.retail ?? null,
    }
  };

  // Add BIS rates for non-USD currencies
  Object.entries(bisResults).forEach(([cur, rate]) => {
    if (cur !== 'USD') {
      if (!realDataContext[cur]) realDataContext[cur] = {};
      realDataContext[cur].rate = rate;
    }
  });

  const realDataStr = JSON.stringify(realDataContext, null, 2);
  const fredStatus  = fredAvailable
    ? `FRED OK — datos USD reales: ${Object.keys(fredResults).filter(k=>!k.includes('_')).join(', ')}`
    : `FRED no disponible (${fredErrors.join('; ')}) — estima todos los datos USD`;
  const bisStatus = bisAvailable
    ? `BIS OK — tasas CB reales para: ${Object.keys(bisResults).join(', ')}`
    : `BIS no disponible (${bisErrors.join('; ')}) — estima tasas CB`;

  // ── STEP 4: Call Claude to fill gaps ───────────────────────────
  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' })
    };
  }

  const claudePrompt = `You are a macro data assistant. The current date is March 2026.

REAL DATA ALREADY FETCHED (use these exact values, do not override them):
${realDataStr}

Data source status:
- ${fredStatus}
- ${bisStatus}

TASK: Return a complete G8 macro dataset as a single raw JSON object.
For fields already provided above, use those EXACT values.
For missing fields, use your best knowledge of March 2026 data.

Required fields per currency (USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF):
- rate: central bank policy rate %
- cpi: CPI year-over-year %
- unemp: unemployment rate %
- gdp: latest quarterly GDP growth %
- pmi_m: Manufacturing PMI
- pmi_s: Services PMI
- retail: Retail Sales month-over-month %
- stance: "hawkish", "neutral", or "dovish"
- rate_source: data source name
- cpi_source: data source name
- unemp_source: data source name
- stance_reasoning: one sentence

Return ONLY this JSON structure, no markdown, no text before or after:
{"timestamp":"2026-03-16T00:00:00Z","data":{...},"sources":{"fred":"${fredAvailable ? 'active' : 'unavailable'}","bis":"${bisAvailable ? 'active' : 'unavailable'}"},"notes":"..."}`;

  let claudeData = null;
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1800,
        messages:   [{ role: 'user', content: claudePrompt }]
      })
    });

    const claudeJson = await claudeRes.json();
    let text = claudeJson?.content?.[0]?.text || '';
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s !== -1 && e !== -1) text = text.substring(s, e + 1);
    claudeData = JSON.parse(text);
  } catch(e) {
    // Claude failed — use hardcoded fallback + real data overlay
    claudeData = {
      timestamp: new Date().toISOString(),
      data: {
        USD: { rate:4.33, cpi:2.6,  unemp:4.2, gdp:0.7,  pmi_m:52.7, pmi_s:53.5, retail:-0.2, stance:'neutral', rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'Fed on hold' },
        EUR: { rate:2.50, cpi:2.3,  unemp:6.2, gdp:0.2,  pmi_m:47.6, pmi_s:51.3, retail:0.1,  stance:'dovish',  rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'ECB cutting' },
        GBP: { rate:4.50, cpi:2.8,  unemp:4.4, gdp:0.1,  pmi_m:46.9, pmi_s:51.0, retail:0.4,  stance:'neutral', rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'BoE cautious' },
        JPY: { rate:0.50, cpi:3.1,  unemp:2.4, gdp:0.4,  pmi_m:49.0, pmi_s:53.7, retail:3.5,  stance:'hawkish', rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'BoJ normalizing' },
        AUD: { rate:4.10, cpi:3.2,  unemp:4.1, gdp:0.5,  pmi_m:50.4, pmi_s:51.2, retail:0.3,  stance:'neutral', rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'RBA on hold' },
        NZD: { rate:3.75, cpi:2.2,  unemp:5.1, gdp:0.3,  pmi_m:52.0, pmi_s:49.5, retail:-0.1, stance:'dovish',  rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'RBNZ cutting' },
        CAD: { rate:3.00, cpi:1.8,  unemp:6.7, gdp:0.1,  pmi_m:48.5, pmi_s:46.5, retail:-0.2, stance:'dovish',  rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'BoC easing' },
        CHF: { rate:0.25, cpi:0.4,  unemp:2.9, gdp:0.2,  pmi_m:49.6, pmi_s:54.2, retail:0.5,  stance:'neutral', rate_source:'Fallback', cpi_source:'Fallback', unemp_source:'Fallback', stance_reasoning:'SNB near zero' },
      },
      sources: { fred: 'unavailable', bis: 'unavailable' },
      notes: 'Fallback data — Claude inference only'
    };
  }

  // ── STEP 5: Overlay real data on top of Claude estimates ───────
  // Real data from FRED/BIS ALWAYS wins over Claude's estimates
  if (claudeData?.data) {

    // USD — overlay all FRED fields
    if (!claudeData.data.USD) claudeData.data.USD = {};
    const usd = claudeData.data.USD;
    if (fredResults.rate   != null) { usd.rate   = fredResults.rate;   usd.rate_source  = 'FRED · FEDFUNDS'; }
    if (fredResults.cpi    != null) { usd.cpi    = fredResults.cpi;    usd.cpi_source   = 'FRED · CPIAUCSL (YoY)'; }
    if (fredResults.unemp  != null) { usd.unemp  = fredResults.unemp;  usd.unemp_source = 'FRED · UNRATE'; }
    if (fredResults.gdp    != null) { usd.gdp    = fredResults.gdp;    }
    if (fredResults.retail != null) { usd.retail = fredResults.retail; }

    // All currencies — overlay BIS rates
    Object.entries(bisResults).forEach(([cur, rate]) => {
      if (!claudeData.data[cur]) claudeData.data[cur] = {};
      claudeData.data[cur].rate = rate;
      claudeData.data[cur].rate_source = `BIS · CB Policy Rate`;
    });

    // Update sources metadata
    claudeData.sources = {
      fred: fredAvailable ? `active · ${Object.keys(fredResults).filter(k=>!k.includes('_')).join(', ')}` : 'unavailable',
      bis:  bisAvailable  ? `active · ${Object.keys(bisResults).join(', ')}` : 'unavailable',
    };

    if (fredErrors.length)  claudeData.fred_errors = fredErrors;
    if (bisErrors.length)   claudeData.bis_errors  = bisErrors;
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify(claudeData) }]
    })
  };
};
