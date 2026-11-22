// Slide deck controller.
// Space / → / PageDown / Enter: next slide. Shift+Space / ← / PageUp / Backspace: previous slide.
// Home / End: first / last slide. F: toggle fullscreen. The URL hash (#3, or #3.2 for a carousel item)
// keeps your place on reload. On a slide with a [data-carousel], forward/back step through its items
// first and only turn the page from the last (or first) item.
(() => {
  const deck = document.querySelector('.deck');
  const slides = [...deck.querySelectorAll('.slide')];
  const total = slides.length;
  const deckTitle = deck.dataset.title || document.title;
  let current = 0;

  // Fit the 1920x1080 canvas to the window.
  const fit = () => {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--scale', String(s));
  };

  // Every slide gets the same footer unless it opts out with data-foot="none".
  const logo = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="16" y="1.5" width="20.5" height="20.5" rx="2" transform="rotate(45 16 1.5)" fill="#0F6B3A"/><path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#FCFCF9" stroke-width="3.2" stroke-linecap="square" fill="none"/></svg>';
  slides.forEach((slide, i) => {
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${total}`);
    if (slide.dataset.foot === 'none') return;
    const foot = document.createElement('footer');
    foot.className = 'slide-foot';
    foot.innerHTML = `<span class="logo">${logo}<b>ComForce <span>MKE</span> Hub</b></span>`
      + `<span>${deckTitle}</span><span class="num">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>`;
    slide.append(foot);
  });

  // Segmented progress bar along the bottom.
  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<i></i>'.repeat(total);
  deck.append(progress);
  const segs = [...progress.children];

  // Carousels: a slide with [data-carousel] holds .car-item children. Page turns step through them first,
  // and the deck only moves to the next or previous slide from the last or first item.
  const carousels = new Map();
  slides.forEach((slide) => {
    const root = slide.querySelector('[data-carousel]');
    if (!root) return;
    const items = [...root.querySelectorAll('.car-item')];
    const nav = document.createElement('div');
    nav.className = 'car-nav';
    nav.setAttribute('aria-hidden', 'true');
    nav.innerHTML = `<span class="segs">${'<i></i>'.repeat(items.length)}</span><span class="count"></span>`;
    root.append(nav);
    carousels.set(slide, { items, pips: [...nav.querySelectorAll('i')], count: nav.querySelector('.count'), index: 0 });
  });

  const showItem = (car, n) => {
    car.index = Math.max(0, Math.min(car.items.length - 1, n));
    car.items.forEach((item, i) => {
      item.classList.toggle('is-active', i === car.index);
      item.classList.toggle('is-before', i < car.index);
      item.setAttribute('aria-hidden', String(i !== car.index));
    });
    car.pips.forEach((pip, i) => {
      pip.classList.toggle('done', i < car.index);
      pip.classList.toggle('on', i === car.index);
    });
    car.count.textContent = `${car.index + 1} / ${car.items.length}`;
  };

  const writeHash = () => {
    const car = carousels.get(slides[current]);
    history.replaceState(null, '', `#${current + 1}${car && car.index ? `.${car.index + 1}` : ''}`);
  };

  // item: which carousel item to show on arrival. 'first', 'last', or a 0-based number.
  const go = (n, item = 'first') => {
    current = Math.max(0, Math.min(total - 1, n));
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === current);
      slide.classList.toggle('is-past', i < current);
      slide.setAttribute('aria-hidden', String(i !== current));
      slide.inert = i !== current;
    });
    segs.forEach((seg, i) => {
      seg.classList.toggle('done', i < current);
      seg.classList.toggle('on', i === current);
    });
    const car = carousels.get(slides[current]);
    if (car) showItem(car, item === 'last' ? car.items.length - 1 : item === 'first' ? 0 : item);
    writeHash();
  };

  const step = (dir) => {
    const car = carousels.get(slides[current]);
    const next = car ? car.index + dir : -1;
    if (car && next >= 0 && next < car.items.length) { showItem(car, next); writeHash(); return; }
    go(current + dir, dir < 0 ? 'last' : 'first');
  };

  // #3 opens slide 3; #3.4 opens slide 3 on its fourth carousel item.
  const fromHash = () => {
    const [s, i] = location.hash.slice(1).split('.').map((v) => parseInt(v, 10));
    go((s || 1) - 1, (i || 1) - 1);
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    const back = e.shiftKey && e.key === ' ';
    if (back || ['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); step(-1); }
    else if ([' ', 'ArrowRight', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); step(1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(total - 1, 'last'); }
    else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('resize', fit);

  fit();
  fromHash();
})();
