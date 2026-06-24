import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Film grain + a breathing vignette in one pass. Doing it together means the
// per-pixel grain dithers the smooth gradient → no colour banding. Luminance
// based (white/black) so it adapts to both themes automatically.
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  void main() {
    float breathe = 0.7 + 0.3 * sin(uTime * 0.7);
    vec2 q = vUv; q.x = (q.x - 0.5) * uAspect + 0.5;  // keep the pools circular
    // faint light pool (upper-centre) — shows on dark themes
    float glow = smoothstep(0.62, 0.0, distance(q, vec2(0.5, 0.42))) * 0.05 * breathe;
    // edge darkening — shows on light themes
    float edge = smoothstep(0.5, 1.05, distance(q, vec2(0.5))) * 0.32 * breathe;
    // film grain (dithers the gradient)
    float t = floor(uTime * 24.0);
    float g = (hash(gl_FragCoord.xy + t * vec2(31.7, 13.1)) - 0.5) * 0.09;
    float v = glow - edge + g;
    vec3 col = v > 0.0 ? vec3(1.0) : vec3(0.0);
    gl_FragColor = vec4(col, clamp(abs(v), 0.0, 0.55));
  }
`;

export function createGrain(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const uniforms = { uTime: { value: 0 }, uAspect: { value: 1 } };
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

  let raf = 0, last = performance.now();
  function frame() {
    const now = performance.now();
    uniforms.uTime.value += (now - last) / 1000; last = now;
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
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      mesh.geometry.dispose(); material.dispose(); renderer.dispose();
    },
  };
}
