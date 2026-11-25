// Taste Gate: background worker. Downloads each pin's image, reshapes it for Jev (JPEG, sides 280..1568 px),
// asks Jev only what your settings need, and saves Jev's answers so pins are never paid for twice.
importScripts('taste.js');
const TG = self.TasteGate;

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const JEV_MODEL = 'jev-latest';
const DEFAULT_PRICE = 0.042; // USD per 1 million input tokens (output is free)

const PIN_IMG_MAX = 640;   // longest side sent to Jev (keeps tokens and cost down)
const PIN_IMG_MIN = 280;   // Jev rejects images with a side under 280 px
const PIN_BATCH = 6;       // images per Jev call
const SHOOT_MATCH = 0.75;  // same person / outfit / set / branding at or above this = same shoot (green)
const SHOOT_UNSURE = 0.6;  // between this and SHOOT_MATCH = a genuine coin-flip (orange)

// One write at a time, so concurrent saves never overwrite each other.
let lock = Promise.resolve();
function withLock(fn) {
  const p = lock.then(fn);
  lock = p.catch(() => {});
  return p;
}

async function getSettings() {
  const { tasteSettings } = await chrome.storage.local.get('tasteSettings');
  return TG.normalizeSettings(tasteSettings);
}

function readAnswer(a) {
  if (!a) return null;
  const probs = a.probabilities || {};
  let value = a.choice;
  let conf = typeof a.confidence === 'number' ? a.confidence : null;
  if (!value && Object.keys(probs).length) value = Object.entries(probs).sort((x, y) => y[1] - x[1])[0][0];
  if (conf === null && value && typeof probs[value] === 'number') conf = probs[value];
  return value ? { value, confidence: conf, probabilities: a.probabilities || null } : null;
}

// ---------- spending ----------
let pendingSpend = null, spendTimer = null;
function recordSpend(cost, tokens, estimated) {
  pendingSpend = pendingSpend || { cost: 0, calls: 0, tokens: 0, estimated: false };
  pendingSpend.cost += cost; pendingSpend.calls += 1; pendingSpend.tokens += tokens;
  pendingSpend.estimated = pendingSpend.estimated || estimated;
  if (!spendTimer) spendTimer = setTimeout(flushSpend, 3000);
}
function flushSpend() {
  spendTimer = null;
  const p = pendingSpend;
  pendingSpend = null;
  if (!p) return;
  return withLock(async () => {
    const { spend = { total: 0, calls: 0, tokens: 0, estimated: false, since: Date.now() } } = await chrome.storage.local.get('spend');
    spend.total += p.cost; spend.calls += p.calls; spend.tokens += p.tokens;
    spend.estimated = spend.estimated || p.estimated;
    await chrome.storage.local.set({ spend });
  });
}

// One Jev request with images. Returns { json, cost, tokens } or { error, status, detail }.
async function callJev(state, questions, assets) {
  const stored = await chrome.storage.local.get(['apiKey', 'price']);
  if (!stored.apiKey) return { error: 'no-key' };
  const body = JSON.stringify({ model: JEV_MODEL, state, questions, assets });
  let res;
  try {
    res = await fetch(JEV_URL, {
      method: 'POST', body,
      headers: { authorization: 'Bearer ' + stored.apiKey, 'content-type': 'application/json', 'TypeSafe-Danger-Zone-Images': 'true' }
    });
  } catch (e) {
    return { error: 'Could not reach Jev: ' + e.message };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    return { error: res.status === 401 || res.status === 403 ? 'bad-key' : 'Jev error ' + res.status, status: res.status, detail };
  }
  const json = await res.json();
  const reported = json.usage?.input_tokens;
  const tokens = typeof reported === 'number' ? reported : Math.ceil(body.length / 4);
  const price = typeof stored.price === 'number' ? stored.price : DEFAULT_PRICE;
  const cost = (tokens * price) / 1e6;
  recordSpend(cost, tokens, typeof reported !== 'number');
  return { json, cost, tokens };
}

