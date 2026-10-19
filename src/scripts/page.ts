// src/scripts/page.ts — the page's lifecycle under Astro's client router.
// Moving around the site doesn't reload: the body is swapped inside a view
// transition, and a bundled script never runs twice. So a component hands its
// setup to onPage(): it runs now (on the page the script arrived with) and on
// every page after it, and gets a signal that aborts the moment the page is
// swapped away. Listeners added with { signal }, and timers and loops that
// watch it, die with the page — nothing of the tv keeps running on a post.
const html = document.documentElement;
let visit = 0;
let ac = new AbortController();

document.addEventListener('astro:before-swap', () => {
  ac.abort();
  ac = new AbortController();
  visit++;
});
// the swap brings the new page's <html> attributes: arriving by navigation
// never boots (the loader is for typing the url or reloading — Loader.astro)
document.addEventListener('astro:after-swap', () => {
  html.classList.add('no-boot');
  html.setAttribute('data-loaded', '');
});

/** set a component up on this page and every page after it (once per page) */
export function onPage(init: (signal: AbortSignal) => void) {
  let ran = -1;
  const run = () => {
    if (ran === visit) return;
    ran = visit;
    init(ac.signal);
  };
  run();
  document.addEventListener('astro:page-load', run);
}

/** setInterval that stops with the page */
export function every(ms: number, fn: () => void, signal: AbortSignal) {
  const id = window.setInterval(fn, ms);
  signal.addEventListener('abort', () => clearInterval(id));
  return id;
}

/** setTimeout that's dropped with the page */
export function later(ms: number, fn: () => void, signal: AbortSignal) {
  const id = window.setTimeout(fn, ms);
  signal.addEventListener('abort', () => clearTimeout(id));
  return id;
}
