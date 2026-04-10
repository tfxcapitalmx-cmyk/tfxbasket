// ═══════════════════════════════════════════════════════════════════
//  TFX CAPITAL · MACRO BASKET ENGINE — DATA PROXY v2.0
//  Netlify Function: /api/claude
//
//  Fuentes:
//  ┌─ FRED API   → USD: CPI YoY, CPI MoM, Core CPI MoM, PPI MoM,
//  │               Core PPI MoM, NFP, GDP QoQ, Fed Funds Rate,
//  │               IR MoM, M2, Building Permits, UMCSI
//  ├─ OECD API   → EUR, GBP, JPY, CAD, AUD, NZD, CHF:
//  │               CPI YoY, CPI MoM, Desempleo
//  ├─ BIS API    → G8 Tasas CB (policy rate)
//  └─ Claude     → PMI Mfg, NMI Services, PPI no-USD,
//                  Core PPI no-USD, NFP no-USD, M2 no-USD,
//                  Permits no-USD, UMCSI no-USD, GDP no-USD
//
//  Indicadores del sistema TFX Capital (13 total):
//  LÍDERES:     pmi_m, pmi_s, permits, umcsi, m2
//  COINCIDENTES: cpi_yoy, cpi_mom, ccpi_mom, ppi_mom, cppi_mom, nfp
//  REZAGADOS:   rate, ir_mom
// ═══════════════════════════════════════════════════════════════════

const FRED_KEY      = process.env.FRED_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const FRED_BASE     = 'https://api.stlouisfed.org/fred/series/observations';
const BIS_BASE      = 'https://stats.bis.org/api/v1/data';
const OECD_BASE     = 'https://sdmx.oecd.org/public/rest/data';

// ── FRED Series for USD (all 13 indicators) ────────────────────────
const FRED_SERIES = {
  // REZAGADOS
  FEDFUNDS:   { field:'rate',      transform:'last',  label:'Fed Funds Rate'        },
  // COINCIDENTES — inflación
  CPIAUCSL:   { field:'cpi_level', transform:'raw13', label:'CPI Level (para YoY/MoM)' },
  CPILFESL:   { field:'ccpi_level',transform:'raw2',  label:'Core CPI Level'        },
  PPIACO:     { field:'ppi_level', transform:'raw2',  label:'PPI Level'             },
  WPSFD4131:  { field:'cppi_level',transform:'raw2',  label:'Core PPI Level'        },
  // COINCIDENTES — empleo
  PAYEMS:     { field:'nfp_level', transform:'raw2',  label:'Nonfarm Payrolls'      },
  // LÍDERES
  M2SL:       { field:'m2_level',  transform:'raw13', label:'M2 Money Supply'       },
  PERMIT:     { field:'permits',   transform:'last',  label:'Building Permits (K)'  },
  UMCSENT:    { field:'umcsi',     transform:'last',  label:'Univ Michigan Sentiment'},
};

// ── BIS Policy Rates ───────────────────────────────────────────────
const BIS_CURRENCIES = {
  USD:'US', EUR:'XM', GBP:'GB', JPY:'JP',
  AUD:'AU', NZD:'NZ', CAD:'CA', CHF:'CH',
};

// ── OECD dataset → CPI YoY, CPI MoM, Desempleo para G7 non-USD ───
// Dataset: OECD.SDD.STES,DSD_STES@DF_KEI
const OECD_COUNTRIES = {
  EUR:'EA19', GBP:'GBR', JPY:'JPN',
  AUD:'AUS',  CAD:'CAN', CHF:'CHE', NZD:'NZL',
};

// ── FRED fetch (last N observations) ───────────────────────────────
async function fetchFRED(seriesId, n=14) {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${n}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);
  const json = await res.json();
  return (json.observations || []).filter(o => o.value !== '.' && o.value !== null);
}

// ── BIS policy rate ────────────────────────────────────────────────
async function fetchBISRate(code) {
  const url = `${BIS_BASE}/CB_POLICY_RATE/M.${code}.?startPeriod=2024-01&format=jsondata`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  try {
    const series = json.data?.dataSets?.[0]?.series;
    if (!series) return null;
    const key = Object.keys(series)[0];
    const obs  = series[key]?.observations;
    if (!obs) return null;
    const sorted = Object.entries(obs).sort((a,b) => parseInt(b[0])-parseInt(a[0]));
    for (const [, vals] of sorted) {
      if (vals[0] !== null) return parseFloat(vals[0]);
    }
    return null;
  } catch { return null; }
}

