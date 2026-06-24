import * as THREE from 'three';

const N = 55;
const EXT = 1.8;          // spread beyond the view (wraps around)
const RADIUS = 0.5;       // cursor influence reach (world units)
const IMPULSE = 0.05;     // push strength when repelled
const FRICTION = 0.94;    // velocity blend toward base drift → inertia + return

// Drifting ink/smoke: big soft faint sprites that wander; the cursor repels and
// accelerates nearby wisps, which keep momentum (inertia) and ease back to their
// usual drift speed.
export function createSmoke(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  const dpr = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.z = 1;

  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return t;
  })();

  const positions = new Float32Array(N * 3);
  const baseVel = new Float32Array(N * 2);
  const vel = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * EXT;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * EXT;
    const ang = Math.random() * 6.283, sp = 0.0008 + Math.random() * 0.0016;
    baseVel[i * 2] = Math.cos(ang) * sp; baseVel[i * 2 + 1] = Math.sin(ang) * sp;
    vel[i * 2] = baseVel[i * 2]; vel[i * 2 + 1] = baseVel[i * 2 + 1];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: tex, sizeAttenuation: false, transparent: true, opacity: 0.03, depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  let aspect = 1;
  function resize() {
    const w = innerWidth, h = innerHeight; aspect = w / Math.max(h, 1);
    renderer.setSize(w, h, false);
    camera.left = -aspect; camera.right = aspect; camera.updateProjectionMatrix();
    material.size = h * dpr * 0.4;   // big soft blobs (buffer px)
  }
  resize();
  addEventListener('resize', resize);

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

  let raf = 0, last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05) * 60; last = now;
    const pwx = px * aspect, pwy = py;

    for (let i = 0; i < N; i++) {
      const j = i * 3, k = i * 2;
      let vx = vel[k], vy = vel[k + 1];
      if (active) {
        const dx = positions[j] - pwx, dy = positions[j + 1] - pwy;
        const d = Math.hypot(dx, dy);
        if (d < RADIUS && d > 1e-3) {
          const f = (1 - d / RADIUS) / d;
          vx += dx * f * IMPULSE; vy += dy * f * IMPULSE;   // accelerate away
        }
      }
      // inertia: keep momentum, ease back toward the base drift speed
      vx = vx * FRICTION + baseVel[k] * (1 - FRICTION);
      vy = vy * FRICTION + baseVel[k + 1] * (1 - FRICTION);
      vel[k] = vx; vel[k + 1] = vy;

      let x = positions[j] + vx * dt, y = positions[j + 1] + vy * dt;
      if (x > EXT) x = -EXT; else if (x < -EXT) x = EXT;
      if (y > EXT) y = -EXT; else if (y < -EXT) y = EXT;
      positions[j] = x; positions[j + 1] = y;
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
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      geo.dispose(); material.dispose(); tex.dispose(); renderer.dispose();
    },
  };
}
