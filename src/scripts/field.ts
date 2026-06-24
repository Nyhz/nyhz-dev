import * as THREE from 'three';
import { repel } from './displace';

const GAP = 0.092;          // grid spacing in world units
const EXTENT_X = 2.5, EXTENT_Y = 1.5;
const RADIUS = 0.55;        // cursor ripple reach
const PUSH = 0.14;          // cursor ripple strength
const DRIFT = 0.014;        // ambient wave amplitude

// A faint, full-viewport dot grid that drifts gently and ripples toward the
// cursor — ambient "magic" behind the content. Monochrome, theme-aware.
export function createField(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.z = 1;

  const base: number[] = [];
  for (let x = -EXTENT_X; x <= EXTENT_X; x += GAP) {
    for (let y = -EXTENT_Y; y <= EXTENT_Y; y += GAP) base.push(x, y, 0);
  }
  const baseArr = new Float32Array(base);
  const positions = new Float32Array(baseArr);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Round dot sprite so points aren't coarse squares.
  const dotTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  })();
  const small = matchMedia('(max-width: 720px)').matches;
  const material = new THREE.PointsMaterial({
    size: small ? 1.5 : 2.2, sizeAttenuation: false, transparent: true, opacity: 0.5,
    map: dotTex, alphaTest: 0.5, depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  // Cursor ripple only on devices with a real pointer — touch must not move the dots.
  const interactive = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let px = 0, py = 0, active = false;
  function onMove(e: PointerEvent) {
    px = (e.clientX / innerWidth) * 2 - 1;
    py = -((e.clientY / innerHeight) * 2 - 1);
    active = true;
  }
  function onLeave() { active = false; }
  if (interactive) {
    addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
  }

  function resize() {
    const w = innerWidth, h = innerHeight, a = w / Math.max(h, 1);
    renderer.setSize(w, h, false);
    camera.left = -a; camera.right = a; camera.top = 1; camera.bottom = -1;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = performance.now(), time = 0, raf = 0;

  function frame() {
    const now = performance.now();
    time += Math.min((now - last) / 1000, 0.05); last = now;
    const a = camera.right;
    const pwx = px * a, pwy = py;

    for (let i = 0; i < positions.length; i += 3) {
      const bx = baseArr[i], by = baseArr[i + 1];
      let x = bx, y = by;
      if (!reduceMotion) {
        x += Math.sin(time * 0.6 + bx * 1.4 + by * 1.1) * DRIFT;
        y += Math.cos(time * 0.5 + by * 1.6) * DRIFT;
      }
      if (active && !reduceMotion) {
        const [ox, oy] = repel([bx, by, 0], [pwx, pwy, 0], RADIUS, PUSH);
        x += ox; y += oy;
      }
      positions[i] = x; positions[i + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    setTheme(color: string) { material.color.set(color); },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('resize', resize);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      geo.dispose(); material.dispose(); dotTex.dispose(); renderer.dispose();
    },
  };
}
