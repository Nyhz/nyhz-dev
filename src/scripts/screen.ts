// The preview "screen": draws a project cover into a canvas (cover-cropped,
// top-weighted). Its motion belongs to the preview's timeline; this only paints.

type Rect = [number, number, number, number];

export function coverRect(iw: number, ih: number, W: number, H: number, focusY = 0.12): Rect {
  const s = Math.max(W / iw, H / ih);
  const sw = W / s, sh = H / s;
  return [(iw - sw) / 2, (ih - sh) * focusY, sw, sh];
}

/** mean luminance (0..1) of an image, from a 16×16 thumbnail */
function luma(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return 0;
  x.drawImage(img, 0, 0, 16, 16);
  const d = x.getImageData(0, 0, 16, 16).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (256 * 255);
}

// `onLuma` reports each cover's brightness so light UIs can be shown inverted
// (they'd glare in the dark page otherwise).
export function createScreen(canvas: HTMLCanvasElement, opts: { onLuma?: (l: number) => void } = {}) {
  const ctx = canvas.getContext('2d');
  const cache = new Map<string, Promise<HTMLImageElement>>();
  let token = 0;

  const load = (url: string) => {
    let p = cache.get(url);
    if (!p) {
      p = new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.decoding = 'async';
        // decode off the main thread, so the first paint doesn't stall a frame
        img.onload = () => img.decode().then(() => res(img), () => res(img));
        img.onerror = rej;
        img.src = url;
      });
      cache.set(url, p);
    }
    return p;
  };

  /** Paints `url`; resolves false if it failed or a newer call superseded it. */
  async function show(url: string): Promise<boolean> {
    const my = ++token;
    if (!ctx || !url) return false;
    let img: HTMLImageElement;
    try { img = await load(url); } catch { return false; }
    if (my !== token) return false;
    opts.onLuma?.(luma(img));

    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const W = canvas.width, H = canvas.height;
    const src = coverRect(img.naturalWidth, img.naturalHeight, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, ...src, 0, 0, W, H);
    return true;
  }

  function clear() {
    token++;
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { show, clear, preload: (url: string) => { if (url) load(url).catch(() => {}); } };
}