// ---------- image preparation ----------
async function prepPinImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('image ' + res.status);
  const bmp = await createImageBitmap(await res.blob());
  const w = bmp.width, h = bmp.height;
  let k = Math.min(1, PIN_IMG_MAX / Math.max(w, h));          // shrink big images
  k = Math.max(k, PIN_IMG_MIN / Math.min(w, h));               // but never below 280 on the short side
  k = Math.min(k, 1568 / Math.max(w, h));                      // and never above 1568 on the long side
  const dw = Math.round(w * k), dh = Math.round(h * k);
  // Very tall/wide pins can't satisfy both limits: pad the short side with white.
  const cw = Math.max(dw, PIN_IMG_MIN), ch = Math.max(dh, PIN_IMG_MIN);
  const canvas = new OffscreenCanvas(cw, ch);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cw, ch);
  g.drawImage(bmp, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  bmp.close?.();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: 'image', format: 'jpg', data_base64: btoa(bin) };
}
const refFor = (id) => 'img-' + String(id).replace(/[^\w-]/g, '').slice(0, 60) + '-' + Math.random().toString(36).slice(2, 8);

// ---------- judging pins ----------
// pins: [{ id, url, link }] -> { results: { id: { kind, reason, vote, cached } }, cost }
async function judgePins(pins) {
  const settings = await getSettings();
  const stored = await chrome.storage.local.get(pins.map((p) => 'pn:' + p.id));
  const results = {};
  const todo = []; // [{ pin, need: [question keys] }]
  for (const p of pins) {
    const rec = stored['pn:' + p.id];
    const need = TG.missingQuestions(rec?.answers, settings);
    if (!need.length) results[p.id] = { ...TG.pinVerdict(rec.answers, settings), vote: rec.vote || null, cached: true };
    else todo.push({ pin: p, need });
  }
  let cost = 0;
  for (let i = 0; i < todo.length; i += PIN_BATCH) {
    const batch = todo.slice(i, i + PIN_BATCH);
    const state = {}, questions = {}, assets = {}, ok = [];
    await Promise.all(batch.map(async (t) => {
      try {
        const ref = refFor(t.pin.id);
        assets[ref] = await prepPinImage(t.pin.url);
        t.ref = ref;
        ok.push(t);
      } catch {
        results[t.pin.id] = { kind: 'error', reason: 'Image unavailable' };
      }
    }));
    if (!ok.length) continue;
    ok.forEach((t, j) => {
      state['pin_' + j] = t.ref;
      for (const k of t.need) {
        if (TG.QUESTIONS[k]) questions[k + j] = TG.QUESTIONS[k](j);
        else {
          const rule = settings.rules.find((r) => TG.ruleKey(r) === k);
          if (rule) questions[k + '_' + j] = TG.ruleQuestion(j, rule);
        }
      }
    });
    const r = await callJev(state, questions, assets);
    if (r.error) return { error: r.error, detail: r.detail, results, cost };
    cost += r.cost;
    const ans = r.json.answers || {};
    await withLock(async () => {
      const fresh = await chrome.storage.local.get(ok.map((t) => 'pn:' + t.pin.id));
      const save = {}, now = Date.now();
      ok.forEach((t, j) => {
        const prev = fresh['pn:' + t.pin.id];
        const answers = { ...(prev?.answers || {}), r: { ...(prev?.answers?.r || {}) } };
        for (const k of t.need) {
          if (k === 's' || k === 'p') { const v = readAnswer(ans[k + j]); if (v) answers[k] = v; }
          else if (TG.QUESTIONS[k]) { if (typeof ans[k + j]?.noul === 'number') answers[k] = ans[k + j].noul; }
          else if (typeof ans[k + '_' + j]?.noul === 'number') answers.r[k] = ans[k + '_' + j].noul;
        }
        const rec = { id: t.pin.id, img: t.pin.url, link: t.pin.link || '', answers, vote: prev?.vote || null, firstSeen: prev?.firstSeen || now, lastSeen: now };
        save['pn:' + t.pin.id] = rec;
        results[t.pin.id] = TG.missingQuestions(answers, settings).length
          ? { kind: 'error', reason: 'Jev gave no answer' }
          : { ...TG.pinVerdict(answers, settings), vote: rec.vote };
      });
      await chrome.storage.local.set(save);
    });
  }
  return { results, cost };
}

