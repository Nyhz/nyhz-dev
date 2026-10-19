// tests/ambilight.test.ts
import { describe, it, expect } from 'vitest';
import { edges, glow } from '../src/scripts/ambilight';

// a 10×10 picture: red on the left half, blue on the right
const W = 10, H = 10;
const px = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.set(x < 5 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * W + x) * 4);

describe('edges', () => {
  it('averages each edge band', () => {
    const [l, t, r, b] = edges(px, W, H);
    expect(l).toEqual([255, 0, 0]);
    expect(r).toEqual([0, 0, 255]);
    expect(t).toEqual([128, 0, 128]); // the top band spans both halves
    expect(b).toEqual(t);
  });
});

describe('glow', () => {
  it('keeps the hue and the alpha', () => {
    expect(glow([255, 0, 0])).toBe('hsl(0 100% 50% / 0.4)');
    expect(glow([0, 0, 255], 0.3)).toBe('hsl(240 100% 50% / 0.3)');
  });
  it('lifts a dark cover and calms a pale one', () => {
    expect(glow([10, 10, 30])).toMatch(/ 34% \//);
    expect(glow([250, 250, 250])).toBe('hsl(0 0% 62% / 0.4)');
  });
});
