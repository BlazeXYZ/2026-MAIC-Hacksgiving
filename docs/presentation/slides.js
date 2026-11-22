// Slide deck controller.
// Space / → / PageDown / Enter: next slide. Shift+Space / ← / PageUp / Backspace: previous slide.
// Home / End: first / last slide. F: toggle fullscreen. The URL hash (#3) keeps your place on reload.
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

  const go = (n) => {
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
    history.replaceState(null, '', `#${current + 1}`);
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    const back = e.shiftKey && e.key === ' ';
    if (back || ['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(current - 1); }
    else if ([' ', 'ArrowRight', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); go(current + 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(total - 1); }
    else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });
  window.addEventListener('hashchange', () => go(parseInt(location.hash.slice(1), 10) - 1 || 0));
  window.addEventListener('resize', fit);

  // A short hint on load so the presenter knows how to drive it.
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.innerHTML = '<kbd>Space</kbd> next &nbsp; <kbd>Shift</kbd>+<kbd>Space</kbd> back &nbsp; <kbd>F</kbd> fullscreen';
  document.body.append(hint);
  requestAnimationFrame(() => hint.classList.add('show'));
  setTimeout(() => hint.classList.remove('show'), 3500);

  fit();
  go((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
