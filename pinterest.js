// Taste Gate: checks every pin against your taste and marks it: green = fits, orange = unsure, red = breaks a rule.
// Pin page: pins from the same photoshoot (same person OR outfit OR set OR branding) get a green edge, move first in
// the grid and show in a "From this shoot" row.
(() => {
  // After the extension is reloaded, scripts still running in open tabs lose their link to it. Instead of throwing
  // errors, stop quietly and ask for a page refresh.
  const TG_GONE = 'Extension updated: refresh this page';
  function tgSend(msg, cb) {
    try {
      if (!chrome.runtime?.id) throw new Error('gone');
      chrome.runtime.sendMessage(msg, cb);
    } catch {
      cb && cb({ error: TG_GONE });
    }
  }

  if (window.__tgPinterest) return;
  window.__tgPinterest = true;

  const BATCH = 6, MAX_PARALLEL = 2, LOOKAHEAD_PX = 1200;

  let enabled = false, stopped = false;
  const mode = 'flag'; // red edges are always on; the colour filter on the bar decides what's covered
  let view = new Set();         // bar filter: empty = All, otherwise the colours shown (green / orange / red), any 1 or 2
  const COLOURS = ['green', 'orange', 'red'];
  const parseView = (v) => new Set(String(v || '').split(',').filter((c) => COLOURS.includes(c)));
  let mo = null, io = null, scanTimer = null, urlTimer = null, pageUrl = '';
  const verdicts = new Map();   // pin id -> rules verdict { kind: keep|flag|unsure|error, reason }
  const shoot = new Map();      // pin id -> { kind: match|unsure|none } (pin page only)
  const revealed = new Set();   // pin ids you chose to Show in Hide mode
  const votes = new Map();      // pin id -> 'keep' | 'flag'
  const queued = new Set();
  let queue = [];
  let running = 0;
  const stats = { checked: 0, cost: 0, notice: '' };
  let mainPin = null;           // { id, url } on a pin page
  let shootQueue = [], shootRunning = false;
  const shootAsked = new Set();

  // ---------- reading pins ----------
  const pinIdOf = (a) => (a?.getAttribute('href') || '').match(/\/pin\/(\d+)/)?.[1] || null;
  const onPinPage = () => /^\/pin\/\d+/.test(location.pathname);
  const pagePinId = () => location.pathname.match(/^\/pin\/(\d+)/)?.[1] || null;

  function bestUrl(img) {
    const set = img.srcset || '';
    const m = set.match(/https:\/\/i\.pinimg\.com\/474x\/[^\s]+/) || set.match(/https:\/\/i\.pinimg\.com\/736x\/[^\s]+/);
    if (m) return m[0];
    return (img.currentSrc || img.src || '').replace(/\/(236x|170x|140x)\//, '/474x/');
  }

  // The rounded, clipped box around the pin image: our overlay goes inside it.
  function frameOf(item, img) {
    for (let e = img.parentElement; e && e !== item; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (parseFloat(cs.borderTopLeftRadius) > 0 && cs.overflow === 'hidden') return e;
    }
    return img.closest('[data-test-id="pinWrapper"]') || img.parentElement;
  }

  function readItem(item) {
    if (item.querySelector('[data-test-id="closeup-body-image-container"]')) return null; // the opened pin itself
    const a = item.querySelector('a[href*="/pin/"]');
    const img = item.querySelector('img[src*="pinimg.com"]');
    const id = pinIdOf(a);
    if (!id || !img) return null;
    return { id, item, img, url: bestUrl(img), link: 'https://www.pinterest.com/pin/' + id + '/' };
  }

  // ---------- scanning ----------
  function scan() {
    if (!enabled) return;
    if (!io) {
      io = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          io.unobserve(en.target);
          const p = readItem(en.target);
          if (p) want(p);
        }
        pump();
      }, { rootMargin: LOOKAHEAD_PX + 'px 0px' });
    }
    for (const item of document.querySelectorAll('[data-grid-item="true"]')) {
      const p = readItem(item);
      if (!p) continue;
      // Pinterest reuses cards: if this card now shows a different pin, start over for it.
      if (item.dataset.tgPin !== p.id) {
        item.dataset.tgPin = p.id;
        removeOverlay(item);
        io.observe(item);
      }
      decorate(p.item, p.id);
    }
    if (onPinPage()) { setupPinPage(); scheduleLayout(); }
  }

  function want(p) {
    if (verdicts.has(p.id) || queued.has(p.id)) { decorate(p.item, p.id); }
    else { queued.add(p.id); queue.push(p); }
    if (onPinPage() && mainPin && p.id !== mainPin.id && !shootAsked.has(p.id)) {
      shootAsked.add(p.id);
      shootQueue.push(p);
      pumpShoot();
    }
  }

  function onMutations(muts) {
    for (const m of muts) {
      const t = m.target;
      if (t.nodeType === 1 && t.closest?.('.tg-pn-ov, #tg-pn-host, #tg-pn-shoot, .tg-pn-clone')) continue;
      if ([...m.addedNodes].some((n) => n.nodeType === 1 && !n.closest?.('.tg-pn-ov, #tg-pn-host, #tg-pn-shoot, .tg-pn-clone'))) {
        if (!scanTimer) scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 250);
        return;
      }
    }
  }

  // ---------- asking Jev: rules ----------
  function pump() {
    while (enabled && !stopped && running < MAX_PARALLEL && queue.length) {
      const batch = queue.splice(0, BATCH).filter((p) => p.item.isConnected);
      if (!batch.length) continue;
      running++;
      updateBar();
      tgSend({ type: 'pins', pins: batch.map(({ id, url, link }) => ({ id, url, link })) }, (res) => {
        running--;
        if (chrome.runtime?.lastError) res = { error: chrome.runtime?.lastError.message };
        res = res || { error: 'No reply' };
        if (res.error === TG_GONE) { stopped = true; stats.notice = TG_GONE; }
        else if (res.error === 'no-key' || res.error === 'bad-key') { stopped = true; stats.notice = res.error === 'no-key' ? 'Add your Jev key in Taste Gate settings' : 'Jev key rejected: check it in settings'; }
        else if (res.error) stats.notice = 'Jev error: try again soon';
        stats.cost += res.cost || 0;
        for (const p of batch) {
          queued.delete(p.id);
          const v = res.results?.[p.id];
          if (!v) continue;
          if (!v.cached) stats.checked++;
          verdicts.set(p.id, v);
          if (v.vote) votes.set(p.id, v.vote); // your earlier vote shows again after a reload
          for (const item of document.querySelectorAll('[data-grid-item="true"][data-tg-pin="' + p.id + '"]')) decorate(item, p.id);
        }
        updateBar();
        pump();
      });
    }
  }

  // ---------- asking Jev: same photoshoot (pin page) ----------
  function pumpShoot() {
    if (shootRunning || !shootQueue.length || !mainPin || stopped) return;
    shootRunning = true;
    const forMain = mainPin.id;
    const batch = shootQueue.splice(0, 10);
    tgSend({ type: 'shoot', main: { id: mainPin.id, url: mainPin.url }, cands: batch.map(({ id, url }) => ({ id, url })) }, (res) => {
      shootRunning = false;
      if (chrome.runtime?.lastError) res = { error: chrome.runtime?.lastError.message };
      res = res || { error: 'No reply' };
      if (mainPin?.id !== forMain) return; // you moved to another pin meanwhile
      stats.cost += res.cost || 0;
      for (const p of batch) {
        const r = res.results?.[p.id];
        if (!r) continue;
        shoot.set(p.id, { ...r, img: r.img || p.url, w: parseFloat(p.item.style.width) || 0, h: parseFloat(p.item.style.height) || 0 });
        for (const item of document.querySelectorAll('[data-grid-item="true"][data-tg-pin="' + p.id + '"]')) decorate(item, p.id);
      }
      drawShootRow();
      scheduleLayout();
      updateBar();
      pumpShoot();
    });
  }

  // ---------- marking pins ----------
  function overlayFor(item, create) {
    let ov = item.querySelector(':scope .tg-pn-ov');
    if (!ov && create) {
      const img = item.querySelector('img[src*="pinimg.com"]');
      if (!img) return null;
      const frame = frameOf(item, img);
      if (getComputedStyle(frame).position === 'static') frame.style.position = 'relative';
      ov = document.createElement('div');
      ov.className = 'tg-pn-ov';
      ov.innerHTML = '<div class="tg-pn-card"><span class="tg-pn-why"></span><button type="button" class="tg-pn-btn" data-act="show">Show</button></div>' +
        '<div class="tg-pn-chip"><span class="tg-pn-why"></span>' +
        '<button type="button" class="tg-pn-vote" data-act="keep" title="Jev got it wrong: this should be kept">Should keep</button>' +
        '<button type="button" class="tg-pn-vote" data-act="flag" title="Jev got it wrong: this should be flagged">Should flag</button></div>';
      // Keep our clicks from opening the pin.
      for (const t of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
        ov.addEventListener(t, (e) => {
          const b = e.target.closest('button[data-act]');
          if (!b) return;
          e.preventDefault(); e.stopPropagation();
          if (t === 'click') onAct(item, b.dataset.act);
        }, true);
      }
      frame.appendChild(ov);
    }
    return ov;
  }
  function removeOverlay(item) { item.querySelector('.tg-pn-ov')?.remove(); }

  function onAct(item, act) {
    const id = item.dataset.tgPin;
    if (!id) return;
    if (act === 'show') { revealed.add(id); decorate(item, id); return; }
    tgSend({ type: 'pinVote', id, vote: act }, (res) => {
      if (chrome.runtime?.lastError || !res || res.error) return;
      res.vote ? votes.set(id, res.vote) : votes.delete(id);
      decorate(item, id);
    });
  }

  // What should this pin look like right now?
  function look(id) {
    const s = shoot.get(id);
    if (s?.kind === 'match') return { cls: 'shoot', why: 'Same photoshoot' };         // always shown, rules don't apply
    if (s?.kind === 'unsure') return { cls: mode === 'show' ? '' : 'unsure', why: 'Unsure: same shoot?' };
    const v = verdicts.get(id);
    if (!v || v.kind === 'error' || mode === 'show') return { cls: '', why: v?.reason || '' };
    if (v.kind === 'unsure') return { cls: 'unsure', why: v.reason };
    if (v.kind === 'flag') return { cls: mode === 'hide' && !revealed.has(id) ? 'hidden' : 'flag', why: v.reason };
    return { cls: 'keep', why: v.reason };
  }

  // Which colour group a pin is in, whatever the mode: green = kept or same shoot, orange = unsure, red = flagged.
  function groupOf(id) {
    const s = shoot.get(id);
    if (s?.kind === 'match') return 'green';
    if (s?.kind === 'unsure') return 'orange';
    const v = verdicts.get(id);
    if (!v || v.kind === 'error') return null; // not checked yet
    return v.kind === 'flag' ? 'red' : v.kind === 'unsure' ? 'orange' : 'green';
  }

  function decorate(item, id) {
    if (!enabled || !id) return;
    // View filter: pins outside the chosen colour are blurred out in place (nothing moves, no empty holes).
    const g = groupOf(id);
    const visible = !view.size || view.has(g) || revealed.has(id);
    let { cls, why } = look(id);
    let badge = 'Hidden';
    if (!visible) {
      // Same green glass cover as Hide mode, labelled with the pin's colour and reason.
      cls = 'hidden';
      badge = g ? g[0].toUpperCase() + g.slice(1) : 'Checking…';
      why = g ? why : 'Not checked yet';
    }
    // While filtering, always show the colour edge so you can review: green edge on kept pins, red instead of Hidden cards.
    if (view.size && visible && g) {
      if (g === 'green' && cls !== 'shoot') cls = 'keepg';
      if (g === 'red') cls = 'flag';
      if (g === 'orange') cls = 'unsure';
    }
    if (!cls) { const ov = overlayFor(item, false); if (ov) ov.className = 'tg-pn-ov'; return; }
    const ov = overlayFor(item, true);
    if (!ov) return;
    ov.className = 'tg-pn-ov tg-pn-' + cls + (votes.get(id) ? ' tg-pn-voted-' + votes.get(id) : '');
    ov.querySelectorAll('.tg-pn-why').forEach((w) => { w.textContent = why; });
    const card = ov.querySelector('.tg-pn-card');
    if (card) card.dataset.badge = badge;
    ov.dataset.group = visible ? '' : (g || 'none');
  }

  function redrawAll() {
    for (const item of document.querySelectorAll('[data-grid-item="true"][data-tg-pin]')) decorate(item, item.dataset.tgPin);
    updateBar();
  }

  // ---------- pin page: same-shoot cards first in the grid ----------
  // Pinterest places every card with translateX/translateY in fixed-width columns. We re-place the cards it has
  // loaded: green (same shoot) ones first, then the rest in Pinterest's own order, each into the shortest column,
  // exactly like Pinterest's own masonry. Each card's original spot is remembered so the order stays stable.
  const posOf = (el) => {
    const m = (el.style.transform || '').match(/translateX\(([\d.-]+)px\)\s*translateY\(([\d.-]+)px\)/);
    return m ? { x: +m[1], y: +m[2] } : null;
  };
  let layoutTimer = null;
  function scheduleLayout() {
    if (layoutTimer) return;
    layoutTimer = setTimeout(() => { layoutTimer = null; greenFirst(); }, 200);
  }
  // A simple copy of a matching card (image + green rim, opens the pin) for matches Pinterest has unloaded.
  function cloneFor(container, id, r, w) {
    let el = container.querySelector(':scope > .tg-pn-clone[data-tg-pin="' + id + '"]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tg-pn-clone';
      el.dataset.tgPin = id;
      el.innerHTML = '<a href="/pin/' + id + '/"><img src="' + String(r.img || '').replace(/"/g, '') + '" alt=""><span class="tg-pn-clone-rim"></span></a>';
      container.appendChild(el);
    }
    const h = r.w && r.h ? Math.round(w * (r.h / r.w)) : Math.round(w * 1.4);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    return { el, h };
  }

  // Stable layout: once a card has a spot it keeps it, so nothing shuffles while you scroll.
  // A full re-pack only happens when new same-shoot matches arrive AND you're near the top of the page.
  let lay = null; // { pin, cols, cw, bottoms, spots: Map(id -> {x, y, h}), order: [ids], greens: 'ids', pending }
  const NEAR_TOP = 700;

  function greenFirst() {
    if (!enabled || !onPinPage()) return;
    const items = [...document.querySelectorAll('[data-grid-item="true"]')];
    const close = items.find((el) => el.querySelector('[data-test-id="closeup-body-image-container"]'));
    if (!close) return; // the top of the grid isn't loaded: leave everything where it is
    const cp = posOf(close);
    if (!cp) return;
    const container = close.parentElement;
    const cards = new Map(); // id -> element (Pinterest's real cards currently loaded)
    for (const el of items) {
      if (el === close || el.parentElement !== container || !el.dataset.tgPin) continue;
      const now = posOf(el);
      if (!now) continue;
      // Pinterest's own spot for this card, remembered the first time we see it.
      if (el.dataset.tgSet !== el.style.transform) { el.dataset.tgOx = now.x; el.dataset.tgOy = now.y; }
      cards.set(el.dataset.tgPin, el);
    }
    const matchIds = [...shoot.entries()].filter(([, r]) => r.kind === 'match').map(([id]) => id);
    if (!matchIds.length || !cards.size) return;
    const pin = pagePinId();
    const widths = [...cards.values()].map((el) => parseFloat(el.style.width));
    const cw = Math.min(...widths);

    // New page, or new matches while you're near the top: plan the whole layout again.
    const greensKey = matchIds.slice().sort().join(',');
    const needRebuild = !lay || lay.pin !== pin || (lay.greens !== greensKey && scrollY < NEAR_TOP);
    if (needRebuild) {
      const known = lay && lay.pin === pin ? lay.known : new Map(); // id -> { ox, oy, h }
      for (const [id, el] of cards) known.set(id, { ox: +el.dataset.tgOx, oy: +el.dataset.tgOy, h: parseFloat(el.style.height) });
      const cols = [...new Set([...known.values()].map((k) => Math.round(k.ox * 10) / 10))].sort((x, y) => x - y);
      if (cols.length < 2) return;
      const cRight = cp.x + parseFloat(close.style.width), cBottom = cp.y + parseFloat(close.style.height);
      const gaps = [...known.values()].filter((k) => k.ox >= cp.x - 1 && k.ox + cw <= cRight + 1).map((k) => k.oy - cBottom).filter((g) => g >= 0);
      const underGap = gaps.length ? Math.min(...gaps) : 15.55;
      const bottoms = cols.map((x) => (x >= cp.x - 1 && x + cw <= cRight + 1 ? cBottom + underGap : 0));
      const byOriginal = (x, y) => known.get(x).oy - known.get(y).oy || known.get(x).ox - known.get(y).ox;
      // Matches never seen as real cards get a size from the saved match info.
      for (const id of matchIds) if (!known.has(id)) {
        const r = shoot.get(id);
        known.set(id, { ox: -1, oy: -1, h: r.w && r.h ? Math.round(cw * (r.h / r.w)) : Math.round(cw * 1.4) });
      }
      const greens = matchIds.filter((id) => known.has(id)).sort(byOriginal);
      const rest = [...known.keys()].filter((id) => !matchIds.includes(id)).sort(byOriginal);
      const spots = new Map();
      for (const id of [...greens, ...rest]) {
        let k = 0;
        for (let i = 1; i < cols.length; i++) if (bottoms[i] < bottoms[k] - 0.5) k = i;
        spots.set(id, { x: cols[k], y: bottoms[k], h: known.get(id).h });
        bottoms[k] += known.get(id).h + 16;
      }
      lay = { pin, cols, cw, bottoms, spots, known, greens: greensKey };
    }

    // Cards we haven't placed yet (just loaded by scrolling): add them at the bottom of the shortest column.
    const byOriginalNew = [...cards.entries()].filter(([id]) => !lay.spots.has(id))
      .sort((x, y) => +x[1].dataset.tgOy - +y[1].dataset.tgOy || +x[1].dataset.tgOx - +y[1].dataset.tgOx);
    for (const [id, el] of byOriginalNew) {
      const h = parseFloat(el.style.height);
      lay.known.set(id, { ox: +el.dataset.tgOx, oy: +el.dataset.tgOy, h });
      let k = 0;
      for (let i = 1; i < lay.cols.length; i++) if (lay.bottoms[i] < lay.bottoms[k] - 0.5) k = i;
      lay.spots.set(id, { x: lay.cols[k], y: lay.bottoms[k], h });
      lay.bottoms[k] += h + 16;
    }

    // Put every loaded card in its spot (cards keep their spot for the whole visit).
    for (const [id, el] of cards) {
      const sp = lay.spots.get(id);
      const t = 'translateX(' + sp.x + 'px) translateY(' + sp.y + 'px)';
      if (el.style.transform !== t) el.style.transform = t;
      el.dataset.tgSet = t;
    }
    // Copies for planned matches whose real card isn't loaded; remove copies whose real card is back.
    container.querySelectorAll(':scope > .tg-pn-clone').forEach((el) => {
      if (cards.has(el.dataset.tgPin) || !lay.spots.has(el.dataset.tgPin) || !matchIds.includes(el.dataset.tgPin)) el.remove();
    });
    for (const id of matchIds) {
      if (cards.has(id) || !lay.spots.has(id)) continue;
      const sp = lay.spots.get(id);
      const { el } = cloneFor(container, id, shoot.get(id), lay.cw);
      el.style.height = sp.h + 'px';
      el.style.transform = 'translateX(' + sp.x + 'px) translateY(' + sp.y + 'px)';
    }
    const need = Math.max(...lay.bottoms);
    if (parseFloat(container.style.height) < need) container.style.height = need + 'px';
  }

  // A re-pack waiting for you to scroll back near the top.
  window.addEventListener('scroll', () => { if (lay && onPinPage() && scrollY < NEAR_TOP) scheduleLayout(); }, { passive: true });

  // ---------- pin page: "From this shoot" row ----------
  function setupPinPage() {
    const id = pagePinId();
    const img = document.querySelector('[data-test-id="closeup-body-image-container"] img[src*="pinimg.com"]');
    if (!id || !img) return;
    if (mainPin?.id === id) return;
    mainPin = { id, url: (img.currentSrc || img.src).replace(/\/(236x|474x|originals)\//, '/736x/') };
    shoot.clear(); shootQueue = []; shootAsked.clear();
    drawShootRow();
    // Suggestions already on screen: queue them for the same-shoot check.
    for (const item of document.querySelectorAll('[data-grid-item="true"]')) {
      const p = readItem(item);
      if (p && p.id !== id && !shootAsked.has(p.id)) { shootAsked.add(p.id); shootQueue.push(p); }
    }
    pumpShoot();
  }

  // Where the row goes. Pinterest's side column has a "Visit site" block that stretches to fill the column, so we
  // go right under the button itself. Pins with no title or button: right under the main image.
  function stackedLevel(start) {
    for (let e = start; e && e.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e.parentElement);
      const stacked = cs.display === 'block' || ((cs.display === 'flex' || cs.display === 'inline-flex') && cs.flexDirection.startsWith('column'));
      if (stacked && e.parentElement.getBoundingClientRect().width >= 240) return e;
      if (e.parentElement.matches('[data-test-id="closeup-body"], [data-test-id="closeup-container"]')) break;
    }
    return null;
  }
  function shootAnchor() {
    const visit = document.querySelector('[data-test-id="visit-site-button"]');
    if (visit && visit.getBoundingClientRect().width > 0) { const e = stackedLevel(visit); if (e) return e; }
    const title = document.querySelector('[data-test-id="closeup-title"]');
    if (title) { const e = stackedLevel(title); if (e) return e; }
    const image = document.querySelector('[data-test-id="closeup-body-image-container"]');
    if (image) { const e = stackedLevel(image); if (e) return e; }
    return document.querySelector('[data-test-id="metadataless-closeup-action-bar"]') ||
      document.querySelector('[data-test-id="closeup-body-sticky-content"]');
  }

  function drawShootRow() {
    let row = document.getElementById('tg-pn-shoot');
    if (!onPinPage() || !mainPin || !enabled) { row?.remove(); return; }
    const anchor = shootAnchor();
    if (!anchor) return;
    if (!row) {
      row = document.createElement('div');
      row.id = 'tg-pn-shoot';
      row.addEventListener('click', (e) => e.stopPropagation(), true);
    }
    if (row.previousElementSibling !== anchor) anchor.after(row);
    const matches = [...shoot.entries()].filter(([, r]) => r.kind === 'match');
    const checking = shootRunning || shootQueue.length > 0;
    // Thumbnails come from the image saved when the match was found, so pins Pinterest has unloaded still show.
    const thumbs = matches.map(([pid, r]) => {
      const src = r.img || '';
      return src ? '<a class="tg-pn-thumb" href="/pin/' + pid + '/"><img src="' + src.replace(/"/g, '') + '" alt=""></a>' : '';
    }).join('');
    row.innerHTML = '<div class="tg-pn-shoot-head"><b>From this shoot</b><span>' +
      (matches.length ? matches.length + ' found' + (checking ? ' · checking more…' : '') : checking ? 'checking…' : 'none found yet') + '</span></div>' +
      (thumbs ? '<div class="tg-pn-thumbs">' + thumbs + '</div>' : '');
  }

  // ---------- the bottom-centre mode bar ----------
  let host = null, barRoot = null;
  function buildBar() {
    host = document.createElement('div');
    host.id = 'tg-pn-host';
    host.style.cssText = 'all: initial; position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483000;';
    barRoot = host.attachShadow({ mode: 'open' });
    barRoot.innerHTML = `
<style>
  .bar { display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-radius: 999px; position: relative; isolation: isolate;
    font: 600 12.5px 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif; color: #0f3b1f; white-space: nowrap;
    background: linear-gradient(160deg, rgba(240,255,228,.90) 0%, rgba(205,240,180,.84) 50%, rgba(170,225,135,.86) 100%);
    backdrop-filter: blur(18px) saturate(185%) brightness(1.06);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(255,255,255,.35), inset 0 0 0 1px rgba(255,255,255,.4),
      inset 0 -12px 24px rgba(120,210,70,.22), 0 10px 30px rgba(10,60,20,.22), 0 2px 6px rgba(10,60,20,.12); }
  .bar::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; padding: 1.3px;
    background: linear-gradient(135deg, #fff, rgba(255,255,255,.15) 30%, rgba(255,255,255,.05) 65%, rgba(200,245,90,.95));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
  .title { font-weight: 700; }
  .stats { font-weight: 500; opacity: .8; }
  .stats .r { color: #c0261b; font-weight: 700; } .stats .o { color: #b45309; font-weight: 700; } .stats .g { color: #15803d; font-weight: 700; }
  .warn { color: #b42318; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: 0; }
  .dot.g { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,.8); }
  .dot.o { background: #f59e0b; box-shadow: 0 0 5px rgba(245,158,11,.8); }
  .dot.r { background: #ef4444; box-shadow: 0 0 5px rgba(239,68,68,.8); }
  .seg { display: inline-flex; gap: 4px; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.35); box-shadow: inset 0 1px 2px rgba(10,50,20,.15); }
  button { border: 0; cursor: pointer; font: inherit; padding: 5px 13px; border-radius: 999px; color: #0f3b1f; background: transparent;
    transition: transform .15s cubic-bezier(.2,.9,.3,1.4), filter .15s; }
  button:hover { background: rgba(255,255,255,.45); }
  button:active { transform: scale(.94); }
  button.on { color: #10351a; background: radial-gradient(120% 90% at 30% 10%, rgba(250,255,215,.98), rgba(215,245,100,.85) 45%, rgba(160,215,45,.9));
    box-shadow: inset 0 1px 0 #fff, inset 0 -3px 6px rgba(90,150,20,.35), 0 3px 10px rgba(150,210,40,.45); }
</style>
<div class="bar">
  <span class="title">Taste Gate</span>
  <span class="stats"></span>
  <span class="seg view"><button data-view="all" title="Show every pin">All</button><button data-view="green" title="Only kept / same-shoot pins"><i class="dot g"></i>Green</button><button data-view="orange" title="Only unsure pins"><i class="dot o"></i>Orange</button><button data-view="red" title="Only flagged pins"><i class="dot r"></i>Red</button></span>
</div>`;
    barRoot.addEventListener('click', (e) => {
      const v = e.target.closest('button[data-view]');
      if (v) {
        // All clears the colours; a colour toggles on/off; picking all three (or none) means All again.
        const next = v.dataset.view === 'all' ? new Set() : new Set(view);
        if (v.dataset.view !== 'all') next.has(v.dataset.view) ? next.delete(v.dataset.view) : next.add(v.dataset.view);
        chrome.storage.local.set({ pinView: next.size === COLOURS.length ? '' : [...next].join(',') });
      }
    });
    document.documentElement.appendChild(host);
    self.TGLens?.apply(barRoot.querySelector('.bar'), { root: barRoot, bezel: 14, blur: 18 });
  }

  let barTimer = null;
  function updateBar() {
    if (barTimer) return;
    barTimer = setTimeout(() => { barTimer = null; drawBar(); }, 200);
  }
  function drawBar() {
    if (!enabled) return;
    if (!host) buildBar();
    let flagged = 0, unsure = 0, same = 0;
    for (const [id, v] of verdicts) { if (shoot.get(id)?.kind === 'match') continue; if (v.kind === 'flag') flagged++; if (v.kind === 'unsure') unsure++; }
    for (const r of shoot.values()) { if (r.kind === 'match') same++; if (r.kind === 'unsure') unsure++; }
    const busy = running > 0 || queue.length > 0 || shootRunning;
    barRoot.querySelector('.stats').innerHTML = stats.notice ? '<span class="warn">' + stats.notice + '</span>' :
      (busy ? 'checking… · ' : '') + verdicts.size + ' checked · <span class="r">' + flagged + ' flagged</span> · <span class="o">' + unsure + ' unsure</span>' +
      (onPinPage() ? ' · <span class="g">' + same + ' same shoot</span>' : '') + ' · $' + stats.cost.toFixed(4);
    barRoot.querySelectorAll('button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === 'all' ? !view.size : view.has(b.dataset.view)));
  }

  // ---------- page changes (Pinterest is a single-page app) ----------
  let watchedBody = null;
  function watchUrl() {
    // Watchdog: if Pinterest rebuilt the page (it does this right after loading), reconnect to the new page.
    if (enabled) {
      if (watchedBody !== document.body) {
        watchedBody = document.body;
        mo?.disconnect(); mo?.observe(document.body, { childList: true, subtree: true });
        io?.disconnect(); io = null;
        scan();
      }
      if (host && !host.isConnected) { host = null; barRoot = null; drawBar(); }
    }
    if (location.href === pageUrl) return;
    pageUrl = location.href;
    mainPin = null;
    shoot.clear(); shootQueue = []; shootAsked.clear();
    document.getElementById('tg-pn-shoot')?.remove();
    document.querySelectorAll('.tg-pn-clone').forEach((e) => e.remove());
    lay = null;
    scan();
    updateBar();
  }

  // ---------- on / off ----------
  function start() {
    if (enabled) return;
    enabled = true; stopped = false; stats.notice = '';
    pageUrl = location.href;
    mo = new MutationObserver(onMutations);
    mo.observe(document.body, { childList: true, subtree: true });
    watchedBody = document.body;
    urlTimer = setInterval(watchUrl, 700);
    scan();
    drawBar();
  }

  // Pinterest's app takes over the page right after it loads; changing the page before that makes it throw away
  // and rebuild everything. So wait until the page has fully loaded, plus a moment, before starting.
  function whenReady(fn) {
    const go = () => setTimeout(fn, 1200);
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  }

  function stop() {
    enabled = false;
    mo?.disconnect(); io?.disconnect(); io = null;
    clearInterval(urlTimer); clearTimeout(scanTimer); scanTimer = null;
    queue = []; queued.clear(); shootQueue = [];
    document.querySelectorAll('.tg-pn-ov, #tg-pn-shoot, .tg-pn-clone').forEach((e) => e.remove());
    document.querySelectorAll('[data-tg-pin]').forEach((e) => { delete e.dataset.tgPin; });
    host?.remove(); host = null; barRoot = null;
  }

  // Your taste changed: judge every pin again. Saved answers are re-scored for free; only new questions cost anything.
  function rejudge() {
    if (!enabled) return;
    verdicts.clear(); queued.clear(); queue = [];
    for (const item of document.querySelectorAll('[data-grid-item="true"]')) {
      const p = readItem(item);
      if (p) { item.dataset.tgPin = p.id; queued.add(p.id); queue.push(p); }
    }
    redrawAll();
    pump();
  }

  chrome.storage.local.get(['enabled', 'pinView'], (s) => {
    view = parseView(s.pinView);
    if (s.enabled !== false) whenReady(start);
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.enabled) ch.enabled.newValue === false ? stop() : start();
    if (ch.pinView) { view = parseView(ch.pinView.newValue); redrawAll(); }
    if (ch.tasteSettings) rejudge();
    if (ch.apiKey && ch.apiKey.newValue && stopped) { stopped = false; stats.notice = ''; rejudge(); }
  });
})();
