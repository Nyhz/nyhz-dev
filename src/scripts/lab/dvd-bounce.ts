// lab · dvd bounce: the screensaver's logo. It moves at a constant speed and
// flips a component of its velocity on each wall; a corner is two walls in
// the same frame — rare, which is the whole joke. Trails come from painting a
// translucent black over the last frame instead of clearing it.
import { canvas, hint, reduced, stage, type Mount } from './kit';

const COLORS = ['#3ad29f', '#2ee6ff', '#ff2e63', '#f5c542', '#b57bff', '#f2f1ea'];

export const mount: Mount = (host) => {
  const s = stage(host, 'cursor:pointer;');
  const still = reduced();
  let W = 1, H = 1, DPR = 1;
  // nothing moves until the box has a size: at 1×1 every frame would be a corner
  const { cv, stop } = canvas(s, (w, h, dpr) => {
    W = w; H = h; DPR = dpr;
    if (still) { const { w: lw, h: lh } = size(); x = (W - lw) / 2; y = (H - lh) / 2; }
    draw(true);
    if (!still && !raf) raf = requestAnimationFrame((t) => { last = t; step(t); });
  });
  const ctx = cv.getContext('2d')!;
  const tip = hint(s, 'corners: 0 · click to nudge');
  let x = 40, y = 30, vx = 1, vy = 1, c = 0, corners = 0, flash = 0, raf = 0, last = performance.now();

  const font = () => `700 ${Math.round(Math.min(W, H * 1.6) * 0.11)}px "Doto Variable", ui-monospace, monospace`;
  const size = () => { ctx.font = font(); const m = ctx.measureText('nyhz'); return { w: m.width, h: Math.min(W, H * 1.6) * 0.085 }; };

  function draw(clear = false) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = clear ? '#0c0c0b' : 'rgba(12,12,11,0.22)';
    ctx.fillRect(0, 0, W, H);
    if (flash > 0) { ctx.fillStyle = `rgba(242,241,234,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
    const { h } = size();
    ctx.fillStyle = COLORS[c];
    ctx.textBaseline = 'top';
    ctx.shadowColor = COLORS[c]; ctx.shadowBlur = 18;
    ctx.fillText('nyhz', x, y - h * 0.18);
    ctx.shadowBlur = 0;
  }

  function step(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const speed = Math.max(90, W * 0.22); // px/s, scaled to the box
    const { w, h } = size();
    x += vx * speed * dt; y += vy * speed * dt;
    let hx = false, hy = false;
    if (x <= 0) { x = 0; vx = 1; hx = true; } else if (x + w >= W) { x = W - w; vx = -1; hx = true; }
    if (y <= 0) { y = 0; vy = 1; hy = true; } else if (y + h >= H) { y = H - h; vy = -1; hy = true; }
    if (hx || hy) c = (c + 1) % COLORS.length;
    if (hx && hy) { corners++; flash = 1; tip.textContent = `corners: ${corners} · click to nudge`; }
    flash = Math.max(0, flash - dt * 2);
    draw();
    raf = requestAnimationFrame(step);
  }

  // a nudge: a new angle, which changes which corner (if any) it finds
  s.addEventListener('click', () => { const a = 0.6 + Math.random() * 0.5; vx = Math.sign(vx) * Math.cos(a) * 1.4; vy = Math.sign(vy) * Math.sin(a) * 1.4; });
  if (still) tip.textContent = 'dvd bounce (paused: reduced motion)';
  return () => { cancelAnimationFrame(raf); stop(); s.remove(); };
};
