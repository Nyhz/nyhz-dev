// src/scripts/ambilight.ts — the tv's ambilight: the colour along each edge of
// the picture, lifted into a glow that spills round the set. Pure; Tv.astro
// samples the cover into a tiny canvas and hands over its pixels.
export type RGB = [number, number, number];

/** the average colour of each edge band of an RGBA image: left, top, right, bottom */
export function edges(px: ArrayLike<number>, w: number, h: number, band = 0.2): RGB[] {
  const bw = Math.max(1, Math.round(w * band)), bh = Math.max(1, Math.round(h * band));
  const boxes = [[0, 0, bw, h], [0, 0, w, bh], [w - bw, 0, w, h], [0, h - bh, w, h]];
  return boxes.map(([x0, y0, x1, y1]) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = (y * w + x) * 4;
        r += px[k]; g += px[k + 1]; b += px[k + 2]; n++;
      }
    }
    return [r / n, g / n, b / n].map(Math.round) as RGB;
  });
}

/** an edge colour as a glow: a dark cover would glow black and a pale one
 *  wash out, so the lightness is kept in a band and the colour pushed a little */
export function glow([r, g, b]: RGB, alpha = 0.4): string {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const S = Math.min(1, s * 1.3), L = Math.min(0.62, Math.max(0.34, l));
  return `hsl(${Math.round(h)} ${Math.round(S * 100)}% ${Math.round(L * 100)}% / ${alpha})`;
}
