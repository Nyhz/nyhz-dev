import * as THREE from 'three';

const FOV = 45;
const FOV_T = Math.tan((FOV * Math.PI) / 180 / 2);
const CAM_Z = 5.5;

// Particle text-morph: the same point cloud rearranges between words.
const WORDS = ['nyhz', 'creative', 'developer'];
const N = 2400;            // particle count
const HOLD = 2.2;          // seconds a word rests
const MORPH = 1.5;         // seconds to morph between words
const SPAN = 2.8;          // world width the text fits into
const ARC = 0.5;           // depth swirl during a morph
const CANVAS_FONT = (fs: number) =>
  `700 ${fs}px ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

// Subtle cursor reaction (kept gentle so the words stay legible).
const RADIUS = 0.45;
const PUSH = 0.05;

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// Sample N points from a word rendered to an offscreen canvas.
function sampleWord(word: string): Float32Array {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = 190;
  ctx.font = CANVAS_FONT(fs);
  while (ctx.measureText(word).width > W * 0.88 && fs > 20) { fs -= 6; ctx.font = CANVAS_FONT(fs); }
  ctx.fillText(word, W / 2, H / 2);

  const data = ctx.getImageData(0, 0, W, H).data;
  const pts: number[] = [];
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      if (data[(y * W + x) * 4] > 128) pts.push(x, y);
    }
  }
  const count = pts.length / 2 || 1;
  const scale = SPAN / W;
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const s = Math.floor((i * count) / N) % count;
    const px = pts[s * 2], py = pts[s * 2 + 1];
    out[i * 3] = (px - W / 2) * scale + (Math.random() - 0.5) * 0.012;
    out[i * 3 + 1] = -(py - H / 2) * scale + (Math.random() - 0.5) * 0.012;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.14;
  }
  return out;
}

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.z = CAM_Z;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const targets = WORDS.map(sampleWord);
  const hash = new Float32Array(N);
  for (let i = 0; i < N; i++) hash[i] = Math.random();

  const positions = new Float32Array(N * 3);
  const from = new Float32Array(N * 3);
  const to = new Float32Array(targets[0]);
  // Intro: start scattered in a ball, then morph into the first word.
  for (let i = 0; i < N; i++) {
    const r = 1.2 + Math.random() * 0.6, a = Math.random() * 6.283, b = Math.random() * 6.283;
    from[i * 3] = Math.cos(a) * Math.sin(b) * r;
    from[i * 3 + 1] = Math.sin(a) * Math.sin(b) * r;
    from[i * 3 + 2] = Math.cos(b) * r;
  }
  positions.set(reduceMotion ? to : from);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ size: 0.03, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  // Pointer in normalized-device coords.
  let px = 0, py = 0, active = false;
  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = -(((e.clientY - r.top) / r.height) * 2 - 1);
    active = true;
  }
  function onLeave() { active = false; }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function setColor(color: string) { material.color.set(color); }

  // Morph state machine.
  let cur = 0;
  let phase: 'morph' | 'hold' = 'morph';
  let morphT = 0;
  let timer = 0;
  let last = performance.now();
  let time = 0;

  let raf = 0;
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    const aspect = camera.aspect;

    let e = 1;
    if (!reduceMotion) {
      if (phase === 'morph') {
        morphT += dt / MORPH;
        if (morphT >= 1) { morphT = 1; phase = 'hold'; timer = 0; from.set(to); }
        e = easeInOut(morphT);
      } else {
        timer += dt;
        if (timer >= HOLD) {
          cur = (cur + 1) % WORDS.length;
          from.set(to);
          to.set(targets[cur]);
          phase = 'morph'; morphT = 0;
        }
      }
    }

    for (let i = 0; i < N; i++) {
      const j = i * 3;
      let x: number, y: number, z: number;
      if (reduceMotion) {
        x = to[j]; y = to[j + 1]; z = to[j + 2];
      } else {
        x = from[j] + (to[j] - from[j]) * e;
        y = from[j + 1] + (to[j + 1] - from[j + 1]) * e;
        z = from[j + 2] + (to[j + 2] - from[j + 2]) * e;
        // Swirl out and back through depth while morphing.
        z += Math.sin(e * Math.PI) * ARC * (hash[i] - 0.5) * 2 * (phase === 'morph' ? 1 : 0);
        // Gentle idle float.
        z += Math.sin(time * 0.8 + hash[i] * 6.283) * 0.025;
      }

      // Subtle cursor push in screen space.
      if (active && !reduceMotion) {
        const halfH = FOV_T * (CAM_Z - z);
        const sx = x / (halfH * aspect), sy = y / halfH;
        const ddx = sx - px, ddy = sy - py;
        const d = Math.hypot(ddx, ddy);
        if (d < RADIUS && d > 1e-4) {
          const fall = 1 - d / RADIUS;
          const f = fall * fall * PUSH;
          x += (ddx / d) * f;
          y += (ddy / d) * f;
        }
      }

      positions[j] = x; positions[j + 1] = y; positions[j + 2] = z;
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
    setTheme(color: string) { setColor(color); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      geo.dispose(); material.dispose(); renderer.dispose();
    },
  };
}
