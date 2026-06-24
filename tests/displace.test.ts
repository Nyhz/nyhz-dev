// tests/displace.test.ts
import { describe, it, expect } from 'vitest';
import { repel } from '../src/scripts/displace';

describe('repel', () => {
  it('returns zero displacement beyond radius', () => {
    expect(repel([0, 0, 0], [10, 0, 0], 1, 1)).toEqual([0, 0, 0]);
  });
  it('pushes away from the pointer when inside radius', () => {
    const [dx] = repel([0.5, 0, 0], [0, 0, 0], 2, 1);
    expect(dx).toBeGreaterThan(0); // point is +x of pointer, so pushed further +x
  });
  it('stronger push when closer', () => {
    const near = repel([0.2, 0, 0], [0, 0, 0], 2, 1)[0];
    const far = repel([1.5, 0, 0], [0, 0, 0], 2, 1)[0];
    expect(near).toBeGreaterThan(far);
  });
});
