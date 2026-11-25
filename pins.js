let pins = [];
let filter = '';

function load() {
  chrome.storage.local.get(null, (s) => {
    const settings = TG.normalizeSettings(s.tasteSettings);
    pins = Object.entries(s).filter(([k, v]) => k.startsWith('pn:') && v?.answers).map(([, v]) => v)
      .map((p) => ({ ...p, verdict: TG.pinVerdict(p.answers, settings) }))
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    render();
  });
}

// Agreement: of the pins you voted on, how many does Jev already call the way you did?
function agreement() {
  const voted = pins.filter((p) => p.vote);
  if (!voted.length) return '';
  const agree = voted.filter((p) => (p.vote === 'flag') === (p.verdict.kind === 'flag')).length;
  return 'Jev agrees with you on ' + Math.round((agree / voted.length) * 100) + '% of ' + voted.length + ' voted pins.';
}

function render() {
  const list = pins.filter((p) => !filter || (filter === 'voted' ? !!p.vote : p.verdict.kind === filter));
  $('count').textContent = list.length + ' of ' + pins.length + ' pins';
  $('agree').textContent = agreement();
  $('export').textContent = 'Export votes (' + pins.filter((p) => p.vote).length + ')';
  $('grid').innerHTML = list.length ? list.map((p) => {
    const v = p.verdict, a = p.answers;
    const detail = [a.s?.value, a.p?.value].filter(Boolean).join(' · ');
    return '<div class="pin glass ' + esc(v.kind) + '" data-id="' + esc(p.id) + '">' +
      '<a class="pic" href="' + esc(p.link) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(p.img) + '" alt=""></a>' +
      '<div class="info"><div class="why">' + esc(v.reason) + '<small>' + esc(detail) + '</small></div>' +
      '<div class="vote"><button data-vote="keep" class="ghost' + (p.vote === 'keep' ? ' on' : '') + '">Should keep</button>' +
      '<button data-vote="flag" class="ghost' + (p.vote === 'flag' ? ' on' : '') + '">Should flag</button></div></div></div>';
  }).join('') : '<div class="empty">No pins here yet. Search on Pinterest and they will show up here.</div>';
}

$('grid').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-vote]');
  if (!b) return;
  const id = b.closest('.pin').dataset.id;
  chrome.runtime.sendMessage({ type: 'pinVote', id, vote: b.dataset.vote }, (res) => {
    if (chrome.runtime.lastError || !res || res.error) return;
    const p = pins.find((x) => x.id === id);
    if (p) p.vote = res.vote;
    render();
  });
});
$('show').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  $('show').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  render();
});
$('export').addEventListener('click', () => exportVotes());
$('clear').addEventListener('click', () => {
  if (!confirm('Delete all ' + pins.length + ' checked pins? This also removes your votes, and pins will be checked (and paid for) again.')) return;
  chrome.storage.local.get(null, (s) => chrome.storage.local.remove(Object.keys(s).filter((k) => k.startsWith('pn:') || k.startsWith('ps:')), load));
});

chrome.storage.onChanged.addListener((ch) => { if (ch.tasteSettings) load(); });
load();
