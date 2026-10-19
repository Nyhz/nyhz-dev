// lab · ambilight: the tv's glow, taken apart. A cover is shrunk to 32×20
// pixels, each edge band is averaged (scripts/ambilight.ts), the colour is
// lifted into a glow, and four box-shadows — one per side — carry it out.
// The swatches show what each edge came out as.
import { edges, glow } from '../ambilight';
import { el, hint, reduced, stage, type Mount } from './kit';

const SIDES = ['left', 'top', 'right', 'bottom'] as const;

export const mount: Mount = (host, { covers }) => {
  const s = stage(host, 'cursor:pointer;display:grid;place-items:center;');
  hint(s, covers.length > 1 ? 'click for the next picture' : 'ambilight');
  const frame = el('div', 'position:relative;width:54%;aspect-ratio:16/10;border:1px solid #232320;'
    + 'background:#000;transition:box-shadow 0.9s ease;', s);
  const img = el('img', 'display:block;width:100%;height:100%;object-fit:cover;', frame);
  img.alt = '';
  // a swatch outside each edge: the colour that side glows
  const sw = SIDES.map((side) => {
    const pos = { left: 'right:calc(100% + 0.9rem);top:50%;translate:0 -50%;', right: 'left:calc(100% + 0.9rem);top:50%;translate:0 -50%;',
      top: 'bottom:calc(100% + 0.9rem);left:50%;translate:-50% 0;', bottom: 'top:calc(100% + 0.9rem);left:50%;translate:-50% 0;' }[side];
    const d = el('span', `position:absolute;${pos}display:flex;align-items:center;gap:0.4em;white-space:nowrap;`
      + 'font:500 0.56rem var(--mono);letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,241,234,0.7);', frame);
    const dot = el('i', 'width:0.8em;height:0.8em;border-radius:50%;display:inline-block;transition:background 0.9s ease;', d);
    const t = el('b', 'font-weight:500;', d);
    t.textContent = side[0];
    return dot;
  });
  const cx = Object.assign(document.createElement('canvas'), { width: 32, height: 20 }).getContext('2d', { willReadFrequently: true });
  const list = covers.length ? covers : [];
  let k = 0, t = 0;

  img.onload = () => {
    if (!cx) return;
    try {
      cx.drawImage(img, 0, 0, 32, 20);
      const c = edges(cx.getImageData(0, 0, 32, 20).data, 32, 20);
      const g = c.map((x) => glow(x, 0.75));
      frame.style.boxShadow = `-30px 0 70px -12px ${g[0]}, 0 -30px 70px -12px ${g[1]}, 30px 0 70px -12px ${g[2]}, 0 30px 70px -12px ${g[3]}`;
      sw.forEach((d, i) => { d.style.background = glow(c[i], 1); });
    } catch { /* unreadable picture: no glow */ }
  };
  const show = () => { if (list.length) img.src = list[k % list.length]; };
  const next = () => { k++; show(); clearTimeout(t); if (!reduced()) t = window.setTimeout(next, 3200); };
  s.addEventListener('click', next);
  show();
  if (!reduced()) t = window.setTimeout(next, 3200);
  return () => { clearTimeout(t); img.onload = null; s.remove(); };
};
