import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Fine film grain: per-pixel hash noise reseeded ~24×/sec so it flickers like
// film. Light AND dark specks (over the page bg), very faint. Theme-tinted.
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  void main() {
    float t = floor(uTime * 24.0);
    float n = hash(gl_FragCoord.xy + t * vec2(31.7, 13.1));
    vec3 col = n > 0.5 ? uColor : vec3(0.0);
    gl_FragColor = vec4(col, abs(n - 0.5) * 0.10);
  }
`;

export function createGrain(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#f1efe9') } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);
  const camera = new THREE.Camera();

  function resize() { renderer.setSize(innerWidth, innerHeight, false); }
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
    setTheme(c: string) { uniforms.uColor.value.set(c); },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      mesh.geometry.dispose(); material.dispose(); renderer.dispose();
    },
  };
}
