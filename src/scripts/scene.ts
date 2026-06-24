import * as THREE from 'three';
import { repel, type Vec3 } from './displace';

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4;

  // Particles distributed on an icosahedron surface.
  const geo = new THREE.IcosahedronGeometry(1.3, 12);
  const base = geo.attributes.position.array.slice() as unknown as Float32Array;
  const positions = new Float32Array(base);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const material = new THREE.PointsMaterial({ size: 0.02, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  const pointer: Vec3 = [100, 100, 100];
  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    pointer[0] = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer[1] = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer[2] = 0;
  }
  function onLeave() { pointer[0] = pointer[1] = pointer[2] = 100; }
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
    if (!reduceMotion) points.rotation.y = t * 0.15;
    for (let i = 0; i < positions.length; i += 3) {
      const bx = base[i], by = base[i + 1], bz = base[i + 2];
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t + bx * 2 + by * 2) * 0.03;
      const [ox, oy, oz] = repel([bx, by, bz], pointer, 0.7, 0.5);
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
    start() { raf = requestAnimationFrame(frame); },
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
