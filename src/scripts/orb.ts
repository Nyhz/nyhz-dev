import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// A shaded sphere that morphs between a moon (lit crescent) and a sun (full disk
// + corona rays). uMix: 0 = moon, 1 = sun. uRot spins the light during the morph.
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uMix;
  uniform float uTime;
  uniform float uRot;
  uniform vec3 uColor;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float R = 0.42;
    float aa = 0.018;
    float disk = smoothstep(R + aa, R - aa, r);
    float z = sqrt(max(0.0, R * R - r * r));
    vec3 n = normalize(vec3(p, z + 0.0001));

    // light dir (rotates with the morph + a gentle idle sway → feels alive/3D)
    float a = uRot + sin(uTime * 0.4) * 0.15;
    vec3 L = normalize(vec3(cos(a) * 0.7, 0.45, 0.55));
    float diff = clamp(dot(n, L), 0.0, 1.0);

    // MOON: smoothly shaded ball (curved terminator) + specular sheen + soft halo
    float shade = smoothstep(0.04, 0.9, diff);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(clamp(dot(n, H), 0.0, 1.0), 30.0) * 0.95;
    float halo = smoothstep(R + 0.16, R, r) * (1.0 - disk) * 0.22;
    float moon = disk * (shade * 0.92 + spec) + halo;

    // SUN: bright core + animated corona rays + bloom
    float ang = atan(p.y, p.x);
    float core = disk * (0.72 + 0.28 * z / R);
    float ray = pow(0.5 + 0.5 * sin(ang * 12.0 + uTime * 0.9), 2.0);
    float corona = smoothstep(R + 0.46, R, r) * (1.0 - disk) * (0.22 + 0.6 * ray);
    float bloom = smoothstep(R + 0.5, R, r) * (1.0 - disk) * 0.3;
    float sun = core + corona + bloom;

    float v = clamp(mix(moon, sun, uMix), 0.0, 1.0);
    gl_FragColor = vec4(uColor, v);
  }
`;

export function createOrb(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    uRot: { value: 0 },
    uColor: { value: new THREE.Color('#f1efe9') },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);
  const camera = new THREE.Camera();

  function resize() {
    const s = canvas.clientWidth || 48;
    renderer.setSize(s, s, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let raf = 0, last = performance.now();
  function frame() {
    const now = performance.now();
    uniforms.uTime.value += (now - last) / 1000; last = now;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  return {
    uniforms,
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    setColor(c: string) { uniforms.uColor.value.set(c); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      mesh.geometry.dispose(); material.dispose(); renderer.dispose();
    },
  };
}
