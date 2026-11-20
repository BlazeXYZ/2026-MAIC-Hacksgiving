import { useEffect } from 'react';

/** Every surface that draws the chain-link tile (see the PROD pass in styles/tokens.css). */
const FENCED = '.hero, .redhead, .hubband, .alert-strip, .need4 > button.g, .statuscard, .take, .dfoot';

/**
 * "One continuous fence" from the PROD mockup.
 *
 * Each screen (`.view`) draws one fence. Its tile origin is pinned to the scrolling body's content origin, so the
 * fence scrolls with the content (like the mockup's) and runs unbroken behind the fixed header and footer:
 *
 * 1. On every scroll, the screen's tile is shifted by the body's position and scroll offset (--vx/--vy), and the
 *    top wash (--vh/--vs) slides with it.
 * 2. Fenced surfaces inside the body (hero, alert strip, stubs…) shift their own tile by their offset from the
 *    body's content origin. That offset doesn't change on scroll, so it's only recomputed on layout changes.
 */
function alignSurfaces() {
  document.querySelectorAll<HTMLElement>('.view-body').forEach((body) => {
    const br = body.getBoundingClientRect();
    if (!br.width) return;
    body.querySelectorAll<HTMLElement>(FENCED).forEach((el) => {
      const er = el.getBoundingClientRect();
      if (!er.width) return;
      const x = er.left - br.left + body.scrollLeft - body.clientLeft + el.clientLeft;
      const y = er.top - br.top + body.scrollTop - body.clientTop + el.clientTop;
      el.style.setProperty('--fx', `${(-x).toFixed(2)}px`);
      el.style.setProperty('--fy', `${(-y).toFixed(2)}px`);
    });
  });
}

function alignScreens() {
  document.querySelectorAll<HTMLElement>('.view').forEach((view) => {
    const body = view.querySelector<HTMLElement>(':scope > .view-body');
    if (!body) return;
    const vr = view.getBoundingClientRect();
    const br = body.getBoundingClientRect();
    const top = br.top - vr.top + body.clientTop; // height of the fixed header above the body
    view.style.setProperty('--vx', `${(br.left - vr.left + body.clientLeft - body.scrollLeft).toFixed(2)}px`);
    view.style.setProperty('--vy', `${(top - body.scrollTop).toFixed(2)}px`);
    view.style.setProperty('--vh', `${top.toFixed(2)}px`);
    view.style.setProperty('--vs', `${(-body.scrollTop).toFixed(2)}px`);
  });
}

let layoutQueued = false;
function queueLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    alignSurfaces();
    alignScreens();
  });
}

let scrollQueued = false;
function queueScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    alignScreens();
  });
}

/** Re-aligns after every render of the caller, on resize, after clicks (which may change layout), once fonts load, and on scroll. */
export function useFenceAlignment() {
  useEffect(() => {
    queueLayout();
  });

  useEffect(() => {
    const onClick = () => setTimeout(queueLayout, 0);
    document.addEventListener('click', onClick);
    // Scroll doesn't bubble; capture catches every screen body.
    document.addEventListener('scroll', queueScroll, { capture: true, passive: true });
    window.addEventListener('resize', queueLayout);
    void document.fonts?.ready.then(queueLayout);
    const ro = new ResizeObserver(queueLayout);
    ro.observe(document.body);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('scroll', queueScroll, { capture: true });
      window.removeEventListener('resize', queueLayout);
      ro.disconnect();
    };
  }, []);
}
