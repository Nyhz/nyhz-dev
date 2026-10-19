// lab · film grain: the page's own background shader (scripts/grain.ts), run
// inside the box — the lamp follows the pointer, a click sends a ripple, and
// one goes off now and then so it's alive before anyone touches it.
import { createGrain } from '../grain';
import { canvas, hint, reduced, stage, type Mount } from './kit';

export const mount: Mount = (host) => {
  const s = stage(host, 'background:#0b0b0b;cursor:crosshair;');
  const { cv, stop } = canvas(s, () => {});
  const tip = hint(s, 'move the pointer · click for a ripple');
  const g = createGrain(cv, s);
  if (!g) { tip.textContent = 'this one needs webgl'; return () => { stop(); s.remove(); }; }
  g.start();
  let iv = 0;
  if (!reduced()) {
    const r = () => s.getBoundingClientRect();
    iv = window.setInterval(() => {
      const b = r();
      g.ripple(b.left + b.width * (0.2 + Math.random() * 0.6), b.top + b.height * (0.25 + Math.random() * 0.5), 0.9);
    }, 2600);
  }
  return () => { clearInterval(iv); g.dispose(); stop(); s.remove(); };
};
