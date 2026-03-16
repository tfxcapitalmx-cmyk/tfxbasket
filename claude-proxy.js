// ─────────────────────────────────────────────────────────────
//  TFX Capital · Macro Basket Engine
//  Netlify Function: claude-proxy.js
//  Proxies requests from the dashboard to the Anthropic API
//  so the browser never makes a direct cross-origin call.
// ─────────────────────────────────────────────────────────────

exports.handler = async function (event, context) {

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // API key must be set as an environment variable in Netlify dashboard
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'ANTHROPIC_API_KEY not configured. Add it in Netlify → Site Settings → Environment Variables.'
      })
    };
  }

  try {
    const body = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        // Allow calls from any origin on the same Netlify site
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
