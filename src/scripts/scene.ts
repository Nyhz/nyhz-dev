import * as THREE from 'three';

const FOV = 45;
const FOV_T = Math.tan((FOV * Math.PI) / 180 / 2);
const CAM_Z = 5.5;
// Cursor influence: RADIUS is the reach around the pointer (in normalized-device
// units); PUSH is the max nudge in world units — kept small so particles react
// subtly rather than evacuating a hole.
const RADIUS = 1.2;
const PUSH = 0.05;

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.z = CAM_Z;

  // Particles distributed on an icosahedron surface.
  const geo = new THREE.IcosahedronGeometry(1.3, 12);
  const base = geo.attributes.position.array.slice() as unknown as Float32Array;
  const positions = new Float32Array(base);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const material = new THREE.PointsMaterial({ size: 0.024, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  // Pointer in normalized-device coords (-1..1), plus an active flag so the
  // form rests when the cursor leaves the canvas.
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

  let raf = 0;
  let t = 0;
  function frame() {
    t += 0.01;
    const theta = reduceMotion ? 0 : t * 0.12;
    points.rotation.y = theta;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const aspect = camera.aspect;

    for (let i = 0; i < positions.length; i += 3) {
      const bx = base[i], by = base[i + 1], bz = base[i + 2];
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t + bx * 2 + by * 2) * 0.03;

      let ox = 0, oy = 0, oz = 0;
      if (active) {
        // Where this particle sits on screen (project its rotated world pos).
        const wx = bx * cosT + bz * sinT;
        const wy = by;
        const wz = -bx * sinT + bz * cosT;
        const halfH = FOV_T * (CAM_Z - wz);
        const sx = wx / (halfH * aspect);
        const sy = wy / halfH;
        const ddx = sx - px, ddy = sy - py;
        const d = Math.hypot(ddx, ddy);
        if (d < RADIUS && d > 1e-4) {
          // Smooth falloff (eased) so the nudge fades gently toward the edge.
          const fall = 1 - d / RADIUS;
          const f = fall * fall * PUSH;
          const wdx = (ddx / d) * f, wdy = (ddy / d) * f;
          // Push outward in the screen plane, converted back to local space.
          ox = wdx * cosT;
          oy = wdy;
          oz = wdx * sinT;
        }
      }

      positions[i] = bx * breathe + ox;
      positions[i + 1] = by * breathe + oy;
      positions[i + 2] = bz * breathe + oz;
    }
    geo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    start() { if (!raf) raf = requestAnimationFrame(frame); },
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
