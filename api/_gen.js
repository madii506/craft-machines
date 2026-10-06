// CRAFT's machines: the two image models a craft can run on, called with the house's own keys.
//   Ideogram 3.0  POST api.ideogram.ai/v1/ideogram-v3/generate (multipart, Api-Key header), answers with a short-lived URL
//   Krea 2        POST api.krea.ai/generate/image/krea/krea-2/medium (Bearer), answers with a job; GET /jobs/<id> until done
// Every picture is downloaded right away and kept here as a small webp, since both providers' links expire.
const L = require('./_lib');
const IDEOGRAM = (process.env.IDEOGRAM_API_KEY || '').trim();
const KREA = (process.env.KREA_API_KEY || '').trim();
const MODELS = {
  ideogram: { id: 'ideogram', label: 'Ideogram 3.0', by: 'Ideogram', good: 'text, logos, memes, posters' },
  krea: { id: 'krea', label: 'Krea 2', by: 'Krea', good: 'photos, scenes, characters' },
};
const open = () => ({ ideogram: !!(IDEOGRAM || (L.MOCK && L.MOCK.gen)), krea: !!(KREA || (L.MOCK && L.MOCK.gen)) });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('The picture didn’t download.');
  return Buffer.from(await r.arrayBuffer());
}
async function ideogram(prompt) {
  const f = new FormData();
  f.append('prompt', prompt); f.append('rendering_speed', 'TURBO'); f.append('aspect_ratio', '1x1'); f.append('magic_prompt', 'AUTO'); f.append('num_images', '1');
  const r = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', { method: 'POST', headers: { 'Api-Key': IDEOGRAM }, body: f, signal: AbortSignal.timeout(50000) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(r.status === 402 || /credit|balance|billing/i.test(t) ? 'BROKE' : r.status === 422 || /safety|unsafe|moderat/i.test(t) ? 'UNSAFE' : 'Ideogram didn’t answer (' + r.status + ').');
  const d = j && j.data && j.data[0];
  if (!d || !d.url) throw new Error('Ideogram didn’t send a picture.');
  if (d.is_image_safe === false) throw new Error('UNSAFE');
  return download(d.url);
}
async function krea(prompt, deadline) {
  const h = { authorization: 'Bearer ' + KREA, 'content-type': 'application/json' };
  const r = await fetch('https://api.krea.ai/generate/image/krea/krea-2/medium', { method: 'POST', headers: h, body: JSON.stringify({ prompt, aspect_ratio: '1:1', resolution: '1K' }), signal: AbortSignal.timeout(20000) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok || !j || !j.job_id) throw new Error(r.status === 402 || /credit|balance|billing/i.test(t) ? 'BROKE' : 'Krea didn’t answer (' + r.status + ').');
  while (Date.now() < deadline) {
    await sleep(2000);
    const p = await fetch('https://api.krea.ai/jobs/' + encodeURIComponent(j.job_id), { headers: h, signal: AbortSignal.timeout(10000) }).then(x => x.json()).catch(() => null);
    if (!p) continue;
    if (p.status === 'completed') { const u = p.result && p.result.urls && p.result.urls[0]; if (!u) throw new Error('Krea didn’t send a picture.'); return download(u); }
    if (p.status === 'failed' || p.status === 'cancelled') throw new Error(/safety|nsfw|moderat/i.test(JSON.stringify(p)) ? 'UNSAFE' : 'Krea couldn’t make that one.');
  }
  throw new Error('Krea took too long this time. Try again.');
}
// run a prompt on a model: a 640px webp, or a plain-words error
async function make(model, prompt) {
  const deadline = Date.now() + 48000;
  let raw;
  if (L.MOCK && L.MOCK.gen) raw = await L.MOCK.gen(model, prompt);
  else if (model === 'ideogram') { if (!IDEOGRAM) throw new Error('CLOSED'); raw = await ideogram(prompt); }
  else if (model === 'krea') { if (!KREA) throw new Error('CLOSED'); raw = await krea(prompt, deadline); }
  else throw new Error('That machine type doesn’t exist.');
  return require('sharp')(raw, { limitInputPixels: 60e6 }).resize(640, 640, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
}
const words = e => {
  const m = String(e && e.message || e);
  return m === 'CLOSED' ? 'This machine’s model is switched off right now.' : m === 'BROKE' ? 'The machines are out of credits for a moment. Try again soon.'
    : m === 'UNSAFE' ? 'The model refused that one. Try other words.' : m.slice(0, 160);
};
// the prompt a craft really sends: its recipe with what someone typed in it
function promptOf(recipe, input) {
  const r = L.clean(recipe, 600), i = L.clean(input, 120);
  return /\{input\}/i.test(r) ? r.replace(/\{input\}/gi, i) : (r + (i ? '. Subject: ' + i : ''));
}
module.exports = { MODELS, open, make, words, promptOf };
