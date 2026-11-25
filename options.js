let settings = TG.normalizeSettings(null);
const say = (id, cls, text) => { $(id).className = cls; $(id).textContent = text; };

// ---------- step 1: key ----------
function showKey(apiKey) {
  if (apiKey) say('keyStatus', 'ok', '✓ Key saved (ends in …' + apiKey.slice(-4) + ')');
  else say('keyStatus', 'bad', 'No key yet: paste it above to start.');
  $('keyCard').classList.toggle('need', !apiKey);
}
$('saveKey').addEventListener('click', () => {
  const v = $('key').value.trim();
  if (!v) return;
  chrome.storage.local.set({ apiKey: v }, () => { $('key').value = ''; showKey(v); });
});
$('key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('saveKey').click(); });

// ---------- step 2: taste ----------
function drawTaste() {
  $('chips').innerHTML = TG.summary(settings).map((c) =>
    '<span class="chip ' + c.kind + '">' + (c.kind === 'avoid' ? '<b>Avoid</b>' : c.kind === 'need' ? '<b>Must have</b>' : '') + esc(c.text) + '</span>').join('');
}
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
  say('tasteStatus', 'ok', '✓ Copied. Paste it into your AI chat with the learn-my-taste prompt from the guide.');
});
$('showPaste').addEventListener('click', () => { $('pasteBox').hidden = false; $('block').focus(); });
$('cancel').addEventListener('click', () => { $('pasteBox').hidden = true; $('block').value = ''; say('tasteStatus', '', ''); });
$('apply').addEventListener('click', () => {
  try {
    const next = TG.parseSettingsText($('block').value);
    chrome.storage.local.set({ tasteSettings: next }, () => {
      settings = next;
      drawTaste();
      $('pasteBox').hidden = true;
      $('block').value = '';
      say('tasteStatus', 'ok', '✓ New taste in use. Open Pinterest tabs update by themselves; pins already checked are re-scored for free.');
    });
  } catch (e) {
    say('tasteStatus', 'bad', e.message);
  }
});
$('reset').addEventListener('click', () => {
  if (!confirm('Go back to the starting taste? Your current taste will be replaced.')) return;
  settings = TG.normalizeSettings(null);
  chrome.storage.local.set({ tasteSettings: settings }, () => {
    drawTaste();
    $('pasteBox').hidden = true;
    say('tasteStatus', 'ok', '✓ Back to the starting taste.');
  });
});

// ---------- step 3: export ----------
$('export').addEventListener('click', () => exportVotes((r) => {
  say('exportStatus', r.votes ? 'ok' : 'bad', r.votes
    ? '✓ Exported ' + r.votes + ' votes (and ' + (r.pins - r.votes) + ' other checked pins).'
    : 'Exported, but you haven\'t voted yet: vote keep or flag on 40+ pins first, so the AI can learn what you like.');
}));
$('guide').addEventListener('click', () => chrome.tabs.create({ url: GUIDE_URL }));

// ---------- load ----------
chrome.storage.local.get(null, (s) => {
  settings = TG.normalizeSettings(s.tasteSettings);
  drawTaste();
  showKey(s.apiKey);
  $('pins').textContent = pinCount(s).toLocaleString();
  $('total').textContent = money(s.spend?.total);
  const n = voteCount(s);
  $('export').textContent = 'Export votes (' + n + ')';
});
chrome.storage.onChanged.addListener((ch) => {
  if (ch.tasteSettings) { settings = TG.normalizeSettings(ch.tasteSettings.newValue); drawTaste(); }
});
