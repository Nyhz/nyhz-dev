// src/scripts/snake.ts — the terminal's `snake`, played on the frame. Pure
// game state; drawing and input live in Snake.astro.

export type P = { x: number; y: number };
export type Game = {
  cols: number; rows: number;
  body: P[];      // head first
  dir: P;         // direction of the last step
  next: P;        // queued direction for the next step
  food: P;
  grow: number;   // segments still to add
  score: number;
  dead: boolean;
};

const same = (a: P, b: P) => a.x === b.x && a.y === b.y;

function placeFood(g: Game, rnd: () => number): P {
  for (let i = 0; i < 500; i++) {
    const p = { x: Math.floor(rnd() * g.cols), y: Math.floor(rnd() * g.rows) };
    if (!g.body.some((b) => same(b, p))) return p;
  }
  return { x: 0, y: 0 };
}

export function create(cols: number, rows: number, rnd: () => number = Math.random): Game {
  const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
  const g: Game = {
    cols, rows,
    body: [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }],
    dir: { x: 1, y: 0 }, next: { x: 1, y: 0 },
    food: { x: 0, y: 0 }, grow: 0, score: 0, dead: false,
  };
  g.food = placeFood(g, rnd);
  return g;
}

/** Queue a turn; reversing onto yourself is ignored. */
export function turn(g: Game, d: P) {
  if (d.x === -g.dir.x && d.y === -g.dir.y) return;
  g.next = d;
}

/** One tick. The frame's edges are walls; so is your own tail. */
export function step(g: Game, rnd: () => number = Math.random): { ate: boolean } {
  if (g.dead) return { ate: false };
  g.dir = g.next;
  const head = { x: g.body[0].x + g.dir.x, y: g.body[0].y + g.dir.y };
  const tailMoves = g.grow === 0;
  const hitsSelf = g.body.some((b, i) => same(b, head) && !(tailMoves && i === g.body.length - 1));
  if (head.x < 0 || head.y < 0 || head.x >= g.cols || head.y >= g.rows || hitsSelf) {
    g.dead = true;
    return { ate: false };
  }
  g.body.unshift(head);
  if (g.grow > 0) g.grow--; else g.body.pop();
  const ate = same(head, g.food);
  if (ate) {
    g.score++;
    g.grow += 2;
    g.food = placeFood(g, rnd);
  }
  return { ate };
}

/** ms per step: quicker with every bite, down to a floor */
export const speed = (score: number) => Math.max(55, 115 - score * 4);