// ---------- same photoshoot on a pin's page ----------
// main: { id, url }, cands: [{ id, url }] -> { results: { id: { kind: 'match'|'unsure'|'none', ... } }, cost }
async function matchShoot(main, cands) {
  const keys = cands.map((c) => 'ps:' + main.id + ':' + c.id);
  const stored = await chrome.storage.local.get(keys);
  const results = {}, todo = [];
  for (const c of cands) {
    const hit = stored['ps:' + main.id + ':' + c.id];
    if (hit) results[c.id] = { ...hit, cached: true };
    else todo.push(c);
  }
  if (!todo.length) return { results, cost: 0 };
  let mainImg;
  try { mainImg = await prepPinImage(main.url); } catch { return { error: 'Main image unavailable', results, cost: 0 }; }
  let cost = 0;
  for (let i = 0; i < todo.length; i += 5) {
    const batch = todo.slice(i, i + 5);
    const mainRef = refFor('main-' + main.id);
    const assets = { [mainRef]: mainImg };
    const state = { opened_pin: mainRef }, questions = {}, ok = [];
    await Promise.all(batch.map(async (c) => {
      try {
        const ref = refFor(c.id);
        assets[ref] = await prepPinImage(c.url);
        c._ref = ref;
        ok.push(c);
      } catch { results[c.id] = { kind: 'none' }; }
    }));
    if (!ok.length) continue;
    ok.forEach((c, j) => {
      state['other_' + j] = c._ref;
      questions['person' + j] = { type: 'noul', instructions: 'Is it the exact same individual (the same model, same face and hair) in both `opened_pin` and `other_' + j + '`? Two different people who merely look alike, or share a style, is NO.' };
      questions['outfit' + j] = { type: 'noul', instructions: 'Is the person in `other_' + j + '` wearing the exact same clothes as in `opened_pin` (same garments, colours and pattern)? A similar style is NO.' };
      questions['set' + j] = { type: 'noul', instructions: 'Were `opened_pin` and `other_' + j + '` shot in the exact same set or location (the same room, furniture, props or backdrop), as part of one photoshoot? A similar-looking sky or colour is NO.' };
      questions['campaign' + j] = { type: 'noul', instructions: 'Do `opened_pin` and `other_' + j + '` show the same brand name, logo or watermark (for example the same campaign title printed on both)? Only answer yes if the same branding is actually visible in both; a similar look or colour scheme is NO.' };
    });
    const r = await callJev(state, questions, assets);
    if (r.error) return { error: r.error, detail: r.detail, results, cost };
    cost += r.cost;
    const a = r.json.answers || {};
    const save = {};
    ok.forEach((c, j) => {
      const person = a['person' + j]?.noul ?? 0, outfit = a['outfit' + j]?.noul ?? 0, set = a['set' + j]?.noul ?? 0, campaign = a['campaign' + j]?.noul ?? 0;
      const top = Math.max(person, outfit, set, campaign); // any one is enough
      const kind = top >= SHOOT_MATCH ? 'match' : top >= SHOOT_UNSURE ? 'unsure' : 'none';
      const rec = { kind, person, outfit, set, campaign, img: c.url };
      results[c.id] = rec;
      save['ps:' + main.id + ':' + c.id] = rec;
    });
    await chrome.storage.local.set(save);
  }
  return { results, cost };
}

// ---------- votes ("Should keep" / "Should flag") ----------
async function votePin(id, vote) {
  const key = 'pn:' + id;
  return withLock(async () => {
    const rec = (await chrome.storage.local.get(key))[key];
    if (!rec) return { error: 'unknown pin' };
    rec.vote = rec.vote === vote ? null : vote; // clicking the same vote again clears it
    await chrome.storage.local.set({ [key]: rec });
    return { vote: rec.vote };
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    pins: () => judgePins(msg.pins),
    shoot: () => matchShoot(msg.main, msg.cands),
    pinVote: () => votePin(msg.id, msg.vote)
  };
  const h = handlers[msg?.type];
  if (!h) return;
  h().then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true; // keep the channel open for the async reply
});

// First install: save the default taste and open the setup page (it asks for a Jev key).
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const s = await chrome.storage.local.get(['tasteSettings', 'enabled']);
  if (!s.tasteSettings) await chrome.storage.local.set({ tasteSettings: TG.normalizeSettings(null) });
  if (s.enabled === undefined) await chrome.storage.local.set({ enabled: true });
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
