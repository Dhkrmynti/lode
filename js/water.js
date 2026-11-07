// Living water for the LODE hero: a WebGL pass over the rendered still.
// Below the horizon the reflection ripples with perspective, glints sparkle, the cursor
// leaves rings, and the gold vein breathes. Falls back to the plain <img> without WebGL.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// HORIZON: horizon height in the render, as a fraction from the top.
const makeFrag = (HORIZON) => `
precision highp float;
uniform sampler2D uTex, uVid;
uniform vec4 uRect;      // video window in texture uv: x0, y0, x1, y1
uniform float uHasVid;
uniform vec2 uRes, uImg, uPos, uMouse;
uniform float uTime, uMouseT, uDpr;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// The still render, with the animated window (floating ore) laid over it and feathered at the edges.
vec3 scene(vec2 p) {
  vec3 c = texture2D(uTex, p).rgb;
  if (uHasVid > 0.5) {
    vec2 r = (p - uRect.xy) / (uRect.zw - uRect.xy);
    if (r.x > 0.0 && r.x < 1.0 && r.y > 0.0 && r.y < 1.0) {
      float e = smoothstep(0.0, 0.05, r.x) * smoothstep(0.0, 0.05, 1.0 - r.x) * smoothstep(0.0, 0.08, r.y) * smoothstep(0.0, 0.08, 1.0 - r.y);
      c = mix(c, texture2D(uVid, r).rgb, e);
    }
  }
  return c;
}

void main() {
  // object-fit: cover with an object-position, in texture space (v = 0 at the top)
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float scale = max(uRes.x / uImg.x, uRes.y / uImg.y);
  vec2 size = uImg * scale;
  vec2 offset = (uRes - size) * uPos;
  vec2 uv = (frag - offset) / size;

  float t = uTime;
  float water = smoothstep(${HORIZON.toFixed(3)}, ${(HORIZON + 0.012).toFixed(3)}, uv.y);
  float depth = max(uv.y - ${HORIZON.toFixed(3)}, 0.0) / ${(1 - HORIZON).toFixed(3)}; // 0 at horizon, 1 at the bottom
  float persp = 1.0 / (depth + 0.06);                                     // ripples crowd toward the horizon

  // layered swell: long slow bands + finer chop, both squashed by perspective
  vec2 q = vec2(uv.x * 3.0, depth * persp * 0.9);
  float swell = sin(q.y * 9.0 - t * 1.25 + noise(q * vec2(2.0, 1.0) + t * 0.15) * 4.0);
  float chop = noise(vec2(uv.x * 22.0, q.y * 6.0 - t * 1.7)) - 0.5;
  float amp = mix(0.0022, 0.017, depth);
  vec2 d = vec2(chop * amp * 0.6, (swell * 0.65 + chop) * amp);

  // cursor rings on the water
  vec2 m = uMouse; float aspect = uRes.x / uRes.y;
  vec2 dm = (uv - m) * vec2(aspect, 1.0 / max(0.25, 1.0 - depth * 0.5) * 2.2);
  float dist = length(dm);
  float ring = sin(dist * 90.0 - uMouseT * 7.0) * exp(-dist * 7.0) * exp(-uMouseT * 0.7);
  d.y += ring * 0.010 * step(${HORIZON.toFixed(3)}, m.y);

  vec3 col = scene(clamp(uv + d * water, 0.001, 0.999));

  // glints: tiny bright streaks that come and go on the surface
  float g = noise(vec2(uv.x * 26.0 + sin(t * 0.3) * 0.5, depth * persp * 46.0 - t * 1.8)) * noise(vec2(uv.x * 9.0 - t * 0.2, depth * persp * 12.0));
  float glint = smoothstep(0.42, 0.62, g) * water * (0.3 + 0.7 * (1.0 - depth));
  vec3 sky = texture2D(uTex, vec2(uv.x, ${(HORIZON - 0.03).toFixed(3)})).rgb;
  col += sky * glint * 0.45;

  // gentle darkening toward the bottom edge of the water
  col *= 1.0 - water * depth * 0.18;

  // the vein breathes: warm, bright pixels pulse like embers (also in the reflection)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float warm = smoothstep(0.55, 0.9, lum) * smoothstep(0.08, 0.25, col.r - col.b);
  float pulse = 0.5 + 0.5 * sin(t * 1.6) * 0.6 + 0.4 * sin(t * 3.7 + 1.3) * 0.5;
  col += col * warm * (pulse * 0.35);

  gl_FragColor = vec4(col, 1.0);
}`;

export function startWater(img, { horizon = 0.704, video = null, rect = null } = {}) {
  if (!img || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, makeFrag(horizon)));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { vid: U('uVid'), rect: U('uRect'), hasVid: U('uHasVid'), tex: U('uTex'), res: U('uRes'), img: U('uImg'), pos: U('uPos'), mouse: U('uMouse'), time: U('uTime'), mouseT: U('uMouseT'), dpr: U('uDpr') };

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // optional animated window: a looping <video> covering rect = [x0, x1, y0, y1] of the still
  let vtex = null, vReady = false, lastVT = -1;
  if (video && rect) {
    vtex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, vtex);
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.activeTexture(gl.TEXTURE0);
    video.muted = true; video.loop = true; video.playsInline = true;
    video.play().catch(() => {});
  }
  const updateVideo = () => {
    if (!vtex || video.readyState < 2 || video.currentTime === lastVT) return;
    lastVT = video.currentTime;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, vtex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.activeTexture(gl.TEXTURE0);
    vReady = true;
  };

  const [posX, posY] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
  let dpr = Math.min(devicePixelRatio || 1, 1.5);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  let mouse = [0.5, 0.0], lastMove = -100, running = false, visible = true, raf = 0;
  const t0 = performance.now();
  const frame = (now) => {
    raf = 0;
    if (!running || !visible) return;
    const t = (now - t0) / 1000;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform2f(u.img, img.naturalWidth, img.naturalHeight);
    gl.uniform2f(u.pos, posX, posY);
    gl.uniform2f(u.mouse, mouse[0], mouse[1]);
    gl.uniform1f(u.time, t);
    gl.uniform1f(u.mouseT, t - lastMove);
    gl.uniform1f(u.dpr, dpr);
    updateVideo();
    gl.uniform1f(u.hasVid, vReady ? 1 : 0);
    if (rect) gl.uniform4f(u.rect, rect[0], rect[2], rect[1], rect[3]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && running && visible) raf = requestAnimationFrame(frame); };

  const begin = () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.uniform1i(u.tex, 0);
    gl.uniform1i(u.vid, 1);
    img.after(canvas);
    resize();
    running = true;
    canvas.classList.add('on');
    kick();
  };
  if (img.complete && img.naturalWidth) begin(); else img.addEventListener('load', begin, { once: true });

  addEventListener('resize', resize);
  // map the pointer into texture space (same cover math as the shader)
  const hero = img.closest('.hero, .cta-band') || document.body;
  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const W = r.width, H = r.height, s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = img.naturalWidth * s, shh = img.naturalHeight * s;
    const ox = (W - sw) * posX, oy = (H - shh) * posY;
    const nx = (e.clientX - r.left - ox) / sw, ny = (e.clientY - r.top - oy) / shh;
    const moved = Math.hypot(nx - mouse[0], ny - mouse[1]) > 0.02;
    mouse = [nx, ny];
    if (moved) lastMove = (performance.now() - t0) / 1000;
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(hero);
  return canvas;
}
