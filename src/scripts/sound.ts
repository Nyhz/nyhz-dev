// src/scripts/sound.ts — optional UI sound, synthesised (no files). Off by
// default; the frame's toggle turns it on (a click, so browsers allow audio)
// and the choice is remembered. Every call is a no-op while it's off.

const KEY = 'nyhz:sound';
const VOL = 'nyhz:vol';
let on = false;
let level = 5; // 0..8, the tv remote's + / -
try {
  on = localStorage.getItem(KEY) === '1';
  const v = Number(localStorage.getItem(VOL));
  if (v >= 1 && v <= 8) level = v;
} catch { /* stays off */ }
const gainFor = (l: number) => (l / 8) * 0.8;
const changed = () => dispatchEvent(new Event('nyhz:sound')); // toggles repaint
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let hum: { stop: () => void } | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = gainFor(level);
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** a tone with a fast attack and an exponential tail */
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** a burst of filtered noise */
function noise(dur: number, vol: number, hp: number, at = 0) {
  const a = audio();
  if (!a || !master || !noiseBuf) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf;
  f.type = 'highpass';
  f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.02);
}

export const sound = {
  get on() { return on; },
  get level() { return on ? level : 0; },
  set(v: boolean) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* session only */ }
    if (v) { audio(); tone('square', 660, 660, 0.06, 0.05); tone('square', 990, 990, 0.08, 0.05, 0.07); }
    else this.hum(false);
    changed();
  },
  /** the remote's volume: 0 is off; anything above switches sound on */
  volume(l: number) {
    const was = on;
    level = Math.max(0, Math.min(8, l));
    if (level === 0) { if (was) this.set(false); return; }
    try { localStorage.setItem(VOL, String(level)); } catch { /* fine */ }
    if (!was) { this.set(true); } else { audio(); changed(); }
    if (master && ctx) master.gain.setTargetAtTime(gainFor(level), ctx.currentTime, 0.02);
    tone('square', 880, 880, 0.04, 0.04);
  },
  /** the test card's 1 kHz tone */
  beep(dur = 1.2) { if (on) tone('sine', 1000, 1000, dur, 0.05); },
  /** a terminal keystroke: a dry tick, never quite the same twice */
  key() { if (on) noise(0.018, 0.12, 2500 + Math.random() * 2500); },
  /** hovering a project: barely there */
  tick() { if (on) tone('sine', 1900, 1900, 0.025, 0.025); },
  /** a glitch: stepped square jumps over crackle */
  glitch() {
    if (!on) return;
    noise(0.09, 0.08, 800);
    for (let i = 0; i < 4; i++) { const f = 120 + Math.random() * 900; tone('square', f, f, 0.025, 0.035, i * 0.022); }
  },
  /** an achievement: two rising notes */
  unlock() { if (on) { tone('square', 880, 880, 0.09, 0.05); tone('square', 1320, 1320, 0.14, 0.05, 0.09); } },
  /** snake */
  blip() { if (on) tone('square', 520 + Math.random() * 80, 760, 0.05, 0.04); },
  die() { if (on) { tone('sawtooth', 420, 55, 0.45, 0.06); noise(0.3, 0.05, 300); } },
  /** the transmission packet */
  send() { if (on) tone('sine', 300, 1600, 0.5, 0.05); },
  /** the screensaver: a low CRT hum with a little crackle on top */
  hum(start: boolean) {
    if (!start || !on) { hum?.stop(); hum = null; return; }
    const a = audio();
    if (!a || !master || hum) return;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.02, a.currentTime + 1.2);
    g.connect(master);
    const os = [60, 120, 15750].map((f, i) => {
      const o = a.createOscillator();
      o.frequency.value = f;
      const og = a.createGain();
      og.gain.value = [1, 0.5, 0.04][i];
      o.connect(og).connect(g);
      o.start();
      return o;
    });
    const crackle = window.setInterval(() => { if (Math.random() < 0.3) noise(0.01, 0.015, 4000); }, 400);
    hum = {
      stop() {
        clearInterval(crackle);
        const t = a.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        os.forEach((o) => o.stop(t + 0.35));
      },
    };
  },
};
