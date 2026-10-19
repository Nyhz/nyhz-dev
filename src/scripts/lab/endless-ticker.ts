// lab · endless ticker: the news strip's trick. The headlines are in the track
// twice; the track slides exactly half its width and starts again — at that
// moment the second copy is where the first one began, so the seam never
// shows. Click for x-ray: the two copies tinted, and the seam marked.
import { el, hint, reduced, stage, type Mount } from './kit';

const HEADLINES = [
  'this strip never jumps',
  'the headlines are in here twice',
  'it slides exactly half its width',
  'then starts again from zero',
  'the second copy is where the first began',
  'so nobody sees the seam',
];
const SPEED = 60; // px per second

export const mount: Mount = (host) => {
  const s = stage(host, 'cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:1.1rem;');
  const tip = hint(s, 'click for x-ray');
  const caption = el('p', 'margin:0 1.4rem;font:500 0.62rem/1.6 var(--mono);letter-spacing:0.14em;text-transform:uppercase;'
    + 'color:rgba(242,241,234,0.55);text-align:center;min-height:1.6em;', s);
  const strip = el('div', 'position:relative;overflow:hidden;height:2.4rem;display:flex;align-items:center;'
    + 'background:rgba(8,8,8,0.85);border-top:1px solid #232320;border-bottom:1px solid #232320;', s);
  const track = el('div', 'display:flex;width:max-content;will-change:transform;', strip);
  const half = () => {
    const h = el('div', 'display:flex;flex:none;');
    HEADLINES.forEach((t) => {
      const n = el('span', 'padding:0 1.4rem;white-space:nowrap;font:500 0.8rem var(--mono);letter-spacing:0.08em;'
        + 'text-transform:uppercase;color:#f2f1ea;', h);
      n.textContent = t;
      el('i', 'font-style:normal;color:#3ad29f;font-size:0.6em;align-self:center;', h).textContent = '■';
    });
    return h;
  };
  const a = half(), b = half();
  track.append(a, b);
  // x-ray: each copy tinted, the seam between them a bright rule
  const seam = el('i', 'position:absolute;top:-6px;bottom:-6px;width:2px;background:#ff2e63;box-shadow:0 0 10px #ff2e63;'
    + 'display:none;pointer-events:none;', b);
  b.style.position = 'relative';
  seam.style.left = '0';
  let xray = false;
  const paint = () => {
    a.style.background = xray ? 'rgba(58,210,159,0.3)' : '';
    b.style.background = xray ? 'rgba(181,123,255,0.32)' : '';
    seam.style.display = xray ? 'block' : 'none';
    caption.textContent = xray ? 'green: copy one · purple: copy two · red: where it loops back to the start' : '';
    tip.textContent = xray ? 'click to hide the x-ray' : 'click for x-ray';
  };
  let anim: Animation | null = null;
  const run = () => {
    anim?.cancel();
    if (reduced()) { xray = true; paint(); return; }
    const w = a.offsetWidth;
    anim = track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }],
      { duration: (w / SPEED) * 1000, iterations: Infinity });
  };
  s.addEventListener('click', () => { xray = !xray; paint(); });
  const ro = new ResizeObserver(run);
  ro.observe(strip);
  document.fonts.ready.then(run);
  paint();
  return () => { ro.disconnect(); anim?.cancel(); s.remove(); };
};
