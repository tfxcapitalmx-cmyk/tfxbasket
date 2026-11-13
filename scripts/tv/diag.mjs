// Temporal: muestra qué datos del directo siguen en la página que YouTube devuelve a este equipo.
const HDR = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+1; SOCS=CAI' };
for (const [h, id] of [['YahooFinance', 'UCEAZeUIeJs0IjQiqTCdVSIg'], ['SkyNews', 'UCoMdktPbSTixAyNGwb-UYkQ'], ['CNBCtelevision', 'UCrp_UI8XtuYfpiqluWLD7Lw'], ['NewsNation', 'UCCjG8NtOig0USdrT5D1FpxQ']]) {
  try {
    const r = await fetch(`https://www.youtube.com/@${h}/live`, { headers: HDR }), t = await r.text();
    const m = re => (re.exec(t) || [])[1] || '';
    const vdi = t.indexOf('"videoDetails"');
    console.log(JSON.stringify({ h, canon: m(/<link rel="canonical" href="([^"]+)"/), liveNow: /"isLiveNow":true/.test(t), liveBcast: /"liveBroadcastDetails"/.test(t), ldLive: /"isLiveBroadcast"\s*:\s*true|"isLiveBroadcast":"True"/i.test(t),
      vdAt: vdi, vdSeg: vdi >= 0 ? t.slice(vdi, vdi + 160) : '', extId: m(/"externalId":"(UC[\w-]{22})"/), ogUrl: m(/<meta property="og:url" content="([^"]+)"/), ogTitle: m(/<meta property="og:title" content="([^"]{0,60})/),
      vidCount: (t.match(/"videoId":"[\w-]{11}"/g) || []).slice(0, 4), play: m(/"playabilityStatus":\{"status":"(\w+)"/) }));
  } catch (e) { console.log(h, 'ERR', e.message); }
}
