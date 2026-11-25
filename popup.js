chrome.storage.local.get(null, (s) => {
  $('enabled').checked = s.enabled !== false;
  $('keywarn').hidden = !!s.apiKey;
  $('pins').textContent = pinCount(s).toLocaleString();
  $('total').textContent = money(s.spend?.total);
  const voted = Object.entries(s).filter(([k, v]) => k.startsWith('pn:') && v?.vote).map(([, v]) => v.vote);
  $('votes').textContent = voted.length;
  $('keeps').textContent = voted.filter((v) => v === 'keep').length;
  $('flags').textContent = voted.filter((v) => v === 'flag').length;
});
$('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }));
$('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('openPins').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pins.html') }));
$('export').addEventListener('click', () => exportVotes((r) => { $('export').textContent = 'Exported ' + r.votes + ' votes'; }));
