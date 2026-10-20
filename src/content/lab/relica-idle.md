---
title: How Relica Idle keeps fighting with the tab closed
summary: A browser MMORPG where your hero hunts on after you leave. How the server plays every fight, why Math.pow is banned, how idle rooms skip 91% of their ticks, and how loot is paid exactly once.
date: 2026-10-20
tags: [typescript, determinism, gamedev, colyseus]
cover: /lab/relica-idle.webp
image: /lab/relica-idle.jpg
---

[Relica Idle](https://relica.nyhz.dev) is a semi-idle browser MMORPG. You build a hero, open a portal and walk away. Up to four adventurers share a portal, monsters come out of it one at a time, and the fight goes on after you close the tab, until your hero runs out of stamina and makes camp on the spoils.

That one promise, *walk away*, decided most of the architecture. A fight that keeps going without you has to be played by the server, and a server that plays thousands of fights nobody is watching has to be cheap and correct. It also has to be exactly reproducible, because the same engine runs in the browser too.

This post is about that engine: what it can't touch, why `Math.pow` is banned, how idle rooms skip 91% of their work, and how loot is paid exactly once.

## 1. The server plays, the client watches

The obvious design for a browser game is the client simulating and the server checking. Relica does the opposite. **The browser never simulates the hunt.** The server owns one engine instance per room and steps all of them at 20 ticks a second, whether anyone is connected or not. The realtime rooms (Colyseus) are only *views*: when you open the game, you subscribe to a fight that was already running.

So there is no client prediction, no rollback and no reconciliation to get wrong. The only things a player can send are a handful of actions (drink a potion, open a chest, rejoin, leave), each validated by its own schema. Everything else flows the other way:

- **frames:** what changed since the last frame, at most 10 a second and only when something changed, with a full keyframe on join and every 10 s;
- **events:** compact tuples for every swing, hit, kill and drop.

Colyseus' automatic state sync is off (`patchRate = null`). Everything is a typed message, delta-encoded (`[id, bitmask, ...changedValues]`) and deflated. A spectator costs **0.3–0.6 KB/s**.

Since the client holds nothing that matters, losing the connection costs nothing either. It joins again from scratch and gets a fresh keyframe. The only care it takes is not to come back all at once with every other client after a server restart:

```ts
export const reconnectConfig = {
  baseMs: 500,
  maxMs: 10_000,
  jitter: 0.3,
} as const;

export function reconnectDelayMs(attempt: number, random = Math.random) {
  const { baseMs, maxMs, jitter } = reconnectConfig;
  const raw = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(raw * (1 - jitter + 2 * jitter * random()));
}
```

## 2. An engine with no outside world

The combat engine is its own package, and the first rule is that it can't see anything outside itself. ESLint stops it from importing Colyseus, Fastify, Postgres, Redis, Phaser, React or anything from `node:*`. And a test reads its source and fails if it finds `Math.random`, `Date.now`, `new Date(`, `performance`, a timer, `process` or `require`.

No clock, no timers, no ambient randomness. Time inside a fight is a tick number, and "now" is derived from it:

```ts
export const TICK_MS = 1000 / combatConfig.tickRate; // 20 Hz: 50 ms

export function nowMs(ctx: RoomContext): number {
  return ctx.state.startTimeMs + ctx.state.tick * TICK_MS;
}
```

Every buff and debuff lasts a number of hits, answers or turns, never milliseconds. A potion expires at a game time, not a wall time.

The room's state is plain JSON: no `Map`s, no classes, no functions. Loops walk arrays in insertion order and break ties by id. That makes a snapshot nothing more than `JSON.stringify`, and a restored room "continues exactly like the continuous run".

## 3. Same seed, same fight

Randomness comes from a seeded generator (sfc32, seeded through SplitMix32). Its whole state is four numbers, and everything random in a fight, from a crit to a drop, goes through three small functions:

```ts
export type RngState = [number, number, number, number];

export function nextFloat(st: RngState): number {
  return nextUint32(st) / 4294967296;
}

/** Uniform integer in [min, max] (inclusive). */
export function nextInt(st: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(st) * (max - min + 1));
}

export function chance(st: RngState, p: number): boolean {
  return nextFloat(st) < p;
}
```

The detail that matters: **the generator's state lives inside the room's state.** It isn't a module variable or a closure, it's four numbers in the JSON. So a snapshot carries the dice with it, and a restored room rolls exactly what the original would have rolled next.

Event ids are deterministic too. They're made of the room, the tick and a counter that also lives in the state:

```ts
export function nextEventId(ctx: RoomContext): string {
  ctx.state.eventSeq += 1;
  return `${ctx.state.roomId}:${ctx.state.tick}:${ctx.state.eventSeq}`;
}
```

Two runs of the same room produce the same events with the same ids. That turns out to be the key to section 6. And it's the kind of claim a test can state in plain words:

```ts
it('a restored room continues exactly like the continuous run', () => {
  const continuous = fourCharacterRoom(99);
  continuous.run(1500);
  const snapshot = JSON.parse(JSON.stringify(continuous.snapshot()));
  const tail = continuous.run(900);

  const restored = HuntingRoom.restore(catalog, snapshot);
  const restoredTail = restored.run(900);

  expect(JSON.stringify(restoredTail)).toBe(JSON.stringify(tail));
});
```

## 4. `Math.pow` is not the same everywhere

This is the one that surprised me. The ECMAScript spec lets `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `Math.pow` and friends be *implementation-approximated*. V8, SpiderMonkey and JavaScriptCore are free to return results that differ in the last bit, and sometimes they do. The basic arithmetic operators and `Math.sqrt`, on the other hand, are exactly rounded by IEEE 754, so they give the same bits in every engine.

For most code a last-bit difference is noise. For a deterministic simulation it is a time bomb. One different bit in a damage curve changes a crit roll, then a kill, then the loot, and the server and the browser no longer agree about what happened. So the engine and the balance config ban them in lint: `Math.pow`, `exp`, `log`, `sin`, `cos`, `tan`, `hypot` and `cbrt`, the `**` operator, and `localeCompare` while at it, whose order depends on the user's locale. The lint message says what to use instead: *"Not bit-exact across JavaScript engines: use products, sqrt or a table."*

What replaces them is boring on purpose:

- **Whole powers** become repeated multiplication:
  ```ts
  /**
   * `base^n` for a whole `n` by repeated multiplication
   * (`Math.pow` may differ between engines).
   */
  export function powInt(base: number, n: number): number {
    let v = 1;
    for (let i = 0; i < Math.abs(n); i++) v *= base;
    return n < 0 ? 1 / v : v;
  }
  ```
- **Level curves** are built by multiplying step by step, not with `**`.
- **The one place that needed a cosine** reads it from a generated table, so `Math.cos` never runs at runtime.

A lint rule is a promise, so there's also a proof. A *determinism probe* plays a long, busy fight on the real catalog and hashes every event. Playwright runs it in Node and in Chromium, Firefox and WebKit, and the four hashes must be the same.

Besides that, the engine's unit tests pin SHA-256 hashes of reference fights. A refactor that changes a single event fails the build.

## 5. Nobody's watching: skip the quiet ticks

Twenty ticks a second for every room adds up. But look at what actually happens in one: a character swings once every 2.5 seconds, which is once every 50 ticks. **Most ticks only count timers down.**

So a room that nobody is watching doesn't step every tick. It counts the ticks it owes and plays them in blocks of 20, once a second. Inside a block it jumps straight over the ticks where nothing can happen:

```ts
advanceQuiet(maxTicks: number): CombatEvent[] {
  let left = Math.floor(maxTicks);
  while (left > 0) {
    // how far can we jump without missing anything?
    const k = this.skipQuiet(Math.min(this.quietTicks(), left - 1));
    left -= k;
    // play the next tick for real
    const events = this.step();
    left--;
    if (events.length > 0) return events;
  }
  return [];
}
```

The skip itself is almost nothing: move the tick counter forward and take the same number off every fighter's swing timer. The interesting part is `quietTicks()`, the proof that a jump is safe. It bounds the jump by everything that could happen without a swing:

- the next weather slot;
- the next potion check that would see a potion run out;
- a rest or camp clock turning over;
- a mini-boss about to be announced.

The result: unwatched rooms skip **91% of their ticks**. The moment someone opens the room, it goes back to stepping every tick.

An optimisation like this is only acceptable if it's invisible, so it's tested that way. The same room is played tick by tick and in quiet blocks, and the test demands the same final tick, the same events with the same ids, and the same gold, XP and loot.

## 6. Loot exactly once, even after a crash

A server that plays fights for absent players has to pay them, and pay them exactly once. Rewards are saved in batches every 3 seconds, and immediately for anything that matters (a level-up, a death, an epic drop). Every 30 seconds each room also saves a checkpoint, which is just its JSON snapshot.

If the process dies, nothing is lost and nothing is paid twice. On restart each room is restored from its checkpoint and *replays* the ticks since then. Because the simulation is deterministic, the replay produces the same events with the same ids. Each run remembers the sequence number of the last event it persisted, and anything at or below that watermark is dropped:

```ts
const fresh = batch.events.filter(
  (e) => 'eventId' in e && eventSeq(e.eventId) > run.last,
);
```

Determinism here isn't a nicety for replays. It *is* the crash recovery.

Loot uses a related trick. The engine decides *what* drops: the item, its rarity and its band. Building the actual item (its base, class and affixes) is heavier and lives on the server, outside the simulation. To keep that reproducible as well, the server seeds a fresh generator from a hash of the event:

```ts
function rngFor(eventId: string, index: number) {
  const h = createHash('sha256').update(`${eventId}#${index}`).digest();
  return seedRng(h.readUInt32LE(0));
}
```

Same kill, same item, however many times the event is processed.

## 7. A hidden tab draws nothing

On the client, Phaser draws the fight from the stream of events. It never computes anything about combat; visual effects are triggered by the server's events. That raises a small problem: when you come back to a tab that has been in the background, the events that arrived meanwhile are all waiting, and playing them back would mean a burst of every queued swing at once.

So events are split into two kinds. **Fleeting** ones (a swing, an answer, a damage tick, a heal) only draw something passing, and they are dropped while the tab is hidden or the scene has stalled. Everything that changes the scene for good (a new enemy, a death, loot) is always applied. The whole rule is a list and a one-liner:

```ts
/**
 * The portal events that only draw something passing:
 * made while nobody looks, they would all play at once
 * on the return, so they are dropped.
 */
export const FLEETING_PORTAL_EVENTS = new Set([
  'swing',
  'answer',
  'dot',
  'heal',
  'barrier',
  'riposte',
  'potion',
  // …
]);

/** Always drawn while looked at, else only lasting ones. */
export const drawsWhileUnseen = (t: PortalFeedEvent['t']) =>
  !FLEETING_PORTAL_EVENTS.has(t);
```

You come back to the fight as it is now, not to a fast-forward of the last ten minutes.

## 8. Where the engine runs in the browser

The pitch says the engine is shared by the client and the server, and it is, just not for the live hunt. The browser runs the same package for things that only make sense with a real simulation:

- **The landing page.** The fight behind "watch a hunt" is a real engine room running locally on a timer, feeding the same Phaser scene the server's events feed. The demo isn't a recording or a mock: it's the game, playing itself.
- **Item and zone maths** in the UI, which can never disagree with what the server will do.
- **The determinism probe** from section 4, which is just the engine playing a reference fight in whatever browser opens it.

The server only ever runs in Node, but the engine runs on everyone's machine. That's why the bit-exact rules of section 4 matter at all.

## 9. Balance by simulation

With a deterministic engine, balance stops being guesswork. A simulator plays the real engine through gear progressions, talents, zones, weather and encounters, and reports on them. A quick run is part of `verify`, and the build fails if a balance criterion breaks.

It goes one step further: with `--write`, the simulator *fits* some balance constants itself and writes them back into the config. Those files carry a "generated, never edited by hand" header, and a repo check enforces that nobody edits them by hand anyway.

## 10. The rewrite, and the migrators that survived it

The first combat model was nothing like this one: crowds of enemies, projectiles, areas of effect, pets. It was a lot of simulation for a game you mostly don't watch. Version 6 of the room state threw it away for the current model, one enemy out of the portal at a time with a swing every 2.5 seconds. Saved rooms from the old model simply can't continue.

What did survive is the habit of **versioning the state from day one**. Every room snapshot carries a version, and a chain of migrators brings old ones forward. When a later update doubled stamina, its migrator also doubled the stamina left in every saved room, so nobody lost half a hunt overnight:

```ts
/** v7 → v8: stamina counts swings of 2.5 s (twice as many in a load). */
function v7ToV8(state: Json): void {
  const double = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const x of list)
      if (isObject(x) && typeof x.stamina === 'number') x.stamina *= 2;
  };
  double(state.characters);
  if (isObject(state.portal)) double(state.portal.members);
}