// ── OECD fetch — CPI MoM, CPI YoY, Unemployment ───────────────────
async function fetchOECD(oecdCode) {
  try {
    // CPI Monthly — CPALTT01 indicator, growth previous period (GP)
    const cpiUrl = `${OECD_BASE}/OECD.SDD.STES,DSD_STES@DF_KEI/${oecdCode}.CPALTT01.GP.M?lastNObservations=13&format=jsondata`;
    const cpiRes = await fetch(cpiUrl);

    // Unemployment rate — UNR indicator
    const unrUrl = `${OECD_BASE}/OECD.SDD.STES,DSD_STES@DF_KEI/${oecdCode}.UNR..M?lastNObservations=2&format=jsondata`;
    const unrRes = await fetch(unrUrl);

    const result = {};

    if (cpiRes.ok) {
      const cpiJson = await cpiRes.json();
      const obs = extractOECDSeries(cpiJson);
      if (obs.length >= 1) result.cpi_mom = parseFloat(obs[0].value.toFixed(2));
      if (obs.length >= 13) {
        // Compute YoY from 12 MoM values
        const yoy = obs.slice(0,12).reduce((acc,o) => acc * (1 + o.value/100), 1);
        result.cpi_yoy = parseFloat(((yoy-1)*100).toFixed(2));
      }
    }

    if (unrRes.ok) {
      const unrJson = await unrRes.json();
      const obs = extractOECDSeries(unrJson);
      if (obs.length >= 1) result.unemp = parseFloat(obs[0].value.toFixed(1));
    }

    return result;
  } catch(e) {
    return {};
  }
}

// ── Extract observations from OECD SDMX-JSON ──────────────────────
function extractOECDSeries(json) {
  try {
    const ds  = json.data?.dataSets?.[0];
    const str = json.data?.structures?.[0];
    if (!ds || !str) return [];
    const series = ds.series;
    if (!series) return [];
    const key = Object.keys(series)[0];
    const obs  = series[key]?.observations;
    if (!obs) return [];
    const timeDim = str.dimensions?.observation?.find(d => d.id === 'TIME_PERIOD');
    const timeValues = timeDim?.values || [];
    return Object.entries(obs)
      .map(([idx, vals]) => ({
        period: timeValues[parseInt(idx)]?.id || idx,
        value:  parseFloat(vals[0])
      }))
      .filter(o => !isNaN(o.value))
      .sort((a,b) => b.period.localeCompare(a.period));
  } catch { return []; }
}

// ── Math helpers ───────────────────────────────────────────────────
function yoy(obs)  {
  const vals = obs.filter(o=>!isNaN(parseFloat(o.value)));
  if (vals.length < 13) return null;
  const l = parseFloat(vals[0].value), y = parseFloat(vals[12].value);
  return y === 0 ? null : parseFloat(((l-y)/y*100).toFixed(2));
}
function mom(obs)  {
  const vals = obs.filter(o=>!isNaN(parseFloat(o.value)));
  if (vals.length < 2) return null;
  const l = parseFloat(vals[0].value), p = parseFloat(vals[1].value);
  return p === 0 ? null : parseFloat(((l-p)/p*100).toFixed(2));
}
function momAbs(obs) {
  // MoM in absolute BPS (for IR MoM)
  const vals = obs.filter(o=>!isNaN(parseFloat(o.value)));
  if (vals.length < 2) return null;
  return parseFloat((parseFloat(vals[0].value) - parseFloat(vals[1].value)).toFixed(2));
}
function annualized(momPct, periods=12) {
  return parseFloat(((Math.pow(1 + momPct/100, periods) - 1) * 100).toFixed(2));
}

