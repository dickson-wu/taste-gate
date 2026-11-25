// Taste Gate: your taste as settings, and how a pin is judged against them.
// Shared by the background worker (importScripts), the settings page and the Checked pins page.
(() => {
  // What Jev is asked about each image. The wording matters: it was tuned on real keep/flag votes.
  const SETTING = {
    'Real place': 'A real or staged scene with things in it: outdoors (sky, clouds, water, beach, fields, streets, courts, rooftops), a room, a car, a cafe, a table or floor with food, plates, bags or props, even if it is a styled set or shot from above. Sky, clouds, sea or water behind a person ALWAYS count as a real place, even when the sky looks clean like a backdrop.',
    'Plain backdrop, candid': 'A plain or single-colour wall or backdrop, BUT the moment feels natural and lived-in: relaxing, sitting on furniture, playing with a pet, laughing, eating, drinking or using the product. Not a stiff posed catalogue shot.',
    'Studio set': 'A studio shot: a person posing against a plain or seamless solid/gradient colour backdrop, OR a built studio set (a plain backdrop and floor with only a few props such as stands, posts, boxes or a chair). There is no real scenery: no sky, outdoors, real room or street. A blue sky or sky-like gradient with clouds, splashes, water drops or sea is NEVER a studio backdrop.',
    'Design layout': 'Only a web or document layout: a website or landing page, an online shop page, a newsletter or email, an app or UI screen, presentation slides, or a colour palette / swatch card, usually with navigation, buttons, sections or paragraphs of body text. Ad posters, magazine-style covers, photo collages or grids, and social media post designs are NOT this, even with big headlines.',
    'Not a photo': 'Not a real photo scene: a flat drawing, illustration, cartoon or pixel/voxel art, a 3D or isometric render of a building, shop, booth, room or machine (renders of products themselves are fine), OR a graphic made of many small cut-out items arranged as a pattern around illustrations or shapes, with no real scene (for example a busy sale banner). Ad posters and campaign visuals built on a real photo of a person or product ARE photos, however much text, graphics or effects are added.'
  };
  const PRODUCT = {
    'Held or used': 'A person (their face or body is a main part of the picture) is clearly holding, using, drinking, applying or wearing a branded product (a bottle, can, cup, tube, device, package).',
    'In frame': 'A person is the main subject and a product is visible somewhere in the image (even small), but they are not holding it.',
    'Product shot': 'The product is the main subject: product photography of any kind, including hands or arms holding or touching it close-up, products in a styled scene or still life (picnic, ice bucket, table), floating, splash or rendered product scenes, and collages or grids of product photos.',
    'No product': 'No product is visible; the image is only about a person (a portrait or selfie), an outfit, a pose or a scene. Clothes, bags, shoes, jewellery, accessories, books and everyday objects do not count as a product.'
  };

  const QUESTIONS = {
    s: (j) => ({ type: 'choice', instructions: 'What kind of setting or image is `pin_' + j + '`? First: is it a designed layout (website, newsletter, app screen, slides, colour palette, mood board, infographic)? If not, ignore any text, headlines or logos on top and judge only the scene in the photo.', criteria: SETTING }),
    p: (j) => ({ type: 'choice', instructions: 'How does a product appear in `pin_' + j + '`?', criteria: PRODUCT }),
    d: (j) => ({ type: 'noul', instructions: 'Is there a drink or drink container visible in `pin_' + j + '`: a cup, glass, mug, bottle, can, carton or a drink being poured? Food on its own does not count, and a cup, bowl or tub of FOOD (noodles, ice cream, soup, yoghurt) is not a drink.' }),
    e: (j) => ({ type: 'noul', instructions: 'Is food (a meal, snack, dessert, bread, fruit) shown as a main part of `pin_' + j + '`? A tiny garnish or a drink on its own is NO.' }),
    f: (j) => ({ type: 'noul', instructions: 'Is food the main, in-your-face subject of `pin_' + j + '` (a plate or dish of food pushed toward the camera or filling most of the picture)? Someone eating or food on the side of a scene is NO.' })
  };
  const ruleQuestion = (j, rule) => ({
    type: 'noul',
    instructions: rule.kind === 'need'
      ? 'Does `pin_' + j + '` match this description: "' + rule.text + '"? Answer YES only if it clearly does.'
      : 'Does `pin_' + j + '` show or contain this: "' + rule.text + '"? Answer YES only if it is clearly true of this image.'
  });

  // The ready-made checks people can switch on and off.
  const CHECKS = {
    studio: { label: 'No studio shots', help: 'Flags people posing on a plain studio backdrop or a built studio set. Sky, outdoors and real rooms never count as studio. Product photography is always allowed.' },
    product: { label: 'A product must be in the shot', help: 'Flags images with no product in them (only a portrait, outfit or scene). Clothes, bags, shoes and accessories don\'t count as products.' },
    photo: { label: 'Real photos only', help: 'Flags illustrations, cartoons and 3D renders of shops or rooms. Ad posters built on a real photo still count as photos.' },
    design: { label: 'No website or design layouts', help: 'Flags websites, shop pages, newsletters, app screens, slides and colour palettes.' },
    foodDrink: { label: 'Food needs a drink, and can\'t be the main focus', help: 'Flags in-your-face food shots, and food shown without a drink. Pins with no food are not affected.' }
  };

  const STRICTNESS = {
    relaxed: { flagAt: 0.7, unsureAt: 0.45 },
    balanced: { flagAt: 0.6, unsureAt: 0.35 },
    strict: { flagAt: 0.5, unsureAt: 0.25 }
  };

  const DEFAULT_SETTINGS = {
    taste_gate_settings: 1,
    checks: { studio: true, product: true, photo: true, design: true, foodDrink: false },
    rules: [],                                  // [{ kind: 'avoid' | 'need', text }]
    flagAt: 0.6,                                // a rule break this likely = red
    unsureAt: 0.35,                             // a real chance of one, but not sure = orange; less = green
    productShotMin: 0.45,                       // how sure Jev must be that an image is product photography
    designSure: 0.7,                            // a product shot only counts as a design layout when Jev is this sure
    notPhotoSure: 0.95                          // ...or as 'not a photo' when Jev is this sure
  };
  const MAX_RULES = 8;

  const num = (v, d, lo = 0, hi = 1) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

  // Turns anything (saved settings, a pasted block) into valid settings. Unknown fields are dropped.
  function normalizeSettings(raw) {
    const d = DEFAULT_SETTINGS, r = raw && typeof raw === 'object' ? raw : {};
    const checks = {};
    for (const k of Object.keys(CHECKS)) checks[k] = typeof r.checks?.[k] === 'boolean' ? r.checks[k] : d.checks[k];
    const rules = (Array.isArray(r.rules) ? r.rules : [])
      .map((x) => ({ kind: x?.kind === 'need' ? 'need' : 'avoid', text: String(x?.text || '').replace(/["`]/g, "'").replace(/\s+/g, ' ').trim().slice(0, 200) }))
      .filter((x) => x.text).slice(0, MAX_RULES);
    const out = {
      taste_gate_settings: 1, checks, rules,
      flagAt: num(r.flagAt, d.flagAt, 0.05, 0.99),
      unsureAt: num(r.unsureAt, d.unsureAt, 0.01, 0.98),
      productShotMin: num(r.productShotMin, d.productShotMin),
      designSure: num(r.designSure, d.designSure),
      notPhotoSure: num(r.notPhotoSure, d.notPhotoSure)
    };
    if (out.unsureAt >= out.flagAt) out.unsureAt = Math.max(0.01, out.flagAt - 0.1);
    return out;
  }

  // Reads a pasted settings block (JSON, possibly wrapped in ``` fences or surrounded by text).
  function parseSettingsText(text) {
    const s = String(text || '');
    const start = s.indexOf('{'), end = s.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('No settings block found. Paste the whole block, including the { and }.');
    let obj;
    const body = s.slice(start, end + 1);
    try { obj = JSON.parse(body); } catch {
      // AI chats sometimes leave // comments or trailing commas in: remove them and try again.
      const loose = body.replace(/\/\/[^"\n]*$/gm, '').replace(/,\s*([}\]])/g, '$1');
      try { obj = JSON.parse(loose); } catch { throw new Error('The block isn\'t a valid taste. Copy it again, from the first { to the last }.'); }
    }
    if (!obj || typeof obj !== 'object' || !obj.checks) throw new Error('That block doesn\'t look like Taste Gate settings (it has no "checks").');
    return normalizeSettings(obj);
  }

  // Short, stable id for a custom rule, so its saved answers survive reordering.
  function ruleKey(rule) {
    let h = 0x811c9dc5;
    const s = rule.kind + ':' + rule.text.toLowerCase();
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return 'r' + (h >>> 0).toString(36);
  }

  // Which questions the current settings need answered about a pin, given the answers already saved.
  function missingQuestions(answers, settings) {
    const a = answers || {}, c = settings.checks, need = [];
    const anyScene = c.studio || c.product || c.photo || c.design;
    if (anyScene && !a.s) need.push('s');
    if (anyScene && !a.p) need.push('p');
    if (c.foodDrink) for (const k of ['d', 'e', 'f']) if (typeof a[k] !== 'number') need.push(k);
    for (const rule of settings.rules) { const k = ruleKey(rule); if (typeof a.r?.[k] !== 'number') need.push(k); }
    return need;
  }

  const probsOf = (ans, ids) => {
    const out = {};
    const pr = ans?.probabilities || {};
    for (const k of ids) out[k] = typeof pr[k] === 'number' ? pr[k] : 0;
    if (!Object.keys(pr).length && ans?.value) out[ans.value] = ans.confidence ?? 1;
    return out;
  };

  // answers: { s, p, d, e, f, r: { ruleKey: probability } } -> { kind: keep | flag | unsure, reason }
  // Red when a rule break is likely, orange only when there's a real chance of one, green otherwise.
  function pinVerdict(answers, settings) {
    const a = answers || {}, S = settings, c = S.checks, F = S.flagAt, U = S.unsureAt;
    // Your own rules apply to every image, product shots included.
    let ruleUnsure = null;
    for (const rule of S.rules) {
      const p = a.r?.[ruleKey(rule)];
      if (typeof p !== 'number') continue;
      const breaks = rule.kind === 'need' ? 1 - p : p; // chance the image breaks this rule
      const name = rule.kind === 'need' ? 'Not: ' + rule.text : rule.text;
      if (breaks >= F) return { kind: 'flag', reason: name };
      if (breaks >= U && !ruleUnsure) ruleUnsure = { kind: 'unsure', reason: 'Unsure: ' + name };
    }
    const built = builtInVerdict(a, S, c, F, U);
    if (built.kind === 'keep' && ruleUnsure) return ruleUnsure;
    return built;
  }

  function builtInVerdict(a, S, c, F, U) {
    const sp = probsOf(a.s, Object.keys(SETTING)), pp = probsOf(a.p, Object.keys(PRODUCT));
    const design = c.design ? sp['Design layout'] : 0;
    const notPhoto = c.photo ? sp['Not a photo'] : 0;
    // Product photography is always fine (packaged food and drinks included), so it's checked first:
    // only a page Jev is very sure is a website/design layout, or an illustration, still goes red.
    const productShot = a.p?.value === 'Product shot' && pp['Product shot'] >= S.productShotMin;
    if (productShot) {
      if (design >= S.designSure) return { kind: 'flag', reason: 'Website or design layout' };
      if (notPhoto >= S.notPhotoSure) return { kind: 'flag', reason: 'Not a photo' };
      return { kind: 'keep', reason: 'Product shot' };
    }
    if (design >= F) return { kind: 'flag', reason: 'Website or design layout' };
    if (c.foodDrink) {
      if (typeof a.f === 'number' && a.f >= F) return { kind: 'flag', reason: 'Food is the focus' };
      // Food on its own isn't enough: it needs a drink with it. Pins with no food skip this.
      if (typeof a.e === 'number' && typeof a.d === 'number' && a.e >= F) {
        if (a.d < 1 - F) return { kind: 'flag', reason: 'Food but no drink' };
        if (a.d < 1 - U) return { kind: 'unsure', reason: 'Unsure: drink with the food?' };
      }
      if (typeof a.f === 'number' && a.f >= U) return { kind: 'unsure', reason: 'Unsure: food the focus?' };
    }
    if (design >= U) return { kind: 'unsure', reason: 'Unsure: website or design?' };
    const risks = [
      ['Not a photo', notPhoto, 'Unsure: not a photo?'],
      ['No product in frame', c.product ? pp['No product'] : 0, 'Unsure: product'],
      ['Studio backdrop', c.studio ? sp['Studio set'] : 0, 'Unsure: backdrop']
    ].sort((x, y) => y[1] - x[1]);
    const [reason, risk, unsureReason] = risks[0];
    if (risk >= F) return { kind: 'flag', reason };
    if (risk >= U) return { kind: 'unsure', reason: unsureReason };
    if (!(c.studio || c.product || c.photo || c.design)) return { kind: 'keep', reason: 'Passes your rules' };
    return { kind: 'keep', reason: a.s?.value === 'Plain backdrop, candid' ? 'Candid, product in frame' : 'Real scene, product in frame' };
  }

  // Jev's scores for one pin, as CSV columns (for tuning with an AI chat).
  function scoreColumns(answers, settings) {
    const a = answers || {};
    const sp = probsOf(a.s, Object.keys(SETTING)), pp = probsOf(a.p, Object.keys(PRODUCT));
    const f = (v) => (typeof v === 'number' ? v.toFixed(2) : '');
    const cols = {
      'score: studio set': a.s ? f(sp['Studio set']) : '',
      'score: not a photo': a.s ? f(sp['Not a photo']) : '',
      'score: design layout': a.s ? f(sp['Design layout']) : '',
      'score: no product': a.p ? f(pp['No product']) : '',
      'score: product shot': a.p ? f(pp['Product shot']) : '',
      'score: drink visible': f(a.d),
      'score: food shown': f(a.e),
      'score: food is the focus': f(a.f)
    };
    for (const rule of settings.rules) cols['score: ' + (rule.kind === 'need' ? 'matches "' : 'shows "') + rule.text + '"'] = f(a.r?.[ruleKey(rule)]);
    return cols;
  }

  // Your taste as a short readable list: [{ kind: 'avoid' | 'need' | 'info', text }].
  const CHECK_SUMMARY = {
    studio: { kind: 'avoid', text: 'studio shots' },
    product: { kind: 'need', text: 'a product in the shot' },
    photo: { kind: 'avoid', text: 'illustrations and 3D renders' },
    design: { kind: 'avoid', text: 'websites and design layouts' },
    foodDrink: { kind: 'avoid', text: 'food without a drink, or food as the main focus' }
  };
  function summary(settings) {
    const S = normalizeSettings(settings), out = [];
    for (const [k, on] of Object.entries(S.checks)) if (on) out.push(CHECK_SUMMARY[k]);
    for (const r of S.rules) out.push({ kind: r.kind, text: r.text });
    const level = Object.entries(STRICTNESS).find(([, v]) => v.flagAt === S.flagAt && v.unsureAt === S.unsureAt)?.[0];
    out.push({ kind: 'info', text: 'Strictness: ' + (level || 'custom') });
    return out;
  }

  // Every checked pin as a CSV: verdict with your current taste, your vote, and Jev's score (0 to 1) for each check.
  // store: everything in chrome.storage.local. Returns { csv, pins, votes }.
  function votesCsv(store) {
    const S = normalizeSettings(store.tasteSettings);
    const pins = Object.entries(store).filter(([k, v]) => k.startsWith('pn:') && v?.answers).map(([, v]) => v)
      .sort((a, b) => (b.vote ? 1 : 0) - (a.vote ? 1 : 0) || (b.lastSeen || 0) - (a.lastSeen || 0)); // voted pins first
    const heads = Object.keys(scoreColumns({}, S));
    const rows = [['pin', 'verdict', 'reason', 'your vote', ...heads, 'image']];
    for (const p of pins) {
      const v = pinVerdict(p.answers, S), sc = scoreColumns(p.answers, S);
      rows.push([p.link, v.kind, v.reason, p.vote || '', ...heads.map((h) => sc[h]), p.img]);
    }
    const csv = rows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
    return { csv, pins: pins.length, votes: pins.filter((p) => p.vote).length };
  }
  function csvFileName() {
    const d = new Date();
    return 'taste-gate-votes-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.csv';
  }

  self.TasteGate = { SETTING, PRODUCT, QUESTIONS, CHECKS, STRICTNESS, DEFAULT_SETTINGS, MAX_RULES, ruleQuestion,
    normalizeSettings, parseSettingsText, ruleKey, missingQuestions, pinVerdict, scoreColumns, summary, votesCsv, csvFileName };
})();
