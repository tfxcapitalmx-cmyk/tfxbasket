// Finds the video that is live right now on each TV channel of the TV section and writes data/tv.json
// ({ channels: { <channelId>: { v: <videoId>, t: <title> } } }). The page embeds that video; for a channel that is not
// live, or when this process could not read it, the page falls back to the channel's own live embed.
// Why: for several channels (Yahoo Finance, Fox Business, Reuters, Schwab, Negocios TV) YouTube's channel embed
// answers "video unavailable", while the video embed works, and their live video changes with every show.
// Runs in .github/workflows/tv.yml. Local run: node scripts/tv/update.mjs
import fs from 'fs';

// Channels come from data/tv-config.json (edited only by the administrator): the YouTube ones with a handle.
const CH = JSON.parse(fs.readFileSync('data/tv-config.json', 'utf8')).canales
  .filter(c => c.k === 'channel' && c.h).map(c => [c.h, c.v, c.n]);
const OUT = 'data/tv.json';
const HDR = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+1; SOCS=CAI' };

// Reads a /live page. live = a stream running now.
// From datacenter addresses (GitHub Actions) YouTube answers a "sign in to confirm you're not a bot" page: the player
// data is gone but the page still carries the watched video (its like button) and the "isLive" mark, so that version is
// read too. The three first video ids of that page belong to the suggested next video, not to the stream.
export function parseLive(html, channelId) {
  if (!html.includes('ytInitialPlayerResponse')) return { ok: false, err: 'YouTube no devolvió los datos del reproductor (' + (/<title>([^<]{0,60})/.exec(html) || [])[1] + ', ' + html.length + ' bytes)' };
  if (/"playabilityStatus":\{"status":"LOGIN_REQUIRED"/.test(html)) {
    const v = (/"likeEndpoint":\{"status":"LIKE","target":\{"videoId":"([\w-]{11})"/.exec(html) || [])[1] || '';
    const live = !!v && /"isLive":true/.test(html) && html.includes('"browseId":"' + channelId + '"');
    const t = (/"playerOverlayVideoDetailsRenderer":{"title":{"simpleText":"([^"]{0,80})/.exec(html) || [])[1] || '';
    return { ok: true, live, v: live ? v : '', t: live ? t.replace(/\\u0026/g, '&') : '', blocked: true };
  }
  const i = html.indexOf('"videoDetails"');
  if (i < 0) return { ok: true, live: false };
  const seg = html.slice(i, i + 3000), get = re => (re.exec(seg) || [])[1] || '';
  const v = get(/"videoId":"([\w-]{11})"/), ch = get(/"channelId":"(UC[\w-]{22})"/);
  const embed = (/"playableInEmbed":(true|false)/.exec(html) || [])[1] !== 'false';
  const live = /"isLive":true/.test(seg) && !!v && ch === channelId && embed;
  return { ok: true, live, v: live ? v : '', t: live ? get(/"title":"([^"]{0,80})/).replace(/\\u0026/g, '&') : '' };
}

async function one([h, id, name]) {
  for (let k = 0; k < 2; k++) {
    try {
      const r = await fetch(`https://www.youtube.com/@${h}/live`, { headers: HDR, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      if (/consent\.youtube\.com|before you continue to youtube/i.test(html.slice(0, 4000))) throw new Error('página de consentimiento');
      const p = parseLive(html, id);
      if (!p.ok) throw new Error(p.err);
      return { id, name, ...p };
    } catch (e) { if (k) return { id, name, ok: false, err: String(e.message || e) }; }
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')).channels || {}; } catch (e) {}
  const R = await Promise.all(CH.map(one)), channels = {};
  for (const r of R) {
    if (!r.ok) { console.log(`${r.name}: no se pudo leer (${r.err}); se conserva el valor anterior`); if (prev[r.id]) channels[r.id] = prev[r.id]; continue; }
    console.log(`${r.name}: ${r.live ? `en vivo ${r.v} · ${r.t}${r.blocked ? ' (lectura con bloqueo)' : ''}` : 'sin directo ahora (la página usará el canal)'}`);
    if (r.live) channels[r.id] = { v: r.v, t: r.t };
  }
  const read = R.filter(r => r.ok).length;
  if (!read) { console.error('Ningún canal se pudo leer: no se escribe nada.'); process.exit(1); }
  // 24/7 channels never all go dark at once; an empty result over a populated one means a bad read, not a real change.
  if (!Object.keys(channels).length && Object.keys(prev).length > 2) { console.error('Todos los canales salieron sin directo: se considera una lectura mala y se conserva lo anterior.'); process.exit(1); }
  if (JSON.stringify(prev) === JSON.stringify(channels)) console.log('Sin cambios.');
  else { fs.writeFileSync(OUT, JSON.stringify({ asof: new Date().toISOString(), channels }, null, 1) + '\n'); console.log(`data/tv.json actualizado (${Object.keys(channels).length} en vivo de ${CH.length}).`); }
}
