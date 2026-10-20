// src/scripts/overclock.ts — the page pushed past its limits (Overclock.astro's
// fader sets it). 0..1: the text splits into red and cyan, scanlines come up,
// and the page glitches more often — and harder — the higher it goes; past
// 94% it overheats. For the visit only: it drops to 0 when the page is
// swapped away.
import { sound } from './sound';

const html = document.documentElement;
let oc = 0, timer = 0;

export const overclock = () => oc;

export function setOverclock(v: number) {
  oc = Math.max(0, Math.min(1, v));
  html.style.setProperty('--oc', oc.toFixed(3));
  html.classList.toggle('oc', oc > 0.01);
  html.classList.toggle('oc-hot', oc > 0.94);
  if (oc > 0.01 && !timer) timer = window.setInterval(tick, 100);
  else if (oc <= 0.01 && timer) { clearInterval(timer); timer = 0; }
  dispatchEvent(new CustomEvent('nyhz:overclock', { detail: oc }));
}

// ten times a second, a roll of the dice — every effect gets likelier (and
// harder) the higher it's pushed
function tick() {
  if (Math.random() < oc * oc * 0.22) jolt();
  if (Math.random() < oc ** 3 * 0.06) {
    dispatchEvent(new CustomEvent('nyhz:shock', {
      detail: { x: Math.random() * innerWidth, y: Math.random() * innerHeight, strength: 0.5 + oc },
    }));
  }
  if (Math.random() < oc * oc * 0.05) {
    const name = document.querySelector('.hero-name');
    if (name && !name.classList.contains('glitching')) {
      name.classList.add('glitching');
      setTimeout(() => name.classList.remove('glitching'), 420);
    }
  }
}

function jolt() {
  const page = document.querySelector<HTMLElement>('.page');
  if (!page) return;
  page.style.transform = `translateX(${((Math.random() - 0.5) * 16 * oc).toFixed(1)}px) skewX(${((Math.random() - 0.5) * 8 * oc).toFixed(1)}deg)`;
  html.classList.add('oc-jolt');
  setTimeout(() => { page.style.transform = ''; html.classList.remove('oc-jolt'); }, 60 + Math.random() * 110);
  if (oc > 0.5 && Math.random() < 0.3) sound.glitch();
}

document.addEventListener('astro:before-swap', () => setOverclock(0));
