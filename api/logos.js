// GET /api/logos?mints=a,b,c  the real token pictures (and names) of up to 20 Solana tokens, read from Jupiter's token
// list. Also: GET /api/logos?uri=<metadata url>  a new pump.fun coin's picture, read from its own metadata (any public
// https host; IPFS links are tried across several gateways). GET /api/logos?img=<url>  that picture as a small webp.
// The page shows these as each coin's own image; when a read fails it says nothing and draws the coin's pad instead.
const L = require('./_lib');
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// a picture, fetched once and cached at the edge: IPFS links are tried across several public gateways at once,
// and every picture comes back as a small square webp from this site, so it loads fast and never gets blocked.
const GW = ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://w3s.link/ipfs/', 'https://nftstorage.link/ipfs/'];
function sources(url) {
  let u; try { u = new URL(url); } catch { return []; }
  if (u.protocol !== 'https:' || /^(localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|metadata\.google)/i.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return [];
  const m = u.pathname.match(/^\/ipfs\/([A-Za-z0-9]{40,100})(\/.*)?$/), sub = u.hostname.match(/^([a-z0-9]{40,100})\.ipfs\./i), raw = /^\/?(baf[a-z0-9]{50,})$/i.test(u.hostname) ? u.hostname : null;
  const cid = m ? m[1] : sub ? sub[1] : (u.hostname.match(/^(baf[a-z0-9]{50,})/i) || [])[1] || raw;
  if (cid) return GW.map(g => g + cid + (m && m[2] ? m[2] : ''));
  return [u.toString()];
}
async function grab(src, ms) {
  const r = await fetch(src, { headers: { 'user-agent': L.UA, accept: 'image/*,*/*' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!r.ok) throw new Error('status ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length || buf.length > 8e6) throw new Error('size');
  return buf;
}
async function picture(req, res, url) {
  const srcs = sources(url).slice(0, 5);
  if (!srcs.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=300'); return res.end(); }
  try {
    const buf = await Promise.any(srcs.map(s => grab(s, 9000)));
    const out = await require('sharp')(buf, { animated: false, limitInputPixels: 50e6 }).resize(192, 192, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
    res.statusCode = 200; res.setHeader('Content-Type', 'image/webp'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    return res.end(out);
  } catch { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600'); return res.end(); }
}
module.exports = async (req, res) => {
  const qy = L.query(req);
  if (qy.img) { if (L.limited('img:' + L.ip(req), 300, 60000)) { res.statusCode = 429; return res.end(); } return picture(req, res, String(qy.img).slice(0, 600)); }
  if (L.limited('logos:' + L.ip(req), 120, 60000)) return L.send(res, 200, { ok: false, error: 'Too many requests. Wait a minute.' });
  if (qy.uri) {
    // a new pump.fun coin's metadata, tried across several IPFS gateways at once (a fresh pin can be slow on one)
    const srcs = sources(String(qy.uri).slice(0, 600)).slice(0, 5);
    if (!srcs.length) return L.send(res, 200, { ok: false }, L.CACHE(3600));
    try {
      const image = await Promise.any(srcs.map(async src => {
        const r = await L.getJson(src, {}, 6500);
        let im = r && r.ok && r.json && typeof r.json.image === 'string' ? r.json.image.trim() : '';
        if (/^ipfs:\/\//i.test(im)) im = 'https://ipfs.io/ipfs/' + im.slice(7).replace(/^ipfs\//i, '');
        if (!/^https:\/\//i.test(im)) throw new Error('no image');
        return 'https://' + im.slice(8, 408);
      }));
      return L.send(res, 200, { ok: true, image }, L.CACHE(86400));
    } catch { return L.send(res, 200, { ok: false, image: null }, L.CACHE(20, 20)); }
  }
  const mints = String(qy.mints || '').split(',').map(s => s.trim()).filter(s => B58.test(s)).slice(0, 20);
  if (!mints.length) return L.send(res, 200, { ok: false, error: 'No token addresses.' });
  try {
    const r = await L.getJson('https://lite-api.jup.ag/tokens/v2/search?query=' + mints.join(','), {}, 8000);
    const out = {};
    for (const t of Array.isArray(r.json) ? r.json : []) if (t && mints.includes(t.id)) out[t.id] = { symbol: String(t.symbol || '').slice(0, 20), name: String(t.name || '').slice(0, 40), icon: typeof t.icon === 'string' && /^https:\/\//i.test(t.icon) ? 'https://' + t.icon.slice(8) : null };
    L.send(res, 200, { ok: true, tokens: out }, L.CACHE(21600));
  } catch { L.send(res, 200, { ok: false, error: 'The token list didn’t answer.' }, L.CACHE(60)); }
};
