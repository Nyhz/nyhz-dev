import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uAmt;
  varying vec2 vUv;
  float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    float t = floor(uTime * 14.0);
    // subtle horizontal slice jitter (only a few bands, small shift)
    float band = floor(uv.y * 22.0);
    float r1 = rand(vec2(band, t));
    uv.x += (r1 - 0.5) * (0.012 + uAmt * 0.08) * step(0.72, r1);
    // occasional block tear
    float r2 = rand(vec2(floor(uv.x * 10.0), t * 1.3));
    if (r2 > 0.975) uv.y += (rand(vec2(t, band)) - 0.5) * 0.05 * (0.3 + uAmt);
    // chromatic split — kept moderate so the word stays legible
    float s = 0.003 + uAmt * 0.018;
    float cr = texture2D(uTex, uv + vec2(s, 0.0)).r;
    float cg = texture2D(uTex, uv).r;
    float cb = texture2D(uTex, uv - vec2(s, 0.0)).r;
    vec3 col = vec3(cr, cg, cb);
    float a = max(cr, max(cg, cb));
    // soft scanlines + faint flicker
    col *= 0.9 + 0.1 * sin(uv.y * 240.0);
    col *= 0.96 + 0.04 * rand(vec2(t, 1.0));
    gl_FragColor = vec4(col, a);
  }
`;

// WebGL kinetic glitch rendering of a word. uAmt (0..~1.5) scales the chaos.
export function createGlitchName(canvas: HTMLCanvasElement, text: string) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.z = 1;

  // Render the word to a texture.
  const TW = 1024, TH = 256;
  const tc = document.createElement('canvas');
  tc.width = TW; tc.height = TH;
  const ctx = tc.getContext('2d')!;
  ctx.clearRect(0, 0, TW, TH);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = 220;
  const FONT = (n: number) => `700 ${n}px ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.font = FONT(fs);
  while (ctx.measureText(text).width > TW * 0.86 && fs > 30) { fs -= 8; ctx.font = FONT(fs); }
  ctx.fillText(text, TW / 2, TH / 2);

  const tex = new THREE.CanvasTexture(tc);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const uniforms = {
    uTex: { value: tex },
    uTime: { value: 0 },
    uAmt: { value: 0.18 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, TH / TW), material);
  scene.add(mesh);

  function resize() {
    const w = innerWidth, h = innerHeight, a = w / Math.max(h, 1);
    renderer.setSize(w, h, false);
    camera.left = -a; camera.right = a; camera.top = 1; camera.bottom = -1;
    camera.updateProjectionMatrix();
    const wp = Math.min(2.3, a * 1.7);   // keep the word from overflowing narrow screens
    mesh.scale.setScalar(wp);
  }
  resize();
  addEventListener('resize', resize);

  let last = performance.now(), raf = 0;
  function frame() {
    const now = performance.now();
    uniforms.uTime.value += Math.min((now - last) / 1000, 0.05); last = now;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    setAmt(v: number) { uniforms.uAmt.value = v; },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      mesh.geometry.dispose(); material.dispose(); tex.dispose(); renderer.dispose();
    },
  };
}
