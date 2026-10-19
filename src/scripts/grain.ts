// Plain WebGL: one full-screen triangle pair and one fragment shader — no
// engine needed (three.js was 128KB gzipped for this).
const VERT = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
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
    float a = clamp(abs(v), 0.0, 0.55);
    gl_FragColor = vec4(col * a, a); // premultiplied, like the canvas expects
  }
`;

function program(gl: WebGLRenderingContext) {
  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  return prog;
}

/** null when there's no WebGL (or the shader won't build) — the page just goes without */
/** the grain over the whole viewport (the page's background), or inside `box`
 *  (the lab's demo of it): sizes, the lamp and the ripples follow that box */
export function createGrain(canvas: HTMLCanvasElement, box?: HTMLElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;
  let prog: WebGLProgram;
  try { prog = program(gl); } catch { return null; }
  gl.useProgram(prog);
  // two triangles covering clip space
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(prog, name);
  const uTime = u('uTime'), uAspect = u('uAspect'), uMouse = u('uMouse'), uMouseAmt = u('uMouseAmt'), uRipple = u('uRipple');

  // xy = origin (uv), z = age (s), w = strength — RIPPLES of them, flat
  const ripples = new Float32Array(RIPPLES * 4);
  const mouse = { x: 0.5, y: 0.5 };
  let time = 0, mouseAmt = 0;

  const area = () => (box ? box.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight });
  // a viewport point (CSS px) as uv inside the area
  const uv = (x: number, y: number) => { const a = area(); return { x: (x - a.left) / a.width, y: 1 - (y - a.top) / a.height }; };
  function resize() {
    const pr = Math.min(devicePixelRatio, 2), a = area();
    canvas.width = Math.max(1, Math.round(a.width * pr)); canvas.height = Math.max(1, Math.round(a.height * pr));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform1f(uAspect, a.width / Math.max(a.height, 1));
  }
  resize();
  const ro = box ? new ResizeObserver(resize) : null;
  if (ro && box) ro.observe(box); else addEventListener('resize', resize);

  // Pointer is eased toward its target (the lamp lags the cursor a little)
  // and its strength decays after ~1.6s without movement.
  const target = { x: 0.5, y: 0.5 }; let lastMove = -1e9; let nextRipple = 0;
  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    Object.assign(target, uv(e.clientX, e.clientY));
    lastMove = performance.now();
  }
  function onDown(e: PointerEvent) { ripple(e.clientX, e.clientY, 1); }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ripple(x: number, y: number, strength: number) {
    if (reduce) return;
    const p = uv(x, y);
    ripples.set([p.x, p.y, 0, strength], nextRipple * 4);
    nextRipple = (nextRipple + 1) % RIPPLES;
  }
  const events: EventTarget = box ?? window;
  events.addEventListener('pointermove', onMove as EventListener, { passive: true });
  events.addEventListener('pointerdown', onDown as EventListener, { passive: true });

  let raf = 0, last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    time += (now - last) / 1000; last = now;
    const k = 1 - Math.exp(-dt * 6);
    mouse.x += (target.x - mouse.x) * k; mouse.y += (target.y - mouse.y) * k;
    const want = now - lastMove < 1600 ? 1 : 0;
    mouseAmt += (want - mouseAmt) * (1 - Math.exp(-dt * (want ? 4 : 1.2)));
    for (let i = 0; i < RIPPLES; i++) {
      const o = i * 4;
      if (ripples[o + 3] > 0) { ripples[o + 2] += dt; if (ripples[o + 2] > 2.4) ripples[o + 3] = 0; }
    }
    gl!.uniform1f(uTime, time);
    gl!.uniform2f(uMouse, mouse.x, mouse.y);
    gl!.uniform1f(uMouseAmt, mouseAmt);
    gl!.uniform4fv(uRipple, ripples);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    raf = requestAnimationFrame(frame);
  }
  function onVis() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', onVis);

  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    /** a shockwave from a viewport point (CSS px) */
    ripple,
    /** points the lamp at a viewport point (CSS px), as if the pointer were there */
    lamp(x: number, y: number) { Object.assign(target, uv(x, y)); lastMove = performance.now(); },
    /** stops it for good: listeners, the frame loop and the GL context */
    dispose() {
      cancelAnimationFrame(raf); raf = 0;
      ro?.disconnect(); removeEventListener('resize', resize);
      events.removeEventListener('pointermove', onMove as EventListener);
      events.removeEventListener('pointerdown', onDown as EventListener);
      document.removeEventListener('visibilitychange', onVis);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
