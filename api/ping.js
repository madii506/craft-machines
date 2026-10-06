// GET /api/ping  is everything CRAFT needs answering? The database, which image models are switched on, the house wallet, $CRAFT.
const L = require('./_lib');
const G = require('./_gen');
module.exports = async (req, res) => {
  const out = { ok: true, db: L.dbReady(), models: G.open(), open: !!L.STUDIO, life: L.LIFE_MINT || null, minBurn: L.MIN_BURN, dailyRuns: L.DAILY_RUNS };
  if (out.db) { try { await L.ready(); const s = (await L.q('SELECT cycle, runs, runs_day FROM cft_state WHERE id=1'))[0]; out.today = s; } catch (e) { out.db = false; out.why = String(e && e.message).slice(0, 120); } }
  if (out.life) { try { out.token = await L.lifeToken(); } catch (e) { out.token = null; out.tokenWhy = String(e && e.message).slice(0, 120); } }
  L.send(res, 200, out);
};
