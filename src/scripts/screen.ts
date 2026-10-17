// The preview "screen": draws a project cover into a canvas with a terminal
// decode — a pixelated ghost of the image is scanned top→down into the sharp
// one behind a teal scan bar, then a couple of frames of slice glitch settle it.

type Rect = [number, number, number, number];

export function coverRect(iw: number, ih: number, W: number, H: number, focusY = 0.12): Rect {
  const s = Math.max(W / iw, H / ih);
  const sw = W / s, sh = H / s;
  return [(iw - sw) / 2, (ih - sh) * focusY, sw, sh];
}

export function createScreen(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  const cache = new Map<string, Promise<HTMLImageElement>>();
  let raf = 0;
  let token = 0;

  const load = (url: string) => {
    let p = cache.get(url);
    if (!p) {
      p = new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = url;
      });
      cache.set(url, p);
    }
    return p;
  };

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    return dpr;
  }

  async function show(url: string, instant = false) {
    const my = ++token;
    cancelAnimationFrame(raf);
    if (!ctx || !url) { clear(); return; }
    let img: HTMLImageElement;
    try { img = await load(url); } catch { if (my === token) clear(); return; }
    if (my !== token) return;

    const dpr = fit();
    const W = canvas.width, H = canvas.height;
    const src = coverRect(img.naturalWidth, img.naturalHeight, W, H);
    const sharp = () => ctx.drawImage(img, ...src, 0, 0, W, H);
    if (instant) { ctx.clearRect(0, 0, W, H); sharp(); return; }

    // pixelated copy: draw tiny, scale up without smoothing
    const B = Math.max(6, Math.round(W / 44));
    const small = document.createElement('canvas');
    small.width = Math.ceil(W / B); small.height = Math.ceil(H / B);
    small.getContext('2d')?.drawImage(img, ...src, 0, 0, small.width, small.height);

    const DECODE = 680, SETTLE = 160;
    const t0 = performance.now();
    const step = (now: number) => {
      if (my !== token) return;
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      if (t < DECODE) {
        const k = t / DECODE;
        const y = Math.round((1 - Math.pow(1 - k, 2)) * H);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.5 * Math.min(1, k * 5);
        ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, small.width * B, small.height * B);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, y); ctx.clip(); sharp(); ctx.restore();
        ctx.fillStyle = 'rgba(58,210,159,0.14)';
        ctx.fillRect(0, y - 16 * dpr, W, 16 * dpr);
        ctx.fillStyle = '#3ad29f';
        ctx.fillRect(0, y - dpr, W, 2 * dpr);
      } else if (t < DECODE + SETTLE) {
        // slice glitch: a few horizontal bands jump sideways, then lock
        sharp();
        for (let i = 0; i < 3; i++) {
          const h = Math.round(H * (0.04 + Math.random() * 0.08));
          const y = Math.round(Math.random() * (H - h));
          const dx = Math.round((Math.random() - 0.5) * 18 * dpr);
          ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
        }
      } else {
        sharp();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function clear() {
    token++;
    cancelAnimationFrame(raf);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { show, clear, preload: (url: string) => { if (url) load(url).catch(() => {}); } };
}
