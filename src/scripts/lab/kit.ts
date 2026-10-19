// src/scripts/lab/kit.ts — what every lab demo shares. A demo mounts into a
// host box (the tv's screen, or the frame on its /lab page), fills it, and
// hands back a cleanup that leaves the host empty.
export type LabCtx = { covers: string[] };
export type Mount = (host: HTMLElement, ctx: LabCtx) => () => void;

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** an element with inline styles: demos carry their own css, so they look the same wherever they mount */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  parent?.append(e);
  return e;
}

export const FILL = 'position:absolute;inset:0;width:100%;height:100%;';

/** the demo's own layer, filling the host: listeners go on it, so removing it cleans them up */
export const stage = (host: HTMLElement, css = '') => el('div', `${FILL}overflow:hidden;background:#0c0c0b;${css}`, host);

/** a small instruction at the top of the screen ("click for a ripple") */
export const hint = (parent: HTMLElement, text: string) => {
  const p = el('p', 'position:absolute;left:0;right:0;top:0.85rem;margin:0;text-align:center;pointer-events:none;z-index:4;'
    + 'font:500 0.6rem var(--mono);letter-spacing:0.18em;text-transform:uppercase;color:rgba(242,241,234,0.6);'
    + 'text-shadow:0 0 6px rgba(0,0,0,0.9)', parent);
  p.textContent = text;
  return p;
};

/** a canvas that keeps its backing store matched to its box (and the pixel ratio) */
export function canvas(parent: HTMLElement, onSize: (w: number, h: number, dpr: number) => void) {
  const cv = el('canvas', `${FILL}display:block;`, parent);
  const ro = new ResizeObserver(() => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, parent.clientWidth), h = Math.max(1, parent.clientHeight);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    onSize(w, h, dpr);
  });
  ro.observe(parent);
  return { cv, stop: () => ro.disconnect() };
}
