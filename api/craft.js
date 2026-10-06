// GET /api/craft?mint=  one craft: its record (machine, recipe, token, split), its latest runs, what happened to it, its guild
// (with how each member is doing now), and how many runs it has left today.
const L = require('./_lib');
const G = require('./_gen');
const COLS = `mint, slot, name, symbol, line, model, recipe, ask, cover, xhandle, payer, shares, gods, draw, born_at, status, state, mcap_sol, complete, last_trade_at, vault_lamports,
  created_at, runs, runs_today, run_day, last_run_at, likes`;
const HOUR = 36e5;
const BASE = Math.max(1, Number(process.env.RUNS_BASE) || 20), TRADING = Math.max(BASE, Number(process.env.RUNS_TRADING) || 60), GRAD = Math.max(TRADING, Number(process.env.RUNS_GRADUATED) || 150);
module.exports = async (req, res) => {
  const mint = String(L.query(req).mint || '').trim();
  if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'That isn’t a token address.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'CRAFT’s records are offline.' });
  try {
    await L.ready();
    const k = (await L.q(`SELECT ${COLS} FROM cft_coins WHERE mint=$1`, [mint]))[0];
    if (!k || k.status === 'void') return L.send(res, 200, { ok: false, missing: true, error: 'No machine lives at that address.' }, L.CACHE(10));
    const gods = typeof k.gods === 'string' ? JSON.parse(k.gods) : (k.gods || []);
    const [runs, log, lives, solUsd] = await Promise.all([
      L.q(`SELECT id, input, model, at FROM cft_runs WHERE mint=$1 ORDER BY id DESC LIMIT 24`, [mint]),
      L.q(`SELECT kind, text, at FROM cft_log WHERE mint=$1 ORDER BY id DESC LIMIT 20`, [mint]),
      gods.length ? L.q(`SELECT wallet, born_at, state FROM cft_lives WHERE wallet = ANY($1)`, [gods.map(g => g.wallet)]) : [],
      L.solPrice().catch(() => null),
    ]);
    const now = new Map(lives.map(l => [l.wallet, l]));
    const godsNow = gods.map(g => { const l = now.get(g.wallet); return { ...g, alive: !!(l && l.state === 'alive'), now: l && l.state === 'alive' ? L.stageOf(l.born_at).stage : 'gone' }; });
    const cap = k.complete ? GRAD : k.last_trade_at && Date.now() - new Date(k.last_trade_at) < 6 * HOUR ? TRADING : BASE;
    const used = k.run_day && new Date(k.run_day).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) ? k.runs_today : 0;
    L.send(res, 200, { ok: true, coin: { ...k, gods: godsNow }, runs, log, solUsd, studio: L.STUDIO || null, models: G.open(), today: { cap, used, left: Math.max(0, cap - used) } }, L.CACHE(5, 30));
  } catch (e) { L.send(res, 200, { ok: false, error: 'CRAFT’s records didn’t answer.' }); }
};
