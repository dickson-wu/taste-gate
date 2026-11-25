// Taste Gate: small helpers shared by the popup, settings and Checked pins pages.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TG = self.TasteGate;
const GUIDE_URL = 'https://github.com/dickson-wu/taste-gate#readme';

// Downloads the votes CSV. Calls back with { pins, votes }.
function exportVotes(done) {
  chrome.storage.local.get(null, (store) => {
    const r = TG.votesCsv(store);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv' }));
    a.download = TG.csvFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    done?.(r);
  });
}

const voteCount = (store) => Object.entries(store).filter(([k, v]) => k.startsWith('pn:') && v?.vote).length;
const pinCount = (store) => Object.keys(store).filter((k) => k.startsWith('pn:')).length;
const money = (n) => '$' + (n || 0).toFixed(4);
