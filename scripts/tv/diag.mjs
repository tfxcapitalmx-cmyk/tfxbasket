// Temporal: muestra qué responde YouTube a este equipo.
const HDR = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+1; SOCS=CAI' };
for (const u of ['https://www.youtube.com/@YahooFinance/live', 'https://www.youtube.com/channel/UCEAZeUIeJs0IjQiqTCdVSIg/live', 'https://www.youtube.com/watch?v=QB5BNdBFujE']) {
  try {
    const r = await fetch(u, { headers: HDR, redirect: 'follow' }), t = await r.text();
    const pr = /"playabilityStatus":\{"status":"(\w+)"(?:,"reason":"([^"]{0,120})")?/.exec(t) || [];
    console.log(JSON.stringify({ u: u.slice(24), status: r.status, final: r.url.slice(24, 90), len: t.length, title: (/<title>([^<]{0,70})/.exec(t) || [])[1], ipr: t.includes('ytInitialPlayerResponse'), vd: t.includes('"videoDetails"'), isLive: /"isLive":true/.test(t), play: pr[1], reason: pr[2], bot: /confirm you.re not a bot|unusual traffic|consent\.youtube/i.test(t) }));
  } catch (e) { console.log(u, 'ERR', e.message); }
}
