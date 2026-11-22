/* Shared mockup behavior: real-map rendering, search sectors, scaling, and the interaction conventions
   (data-take, data-tab, data-seg, data-tick, data-switch, data-once, data-layer-chip, data-go, data-join). */
const HUB = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const cssv = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f);
  const views = {};
  const P = MAP.poi, R = MAP.routes;
  const PANTRIES = [[598, 548], [868, 342], [470, 430], [958, 612], [742, 404]];
  const EVENTS = [[318, 520], [905, 520], [690, 305]];

  function initMaps() {
    document.querySelectorAll('svg.map').forEach(svg => {
      const [x, y, w, h] = svg.getAttribute('viewBox').split(' ').map(Number);
      const k = w / +svg.dataset.px;
      const v = views[svg.id] = { svg, x, y, w, h, k };
      if (svg.dataset.labels === 'off') return;
      const fs = +(svg.dataset.lfs || 9);
      const g = el('g', {}, svg);
      MAP.labels.forEach(l => {
        if (l.x < x + 20 * k || l.x > x + w - 20 * k || l.y < y + 10 * k || l.y > y + h - 10 * k) return;
        const t = el('text', { class: 'lbl', x: l.x, y: l.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: `rotate(${l.a} ${l.x} ${l.y})`, 'font-size': (fs * k).toFixed(2) }, g);
        t.style.strokeWidth = (3 * k) + 'px';
        t.textContent = l.t;
      });
    });
  }
  const KIND = {
    safe: ['--pin-safe', '#0F6B3A', '#i-shield', 'square'], pantry: ['--pin-pantry', '#C98A12', '#i-food'],
    event: ['--pin-event', '#17211C', '#i-cal'], search: ['--pin-search', '#DE2F2A', '#i-search'],
    warm: ['--pin-safe', '#0F6B3A', '#i-flame'], help: ['--pin-search', '#DE2F2A', '#i-hand'],
  };
  function layer(v, name) { return el('g', { 'data-layer': name }, v.svg); }
  function pin(v, g, [cx, cy], kind, label, side) {
    const G = el('g', { transform: `translate(${cx} ${cy}) scale(${v.k})` }, g);
    if (kind === 'you') {
      const c = cssv('--pin-you', '#3E7DB3');
      el('circle', { r: 13, fill: c, 'fill-opacity': .2 }, G); el('circle', { r: 7, fill: c, stroke: '#fff', 'stroke-width': 3 }, G);
    } else {
      const [varn, fb, icon, shape] = KIND[kind]; const c = cssv(varn, fb);
      if (shape === 'square') el('rect', { x: -12, y: -12, width: 24, height: 24, rx: +cssv('--pin-radius', 5), fill: c, stroke: '#fff', 'stroke-width': 2 }, G);
      else el('circle', { r: 11, fill: c, stroke: '#fff', 'stroke-width': 2 }, G);
      el('use', { href: icon, x: -7, y: -7, width: 14, height: 14, stroke: '#fff', 'stroke-width': 2.3, fill: 'none' }, G);
    }
    if (label) {
      const right = side !== 'left';
      el('text', { class: 'pinlbl', x: right ? 17 : -17, y: 4, 'text-anchor': right ? 'start' : 'end', 'font-size': 12.5 }, G).textContent = label;
    }
    return G;
  }
  function hood(v, text, x, y, size = 11) {
    const t = el('text', { class: 'hood', x, y, 'text-anchor': 'middle', 'font-size': size * v.k }, v.svg);
    t.style.strokeWidth = (4 * v.k) + 'px'; t.textContent = text; return t;
  }
  function route(v, d, o = {}) {
    const g = layer(v, o.layer || 'route');
    el('path', { d, fill: 'none', stroke: o.glow || cssv('--route-glow', '#E4F23A'), 'stroke-width': o.w ? o.w * v.k : 12 * v.k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': o.glowOpacity ?? 1, style: o.blend === false ? '' : 'mix-blend-mode:multiply' }, g);
    el('path', { d, fill: 'none', stroke: o.line || cssv('--route-line', '#0F6B3A'), 'stroke-width': (o.lw || 3) * v.k, 'stroke-dasharray': o.solid ? 'none' : `${1 * v.k} ${7 * v.k}`, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    return g;
  }
  function searchArea(v, r = 70) {
    const g = layer(v, 'search'), c = cssv('--pin-search', '#DE2F2A');
    el('circle', { cx: P.last_seen[0], cy: P.last_seen[1], r, fill: c, 'fill-opacity': .12, stroke: c, 'stroke-width': 2 * v.k, 'stroke-dasharray': `${6 * v.k} ${4 * v.k}` }, g);
    return g;
  }
  function heat(v, color) {
    const g = el('g', { filter: 'url(#heatblur)', opacity: .78, 'data-layer': 'heat' }, v.svg);
    MAP.samples.forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 16, fill: color || cssv('--pin-search', '#DE2F2A'), 'fill-opacity': .32 }, g));
    return g;
  }
  // Standard overlays for an overview map: search, safe places, pantries, events, my walk
  function overview(id, o = {}) {
    const v = views[id]; if (!v) return;
    if (o.hoods !== false) { hood(v, 'Near West Side', 300, 560); hood(v, 'Westown', 640, 690); hood(v, 'Haymarket', 700, 240); hood(v, 'Juneautown', 1010, 600); }
    if (o.heat) heat(v);
    const s = searchArea(v); pin(v, s, P.last_seen, 'search', o.labels === false ? null : 'Last seen 4:55 PM');
    if (o.walk !== false) { route(v, R.library_to_msoe.d, o.routeOpts || {}); pin(v, layer(v, 'route'), R.library_to_msoe.from, 'you'); }
    const sf = layer(v, 'safe');
    pin(v, sf, P.msoe_ps, 'safe', o.labels === false ? null : 'MSOE Public Safety');
    pin(v, sf, P.sojourner, 'safe', o.labels === false ? null : 'Sojourner Family Peace Center');
    pin(v, sf, P.library, 'safe', o.labels === false ? null : 'Central Library', 'left');
    const pa = layer(v, 'pantry'); PANTRIES.forEach(p => pin(v, pa, p, 'pantry'));
    const ev = layer(v, 'event'); EVENTS.forEach(p => pin(v, ev, p, 'event'));
    return v;
  }
  function sojournerRoute(id, o = {}) {
    const v = views[id]; if (!v) return;
    route(v, R.westside_to_sojourner.d, o);
    pin(v, layer(v, 'safe'), P.sojourner, 'safe', o.label ?? 'Sojourner', 'left');
    pin(v, layer(v, 'you'), R.westside_to_sojourner.from, 'you');
    return v;
  }
  function safePlaces(id) {
    const v = views[id]; if (!v) return;
    const sf = layer(v, 'safe');
    pin(v, sf, P.library, 'safe', 'Central Library'); pin(v, sf, P.sojourner, 'safe', 'Sojourner'); pin(v, sf, P.msoe_ps, 'safe', 'MSOE', 'left');
    pin(v, layer(v, 'you'), [820, 470], 'you');
    return v;
  }
  function pantryMap(id) {
    const v = views[id]; if (!v) return;
    const pa = layer(v, 'pantry'); pin(v, pa, [868, 342], 'pantry', 'Porch shelf'); pin(v, pa, [742, 404], 'pantry', 'Church pantry', 'left'); pin(v, pa, [598, 548], 'pantry');
    pin(v, layer(v, 'you'), [930, 420], 'you');
    return v;
  }

  /* ---- search sectors on the real blocks around N 27th St & W Wisconsin Ave ---- */
  const state = { A: 'clear', B: 'clear', C: 'on', D: 'on', E: 'clear', F: 'lead', G: 'open', H: 'open' };
  let joined = null;
  const sectorEls = [];
  function sectorMap(id) {
    const v = views[id]; if (!v) return;
    const G = MAP.grid, cols = ['29th', '28th', '27th', '26th', '25th'], rows = ['Wells', 'Wisconsin', 'Michigan'], names = 'ABCDEFGH';
    const sg = el('g', {}, v.svg); let i = 0;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const q = [G[`${cols[c]}|${rows[r]}`], G[`${cols[c + 1]}|${rows[r]}`], G[`${cols[c + 1]}|${rows[r + 1]}`], G[`${cols[c]}|${rows[r + 1]}`]];
      const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
      const inset = q.map(([x, y]) => [x + (cx - x) * .14, y + (cy - y) * .14]);
      const g = el('g', { class: 'sector', 'data-s': names[i], tabindex: 0, role: 'button', 'aria-label': 'Sector ' + names[i], style: 'cursor:pointer' }, sg);
      el('polygon', { points: inset.map(p => p.join(',')).join(' ') }, g);
      el('text', { x: inset[0][0] + 3, y: inset[0][1] + 9, 'font-size': 9, 'font-weight': 800, 'font-family': 'system-ui,sans-serif', fill: '#17211C' }, g).textContent = names[i];
      sectorEls.push(g); i++;
      const step = () => { const k = g.dataset.s; const cyc = ['open', 'on', 'clear', 'lead']; state[k] = cyc[(cyc.indexOf(state[k]) + 1) % 4]; sync(); };
      g.addEventListener('click', step);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } });
    }
    pin(v, el('g', {}, v.svg), P.last_seen, 'search');
    const C = sectorEls[sectorEls.length - 6].querySelector('polygon').getAttribute('points').split(' ').map(p => p.split(',').map(Number));
    pin(v, el('g', {}, v.svg), [(C[0][0] + C[2][0]) / 2, (C[0][1] + C[2][1]) / 2 + 6], 'you');
    return v;
  }
  function paint(g) {
    const p = g.querySelector('polygon'), st = state[g.dataset.s];
    p.setAttribute('stroke', '#17211C'); p.setAttribute('stroke-width', g.dataset.s === 'C' ? 1.6 : .8);
    p.removeAttribute('stroke-dasharray'); p.style.mixBlendMode = ''; p.setAttribute('fill-opacity', 1);
    if (st === 'clear') p.setAttribute('fill', 'url(#fence)');
    else if (st === 'on') { p.setAttribute('fill', cssv('--sector-on', '#E4F23A')); p.setAttribute('fill-opacity', .82); p.style.mixBlendMode = 'multiply'; }
    else if (st === 'lead') { p.setAttribute('fill', '#FBE5E2'); p.setAttribute('fill-opacity', .9); p.setAttribute('stroke', '#DE2F2A'); }
    else { p.setAttribute('fill', '#FFFFFF'); p.setAttribute('fill-opacity', .55); p.setAttribute('stroke-dasharray', '3 2'); }
  }
  function sync() {
    sectorEls.forEach(paint);
    const order = 'ABCDEFGH'.split(''), clear = order.filter(k => state[k] === 'clear').length;
    document.querySelectorAll('[data-segs]').forEach(s => [...s.children].forEach((i, n) => { const st = state[order[n]]; i.className = st === 'clear' ? 'done' : st === 'on' ? 'on' : ''; }));
    document.querySelectorAll('[data-count]').forEach(c => c.textContent = c.dataset.count.replace('#', clear));
    document.querySelectorAll('[data-join]').forEach(b => { const m = b.dataset.join === joined; b.classList.toggle('mine', m); b.setAttribute('aria-pressed', m); b.disabled = !!joined && !m; });
    const done = state.C === 'clear';
    document.querySelectorAll('[data-mine]').forEach(m => {
      m.classList.toggle('cleared', done);
      const l = m.querySelector('[data-mine-label]'), t = m.querySelector('[data-mine-text]');
      if (l) l.textContent = done ? 'Your sector · cleared' : 'Your sector · searching';
      if (t) t.textContent = done ? 'Thanks. ComForce moved you to sector G, south across Wisconsin. 8 people needed.' : 'N 27th to N 26th, Wells to Wisconsin. 6 of 10 people here.';
    });
    document.querySelectorAll('[data-clear] [data-label]').forEach(s => s.textContent = done ? 'Undo C cleared' : 'Mark C cleared');
  }

  /* ---- scaling ---- */
  function fitAll() {
    const fit = f => { const w = +f.dataset.w, inner = f.firstElementChild, s = Math.min(1, f.clientWidth / w); inner.style.transform = `scale(${s})`; f.style.height = Math.ceil(inner.offsetHeight * s) + 'px'; };
    const fits = [...document.querySelectorAll('.fit')];
    const ro = new ResizeObserver(es => es.forEach(e => fit(e.target.closest('.fit') || e.target)));
    fits.forEach(f => { ro.observe(f); ro.observe(f.firstElementChild); fit(f); });
    if (document.fonts) document.fonts.ready.then(() => fits.forEach(fit));
  }

  function wire() {
    document.addEventListener('click', e => {
      const t = e.target;
      const take = t.closest('[data-take]');
      if (take) {
        const c = take.closest('[data-req]'), on = c.classList.toggle('taken'), lab = take.querySelector('[data-label]') || take;
        if (!take.dataset.off) take.dataset.off = lab.textContent;
        lab.textContent = on ? (take.dataset.on || 'Yours') : take.dataset.off;
        const u = take.querySelector('use'); if (u) { if (!take.dataset.icon) take.dataset.icon = u.getAttribute('href'); u.setAttribute('href', on ? '#i-check' : take.dataset.icon); }
        return;
      }
      const j = t.closest('[data-join]');
      if (j) { const k = j.dataset.join; if (joined === k) { joined = null; if (state[k] === 'on' && k !== 'C') state[k] = 'open'; } else { joined = k; if (state[k] === 'open') state[k] = 'on'; } sync(); return; }
      const cl = t.closest('[data-clear]');
      if (cl) { state.C = state.C === 'clear' ? 'on' : 'clear'; sync(); return; }
      const tab = t.closest('[data-tab]');
      if (tab) {
        const scope = tab.closest('[data-tabs]'), name = tab.dataset.tab;
        scope.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.setAttribute('aria-selected', on); b.classList.toggle('on', on); });
        scope.querySelectorAll('[data-view]').forEach(v => v.hidden = v.dataset.view !== name);
        document.dispatchEvent(new CustomEvent('hub:tab', { detail: { scope: scope.dataset.tabs, name } }));
        return;
      }
      const chip = t.closest('[data-layer-chip]');
      if (chip) { const on = chip.getAttribute('aria-pressed') !== 'true'; chip.setAttribute('aria-pressed', on); document.querySelectorAll(`#${chip.dataset.map} [data-layer="${chip.dataset.layerChip}"]`).forEach(g => g.style.display = on ? '' : 'none'); return; }
      const seg = t.closest('[data-seg]');
      if (seg) { seg.parentElement.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', b === seg)); return; }
      const tick = t.closest('[data-tick]');
      if (tick) { tick.setAttribute('aria-pressed', tick.getAttribute('aria-pressed') !== 'true'); return; }
      const sw = t.closest('[data-switch]');
      if (sw) { sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') !== 'true'); return; }
      const once = t.closest('[data-once]');
      if (once) { const lab = once.querySelector('[data-label]') || once; lab.textContent = once.dataset.once; once.disabled = true; once.closest('[data-done-row]')?.classList.add('done'); return; }
      const tog = t.closest('[data-toggle-class]');
      if (tog) { const [sel, cls] = tog.dataset.toggleClass.split('|'); const tgt = tog.closest(sel); const on = tgt.classList.toggle(cls); const lab = tog.querySelector('[data-label]'); if (lab && tog.dataset.on) { if (!tog.dataset.off) tog.dataset.off = lab.textContent; lab.textContent = on ? tog.dataset.on : tog.dataset.off; } return; }
      const go = t.closest('[data-go]');
      if (go) { const on = go.closest('[data-walk]').classList.toggle('walking'); const lab = go.querySelector('[data-label]'); if (!go.dataset.off) go.dataset.off = lab.textContent; lab.textContent = on ? go.dataset.on : go.dataset.off; return; }
    });
  }

  function init(build) {
    initMaps();
    if (build) build(api);
    sync(); fitAll(); wire();
  }
  const api = { MAP, P, R, views, el, cssv, layer, pin, hood, route, heat, searchArea, overview, sojournerRoute, safePlaces, pantryMap, sectorMap, init, PANTRIES, EVENTS };
  return api;
})();
