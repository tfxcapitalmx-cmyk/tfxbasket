exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' })
    };
  }

  try {
    const serverBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Return ONLY a raw JSON object. No text, no markdown, no backticks. Just JSON from { to }. Use the most recent data available as of early 2026 — do NOT return data older than 2025. The current date is March 2026.

Return current macro data for G8 economies (USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF).
For each currency return:
- rate: central bank interest rate %
- cpi: latest CPI year-over-year %
- unemp: latest unemployment rate %
- stance: "hawkish", "neutral", or "dovish"
- gdp: latest quarterly GDP growth %
- pmi_m: latest Manufacturing PMI (number like 51.2)
- pmi_s: latest Services PMI (number like 53.4)
- retail: latest Retail Sales month-over-month %
- rate_source, cpi_source, unemp_source, stance_reasoning

Use your most current knowledge. Return exactly this structure:
{"timestamp":"2026-03-16T00:00:00Z","data":{"USD":{"rate":3.625,"cpi":2.4,"unemp":4.4,"stance":"neutral","gdp":0.7,"pmi_m":51.6,"pmi_s":51.7,"retail":-0.2,"rate_source":"Fed","cpi_source":"BLS","unemp_source":"BLS","stance_reasoning":"Fed holding steady"},"EUR":{"rate":2.0,"cpi":2.2,"unemp":6.1,"stance":"neutral","gdp":0.2,"pmi_m":50.8,"pmi_s":51.9,"retail":-0.1,"rate_source":"ECB","cpi_source":"Eurostat","unemp_source":"Eurostat","stance_reasoning":"ECB paused"},"GBP":{"rate":3.75,"cpi":3.0,"unemp":5.2,"stance":"neutral","gdp":0.0,"pmi_m":51.7,"pmi_s":53.9,"retail":1.8,"rate_source":"BoE","cpi_source":"ONS","unemp_source":"ONS","stance_reasoning":"BoE cautious"},"JPY":{"rate":0.5,"cpi":1.8,"unemp":2.5,"stance":"neutral","gdp":0.3,"pmi_m":53.0,"pmi_s":53.8,"retail":4.1,"rate_source":"BoJ","cpi_source":"Japan Stats","unemp_source":"Japan Stats","stance_reasoning":"BoJ on hold"},"AUD":{"rate":4.1,"cpi":3.2,"unemp":4.0,"stance":"neutral","gdp":0.8,"pmi_m":51.0,"pmi_s":52.8,"retail":1.2,"rate_source":"RBA","cpi_source":"ABS","unemp_source":"ABS","stance_reasoning":"RBA on hold"},"NZD":{"rate":3.5,"cpi":2.5,"unemp":5.1,"stance":"dovish","gdp":1.1,"pmi_m":55.0,"pmi_s":48.0,"retail":0.9,"rate_source":"RBNZ","cpi_source":"Stats NZ","unemp_source":"Stats NZ","stance_reasoning":"RBNZ cutting"},"CAD":{"rate":3.0,"cpi":1.9,"unemp":6.6,"stance":"dovish","gdp":0.2,"pmi_m":51.0,"pmi_s":46.5,"retail":-0.4,"rate_source":"BoC","cpi_source":"Stats Canada","unemp_source":"Stats Canada","stance_reasoning":"BoC easing"},"CHF":{"rate":0.25,"cpi":0.3,"unemp":2.8,"stance":"neutral","gdp":0.2,"pmi_m":49.6,"pmi_s":54.2,"retail":1.1,"rate_source":"SNB","cpi_source":"Swiss Stats","unemp_source":"Swiss Stats","stance_reasoning":"SNB near zero"}},"confidence":"high","notes":"March 2026"}`
      }]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(serverBody)
    });

    const data = await response.json();

    // Extract text from Claude response
    let text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';

    // Strip markdown fences
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    // Extract JSON object
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.substring(start, end + 1);

    // Parse and validate
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(e) {
      // Fallback with full data including GMT fields
      parsed = {
        timestamp: new Date().toISOString(),
        data: {
          USD: { rate:3.625, cpi:2.4,  unemp:4.4, stance:'neutral', gdp:0.7,  pmi_m:51.6, pmi_s:51.7, retail:-0.2, rate_source:'Fed',  cpi_source:'BLS',          unemp_source:'BLS',          stance_reasoning:'Fed holding steady' },
          EUR: { rate:2.0,   cpi:2.2,  unemp:6.1, stance:'neutral', gdp:0.2,  pmi_m:50.8, pmi_s:51.9, retail:-0.1, rate_source:'ECB',  cpi_source:'Eurostat',     unemp_source:'Eurostat',     stance_reasoning:'ECB paused' },
          GBP: { rate:3.75,  cpi:3.0,  unemp:5.2, stance:'neutral', gdp:0.0,  pmi_m:51.7, pmi_s:53.9, retail:1.8,  rate_source:'BoE',  cpi_source:'ONS',          unemp_source:'ONS',          stance_reasoning:'BoE cautious' },
          JPY: { rate:0.5,   cpi:1.8,  unemp:2.5, stance:'neutral', gdp:0.3,  pmi_m:53.0, pmi_s:53.8, retail:4.1,  rate_source:'BoJ',  cpi_source:'Japan Stats',  unemp_source:'Japan Stats',  stance_reasoning:'BoJ on hold' },
          AUD: { rate:4.1,   cpi:3.2,  unemp:4.0, stance:'neutral', gdp:0.8,  pmi_m:51.0, pmi_s:52.8, retail:1.2,  rate_source:'RBA',  cpi_source:'ABS',          unemp_source:'ABS',          stance_reasoning:'RBA on hold' },
          NZD: { rate:3.5,   cpi:2.5,  unemp:5.1, stance:'dovish',  gdp:1.1,  pmi_m:55.0, pmi_s:48.0, retail:0.9,  rate_source:'RBNZ', cpi_source:'Stats NZ',     unemp_source:'Stats NZ',     stance_reasoning:'RBNZ cutting' },
          CAD: { rate:3.0,   cpi:1.9,  unemp:6.6, stance:'dovish',  gdp:0.2,  pmi_m:51.0, pmi_s:46.5, retail:-0.4, rate_source:'BoC',  cpi_source:'Stats Canada', unemp_source:'Stats Canada', stance_reasoning:'BoC easing' },
          CHF: { rate:0.25,  cpi:0.3,  unemp:2.8, stance:'neutral', gdp:0.2,  pmi_m:49.6, pmi_s:54.2, retail:1.1,  rate_source:'SNB',  cpi_source:'Swiss Stats',  unemp_source:'Swiss Stats',  stance_reasoning:'SNB near zero' }
        },
        confidence: 'high',
        notes: 'Fallback data March 2026'
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(parsed) }] })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
