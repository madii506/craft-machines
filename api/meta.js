// POST /api/meta {mint, payer, name, symbol, line, model, recipe, ask, cover, x}  before a launch: record the craft (its model,
//   its recipe, what people type into it, and the test run whose picture becomes the token's image), draw its guild from
//   $CRAFT guild members, and write its split (locked on-chain at birth).
// GET  /m/<id>    (→ /api/meta?id=)    the metadata JSON the token's on-chain uri points at.
// GET  /i/<mint>  (→ /api/meta?img=)   its picture.
const L = require('./_lib');
const X = require('./_craft');
const G = require('./_gen');

const bytes = s => Buffer.byteLength(s, 'utf8');
function metaJson(k, site) {
  const page = site + '/c/' + k.mint;
  return {
    name: k.name, symbol: k.symbol,
    description: `An AI machine on CRAFT: ${k.line}. Run it: ${page.replace(/^https?:\/\//, '')}`,
    image: site + '/i/' + k.mint, external_url: page, showName: true,
    website: page, twitter: k.xhandle ? 'https://x.com/' + k.xhandle : undefined, extensions: { website: page }, createdOn: site,
    craft: { v: 1, mint: k.mint, model: k.model, shares: k.shares },
  };
}
function img(res, buf, type, live) {
  res.statusCode = 200; res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', live ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=30');
  return res.end(Buffer.from(buf));
}
async function get(req, res) {
  const qy = L.query(req);
  if (!L.dbReady()) return L.send(res, 404, { error: 'not found' });
  await L.ready();
  if (qy.img) {
    const mint = String(qy.img).replace(/\.\w+$/, '');
    const r = L.isAddr(mint) ? await L.q('SELECT img, status FROM cft_coins WHERE mint=$1 AND img IS NOT NULL', [mint]).catch(() => []) : [];
    if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=30'); return res.end(); }
    return img(res, r[0].img, 'image/jpeg', r[0].status === 'live');
  }
  const id = String(qy.id || '').replace(/\.json$/, '');
  if (!/^[1-9A-HJ-NP-Za-km-z]{8,44}$/.test(id)) return L.send(res, 404, { error: 'not found' });
  const r = await L.q('SELECT mint, name, symbol, line, model, xhandle, shares FROM cft_coins WHERE id=$1', [id]).catch(() => []);
  if (!r.length) return L.send(res, 404, { error: 'not found' }, 'public, max-age=30');
  L.send(res, 200, metaJson(r[0], L.origin(req)), 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
}
async function picture(runId) {
  if (!/^\d{1,15}$/.test(String(runId || ''))) return null;
  const r = await L.q('SELECT img FROM cft_runs WHERE id=$1 AND mint IS NULL AND preview = true', [String(runId)]);
  if (!r.length) return null;
  return require('sharp')(Buffer.from(r[0].img)).resize(768, 768, { fit: 'cover' }).flatten({ background: '#f7f6f4' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
async function post(req, res) {
  if (L.limited('meta:' + L.ip(req), 20, 600000)) return L.send(res, 200, { ok: false, error: 'Too many from here. Wait a few minutes.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'CRAFT’s records are offline, so launching is paused. Try again shortly.' });
  if (!L.STUDIO) return L.send(res, 200, { ok: false, error: 'Launching opens soon.' });
  const b = await L.body(req, 3.5 * 1024 * 1024);
  if (b.tooBig) return L.send(res, 200, { ok: false, error: 'That picture is too big.' });
  const mint = String(b.mint || ''), payer = String(b.payer || '');
  if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'The new token address is missing.' });
  if (!L.isAddr(payer)) return L.send(res, 200, { ok: false, error: 'Connect your wallet first.' });
  const name = L.clean(b.name, 64), symbol = L.clean(b.symbol, 20).replace(/^\$/, '').toUpperCase(), line = L.clean(b.line, 300);
  const model = G.MODELS[b.model] ? b.model : null, recipe = L.clean(b.recipe, 600), ask = L.clean(b.ask, 40) || 'a word';
  const x = String(b.x || '').trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').replace(/\/.*$/, '');
  if (x && !/^[A-Za-z0-9_]{1,15}$/.test(x)) return L.send(res, 200, { ok: false, error: 'That X handle doesn’t look right.' });
  if (!name || bytes(name) > 32) return L.send(res, 200, { ok: false, error: 'Give it a name of up to 32 characters.' });
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return L.send(res, 200, { ok: false, error: 'The ticker is 1–10 letters or numbers.' });
  if (line.length < 8) return L.send(res, 200, { ok: false, error: 'Write what the machine makes: one line.' });
  if (!model) return L.send(res, 200, { ok: false, error: 'Pick the machine’s model.' });
  if (recipe.length < 12) return L.send(res, 200, { ok: false, error: 'Write the recipe: what the machine always makes.' });
  if (L.NOPE.test(recipe + ' ' + ask + ' ' + line)) return L.send(res, 200, { ok: false, error: 'The machines don’t make that. Pick other words.' });
  if (L.BANNED.test(name + ' ' + symbol + ' ' + line)) return L.send(res, 200, { ok: false, error: 'Pick other words: those break the house rules.' });
  let pic = null;
  try { await L.ready(); pic = await picture(b.cover); } catch { return L.send(res, 200, { ok: false, error: 'CRAFT’s records didn’t answer. Try again.' }); }
  if (!pic) return L.send(res, 200, { ok: false, error: 'Do a test run first: its picture becomes the token’s image.' });
  try {
    if (!L.MOCK) { const acct = await L.rpc('getAccountInfo', [L.bondingCurveOf(mint), { encoding: 'base64' }]); if (acct && acct.value) return L.send(res, 200, { ok: false, error: 'That token is already launched; its record can’t change.' }); }
  } catch { return L.send(res, 200, { ok: false, error: 'Solana didn’t answer just now. Try again in a moment.' }); }
  try {
    await L.ready();
    const id = L.metaId(mint);
    const prev = await L.q('SELECT mint, status FROM cft_coins WHERE id=$1', [id]);
    if (prev.length && (prev[0].mint !== mint || prev[0].status !== 'pending')) return L.send(res, 200, { ok: false, error: 'Try again: the page will make a new token address.' });
    const { gods, draw } = await X.drawGods(mint, payer);
    const shares = L.sharesOf(payer, gods.map(g => g.wallet));
    await L.q(`INSERT INTO cft_coins (mint, id, name, symbol, line, model, recipe, ask, cover, xhandle, payer, shares, gods, draw, img) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (mint) DO UPDATE SET name=EXCLUDED.name, symbol=EXCLUDED.symbol, line=EXCLUDED.line, model=EXCLUDED.model, recipe=EXCLUDED.recipe, ask=EXCLUDED.ask, cover=EXCLUDED.cover,
        xhandle=EXCLUDED.xhandle, payer=EXCLUDED.payer, shares=EXCLUDED.shares, gods=EXCLUDED.gods, draw=EXCLUDED.draw, img=EXCLUDED.img, created_at=now() WHERE cft_coins.status='pending'`,
      [mint, id, name, symbol, line, model, recipe, ask, String(b.cover), x || null, payer, JSON.stringify(shares), JSON.stringify(gods), JSON.stringify(draw), pic]);
    const site = L.origin(req);
    L.send(res, 200, { ok: true, uri: site + '/m/' + id, image: site + '/i/' + mint, studio: L.STUDIO, name, symbol, shares, gods, draw });
  } catch (e) { L.send(res, 200, { ok: false, error: /drawn/.test(String(e && e.message)) ? String(e.message) : 'Its record didn’t save. Try again.' }); }
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return L.send(res, 204, {});
  if (req.method === 'POST') return post(req, res);
  return get(req, res);
};
