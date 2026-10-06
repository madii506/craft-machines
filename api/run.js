// /api/run  the machines.
//   POST {mint, input}                     run a live craft: its recipe with your words, made by its model (Krea or Ideogram)
//   POST {test: {model, recipe, input}}    a test run before a launch; the picture can become the token's image
//   GET  ?img=<id>                         a run's picture (webp, kept here)
//   GET  ?mint=<mint>[&before=<id>]        a craft's latest runs
//   GET  ?recent=1                         the latest runs from every machine
// Every craft gets free runs every day, more while its token trades and more again once it graduates; the house also
// keeps one daily cap for all machines together. A run that fails is not counted.
const L = require('./_lib');
const G = require('./_gen');
const BASE = Math.max(1, Number(process.env.RUNS_BASE) || 20), TRADING = Math.max(BASE, Number(process.env.RUNS_TRADING) || 60), GRAD = Math.max(TRADING, Number(process.env.RUNS_GRADUATED) || 150);
const HOUR = 36e5;
const allowance = k => (k.complete ? GRAD : k.last_trade_at && Date.now() - new Date(k.last_trade_at) < 6 * HOUR ? TRADING : BASE);
const today = `(now() AT TIME ZONE 'utc')::date`;

async function serveImg(res, id) {
  const r = /^\d{1,15}$/.test(id) ? await L.q('SELECT img FROM cft_runs WHERE id=$1', [id]) : [];
  if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=60'); return res.end(); }
  res.statusCode = 200; res.setHeader('Content-Type', 'image/webp'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
  return res.end(Buffer.from(r[0].img));
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return L.send(res, 204, {});
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'CRAFT’s records are offline.' });
  try {
    await L.ready();
    if (req.method === 'GET') {
      const qy = L.query(req);
      if (qy.img) return serveImg(res, String(qy.img));
      if (qy.mint) {
        if (!L.isAddr(String(qy.mint))) return L.send(res, 200, { ok: false, error: 'That isn’t a token address.' });
        const before = /^\d{1,15}$/.test(String(qy.before || '')) ? String(qy.before) : '999999999999999';
        const runs = await L.q(`SELECT id, input, model, at FROM cft_runs WHERE mint=$1 AND id < $2 ORDER BY id DESC LIMIT 24`, [String(qy.mint), before]);
        return L.send(res, 200, { ok: true, runs }, L.CACHE(5, 30));
      }
      const runs = await L.q(`SELECT r.id, r.input, r.model, r.at, r.mint, c.name, c.symbol FROM cft_runs r JOIN cft_coins c ON c.mint = r.mint
        WHERE r.preview = false AND c.status = 'live' ORDER BY r.id DESC LIMIT 24`);
      return L.send(res, 200, { ok: true, runs }, L.CACHE(5, 30));
    }
    if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'GET or POST.' });
    const b = await L.body(req, 8192);
    const test = b.test && typeof b.test === 'object' ? b.test : null;
    if (L.limited((test ? 'test:' : 'run:') + L.ip(req), test ? 8 : 10, test ? 1800000 : 600000)) return L.send(res, 200, { ok: false, error: test ? 'That’s a lot of test runs. Wait a few minutes.' : 'Easy: wait a few minutes before the next run.' });
    const input = L.clean(test ? test.input : b.input, 120);
    if (input.length < 1) return L.send(res, 200, { ok: false, error: 'Type something for the machine first.' });
    let k = null, model, recipe;
    if (test) {
      model = String(test.model || ''); recipe = L.clean(test.recipe, 600);
      if (!G.MODELS[model]) return L.send(res, 200, { ok: false, error: 'Pick a model.' });
      if (recipe.length < 12) return L.send(res, 200, { ok: false, error: 'Write the recipe first: what the machine always makes.' });
    } else {
      const mint = String(b.mint || '');
      if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'That isn’t a craft.' });
      k = (await L.q(`SELECT mint, name, symbol, model, recipe, complete, last_trade_at, run_day, runs_today FROM cft_coins WHERE mint=$1 AND status='live'`, [mint]))[0];
      if (!k) return L.send(res, 200, { ok: false, error: 'No machine lives there yet.' });
      model = k.model; recipe = k.recipe;
    }
    if (L.NOPE.test(input) || L.NOPE.test(recipe)) return L.send(res, 200, { ok: false, error: 'The machines don’t make that. Try other words.' });
    if (!G.open()[model]) return L.send(res, 200, { ok: false, error: G.words('CLOSED') });
    let left = null;
    if (k) {
      const cap = allowance(k);
      const got = await L.q(`UPDATE cft_coins SET runs_today = CASE WHEN run_day = ${today} THEN runs_today + 1 ELSE 1 END, run_day = ${today}
        WHERE mint=$1 AND (run_day IS DISTINCT FROM ${today} OR runs_today < $2) RETURNING runs_today`, [k.mint, cap]);
      if (!got.length) return L.send(res, 200, { ok: false, error: `This machine used today’s ${cap} runs. ${cap < GRAD ? 'It gets more while its token trades.' : 'More at 00:00 UTC.'}` });
      left = cap - got[0].runs_today;
    }
    if (!(await L.spendRun())) {
      if (k) await L.q(`UPDATE cft_coins SET runs_today = GREATEST(0, runs_today - 1) WHERE mint=$1`, [k.mint]);
      return L.send(res, 200, { ok: false, error: 'The machines hit today’s limit. They’re back at 00:00 UTC.' });
    }
    const prompt = G.promptOf(recipe, input);
    let img;
    try { img = await G.make(model, prompt); }
    catch (e) {
      await L.refundRun();
      if (k) await L.q(`UPDATE cft_coins SET runs_today = GREATEST(0, runs_today - 1) WHERE mint=$1`, [k.mint]);
      return L.send(res, 200, { ok: false, error: G.words(e) });
    }
    const ins = await L.q(`INSERT INTO cft_runs (mint, input, prompt, model, img, preview) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, at`, [k ? k.mint : null, input, prompt, model, img, !k]);
    if (k) { await L.q(`UPDATE cft_coins SET runs = runs + 1, last_run_at = now() WHERE mint=$1`, [k.mint]); }
    L.send(res, 200, { ok: true, id: ins[0].id, at: ins[0].at, img: '/api/run?img=' + ins[0].id, model, left, by: G.MODELS[model].label });
  } catch (e) { L.send(res, 200, { ok: false, error: 'The machine stalled. Try again.' }); }
};
