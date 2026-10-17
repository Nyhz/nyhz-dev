import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Film grain + a breathing vignette in one pass. Doing it together means the
// per-pixel grain dithers the smooth gradient → no colour banding. Luminance
// based (white/black) so it adapts to both themes automatically.
//
// Time inputs are WRAPPED before they reach sin()/the hash. uTime grows without
// bound, and a real GPU's hardware sin() loses precision badly for large
// arguments — so the classic fract(sin(dot())) hash collapsed to a flat value
// after ~15s (grain + glow vanished, vignette stayed). Fix: a sin-free hash
// that stays well-conditioned, fed a bounded frame counter; and a breath clock
// wrapped to its exact period so it never drifts into the imprecise range.
const RIPPLES = 4;
const FRAG = `
  #define RIPPLES ${RIPPLES}
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uMouse;      // pointer, in uv (y up)
  uniform float uMouseAmt;  // 0..1 — fades out when the pointer is idle / gone
  uniform vec4 uRipple[RIPPLES]; // xy = origin (uv), z = age (s), w = strength
  // sin-free hash — well-conditioned for large coords (unlike fract(sin(dot())))
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  void main() {
    float bt = mod(uTime, 8.975979);  // 2*PI/0.7 — wrap the breath, sin() stays precise
    float breathe = 0.7 + 0.3 * sin(bt * 0.7);
    vec2 q = vUv; q.x = (q.x - 0.5) * uAspect + 0.5;  // keep the pools circular
    // faint light pool (upper-centre) — shows on dark themes
    float glow = smoothstep(0.62, 0.0, distance(q, vec2(0.5, 0.42))) * 0.05 * breathe;
    // edge darkening — shows on light themes
    float edge = smoothstep(0.5, 1.05, distance(q, vec2(0.5))) * 0.32 * breathe;
    // film grain (dithers the gradient) — frame counter wrapped so the hash
    // input never grows large (cycles every 64/24 ≈ 2.7s, invisible for noise)
    float t = mod(floor(uTime * 24.0), 64.0);
    float n = hash(gl_FragCoord.xy + t * vec2(31.7, 13.1)) - 0.5;
    // pointer lamp — a soft pool of light that trails the cursor
    vec2 m = uMouse; m.x = (m.x - 0.5) * uAspect + 0.5;
    float lamp = smoothstep(0.34, 0.0, distance(q, m)) * 0.055 * uMouseAmt;
    // click shockwaves — an expanding ring of brighter static that dies out
    float ring = 0.0;
    for (int i = 0; i < RIPPLES; i++) {
      vec4 r = uRipple[i];
      if (r.w <= 0.0) continue;
      vec2 o = r.xy; o.x = (o.x - 0.5) * uAspect + 0.5;
      float d = distance(q, o) - r.z * 0.55;
      float fade = exp(-r.z * 2.6) * r.w;
      ring += smoothstep(0.045, 0.0, abs(d)) * fade;
    }
    float g = n * (0.09 + ring * 0.4);
    float v = glow + lamp + ring * 0.07 - edge + g;
    vec3 col = v > 0.0 ? vec3(1.0) : vec3(0.0);
    gl_FragColor = vec4(col, clamp(abs(v), 0.0, 0.55));
  }
`;

export function createGrain(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const ripples = Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0));
  const uniforms = {
    uTime: { value: 0 }, uAspect: { value: 1 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uMouseAmt: { value: 0 },
    uRipple: { value: ripples },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);
  const camera = new THREE.Camera();

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    uniforms.uAspect.value = innerWidth / Math.max(innerHeight, 1);
  }
  resize();
  addEventListener('resize', resize);

  // Pointer is eased toward its target (the lamp lags the cursor a little)
  // and its strength decays after ~1.6s without movement.
  const target = { x: 0.5, y: 0.5 }; let lastMove = -1e9; let nextRipple = 0;
  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    target.x = e.clientX / innerWidth; target.y = 1 - e.clientY / innerHeight;
    lastMove = performance.now();
  }
  function onDown(e: PointerEvent) { ripple(e.clientX, e.clientY, 1); }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ripple(x: number, y: number, strength: number) {
    if (reduce) return;
    ripples[nextRipple].set(x / innerWidth, 1 - y / innerHeight, 0, strength);
    nextRipple = (nextRipple + 1) % RIPPLES;
  }
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });

  let raf = 0, last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    uniforms.uTime.value += (now - last) / 1000; last = now;
    const mouse = uniforms.uMouse.value, k = 1 - Math.exp(-dt * 6);
    mouse.x += (target.x - mouse.x) * k; mouse.y += (target.y - mouse.y) * k;
    const want = now - lastMove < 1600 ? 1 : 0;
    uniforms.uMouseAmt.value += (want - uniforms.uMouseAmt.value) * (1 - Math.exp(-dt * (want ? 4 : 1.2)));
    for (const r of ripples) if (r.w > 0) { r.z += dt; if (r.z > 2.4) r.w = 0; }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function onVis() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', onVis);

  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    setTheme(_c: string) { /* luminance-based, theme-agnostic */ },
    /** a shockwave from a viewport point (CSS px) */
    ripple,
    /** points the lamp at a viewport point (CSS px), as if the pointer were there */
    lamp(x: number, y: number) { target.x = x / innerWidth; target.y = 1 - y / innerHeight; lastMove = performance.now(); },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVis);
      mesh.geometry.dispose(); material.dispose(); renderer.dispose();
    },
  };
}
