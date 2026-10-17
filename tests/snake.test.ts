// tests/snake.test.ts
import { describe, it, expect } from 'vitest';
import { create, turn, step, speed } from '../src/scripts/snake';

const fixed = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe('snake', () => {
  it('starts in the middle, heading right, with food off its body', () => {
    const g = create(10, 8, fixed(0.95, 0.95));
    expect(g.body[0]).toEqual({ x: 5, y: 4 });
    expect(g.food).toEqual({ x: 9, y: 7 });
  });
  it('moves, ignores reversing, and turns', () => {
    const g = create(10, 8, fixed(0.95));
    turn(g, { x: -1, y: 0 });
    step(g);
    expect(g.body[0]).toEqual({ x: 6, y: 4 });
    turn(g, { x: 0, y: 1 });
    step(g);
    expect(g.body[0]).toEqual({ x: 6, y: 5 });
    expect(g.body).toHaveLength(3);
  });
  it('eats, scores and grows', () => {
    const g = create(10, 8, fixed(0.95));
    g.food = { x: 6, y: 4 };
    expect(step(g, fixed(0.1)).ate).toBe(true);
    expect(g.score).toBe(1);
    step(g); step(g);
    expect(g.body).toHaveLength(5);
  });
  it('dies on the walls and on itself', () => {
    const g = create(4, 4, fixed(0.99));
    step(g); // x 3
    step(g); // wall
    expect(g.dead).toBe(true);
    const h = create(10, 10, fixed(0.99));
    h.body = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }];
    h.dir = { x: 0, y: -1 }; h.next = { x: -1, y: 0 };
    step(h);
    expect(h.dead).toBe(true);
  });
  it('speeds up to a floor', () => {
    expect(speed(0)).toBe(115);
    expect(speed(100)).toBe(55);
  });
});
