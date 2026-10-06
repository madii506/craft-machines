// GET /api/board  every craft (newest first) with its machine, its runs and its token, the latest runs from every machine, and
// how the guild is doing, read from CRAFT's records, which the cycle keeps in step with the chain.
const L = require('./_lib');
const G = require('./_gen');
const COLS = `c.mint, c.slot, c.name, c.symbol, c.line, c.model, c.ask, c.recipe, c.cover, c.payer, c.born_at, c.state, c.mcap_sol, c.complete, c.last_trade_at, c.vault_lamports,
  c.runs, c.runs_today, c.run_day, c.last_run_at, c.likes, c.xhandle, jsonb_array_length(c.gods) AS ngods`;
module.exports = async (req, res) => {
  const base = { models: G.open(), open: !!L.STUDIO, studio: L.STUDIO || null, life: L.LIFE_MINT || null, minBurn: L.MIN_BURN, split: { yours: L.YOURS, gods: L.GODS, house: L.HOUSE, max: L.MAX_GODS } };
  if (!L.dbReady()) return L.send(res, 200, { ok: true, offline: true, coins: [], runs: [], elders: [], lives: { alive: 0, dead: 0 }, ...base });
  try {
    await L.ready();
    const [coins, runs, counts, elders, solUsd, today] = await Promise.all([
      L.q(`SELECT ${COLS} FROM cft_coins c WHERE c.status='live' ORDER BY c.slot DESC LIMIT 500`),
      L.q(`SELECT r.id, r.input, r.model, r.at, r.mint, c.name, c.symbol FROM cft_runs r JOIN cft_coins c ON c.mint = r.mint WHERE r.preview = false AND c.status='live' ORDER BY r.id DESC LIMIT 24`),
      L.q(`SELECT count(*) FILTER (WHERE state='alive')::int AS alive, count(*) FILTER (WHERE state='dead')::int AS dead FROM cft_lives`),
      L.q(`SELECT l.wallet, l.born_at, l.lives, (SELECT count(*)::int FROM cft_coins c WHERE c.status='live' AND c.gods @> jsonb_build_array(jsonb_build_object('wallet', l.wallet))) AS kids
        FROM cft_lives l WHERE l.state='alive' ORDER BY l.born_at ASC LIMIT 10`),
      L.solPrice().catch(() => null),
      L.q(`SELECT CASE WHEN runs_day = (now() AT TIME ZONE 'utc')::date THEN runs ELSE 0 END AS runs FROM cft_state WHERE id=1`),
    ]);
    L.send(res, 200, { ok: true, coins, runs, lives: counts[0] || { alive: 0, dead: 0 }, elders: elders.map(e => ({ ...e, ...L.stageOf(e.born_at) })), solUsd,
      today: { runs: (today[0] && today[0].runs) || 0, cap: L.DAILY_RUNS }, ...base }, L.CACHE(6, 60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'CRAFT’s records didn’t answer.', ...base }); }
};
