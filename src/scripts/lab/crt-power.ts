// lab · crt power: the tv's switch-on and switch-off, on a loop. The picture is
// clipped to a line and opened out (inset() tweened from the middle); the
// bright line is its own element on top, so the frame never moves.
import { gsap } from 'gsap';
import { el, FILL, hint, reduced, stage, type Mount } from './kit';

const BARS = 'linear-gradient(90deg,#c0c0c0 0 14.3%,#c0c000 0 28.6%,#00c0c0 0 42.9%,#00c000 0 57.1%,#c000c0 0 71.4%,#c00000 0 85.7%,#0000c0 0)';

export const mount: Mount = (host, { covers }) => {
  const s = stage(host, 'cursor:pointer;');
  const pic = el('div', `${FILL}background:#111 center/cover no-repeat;`, s);
  const line = el('i', 'position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:#fff;pointer-events:none;'
    + 'box-shadow:0 0 12px 2px rgba(255,255,255,0.8),0 0 34px rgba(58,210,159,0.6);transform:scaleX(0);opacity:0;', s);
  hint(s, 'click to switch it');
  const pics = covers.length ? covers.map((c) => `url("${c}")`) : [BARS];
  let k = 0, on = true, t = 0;
  let tl: gsap.core.Timeline | null = null;
  const still = reduced();
  pic.style.backgroundImage = pics[0];

  const powerOn = () => gsap.timeline()
    .set(pic, { clipPath: 'inset(50% 0% 50% 0%)' })
    .fromTo(line, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.2, ease: 'power3.out' })
    .fromTo(pic, { clipPath: 'inset(50% 0% 50% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.42, ease: 'power3.out' })
    .to(line, { opacity: 0, duration: 0.3, ease: 'power2.out' }, '<');
  const powerOff = () => gsap.timeline()
    .fromTo(pic, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(49.6% 0% 49.6% 0%)', duration: 0.22, ease: 'power3.in' })
    .set(line, { scaleX: 1, opacity: 1 })
    .set(pic, { clipPath: 'inset(50% 0% 50% 0%)' })
    .to(line, { scaleX: 0.004, duration: 0.2, ease: 'power3.in' })
    .to(line, { opacity: 0, duration: 0.5, ease: 'power2.out' });

  function flip() {
    tl?.kill();
    on = !on;
    if (on) pic.style.backgroundImage = pics[k = (k + 1) % pics.length]; // a new picture each time it comes on
    if (still) pic.style.visibility = on ? 'visible' : 'hidden';
    else tl = on ? powerOn() : powerOff();
    clearTimeout(t);
    if (!still) t = window.setTimeout(flip, on ? 2600 : 1100);
  }
  s.addEventListener('click', flip);
  if (!still) t = window.setTimeout(flip, 2200);
  return () => { clearTimeout(t); tl?.kill(); s.remove(); };
};
