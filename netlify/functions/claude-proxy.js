exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, headers: {'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({error:'No API key'}) };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01'},
      body: event.body
    });
    const data = await res.json();
    return { statusCode: res.status, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify(data) };
  } catch(e) {
    return { statusCode: 500, headers: {'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({error:e.message}) };
  }
};