// ══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════
exports.handler = async function(event, context) {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    }, body:'' };
  }

  const HEADERS = {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
  };

  const result = {
    timestamp: new Date().toISOString(),
    data: {}, sources: {}, errors: []
  };

  // ════════════════════════════════════════════════════════════════
  // STEP 1: FRED — USD all 13 indicators
  // ════════════════════════════════════════════════════════════════
  const usd = {};
  const fredErrors = [];

  if (FRED_KEY) {
    try {
      const [
        fedfunds, cpi_raw, ccpi_raw, ppi_raw, cppi_raw,
        nfp_raw, m2_raw, permits_raw, umcsi_raw
      ] = await Promise.all([
        fetchFRED('FEDFUNDS', 3),
        fetchFRED('CPIAUCSL', 14),
        fetchFRED('CPILFESL', 3),
        fetchFRED('PPIACO',   3),
        fetchFRED('WPSFD4131',3),
        fetchFRED('PAYEMS',   3),
        fetchFRED('M2SL',     14),
        fetchFRED('PERMIT',   2),
        fetchFRED('UMCSENT',  2),
      ]);

      // Rate
      if (fedfunds.length) {
        usd.rate     = parseFloat(parseFloat(fedfunds[0].value).toFixed(2));
        // IR MoM in BPS annualized
        if (fedfunds.length >= 2) {
          const irMom = parseFloat(fedfunds[0].value) - parseFloat(fedfunds[1].value);
          usd.ir_mom = parseFloat((irMom * 100).toFixed(1)); // in BPS
        }
        usd.rate_source = 'FRED · FEDFUNDS';
      }

      // CPI — YoY + MoM
      if (cpi_raw.length >= 13) {
        usd.cpi_yoy = yoy(cpi_raw);
        usd.cpi_mom = mom(cpi_raw);
        usd.cpi_source = 'FRED · CPIAUCSL';
      }

      // Core CPI MoM
      if (ccpi_raw.length >= 2) {
        usd.ccpi_mom = mom(ccpi_raw);
        usd.ccpi_source = 'FRED · CPILFESL';
      }

      // PPI MoM
      if (ppi_raw.length >= 2) {
        usd.ppi_mom = mom(ppi_raw);
        usd.ppi_source = 'FRED · PPIACO';
      }

      // Core PPI MoM
      if (cppi_raw.length >= 2) {
        usd.cppi_mom = mom(cppi_raw);
        usd.cppi_source = 'FRED · WPSFD4131';
      }

      // NFP MoM %
      if (nfp_raw.length >= 2) {
        usd.nfp = mom(nfp_raw);
        usd.nfp_source = 'FRED · PAYEMS';
      }

      // M2 Annualized %
      if (m2_raw.length >= 13) {
        const m2_mom = mom(m2_raw);
        if (m2_mom !== null) usd.m2 = annualized(m2_mom);
        usd.m2_source = 'FRED · M2SL';
      }

      // Building Permits (in thousands)
      if (permits_raw.length) {
        usd.permits = parseFloat(parseFloat(permits_raw[0].value).toFixed(0));
        usd.permits_source = 'FRED · PERMIT';
      }

      // UMCSI
      if (umcsi_raw.length) {
        usd.umcsi = parseFloat(parseFloat(umcsi_raw[0].value).toFixed(1));
        usd.umcsi_source = 'FRED · UMCSENT';
      }

      result.sources.fred = `active · ${Object.keys(usd).filter(k=>!k.includes('_source')&&!k.includes('_date')).join(', ')}`;
    } catch(e) {
      fredErrors.push(e.message);
      result.sources.fred = `error: ${e.message}`;
    }
  } else {
    result.sources.fred = 'FRED_API_KEY no configurada';
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 2: BIS — G8 policy rates
  // ════════════════════════════════════════════════════════════════
  const bisRates = {};
  try {
    const bisFetches = Object.entries(BIS_CURRENCIES).map(async ([cur, code]) => {
      const rate = await fetchBISRate(code);
      if (rate !== null) bisRates[cur] = rate;
    });
    await Promise.all(bisFetches);
    result.sources.bis = Object.keys(bisRates).length > 0
      ? `active · ${Object.keys(bisRates).join(', ')}`
      : 'sin datos';
  } catch(e) {
    result.sources.bis = `error: ${e.message}`;
  }

  // Apply BIS to USD if FRED didn't get it
  if (bisRates.USD && !usd.rate) {
    usd.rate = bisRates.USD;
    usd.rate_source = 'BIS · CB Policy Rate';
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 3: OECD — CPI, Desempleo para no-USD
  // ════════════════════════════════════════════════════════════════
  const oecdData = {};
  const oecdErrors = [];
  try {
    const oecdFetches = Object.entries(OECD_COUNTRIES).map(async ([cur, code]) => {
      const d = await fetchOECD(code);
      if (Object.keys(d).length > 0) oecdData[cur] = d;
    });
    await Promise.all(oecdFetches);
    result.sources.oecd = Object.keys(oecdData).length > 0
      ? `active · ${Object.keys(oecdData).join(', ')}`
      : 'sin datos';
  } catch(e) {
    result.sources.oecd = `error: ${e.message}`;
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 4: Claude — estima indicadores faltantes para G8
  // ════════════════════════════════════════════════════════════════

  // Build context: what we already have
  const realData = { USD: usd };
  Object.keys(OECD_COUNTRIES).forEach(cur => {
    realData[cur] = {
      rate: bisRates[cur] ?? null,
      ...(oecdData[cur] || {}),
    };
  });

  const claudePrompt = `You are a macro data assistant for a professional FX trading desk. Today is ${new Date().toISOString().slice(0,7)} (current month).

REAL DATA ALREADY FETCHED (use these EXACT values — do not override):
${JSON.stringify(realData, null, 2)}

TASK: Return a complete G8 macro dataset with ALL 13 indicators per currency.
For fields already provided above, copy them EXACTLY.
For missing fields, estimate using your best knowledge of the most recent data available.

CURRENCIES: USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF

REQUIRED FIELDS per currency (use null if genuinely unknown):
- pmi_m: Manufacturing PMI (ISM/S&P Global, absolute level)
- pmi_s: Services/NMI PMI (ISM/S&P Global, absolute level)
- permits: Building Permits in thousands (USD only, null for others)
- umcsi: University of Michigan Consumer Sentiment (USD only, null for others)
- m2: M2 Money Supply annualized % growth
- cpi_yoy: CPI year-over-year %
- cpi_mom: CPI month-over-month %
- ccpi_mom: Core CPI month-over-month %
- ppi_mom: PPI month-over-month %
- cppi_mom: Core PPI month-over-month %
- nfp: NFP / employment change month-over-month %
- rate: Central bank policy rate %
- ir_mom: Rate change this month in BPS (positive=hike, negative=cut, 0=hold)
- stance: "hawkish" | "neutral" | "dovish"
- stance_reason: one sentence explanation

Return ONLY valid JSON, no markdown fences, no explanation:
{"timestamp":"${new Date().toISOString()}","data":{"USD":{...},"EUR":{...},"GBP":{...},"JPY":{...},"AUD":{...},"NZD":{...},"CAD":{...},"CHF":{...}},"notes":"..."}`;

  let claudeResult = null;
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2500,
        messages:   [{ role:'user', content: claudePrompt }],
      }),
    });
    const claudeJson = await claudeRes.json();
    let text = claudeJson?.content?.[0]?.text || '';
    text = text.replace(/```json\s*/gi,'').replace(/```\s*/gi,'').trim();
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s !== -1 && e !== -1) text = text.substring(s, e+1);
    claudeResult = JSON.parse(text);
    result.sources.claude = 'active · estimaciones G8';
  } catch(e) {
    result.errors.push(`Claude: ${e.message}`);
    result.sources.claude = `error: ${e.message}`;
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 5: Merge — real data ALWAYS overwrites Claude estimates
  // Priority: FRED > BIS > OECD > Claude
  // ════════════════════════════════════════════════════════════════
  const currencies = ['USD','EUR','GBP','JPY','AUD','NZD','CAD','CHF'];

  currencies.forEach(cur => {
    // Start with Claude estimates as base
    const base = claudeResult?.data?.[cur] || {};
    // Overlay OECD (non-USD)
    const oecd = oecdData[cur] || {};
    // Overlay BIS rate
    const bisRate = bisRates[cur];
    // Overlay FRED (USD only)
    const fred = cur === 'USD' ? usd : {};

    result.data[cur] = {
      ...base,
      ...oecd,
      ...fred,
    };

    // BIS rate always wins for all currencies
    if (bisRate != null) {
      result.data[cur].rate = bisRate;
      result.data[cur].rate_source = 'BIS · CB Policy Rate';
    }

    // FRED wins for USD
    if (cur === 'USD') {
      Object.keys(usd).forEach(k => {
        result.data[cur][k] = usd[k];
      });
    }
  });

  // ════════════════════════════════════════════════════════════════
  // STEP 6: Return in the format the frontend expects
  // ════════════════════════════════════════════════════════════════
  if (fredErrors.length)  result.fred_errors  = fredErrors;
  if (oecdErrors.length)  result.oecd_errors  = oecdErrors;

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      content: [{ type:'text', text: JSON.stringify(result) }]
    }),
  };
};
