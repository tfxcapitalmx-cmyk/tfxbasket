// Temporal: contexto de cada identificador de video en la página que YouTube devuelve a este equipo.
const HDR = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+1; SOCS=CAI' };
for (const h of ['YahooFinance', 'SkyNews', 'Reuters']) {
  const t = await (await fetch(`https://www.youtube.com/@${h}/live`, { headers: HDR })).text();
  const out = []; const re = /"videoId":"([\w-]{11})"/g; let m, n = 0;
  while ((m = re.exec(t)) && n < 14) { n++; out.push(m[1] + ' ← ' + t.slice(Math.max(0, m.index - 70), m.index).replace(/[\n"]/g, '').slice(-60)); }
  console.log('### ' + h + ' len=' + t.length + '\n' + out.join('\n'));
  console.log('isLiveContent:', /"isLiveContent":true/.test(t), '| isLive:', (t.match(/"isLive":true/g) || []).length, '| liveStreamability:', /"liveStreamability"/.test(t), '| badge LIVE:', /BADGE_STYLE_TYPE_LIVE_NOW/.test(t), '| ownerBadge:', /"style":"LIVE"|"iconType":"LIVE"/.test(t));
}