const MIGRATORS = { 5: v5ToV6, 6: v6ToV7, 7: v7ToV8 };
```

Restoring a room walks the chain one version at a time, so a save from any version arrives in the current one:

```ts
for (let v = version; v < ROOM_STATE_VERSION; v++) {
  MIGRATORS[v](state);
  state.version = v + 1;
}
```

Golden snapshot fixtures in the tests prove that old saves still restore.

## In numbers

- **Simulation:** 20 ticks a second; a swing every 2.5 s; a stamina load of 1,000 swings, or 41 minutes 40 seconds of hunting.
- **Engine cost per room tick:** 2–5 µs when nothing happens, about 50 µs when something does, and about 0.02 MB of memory per room.
- **Content:** 6 classes, 7 maps, 31 zones and 4,302 items.
- **Tests:** about 2,000, of which 400 are on the engine alone. The engine itself is about 10,000 lines.

## Tricks worth stealing

- **Put the RNG state inside the simulation state.** Then a snapshot is a save game, a replay and a crash-recovery point at once.
- **Ban the implementation-approximated maths** (`Math.pow`, `**`, `sin`, `cos`, `exp`, `log`, `localeCompare`) anywhere results must match across machines. Then prove it with a hash in every browser.
- **Derive time from the tick**, and measure durations in game events, not milliseconds.
- **Skip work nobody can see, and prove it's invisible**: the optimised and the plain run must end bit-identical.
- **Deterministic event ids plus a watermark** give you exactly-once side effects and crash recovery by re-simulation, for free.
- **Seed side calculations from a hash of the event** (`sha256(eventId#i)`), so heavy work can live outside the simulation and still be reproducible.
- **Drop fleeting effects while the tab is hidden.** Nobody wants a fast-forward.
- **Version your state from the first commit.** You will rewrite the game, and the saves will outlive the code.
