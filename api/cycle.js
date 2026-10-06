// GET /api/cycle  one cycle of CRAFT, run by a schedule (safe for anyone to call: it locks, and runs at most once per 25
// minutes). It finishes launches the page didn't see through, voids ones that never landed, reads every craft's token from the
// chain, ends the guild seats of holders who sold, and clears old test runs nobody launched.
const L = require('./_lib');
const X = require('./_craft');
module.exports = async (req, res) => {
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'records offline' });
  try {
    await L.ready();
    const got = await L.q(`UPDATE cft_state SET lock_at=now() WHERE id=1 AND (lock_at IS NULL OR lock_at < now() - interval '3 minutes') AND next_at <= now() RETURNING cycle`);
    if (!got.length) return L.send(res, 200, { ok: true, skipped: true });
    const cycle = got[0].cycle + 1, out = { ok: true, cycle, settled: 0, voided: 0 };
    try {
      for (const p of await L.q(`SELECT mint FROM cft_coins WHERE status='pending' AND created_at > now() - interval '3 hours'`)) { const r = await X.settle(p.mint).catch(() => null); if (r && r.live) out.settled++; }
      const v = await L.q(`UPDATE cft_coins SET status='void', img=NULL WHERE status='pending' AND created_at <= now() - interval '3 hours' RETURNING mint`); out.voided = v.length;
      const r = await X.readBoard(); out.coins = r.coins; out.changes = r.changes;
      out.lives = await X.checkLives();
      const old = await L.q(`DELETE FROM cft_runs WHERE preview = true AND at < now() - interval '2 days' AND id NOT IN (SELECT cover FROM cft_coins WHERE cover IS NOT NULL) RETURNING id`);
      out.cleared = old.length;
      const extra = await L.q(`DELETE FROM cft_runs WHERE preview = false AND id < (SELECT coalesce(min(id), 0) FROM (SELECT id FROM cft_runs WHERE preview = false ORDER BY id DESC LIMIT 4000) t) RETURNING id`);
      out.trimmed = extra.length;
    } finally {
      await L.q(`UPDATE cft_state SET cycle=$1, lock_at=NULL, next_at=now() + interval '25 minutes' WHERE id=1`, [cycle]);
    }
    L.send(res, 200, out);
  } catch (e) { L.send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) }); }
};
