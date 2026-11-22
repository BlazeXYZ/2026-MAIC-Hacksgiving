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

  // QR code for the live site, drawn as one path (green modules on the paper card).
  const qrPath = 'M0 0h7v1h-7zM8 0h4v1h-4zM13 0h3v1h-3zM18 0h1v1h-1zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h2v1h-2zM11 1h5v1h-5zM19 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h1v1h-1zM11 2h1v1h-1zM13 2h2v1h-2zM19 2h1v1h-1zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM10 3h3v1h-3zM14 3h2v1h-2zM17 3h1v1h-1zM20 3h1v1h-1zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h1v1h-1zM13 4h1v1h-1zM15 4h1v1h-1zM17 4h3v1h-3zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h3v1h-3zM13 5h2v1h-2zM20 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM11 7h2v1h-2zM14 7h1v1h-1zM18 7h1v1h-1zM20 7h1v1h-1zM0 8h1v1h-1zM3 8h7v1h-7zM11 8h7v1h-7zM19 8h3v1h-3zM24 8h1v1h-1zM26 8h3v1h-3zM2 9h2v1h-2zM8 9h3v1h-3zM14 9h1v1h-1zM19 9h1v1h-1zM21 9h1v1h-1zM23 9h2v1h-2zM26 9h2v1h-2zM0 10h1v1h-1zM2 10h1v1h-1zM6 10h7v1h-7zM14 10h1v1h-1zM18 10h1v1h-1zM20 10h2v1h-2zM26 10h1v1h-1zM7 11h1v1h-1zM9 11h1v1h-1zM14 11h2v1h-2zM17 11h5v1h-5zM23 11h1v1h-1zM25 11h1v1h-1zM28 11h1v1h-1zM1 12h1v1h-1zM3 12h4v1h-4zM8 12h7v1h-7zM16 12h1v1h-1zM20 12h1v1h-1zM22 12h2v1h-2zM28 12h1v1h-1zM3 13h2v1h-2zM7 13h2v1h-2zM10 13h3v1h-3zM18 13h1v1h-1zM20 13h1v1h-1zM22 13h7v1h-7zM0 14h3v1h-3zM4 14h1v1h-1zM6 14h1v1h-1zM8 14h2v1h-2zM11 14h1v1h-1zM14 14h3v1h-3zM19 14h2v1h-2zM22 14h2v1h-2zM26 14h1v1h-1zM28 14h1v1h-1zM1 15h1v1h-1zM4 15h1v1h-1zM8 15h2v1h-2zM12 15h4v1h-4zM19 15h1v1h-1zM21 15h1v1h-1zM24 15h1v1h-1zM26 15h1v1h-1zM28 15h1v1h-1zM0 16h1v1h-1zM2 16h1v1h-1zM4 16h3v1h-3zM8 16h1v1h-1zM11 16h1v1h-1zM15 16h2v1h-2zM20 16h1v1h-1zM23 16h1v1h-1zM25 16h1v1h-1zM0 17h3v1h-3zM5 17h1v1h-1zM7 17h2v1h-2zM10 17h1v1h-1zM12 17h1v1h-1zM15 17h1v1h-1zM17 17h1v1h-1zM19 17h2v1h-2zM24 17h1v1h-1zM26 17h2v1h-2zM0 18h4v1h-4zM6 18h2v1h-2zM9 18h2v1h-2zM12 18h4v1h-4zM17 18h1v1h-1zM19 18h3v1h-3zM24 18h2v1h-2zM28 18h1v1h-1zM0 19h3v1h-3zM4 19h1v1h-1zM8 19h2v1h-2zM11 19h3v1h-3zM16 19h1v1h-1zM21 19h1v1h-1zM24 19h3v1h-3zM0 20h2v1h-2zM3 20h5v1h-5zM11 20h1v1h-1zM13 20h1v1h-1zM15 20h3v1h-3zM20 20h8v1h-8zM8 21h3v1h-3zM13 21h1v1h-1zM15 21h1v1h-1zM17 21h2v1h-2zM20 21h1v1h-1zM24 21h2v1h-2zM0 22h7v1h-7zM8 22h2v1h-2zM11 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM19 22h2v1h-2zM22 22h1v1h-1zM24 22h2v1h-2zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h4v1h-4zM13 23h1v1h-1zM17 23h4v1h-4zM24 23h1v1h-1zM27 23h2v1h-2zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h4v1h-4zM13 24h1v1h-1zM15 24h2v1h-2zM19 24h7v1h-7zM27 24h2v1h-2zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM8 25h2v1h-2zM11 25h2v1h-2zM14 25h3v1h-3zM18 25h1v1h-1zM20 25h2v1h-2zM28 25h1v1h-1zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM11 26h3v1h-3zM15 26h2v1h-2zM19 26h2v1h-2zM23 26h2v1h-2zM26 26h3v1h-3zM0 27h1v1h-1zM6 27h1v1h-1zM9 27h2v1h-2zM14 27h2v1h-2zM18 27h1v1h-1zM21 27h2v1h-2zM24 27h3v1h-3zM28 27h1v1h-1zM0 28h7v1h-7zM8 28h3v1h-3zM13 28h2v1h-2zM18 28h6v1h-6z';
  const qr = '<a class="qr" href="https://hacksgiving.samfreund.dev" target="_blank" rel="noopener" aria-label="Open hacksgiving.samfreund.dev in a new tab">'
    + `<svg viewBox="0 0 29 29" aria-hidden="true"><path d="${qrPath}" fill="#0F6B3A"/></svg></a>`;

  // Every slide gets the same footer unless it opts out with data-foot="none".
  const logo = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="16" y="1.5" width="20.5" height="20.5" rx="2" transform="rotate(45 16 1.5)" fill="#0F6B3A"/><path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#FCFCF9" stroke-width="3.2" stroke-linecap="square" fill="none"/></svg>';
  slides.forEach((slide, i) => {
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${total}`);
    slide.insertAdjacentHTML('beforeend', qr);
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
