// Taste Gate: liquid-glass lens. Gives an element refracting edges: the page behind it bends near the rim,
// like light through curved glass. Works through an SVG displacement filter used in backdrop-filter (Chrome).
// Usage: TGLens.apply(el, { root, blur, saturate, brightness }) — root is the document or a shadow root.
(() => {
  if (self.TGLens) return;
  let n = 0;

  // Displacement map for a rounded rectangle: pixels near the edge are pushed outward, strongest at the rim.
  function lensMap(w, h, r, bezel) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h), d = img.data;
    const hw = w / 2, hh = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5 - hw, py = y + 0.5 - hh;
        const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
        const dist = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
        let dx = 0, dy = 0;
        if (dist > 0 && dist < bezel) {
          let nx, ny;
          if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
          else if (qx > qy) { nx = Math.sign(px); ny = 0; } else { nx = 0; ny = Math.sign(py); }
          const t = 1 - dist / bezel, s = t * t * (3 - 2 * t);
          dx = nx * s; dy = ny * s;
        }
        const i = (y * w + x) * 4;
        d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function holder(root) {
    const scope = root && root !== document ? root : document.documentElement;
    let svg = scope.querySelector(':scope > svg.tg-lens-defs');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'tg-lens-defs');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      scope.appendChild(svg);
    }
    return svg;
  }

  function apply(el, opts = {}) {
    const id = el.dataset.tgLens || 'tg-lens-' + (++n);
    el.dataset.tgLens = id;
    const draw = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      if (el._tgLensSize === w + 'x' + h) return;
      el._tgLensSize = w + 'x' + h;
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16, w / 2, h / 2);
      const bezel = Math.min(opts.bezel || 16, Math.min(w, h) / 2.5);
      const svg = holder(opts.root);
      svg.querySelector('#' + id)?.remove();
      svg.insertAdjacentHTML('beforeend',
        '<filter id="' + id + '" x="0" y="0" width="' + w + '" height="' + h + '" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
        '<feImage href="' + lensMap(w, h, r, bezel) + '" x="0" y="0" width="' + w + '" height="' + h + '" result="map"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + Math.round(Math.min(36, bezel * 2.2)) + '" xChannelSelector="R" yChannelSelector="G"/>' +
        '</filter>');
      setFilter();
    };
    const setFilter = () => {
      const f = 'url(#' + id + ') blur(' + (opts.blur ?? 6) + 'px) saturate(' + (opts.saturate ?? 185) + '%) brightness(' + (opts.brightness ?? 1.06) + ')';
      el.style.backdropFilter = f;
      el.style.webkitBackdropFilter = f;
    };
    el._tgLensSet = (o) => { Object.assign(opts, o); setFilter(); };
    draw();
    if (!el._tgLensRO) {
      let t = null;
      el._tgLensRO = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 120); });
      el._tgLensRO.observe(el);
    }
  }

  // Change blur/brightness later (e.g. switching to the dark look) without rebuilding the map.
  function tune(el, o) { el._tgLensSet?.(o); }

  self.TGLens = { apply, tune };
})();
