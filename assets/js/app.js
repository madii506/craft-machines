// CRAFT: the page. The machines, making a craft, real pump.fun coins live, the guild.
(function () {
  'use strict';
  const C = window.Core, $ = C.$, $$ = C.$$, esc = C.esc;
  const MODELS = { ideogram: { label: 'Ideogram 3.0', good: 'Text, logos, memes, posters' }, krea: { label: 'Krea 2', good: 'Photos, scenes, characters' } };
  const LABEL = { alive: 'live', asleep: 'quiet', dead: 'idle', ascended: 'graduated', pending: 'launching' };
  const PRESETS = [
    { n: 'Meme maker', model: 'ideogram', ask: 'your caption', r: 'A funny internet meme picture with the caption "{input}" in big bold white letters with a black outline, one clear scene, bright colours' },
    { n: 'PFP maker', model: 'krea', ask: 'who it is', r: 'A profile picture of {input}, centred, looking at the camera, soft studio light, plain bold-colour background, crisp detail' },
    { n: 'Sticker maker', model: 'ideogram', ask: 'a thing', r: 'A die-cut sticker of {input}, cute flat cartoon style, thick white border, black outlines, plain light background' },
    { n: 'Poster maker', model: 'ideogram', ask: 'a headline', r: 'A bold 70s-style poster with the headline "{input}", chunky type, two colours, halftone texture' },
    { n: '3D toy', model: 'krea', ask: 'a character', r: 'A glossy 3D vinyl toy of {input}, studio product photo, soft shadow, pastel background' },
    { n: 'Pixel art', model: 'ideogram', ask: 'a scene', r: 'Pixel art of {input}, 32-bit game style, crisp pixels, limited palette, dark outlines' },
  ];
  const S = { board: null, sort: 'hot', liked: C.store.get('cr-liked') || {}, model: 'ideogram', tests: [], cover: null, lt: 'trending', births: [], nb: 0, trend: null, trendAt: 0, open: { ideogram: false, krea: false } };
  const coins = () => (S.board && S.board.coins) || [];
  const coinOf = m => coins().find(k => k.mint === m);
  const fmt = n => (n == null ? '0' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
  const usdOf = (sol) => (sol != null && S.board && S.board.solUsd ? C.usd(sol * S.board.solUsd) : '—');
  const symOf = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const page = m => location.origin + '/c/' + m;
  const intent = t => 'https://x.com/intent/post?text=' + encodeURIComponent(t);
  const runImg = id => '/api/run?img=' + id;
  const img = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
  const proxied = url => '/api/logos?img=' + encodeURIComponent(url);
  // real pump.fun coins: their own picture (through our image proxy), or their first letter when it won't load
  window.__ph = el => { const s = document.createElement('span'); s.className = 'ph'; s.textContent = el.getAttribute('data-ch') || '?'; el.replaceWith(s); };
  const ini = sym => (symOf(sym) || '?').slice(0, 1);
  const pic = (url, alt, sym, lazy) => url ? `<img src="${esc(proxied(url))}" alt="${esc(alt || '')}" data-ch="${esc(ini(sym))}"${lazy ? ' loading="lazy"' : ''} decoding="async" onerror="__ph(this)">` : `<span class="ph">${esc(ini(sym))}</span>`;
  const httpsOf = u => (typeof u === 'string' && /^https:\/\//i.test(u.trim()) ? 'https://' + u.trim().slice(8, 408) : null);
  const pct = v => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
  const chg = c => (c.ch == null || !isFinite(c.ch) ? '' : `<i class="${c.ch >= 0 ? 'up' : 'dn'}">${c.ch >= 0 ? '+' : '−'}${pct(Math.abs(c.ch))}%</i>`);
  const BAD = /n[i1]gg|f[a@]gg?[o0]t|\brap(e|ed|ist)\b|p[o0]rn|\bnud(e|es|ity)\b|nsfw|hitler|nazi|\bkkk\b|loli|incest|retard|\bkys\b|pedo|\bcum\b|\bsex/i;
  const mcapOf = c => (c.mcap ? C.usd(c.mcap) : c.mcapSol && S.board && S.board.solUsd ? C.usd(c.mcapSol * S.board.solUsd) : c.mcapSol ? c.mcapSol.toFixed(0) + ' SOL' : '');

  // ---------- nav + reveal ----------
  if ('IntersectionObserver' in window) {
    const links = $$('.links a');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(s => io.observe(s));
  }
  $$('.sh, .form, .pv, .vgrid, .splitx, .faq, .steps3').forEach(e => e.classList.add('reveal'));
  C.reveal();

  // ---------- the hero: which models are on, the freshest runs ----------
  function models() {
    $('#models').innerHTML = Object.keys(MODELS).map(k => `<span class="mchip ${S.open[k] ? 'on' : ''}"><i></i>${MODELS[k].label} · ${S.open[k] ? 'online' : 'offline'}</span>`).join('');
  }
  const SPOTS = [[0, 6, -8], [70, 0, 7], [0, 60, 6], [72, 62, -6]];
  const heroCoin = (c, i, d) => `<div class="hc" data-m="${esc(c.mint)}" data-i="${i}" style="left:${SPOTS[i][0]}%;top:${SPOTS[i][1]}%;--r:${SPOTS[i][2]}deg;animation-delay:${d}s">${pic(c.icon, c.name, c.symbol)}<b>$${esc(symOf(c.symbol) || '?')}</b><small>${chg(c) || mcapOf(c)}</small></div>`;
  const shownCoins = () => (S.trend || []).filter(c => c.icon);
  function fresh() {
    const rs = (S.board && S.board.runs) || [], el = $('#fresh');
    const runs = rs.slice(0, 4).map((r, i) => `<img src="${runImg(r.id)}" alt="" style="left:${SPOTS[i][0]}%;top:${SPOTS[i][1]}%;--r:${SPOTS[i][2]}deg;animation-delay:${0.3 + i * 0.12}s">`);
    el.innerHTML = runs.join('') + shownCoins().slice(0, 4 - runs.length).map((c, k) => heroCoin(c, runs.length + k, 0.3 + (runs.length + k) * 0.12)).join('');
  }
  let hcNext = 0, hcSpot = -1;
  setInterval(() => {
    if (document.hidden || C.calm) return;
    const cards = $$('#fresh .hc'), tr = shownCoins();
    if (!cards.length || tr.length <= cards.length) return;
    hcSpot = (hcSpot + 1) % cards.length;
    const on = new Set(cards.map(x => x.dataset.m)); let c = null;
    for (let n = 0; n < tr.length; n++) { const k = tr[(cards.length + hcNext++) % tr.length]; if (!on.has(k.mint)) { c = k; break; } }
    if (c) cards[hcSpot].outerHTML = heroCoin(c, +cards[hcSpot].dataset.i, 0);
  }, 3800);

  // ---------- the strip: real coins, live on pump.fun ----------
  const tape = $('#tape'); let tx = 0, tlast = 0;
  const tapeItem = c => `<a href="https://pump.fun/coin/${encodeURIComponent(c.mint)}" target="_blank" rel="noopener" data-m="${esc(c.mint)}"${c.kind === 'new' ? ' class="nw"' : ''}>${pic(c.icon, c.name, c.symbol)}<span>${esc(c.name || c.symbol)}<small>$${esc(symOf(c.symbol) || '?')} · ${c.kind === 'new' ? '<i class="up">new</i>' : mcapOf(c) + ' ' + chg(c)}</small></span></a>`;
  function strip() {
    if (tape.dataset.on) return;
    if (!S.trend || !S.trend.length) { tape.innerHTML = `<span class="mut">${S.trend === false ? 'pump.fun’s trending list didn’t answer. New coins still stream in below.' : 'Reading pump.fun…'}</span>`; return; }
    tape.dataset.on = '1'; tx = 0; tape.style.transform = '';
    tape.innerHTML = S.trend.slice(0, 24).map(tapeItem).join('');
  }
  const tapeBirth = c => { if (tape.dataset.on) tape.insertAdjacentHTML('beforeend', tapeItem(c)); };
  let tHold = false; const tWrap = tape.parentNode;
  tWrap.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') tHold = true; }); tWrap.addEventListener('pointerleave', () => { tHold = false; });
  (function roll(now) {
    const dt = tlast ? Math.min(64, now - tlast) : 16; tlast = now;
    if (!document.hidden && !C.calm && !tHold && tape.children.length > 2 && tape.scrollWidth > tape.parentNode.clientWidth) {
      tx -= dt * 0.04; const f = tape.firstElementChild;
      if (f && tx + f.offsetWidth + 12 < 0) { tx += f.offsetWidth + 12; if (f.classList.contains('nw') && tape.querySelectorAll('a.nw').length > 10) f.remove(); else tape.appendChild(f); }
      tape.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
    }
    requestAnimationFrame(roll);
  })(0);

  // ---------- 01 the machines ----------
  function sorted(ks) {
    const a = ks.slice(), t = k => new Date(k.born_at || 0).getTime();
    if (S.sort === 'new') return a.sort((x, y) => t(y) - t(x));
    if (S.sort === 'runs') return a.sort((x, y) => (y.runs || 0) - (x.runs || 0) || t(y) - t(x));
    const s = k => (k.runs || 0) * 2 + (k.likes || 0) * 3 + (k.state === 'alive' || k.state === 'ascended' ? 20 : 0) + (k.last_run_at && Date.now() - new Date(k.last_run_at) < 36e5 ? 30 : 0);
    return a.sort((x, y) => s(y) - s(x) || t(y) - t(x));
  }
  function grid() {
    const ks = sorted(coins()), el = $('#grid');
    el.classList.toggle('bpm', !ks.length); $('#sorts').hidden = !ks.length;
    if (!ks.length) { el.innerHTML = blueprints(); bpWire(el); return; }
    el.innerHTML = ks.map((k, i) => `<article class="mc" data-m="${k.mint}" style="--i:${Math.min(i, 10)}"><div class="im">${img('/i/' + k.mint, k.name)}<span class="tag mint">${esc((MODELS[k.model] || {}).label || k.model)}</span></div>
      <div class="bd"><h3>${esc(k.name)}<span>$${esc(k.symbol)}</span></h3><p>${esc(k.line)}</p>
      <div class="ft"><span class="st ${k.state}"><i></i>${LABEL[k.state] || k.state}</span><span>${fmt(k.runs || 0)} runs</span></div></div></article>`).join('');
    $$('.mc', el).forEach(c => c.addEventListener('click', () => openCraft(c.dataset.m)));
    Live.watch(ks.filter(k => k.state !== 'ascended').map(k => k.mint));
  }
  const ICON = [
    '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="7" width="38" height="28" rx="6"/><path d="M14 35l-2 8 10-8"/><path class="l" d="M12 17h24M12 25h15"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19"/><circle class="w" cx="24" cy="19.5" r="6.5"/><path class="w" d="M12.5 37.5c2.4-6 6.6-9 11.5-9s9.1 3 11.5 9"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 6h28a4 4 0 0 1 4 4v18L28 42H10a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z"/><path class="w" d="M42 28H32a4 4 0 0 0-4 4v10z"/><circle class="w" cx="19" cy="19" r="5"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="4" width="28" height="40" rx="3"/><circle class="w" cx="24" cy="17" r="6.5"/><path class="l" d="M16 31h16M18.5 37h11"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l17 9v20l-17 9-17-9V14z"/><path class="t" d="M24 5l17 9-17 9-17-9z"/><path class="l" d="M24 23v20"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="w" x="5" y="5" width="38" height="38" rx="5"/><path d="M11 11h9v9h-9zM28 11h9v9h-9zM19.5 19.5h9v9h-9zM11 28h9v9h-9zM28 28h9v9h-9z"/></svg>',
  ];
  const recipeHtml = (r, v) => esc(r).replace('{input}', `<mark>${esc(v) || '{input}'}</mark>`);
  const blueprints = () => `<div class="bphead"><h3>No machines yet.</h3><p>Start from one of these, then make it yours.</p></div>` + PRESETS.map((p, i) => `<article class="bp" style="--i:${i}">
      <div class="bpt">${ICON[i]}<div><b>${esc(p.n)}</b><span class="tag${p.model === 'ideogram' ? ' mint' : ''}">${MODELS[p.model].label}</span></div></div>
      <p class="bpr">${recipeHtml(p.r, '')}</p>
      <input class="bpin" maxlength="40" placeholder="try it: ${esc(p.ask)}" aria-label="Try the ${esc(p.n)}: ${esc(p.ask)}" spellcheck="false">
      <button type="button" class="btn sm ink" data-bp="${i}">Build this machine</button></article>`).join('');
  function bpWire(el) {
    $$('.bp', el).forEach((card, i) => {
      const inp = $('.bpin', card), out = $('.bpr', card);
      inp.addEventListener('input', () => { out.innerHTML = recipeHtml(PRESETS[i].r, inp.value.trim()); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-bp]', card).click(); });
      $('[data-bp]', card).onclick = () => { applyPreset(i); const v = inp.value.trim(); if (v) $('#tin').value = v; go('#make'); const f = $('.form'); f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); setTimeout(() => $('#nm').focus({ preventScroll: true }), 700); };
    });
  }
  const go = sel => { const t = $(sel); if (t) t.scrollIntoView({ behavior: C.calm ? 'auto' : 'smooth', block: 'start' }); };
  $$('#sorts button').forEach(b => b.onclick = () => { S.sort = b.dataset.s; $$('#sorts button').forEach(x => x.classList.toggle('on', x === b)); grid(); });
  Live.on('trade', t => { const c = $(`#grid .mc[data-m="${t.mint}"] .st`); if (c && !c.classList.contains('ascended')) { c.className = 'st alive'; c.innerHTML = '<i></i>live'; } });

  // ---------- 02 make a craft ----------
  const tk = $('#tk');
  function mdl() {
    $('#mdl').innerHTML = Object.keys(MODELS).map(k => `<button type="button" class="mo ${S.model === k ? 'on' : ''}" data-k="${k}"><b>${MODELS[k].label}</b><span>${MODELS[k].good}</span><small><i class="${S.open[k] ? 'on' : ''}"></i>${S.open[k] ? 'online' : 'offline right now'}</small></button>`).join('');
    $$('#mdl .mo').forEach(b => b.onclick = () => { S.model = b.dataset.k; mdl(); });
  }
  $('#presets').innerHTML = PRESETS.map((p, i) => `<button type="button" data-i="${i}">${p.n}</button>`).join('');
  function applyPreset(i) {
    const p = PRESETS[i]; $('#recipe').value = p.r; $('#ask').value = p.ask; S.model = p.model; mdl();
    if (!$('#line').value.trim()) $('#line').value = p.n.toLowerCase() + ': ' + p.ask + ' in, a picture out';
    $$('#presets button').forEach(x => x.classList.toggle('on', +x.dataset.i === i));
    pv();
  }
  $$('#presets button').forEach(b => b.onclick = () => applyPreset(+b.dataset.i));
  function pv() {
    const nm = $('#nm').value.trim() || 'Meme Press', sy = symOf(tk.value) || 'PRESS', line = $('#line').value.trim() || 'memes with your words on them, in one style';
    $('#pvName').textContent = nm; $('#pvTk').textContent = '$' + sy; $('#pvLine').textContent = line;
    const cur = S.tests.find(t => t.id === S.cover);
    if (cur && !$('#pvImg > img[data-id="' + cur.id + '"]')) $('#pvImg').innerHTML = `<img src="${runImg(cur.id)}" alt="" data-id="${cur.id}">`;
    $('#thumbs').innerHTML = S.tests.map(t => `<button type="button" class="${t.id === S.cover ? 'on' : ''}" data-id="${t.id}" aria-label="Use this test as the token’s picture"><img src="${runImg(t.id)}" alt=""></button>`).join('');
    $$('#thumbs button').forEach(b => b.onclick = () => { S.cover = +b.dataset.id; pv(); });
    goLabel();
  }
  tk.addEventListener('input', () => { const v = symOf(tk.value); if (v !== tk.value) tk.value = v; pv(); });
  ['nm', 'line'].forEach(id => $('#' + id).addEventListener('input', pv));
  $('#testBtn').onclick = async () => {
    const b = $('#testBtn'), st = $('#tSt'), recipe = $('#recipe').value.trim(), input = $('#tin').value.trim() || $('#nm').value.trim();
    st.className = 'status';
    if (recipe.length < 12) { st.className = 'status err'; st.textContent = 'Write the recipe first, or tap a preset.'; return; }
    if (!input) { st.className = 'status err'; st.textContent = 'Type something to test it with.'; $('#tin').focus(); return; }
    if (!S.open[S.model]) { st.className = 'status err'; st.textContent = MODELS[S.model].label + ' is offline right now. Pick the other model.'; return; }
    b.disabled = true; st.textContent = `${MODELS[S.model].label} is making it…`;
    $('#pvImg').insertAdjacentHTML('beforeend', '<div class="spin">making it…</div>');
    const r = await C.post('/api/run', { test: { model: S.model, recipe, input } }).catch(() => null);
    b.disabled = false; const sp = $('#pvImg .spin'); if (sp) sp.remove();
    if (!r || !r.ok) { st.className = 'status err'; st.textContent = (r && r.error) || 'The machine didn’t answer. Try again.'; return; }
    S.tests.unshift({ id: r.id }); S.tests = S.tests.slice(0, 6); S.cover = r.id;
    st.className = 'status ok'; st.textContent = 'Made by ' + r.by + '. The ticked one becomes your token’s picture.';
    pv();
  };
  const buy = Cross.buyBox($('#buyBox'));
  function splitBox(gods) {
    const j = S.board || {}, pool = (j.lives && j.lives.alive) || 0, n = gods ? gods.length : Math.min(8, pool), has = n > 0, you = has ? 70 : 85;
    $('#split').innerHTML = `<div class="bars"><i style="width:${you}%"></i><i style="width:${has ? 15 : 0}%"></i><i style="width:15%"></i></div>
      <dl><div><dt>you</dt><dd>${you}%</dd></div><div><dt>its guild</dt><dd>${has ? 15 : 0}%</dd><div class="vw">${Array.from({ length: 8 }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</div></div><div><dt>house</dt><dd>15%</dd></div></dl>
      <p>${gods ? (gods.length ? 'Seated just now: ' + gods.map(g => `${C.short(g.wallet)} (${g.stage})`).join(', ') + '.' : 'Nobody to seat yet, so the guild’s 15% is yours.') : has ? `${pool} in the draw. 8 are seated the moment you launch.` : 'No guild members yet, so their 15% stays with you.'}</p>`;
  }
  function goLabel() { const b = $('#goBtn'), j = S.board; if (j && !j.open) { b.disabled = true; b.textContent = 'Launching opens soon'; return; } b.disabled = false; b.textContent = C.S.me ? `Launch $${symOf(tk.value) || 'it'} with this machine` : 'Connect wallet to launch'; }
  const status = (t, c) => { const s = $('#goStatus'); s.className = 'status' + (c ? ' ' + c : ''); s.innerHTML = t || ''; };
  $('#goBtn').onclick = async () => {
    if (!C.S.me) { await C.connect(); return; }
    const symbol = symOf(tk.value), name = $('#nm').value.trim(), line = $('#line').value.trim(), recipe = $('#recipe').value.trim(), ask = $('#ask').value.trim() || 'a word';
    if (!name) { $('#nm').focus(); return status('Give your machine a name.', 'err'); }
    if (!symbol) { tk.focus(); return status('Type its ticker.', 'err'); }
    if (line.length < 8) { $('#line').focus(); return status('Write what it makes: one line.', 'err'); }
    if (recipe.length < 12) { $('#recipe').focus(); return status('Write its recipe, or tap a preset.', 'err'); }
    if (!S.cover) return status('Do a test run first: its picture becomes the token’s picture.', 'err');
    if (buy.over()) return status('Up to 5 SOL in the first buy.', 'err');
    const btn = $('#goBtn'), prog = $('#goProg'); btn.disabled = true; status(''); $('#goRes').hidden = true;
    try {
      const r = await Cross.run({ name, symbol, line, model: S.model, recipe, ask, cover: S.cover, x: $('#xh').value.trim(), devBuy: buy.lamports(), onStep: i => Cross.steps(prog, i), onDraw: m => splitBox(m.gods) });
      Cross.steps(prog, Cross.STEPS.length, true);
      const res = $('#goRes'); res.hidden = false;
      res.innerHTML = `<div class="res"><b>$${esc(symbol)} is live and its machine is open.</b>${r.buyNote ? ' ' + esc(r.buyNote) : ''}<br><a href="/c/${r.mint}">Open its machine →</a> · <a href="https://pump.fun/coin/${r.mint}" target="_blank" rel="noopener">pump.fun ↗</a></div>`;
      status('Done.', 'ok'); S.tests = []; S.cover = null; pv(); load();
    } catch (e) { status(esc(C.human(e)) + (e.mint ? ` <a href="/c/${e.mint}">Open it</a>` : ''), 'err'); }
    finally { btn.disabled = false; goLabel(); }
  };

  // ---------- running a machine ----------
  async function run(m, input, onDone) {
    const r = await C.post('/api/run', { mint: m, input }).catch(() => null);
    if (!r || !r.ok) { C.toast((r && r.error) || 'The machine stalled. Try again.'); onDone && onDone(null); return null; }
    onDone && onDone(r); return r;
  }
  function shareRun(k, id) { C.store.set('cr-last', id); window.open(intent(`made with the $${k.symbol} machine on Craft\n\n${page(k.mint)}`), '_blank', 'noopener'); }
  function saveRun(k, id) { const a = document.createElement('a'); a.href = runImg(id); a.download = `${String(k.symbol).toLowerCase()}-${id}.webp`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1500); }

  // ---------- a craft, opened ----------
  let cur = null;
  async function openCraft(m) {
    const k0 = coinOf(m);
    C.sheet(k0 ? k0.name : 'machine', `<div class="cs"><div><div class="big" id="cBig">${k0 ? img('/i/' + m, k0.name) : ''}</div></div><div id="cSide"><p class="mut">Loading…</p></div><div class="gal" id="cGal"></div></div>`);
    if (location.pathname !== '/c/' + m) history.replaceState(null, '', '/c/' + m + location.hash);
    C.closeSheet.after = () => { cur = null; if (location.pathname.startsWith('/c/')) history.replaceState(null, '', '/' + location.hash); };
    const j = await C.get('/api/craft?mint=' + m).catch(() => null);
    const side = $('#cSide'); if (!side) return;
    if (!j || !j.ok) { side.innerHTML = `<p class="mut">${esc((j && j.error) || 'Didn’t load. Try again.')}</p>`; return; }
    const k = j.coin; cur = { k, j, shown: null };
    $('#sheetTitle').textContent = '$' + k.symbol;
    const live = k.status === 'live', on = j.models && j.models[k.model];
    side.innerHTML = `<h3>${esc(k.name)}</h3><div class="sub">$${esc(k.symbol)} · ${esc((MODELS[k.model] || {}).label || k.model)} · ${fmt(k.runs)} runs</div><p class="line">${esc(k.line)}</p>
      <div class="runbox"><input class="in" id="cIn" maxlength="120" placeholder="${esc(k.ask || 'a word')}" ${live ? '' : 'disabled'}><button class="btn ink" id="cRun" type="button" ${live && on ? '' : 'disabled'}>Run it</button></div>
      <p class="runmeta" id="cMeta">${!live ? 'It opens the moment its token is live.' : !on ? 'Its model is offline right now.' : `${j.today.left} of ${j.today.cap} runs left today.`}</p>
      <div class="rkit" id="cKit" hidden><button class="btn sm" id="cSave" type="button">⬇ save it</button><button class="btn sm mint" id="cShare" type="button">post it on X</button></div>
      <dl class="dstat"><div><dt>mcap</dt><dd>${usdOf(k.mcap_sol)}</dd></div><div><dt>approvals</dt><dd id="cLikes">${fmt(k.likes)}</dd></div><div><dt>to pay out</dt><dd>${C.sol(k.vault_lamports || 0)}</dd></div></dl>
      <div class="dbtn"><button class="ok2 ${S.liked[m] ? 'on' : ''}" type="button" id="cOk">✦ approve</button><a class="btn sm mint" href="https://pump.fun/coin/${k.mint}" target="_blank" rel="noopener">pump.fun ↗</a><a class="btn sm" href="https://dexscreener.com/solana/${k.mint}" target="_blank" rel="noopener">chart ↗</a><button class="btn sm" type="button" id="cCa">copy CA</button><button class="btn sm" type="button" id="cPay" ${live ? '' : 'disabled'}>pay out</button></div>
      <div class="recipe"><b>its recipe</b><br>${esc(k.recipe)}</div>
      <div class="mut" style="font:11.5px GM;margin-top:12px">its guild · ${(k.gods || []).length} seated</div><div class="vw">${Array.from({ length: 8 }, (_, i) => `<i class="${i < (k.gods || []).length ? 'on' : ''}" title="${k.gods && k.gods[i] ? C.short(k.gods[i].wallet) : ''}"></i>`).join('')}</div>`;
    gallery(j.runs);
    const inp = $('#cIn'), btn = $('#cRun');
    const go = async () => {
      const q = inp.value.trim(); if (!q) { inp.focus(); return; }
      btn.disabled = true; $('#cBig').insertAdjacentHTML('beforeend', '<div class="spin">making it…</div>');
      await run(m, q, r => {
        const sp = $('#cBig .spin'); if (sp) sp.remove(); btn.disabled = false;
        if (!r) return;
        show(r.id); $('#cMeta').textContent = r.left != null ? `${r.left} of ${j.today.cap} runs left today.` : 'Made.';
        cur.j.runs.unshift({ id: r.id, input: q, model: r.model, at: r.at }); gallery(cur.j.runs);
      });
    };
    if (btn) { btn.onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
    $('#cSave').onclick = () => cur.shown && saveRun(k, cur.shown);
    $('#cShare').onclick = () => cur.shown && shareRun(k, cur.shown);
    $('#cCa').onclick = () => C.copy(k.mint);
    $('#cOk').onclick = e => approve(m, e.currentTarget);
    $('#cPay').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { const r = await Cross.feed(m); if (r) C.toast('Paid out to everyone in its split.'); } catch (er) { C.toast(C.human(er)); } b.disabled = false; };
    if (S.prefill) { inp.value = S.prefill; S.prefill = null; if (!btn.disabled) go(); }
  }
  function show(id) { cur.shown = id; const big = $('#cBig'); if (big) big.innerHTML = `<img src="${runImg(id)}" alt="">`; const kit = $('#cKit'); if (kit) kit.hidden = false; }
  function gallery(runs) {
    const el = $('#cGal'); if (!el) return;
    el.innerHTML = runs && runs.length ? `<h4>its latest runs</h4><div class="g">${runs.map(r => `<button type="button" data-id="${r.id}" title="${esc(r.input)}"><img src="${runImg(r.id)}" alt="${esc(r.input)}" loading="lazy"></button>`).join('')}</div>` : '<h4>its latest runs</h4><p class="mut" style="margin:0">Nobody has run it yet. Be the first.</p>';
    $$('.g button', el).forEach(b => b.onclick = () => show(+b.dataset.id));
  }
  async function approve(m, btn) {
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    if (S.liked[m]) return;
    S.liked[m] = 1; C.store.set('cr-liked', S.liked); btn.classList.add('on');
    const r = await C.post('/api/like', { mint: m }).catch(() => null);
    if (r && r.ok) { const k = coinOf(m); if (k) k.likes = r.likes; const el = $('#cLikes'); if (el) el.textContent = fmt(r.likes); }
    else if (r && !r.ok) C.toast(r.error);
  }

  // ---------- 03 live on pump.fun ----------
  const LG = $('#lgrid');
  function liveCard(c) {
    const meta = c.kind === 'new' ? `<span class="age">new · ${C.ago(c.at)}</span><span>${mcapOf(c)}</span>`
      : `<span>${mcapOf(c) || '—'}</span><span>${c.ch == null ? '' : chg(c) + ' 1h'}</span>`;
    return `<div class="lc" data-m="${esc(c.mint)}"><div class="im">${pic(c.icon, c.name, c.symbol, true)}</div><div class="bd"><b>${esc(c.name || c.symbol)}</b><div class="meta"><span>$${esc(symOf(c.symbol) || '?')}</span></div><div class="meta">${meta}</div>
      <div class="act"><button type="button" data-run="${esc(c.mint)}">Run a machine</button><a href="https://pump.fun/coin/${encodeURIComponent(c.mint)}" target="_blank" rel="noopener" aria-label="Open on pump.fun">↗</a></div></div></div>`;
  }
  function liveGrid() {
    const list = S.lt === 'new' ? S.births : S.trend;
    const prev = LG.dataset.tab; LG.dataset.tab = '';
    if (S.q) {
      const f = S.found || [];
      LG.innerHTML = f.length ? f.slice(0, 18).map(liveCard).join('') : `<div class="lnote">${S.qDone ? 'No pump.fun coin matches that.' : 'Looking on pump.fun…'}</div>`;
      return;
    }
    if (S.lt === 'trending' && S.trend === null) { LG.innerHTML = '<div class="lnote">Reading what’s trending on pump.fun…</div>'; return; }
    if (S.lt === 'trending' && S.trend === false) { LG.innerHTML = '<div class="lnote">The trending list didn’t answer. <button class="btn sm" type="button" id="tRetry">Try again</button></div>'; $('#tRetry').onclick = () => { S.trendAt = 0; trending(); }; return; }
    if (!list.length) { LG.innerHTML = `<div class="lnote">${Live.S.up ? 'Waiting for the next coin to be born on pump.fun…' : 'Connecting to pump.fun’s live feed…'}</div>`; return; }
    const want = list.slice(0, 18), cards = $$('.lc', LG);
    LG.dataset.tab = S.lt;
    if (S.lt === 'new' && prev === 'new' && cards.length) {
      const have = new Set(cards.map(e => e.dataset.m)), keep = new Set(want.map(c => c.mint));
      want.filter(c => !have.has(c.mint)).reverse().forEach(c => LG.insertAdjacentHTML('afterbegin', liveCard(c)));
      $$('.lc', LG).forEach(e => { if (!keep.has(e.dataset.m)) e.remove(); else { const c = want.find(x => x.mint === e.dataset.m), a = e.querySelector('.age'); if (a) a.textContent = 'new · ' + C.ago(c.at); } });
      return;
    }
    LG.innerHTML = want.map(liveCard).join('');
  }
  LG.addEventListener('click', e => { const b = e.target.closest('[data-run]'); if (!b) return; const c = ((S.q ? S.found : S.lt === 'new' ? S.births : S.trend) || []).find(x => x.mint === b.dataset.run); if (c) pickFor(c); });
  const LQ = $('#lq'), LQX = $('#lqX'); let qT = 0, qSeq = 0;
  const jupCoin = t => ({ kind: 'trending', mint: t.id, name: String(t.name || '').slice(0, 40), symbol: String(t.symbol || '').slice(0, 14), icon: httpsOf(t.icon), mcap: Number(t.mcap) || Number(t.fdv) || null, ch: t.stats1h && isFinite(+t.stats1h.priceChange) ? +t.stats1h.priceChange : null });
  const isPump = t => t && t.id && (t.launchpad === 'pump.fun' || /pump$/.test(t.id)) && !BAD.test(String(t.name || '') + ' ' + String(t.symbol || ''));
  function findLocal(q) {
    const k = q.toLowerCase().replace(/^\$/, ''), seen = new Set();
    return [...(S.trend || []), ...S.births].filter(c => { if (seen.has(c.mint)) return false; seen.add(c.mint); return c.mint === q || String(c.name || '').toLowerCase().includes(k) || String(c.symbol || '').toLowerCase().includes(k); });
  }
  async function findRemote(q) {
    const my = ++qSeq;
    try {
      const r = await fetch('https://lite-api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(q.replace(/^\$/, ''))).then(x => x.json());
      if (my !== qSeq) return;
      const have = new Set((S.found || []).map(c => c.mint));
      S.found = [...(S.found || []), ...(Array.isArray(r) ? r : []).filter(isPump).map(jupCoin).filter(c => !have.has(c.mint))];
    } catch {}
    if (my === qSeq) { S.qDone = true; liveGrid(); }
  }
  LQ.addEventListener('input', () => {
    S.q = LQ.value.trim(); LQX.hidden = !S.q; clearTimeout(qT); qSeq++;
    S.found = S.q ? findLocal(S.q) : null; S.qDone = false;
    $$('#ltabs button').forEach(x => x.classList.toggle('on', !S.q && x.dataset.l === S.lt));
    liveGrid();
    if (S.q.length >= 2) qT = setTimeout(() => findRemote(S.q), 380); else if (S.q) { S.qDone = true; liveGrid(); }
  });
  LQX.onclick = () => { LQ.value = ''; LQ.dispatchEvent(new Event('input')); LQ.focus(); };
  $$('#ltabs button').forEach(b => b.onclick = () => { if (S.q) { LQ.value = ''; S.q = ''; S.found = null; LQX.hidden = true; } S.lt = b.dataset.l; $$('#ltabs button').forEach(x => x.classList.toggle('on', x === b)); if (S.lt === 'trending') trending(); liveGrid(); });
  Live.on('status', up => { $('#tDot').classList.toggle('on', up); if (S.lt === 'new' && !S.births.length) liveGrid(); });
  async function logo(c, uri, n) {
    await new Promise(z => setTimeout(z, n ? 6000 : 1500));
    const r = await C.get('/api/logos?uri=' + encodeURIComponent(uri)).catch(() => null);
    if (!(r && r.ok && r.image)) { if (!n) logo(c, uri, 1); return; }
    c.icon = r.image; const h = pic(c.icon, c.name, c.symbol);
    const card = LG.querySelector(`.lc[data-m="${CSS.escape(c.mint)}"] .im`); if (card) card.innerHTML = h;
    const t = tape.querySelector(`a[data-m="${CSS.escape(c.mint)}"]`); if (t && t.firstElementChild) t.firstElementChild.outerHTML = h;
  }
  Live.on('birth', b => {
    if (BAD.test((b.name || '') + ' ' + (b.symbol || ''))) return;
    S.nb++; const nl = $('#nLine'); if (nl) nl.textContent = `${S.nb.toLocaleString('en-US')} new coin${S.nb === 1 ? ' was' : 's were'} born on pump.fun since you opened this page.`;
    const c = { kind: 'new', mint: b.mint, name: b.name, symbol: b.symbol, at: b.at, mcapSol: b.mcap, icon: null };
    S.births.unshift(c); S.births = S.births.slice(0, 30);
    if (b.uri && /^https:\/\//i.test(b.uri)) logo(c, b.uri, 0);
    tapeBirth(c);
    if (S.lt === 'new' && !S.q) { if (!throttle) { throttle = setTimeout(() => { throttle = 0; if (!S.q) liveGrid(); }, 900); } }
  });
  let throttle = 0;
  async function trending() {
    if (S.trend && Date.now() - S.trendAt < 60000) return S.q ? null : liveGrid();
    try {
      const r = await fetch('https://lite-api.jup.ag/tokens/v2/toptrending/1h?limit=80').then(x => x.json());
      const arr = Array.isArray(r) ? r : (r && (r.tokens || r.data)) || [];
      S.trend = arr.filter(t => t && t.id && (t.launchpad === 'pump.fun' || /pump$/.test(t.id)) && !BAD.test(String(t.name || '') + ' ' + String(t.symbol || ''))).slice(0, 30).map(t => ({
        kind: 'trending', mint: t.id, name: String(t.name || '').slice(0, 40), symbol: String(t.symbol || '').slice(0, 14), icon: httpsOf(t.icon),
        mcap: Number(t.mcap) || Number(t.fdv) || null, ch: t.stats1h && isFinite(+t.stats1h.priceChange) ? +t.stats1h.priceChange : null }));
      S.trendAt = Date.now();
    } catch { if (!S.trend) S.trend = false; }
    if (S.lt === 'trending' && !S.q) liveGrid();
    strip(); if (!$('#fresh .hc') && !$('#fresh img')) fresh();
  }
  setInterval(() => { if (!document.hidden) trending(); }, 61000);
  // run one of our machines for a live pump.fun coin
  function pickFor(c) {
    const live = coins().filter(k => !k.status || k.status === 'live');
    const word = `${c.name || c.symbol} ($${symOf(c.symbol)})`;
    if (!live.length) { C.sheet('run a machine', `<p>No machines are live yet. The first craft you make can run for <b>${esc(word)}</b> and every other coin.</p><a class="btn ink wide" href="#make" id="pkMake">Make the first craft</a>`); $('#pkMake').onclick = () => C.closeSheet(); return; }
    C.sheet('pick a machine', `<p class="mut" style="margin:0 0 12px">It runs with “${esc(word)}” as its input.</p><div class="pick">${live.slice(0, 12).map(k => `<button type="button" data-m="${k.mint}"><img src="/i/${k.mint}" alt=""><span><b>${esc(k.name)}</b><small>$${esc(k.symbol)} · ${esc((MODELS[k.model] || {}).label || k.model)}</small></span></button>`).join('')}</div>`);
    $$('.pick button').forEach(b => b.onclick = () => { S.prefill = word; C.closeSheet(); openCraft(b.dataset.m); });
  }

  // ---------- 04 the guild ----------
  const RANKS = [['apprentice', 1, 0], ['journeyman', 1.5, 3], ['artisan', 2, 10], ['master', 3, 30]];
  function ladder() {
    const el = $('#ladder'); el.classList.add('stg');
    el.innerHTML = RANKS.map((r, i) => `<button type="button" class="rung" data-d="${r[2]}" style="--k:${i}"><b>${r[0]}</b><div class="x">${r[1]}x</div><small>from day ${r[2]}</small></button>`).join('');
    $$('.rung', el).forEach(b => b.onclick = () => { $('#dRange').value = b.dataset.d; days(); });
    days(); C.reveal($('#guild'));
  }
  function days() {
    const r = $('#dRange'), d = +r.value, k = RANKS.reduce((a, x, i) => (d >= x[2] ? i : a), 0), nx = RANKS[k + 1];
    r.style.setProperty('--p', (d / +r.max * 100).toFixed(1) + '%');
    $('#dOut').innerHTML = `<b>day ${d}</b> · ${RANKS[k][0]} · ${RANKS[k][1]}x tickets${nx ? ` <small>${nx[0]} in ${nx[2] - d} day${nx[2] - d === 1 ? '' : 's'}</small>` : ' <small>top rank</small>'}`;
    $$('#ladder .rung').forEach((e, i) => { e.classList.toggle('on', i === k); e.classList.toggle('past', i < k); });
  }
  $('#dRange').addEventListener('input', days);

  // ---------- 05 how it works: steps that take you there, a split you can open ----------
  $$('.steps3 li[data-go]').forEach(li => { li.tabIndex = 0; li.setAttribute('role', 'link'); li.onclick = () => go(li.dataset.go); li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(li.dataset.go); } }; });
  const NOTES = ['The wallet that launched the craft. pump.fun’s own fee sharing pays it on every trade, for as long as the token trades.',
    'Eight $CRAFT guild members, drawn the moment the craft is recorded. Until anyone has joined the guild, this share stays with the maker.',
    'The house. It pays Krea and Ideogram for every run anyone makes, on every machine.'];
  $$('#splitx button').forEach(b => { const pick = () => { $$('#splitx button').forEach(x => x.classList.toggle('on', x === b)); $('#splitN').textContent = NOTES[+b.dataset.k]; }; b.addEventListener('mouseenter', pick); b.addEventListener('focus', pick); b.addEventListener('click', pick); });
  if ('IntersectionObserver' in window && !C.calm) {
    const nums = $$('#splitx b[data-n]'); nums.forEach(b => { b.textContent = '0%'; });
    const io2 = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; io2.disconnect(); const t0 = performance.now();
      (function tick(t) { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); nums.forEach(b => { b.textContent = Math.round(+b.dataset.n * e) + '%'; }); if (k < 1) requestAnimationFrame(tick); })(t0);
      setTimeout(() => nums.forEach(b => { b.textContent = b.dataset.n + '%'; }), 1400);
    }, { threshold: .15 });
    io2.observe($('#splitx'));
  }

  // ---------- cards lean toward the pointer ----------
  if (!C.calm && matchMedia('(hover: hover)').matches) {
    let tl = null;
    document.addEventListener('pointermove', e => {
      const el = e.target.closest ? e.target.closest('.mc, .lc, .bp') : null;
      if (tl && tl !== el) { tl.style.removeProperty('--rx'); tl.style.removeProperty('--ry'); }
      tl = el; if (!el) return;
      const q = el.getBoundingClientRect(), x = (e.clientX - q.left) / q.width - 0.5, y = (e.clientY - q.top) / q.height - 0.5;
      el.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg'); el.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
    }, { passive: true });
  }
  const TOK = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'], CB = 'ComputeBudget111111111111111111111111111111';
  async function me() {
    const el = $('#me'), j = S.board || {};
    if (!C.S.me) { el.innerHTML = `<h3>Your seat</h3><div class="big">no seat</div><p class="mut">Connect the wallet that holds your $CRAFT.</p><button class="btn ink" id="meC" type="button">Connect wallet</button>`; $('#meC').onclick = () => C.connect(); return; }
    if (!j.life) { el.innerHTML = `<h3>Your seat</h3><div class="big">soon</div><p class="mut">Joining opens when $CRAFT launches.</p>`; return; }
    el.innerHTML = '<h3>Your seat</h3><p class="mut">Reading…</p>';
    const r = await C.get('/api/born?w=' + C.S.me).catch(() => null);
    if (!r || !r.ok) { el.innerHTML = `<h3>Your seat</h3><p class="mut">${esc((r && r.error) || 'Didn’t load. Try again.')}</p>`; return; }
    const l = r.life, min = r.minBurn || 10000, form = label => `<div class="burn"><input class="in" id="bAmt" inputmode="numeric" value="${min}"><button class="btn ink" id="bBtn" type="button">${label}</button></div><p class="mut" style="font-size:13px;margin:8px 0 0">You hold ${r.balance == null ? '—' : Number(r.balance).toLocaleString('en-US')} $CRAFT. Joining burns at least ${min.toLocaleString('en-US')}.</p><p class="status" id="bSt"></p>`;
    if (!l) el.innerHTML = `<h3>Your seat</h3><div class="big">no seat</div>${form('Burn and join the guild')}`;
    else if (l.state === 'dead') el.innerHTML = `<h3>Your seat</h3><div class="big">left</div><p class="mut">This wallet sold below what it held after joining. Guilds it already sits on still pay it.</p>${form('Join again')}`;
    else el.innerHTML = `<h3>Your seat</h3><div class="big">${esc(l.stage)}</div><dl><div><dt>in the guild</dt><dd>${Math.floor(l.days || 0)} days</dd></div><div><dt>tickets</dt><dd>${l.mult}x</dd></div><div><dt>next</dt><dd>${l.next ? l.next.stage + ' in ' + Math.ceil(l.next.in) + 'd' : 'top rank'}</dd></div><div><dt>machines</dt><dd>${(l.godchildren || []).length}</dd></div></dl>
      <div class="kids">${(l.godchildren || []).slice(0, 10).map(c => `<a href="/c/${c.mint}"><span>$${esc(c.symbol)}</span><span>${C.sol(c.vault_lamports || 0)} waiting</span></a>`).join('')}</div>${form('Burn more')}`;
    const b = $('#bBtn'); if (b) b.onclick = () => burn(r);
  }
  async function burn(info) {
    const st = (t, c) => { const s = $('#bSt'); if (s) { s.className = 'status' + (c ? ' ' + c : ''); s.textContent = t; } };
    const amt = Math.floor(Number(String($('#bAmt').value).replace(/[, _]/g, '')));
    if (!(amt >= (info.minBurn || 10000))) return st(`Joining burns at least ${(info.minBurn || 10000).toLocaleString('en-US')} $CRAFT.`, 'err');
    const btn = $('#bBtn'); btn.disabled = true;
    try {
      st('Building the burn…');
      const r = await C.post('/api/born', { wallet: C.S.me, amount: amt }); if (!r.ok) throw new Error(r.error);
      const w3 = await C.loadWeb3(), tx = w3.VersionedTransaction.deserialize(Uint8Array.from(atob(r.tx), c => c.charCodeAt(0)));
      const msg = tx.message, keys = msg.staticAccountKeys.map(k => k.toBase58()); let ok = false;
      for (const ix of msg.compiledInstructions) {
        const prog = keys[ix.programIdIndex], d = ix.data; if (prog === CB) continue;
        if (!TOK.includes(prog) || d[0] !== 15 || ok) throw new Error('The burn isn’t what was shown, so nothing was signed.');
        let v = 0n; for (let i = 8; i >= 1; i--) v = v * 256n + BigInt(d[i]);
        const ks = ix.accountKeyIndexes.map(i => keys[i]);
        if (v !== BigInt(r.amount) || ks[1] !== r.mint || ks[2] !== C.S.me) throw new Error('The burn isn’t what was shown, so nothing was signed.');
        ok = true;
      }
      if (!ok) throw new Error('The burn is missing, so nothing was signed.');
      st('Waiting for your wallet…'); const [signed] = await C.signAll([tx]); const sig = await C.send(signed); st('Burning…'); await C.confirm(sig);
      st('Reading it from Solana…'); let v = null;
      for (let i = 0; i < 6; i++) { v = await C.post('/api/born', { wallet: C.S.me, sig }).catch(() => null); if (v && v.ok) break; await new Promise(z => setTimeout(z, 2000)); }
      if (!v || !v.ok) throw new Error((v && v.error) || 'The burn landed; it shows after the next check.');
      C.toast('You’re in the guild.'); load();
    } catch (e) { st(C.human(e), 'err'); btn.disabled = false; }
  }
  function vtop() {
    const e = (S.board && S.board.elders) || [];
    $('#vtop').innerHTML = `<h3>Longest in the guild</h3>` + (e.length ? `<table class="tbl"><thead><tr><th>#</th><th>wallet</th><th>rank</th><th>machines</th></tr></thead><tbody>${e.map((x, i) => `<tr><td>${i + 1}</td><td>${C.short(x.wallet)}</td><td>${esc(x.stage)}</td><td>${x.kids}</td></tr>`).join('')}</tbody></table>` : `<p class="mut">${S.board && S.board.life ? 'Nobody has joined yet. The first one keeps the top spot for a while.' : 'Opens when $CRAFT launches.'}</p>`);
  }

  // ---------- load ----------
  function caBox() {
    const m = S.board && S.board.life, el = $('#caBox'); el.hidden = !m; if (!m) return;
    el.innerHTML = `<span>$CRAFT</span><code>${C.short(m, 6)}</code><button type="button" id="caC">copy</button><a href="https://pump.fun/coin/${m}" target="_blank" rel="noopener">buy</a><a href="https://dexscreener.com/solana/${m}" target="_blank" rel="noopener">chart</a>`;
    $('#caC').onclick = () => C.copy(m);
  }
  let first = true;
  async function load() {
    const j = await C.get('/api/board').catch(() => null);
    S.board = j && (j.ok || j.offline) ? j : { coins: [], runs: [], elders: [], lives: { alive: 0 }, open: false, models: {} };
    S.open = Object.assign({ ideogram: false, krea: false }, S.board.models || {});
    if (!S.open[S.model] && S.open.krea) S.model = 'krea';
    models(); fresh(); strip(); grid(); mdl(); splitBox(); pv(); caBox(); me(); vtop();
    if (first) {
      first = false; ladder(); liveGrid(); trending();
      const mm = location.pathname.match(/^\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
      if (mm) openCraft(mm[1]);
    }
  }
  C.onWallet(() => { goLabel(); me(); });
  Live.start();
  load();
  setInterval(() => {
    if (document.hidden) return;
    C.get('/api/board').then(j => {
      if (!j || !j.ok) return;
      const sig = b => JSON.stringify([((b && b.coins) || []).map(k => [k.mint, k.state, k.runs, k.likes]), ((b && b.runs) || []).map(r => r.id)]);
      const changed = sig(j) !== sig(S.board); S.board = j; S.open = Object.assign({ ideogram: false, krea: false }, j.models || {});
      if (changed) { fresh(); strip(); grid(); } vtop();
    }).catch(() => {});
  }, 45000);
})();
