(function () {
  "use strict";

  const MAX_THREADS = 24;
  const MAX_COLORS = 6;

  const vertexSource = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;
uniform float uCount;
uniform float uFrequency;
uniform float uSpread;
uniform float uTaper;
uniform float uPosition;
uniform float uPinch;
uniform float uNodes;
uniform float uAngle;
uniform float uGlow;
uniform float uFalloff;
uniform float uThickness;
uniform float uBrightness;
uniform float uOpacity;
uniform float uDepth;
uniform float uPulses;
uniform float uFade;
uniform float uMirror;
uniform float uShimmer;
uniform float uGrain;
uniform float uMouseActive;
uniform float uMouseStrength;
uniform float uIntro;
uniform float uLightMode;
uniform float uPulseX;
uniform float uPulseTime;
uniform float uPulseActive;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform vec3 uCore;
uniform vec3 uBackground;
uniform float uOpaque;
out vec4 outColor;
const float PI = 3.14159265;
const float TAU = 6.28318530;

vec3 palette(float value) {
  if (uColorCount <= 1) return uColors[0];
  float scaled = clamp(value, 0.0, 1.0) * float(uColorCount - 1);
  int index = int(min(floor(scaled), float(uColorCount - 2)));
  return mix(uColors[index], uColors[index + 1], scaled - float(index));
}

vec2 toThreadSpace(vec2 point) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 q = (point - 0.5) * vec2(aspect, 1.0);
  float cosine = cos(uAngle);
  float sine = sin(uAngle);
  q = vec2(q.x * cosine + q.y * sine, -q.x * sine + q.y * cosine);
  return vec2(q.x / aspect, q.y) + 0.5;
}

float lineY(float x, float index) {
  float dx = x - uPinch;
  float envelope = uSpread * abs(dx);
  if (uNodes > 1.0) {
    envelope = uSpread * 0.5 * abs(cos(PI * uNodes * (dx + 0.5)));
  }
  float lane = uNodes <= 1.0 ? dx : (dx + 0.5) * uNodes - 0.5;
  float side = uMirror > 0.5 && mod(floor(lane), 2.0) < 0.5 ? -1.0 : 1.0;
  float shimmer = uShimmer > 0.5 ? sin(uTime * 1.7 + index * 1.3) * 0.35 : 0.0;
  float phase = uTime * 0.35 + index * TAU / max(uCount, 1.0) + shimmer;
  float wave = sin(x * uFrequency + phase * side);
  return uPosition - envelope * (1.0 + index * uTaper) * wave;
}

float hash(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 point = toThreadSpace(uv);
  float x = point.x;
  float y = point.y;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float timeSinceClick = uTime - uPulseTime;
  float pulseProgress = clamp(timeSinceClick / 1.4, 0.0, 1.0);
  float pulseHead = mix(uPulseX, uPinch, pulseProgress * pulseProgress * (3.0 - 2.0 * pulseProgress));
  vec2 mouse = toThreadSpace(uMouse);
  vec3 color = vec3(0.0);
  float energy = 0.0;
  float weight = 0.0;

  for (int i = 0; i < ${MAX_THREADS}; i++) {
    if (float(i) >= uCount) break;
    float index = float(i);
    float lane = lineY(x, index);
    float slope = (lineY(x + 0.001, index) - lineY(x - 0.001, index)) * 500.0;
    float distancePx = abs(y - lane) * uResolution.y / sqrt(1.0 + slope * slope / (aspect * aspect));
    float phase = x * uFrequency + uTime * 0.35 + index * TAU / max(uCount, 1.0);
    float depthValue = 0.5 + 0.5 * cos(phase);
    float depthFactor = mix(1.0, 0.3 + 0.7 * depthValue, uDepth);
    float width = max(0.5, uThickness * mix(1.0, 0.55 + 0.7 * depthValue, uDepth));
    float stroke = exp(-distancePx / width);
    float halo = uGlow / pow(max(distancePx / width, 0.35), max(uFalloff, 0.05));
    halo *= exp(-distancePx / (width * 9.0 + 1.0));
    float focusDistance = abs(mouse.y - lineY(mouse.x, index));
    float focus = uMouseActive * (1.0 - smoothstep(0.012, 0.075, focusDistance));
    float reveal = uIntro > 0.5 ? smoothstep(index * 0.065, index * 0.065 + 0.9, uTime) : 1.0;
    float pulseDistance = abs((x - pulseHead) * aspect);
    float pulse = uPulseActive * (1.0 - smoothstep(0.0, 0.11, pulseDistance)) *
      sin(PI * pulseProgress) * step(0.0, timeSinceClick) * (1.0 - step(1.4, timeSinceClick));
    float travellingPulse = uPulses * pow(0.5 + 0.5 * sin(abs(x - uPinch) * 16.0 + uTime * 2.2 + index * 1.9), 24.0);
    float strand = (stroke + halo) * reveal * depthFactor;
    strand *= 1.0 + focus * uMouseStrength * 1.6 + pulse * 1.8 + travellingPulse * 5.0 * stroke;
    vec3 tint = mix(palette(index / max(uCount - 1.0, 1.0)), uCore, focus * 0.28 + pulse * 0.5);
    color += tint * strand;
    energy += strand;
    weight += strand;
  }

  float core = exp(-abs(x - uPinch) * 55.0 - abs(y - uPosition) * 70.0);
  color = mix(color, uCore * max(energy, 0.35), min(core * 0.62, 0.8));
  energy += core * 0.28;
  float edge = min(x, 1.0 - x);
  float fade = uFade > 0.0 ? smoothstep(0.0, max(uFade * 0.5, 0.001), edge) : 1.0;
  float noise = (hash(gl_FragCoord.xy + fract(uTime) * 97.0) - 0.5) * uGrain;
  float alpha = clamp(energy * uBrightness * fade * uOpacity * (1.0 + noise), 0.0, 0.92);
  vec3 tint = weight > 0.0001 ? color / max(energy, 0.0001) : palette(0.5);

  if (uLightMode > 0.5) {
    alpha = clamp(energy * fade * uOpacity, 0.0, 0.95);
    tint = weight > 0.0001 ? color / max(weight, 0.0001) : palette(0.5);
  }
  if (uOpaque > 0.5) {
    outColor = vec4(mix(uBackground, tint, alpha), 1.0);
  } else {
    outColor = vec4(tint * alpha, alpha);
  }
}`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let colorProbe = null;
  function parseColor(value, fallback) {
    const text = String(value);
    if (text === "transparent") return fallback;
    if (!colorProbe) colorProbe = document.createElement("canvas").getContext("2d");
    if (!colorProbe) return fallback;
    colorProbe.fillStyle = "#000000";
    colorProbe.fillStyle = text;
    const normalized = colorProbe.fillStyle;
    if (normalized.startsWith("#")) {
      let hex = normalized.slice(1);
      if (hex.length === 3) hex = hex.split("").map((part) => part + part).join("");
      if (hex.length === 6) return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    }
    const match = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(normalized);
    if (!match || (match[4] !== undefined && Number(match[4]) === 0)) return fallback;
    return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("WebThreads shader compilation failed:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function mount(container, options) {
    if (!container) throw new Error("WebThreads needs a container element.");
    const props = Object.assign({
      colors: ["#5227FF", "#FF9FFC"],
      coreColor: "#FFFFFF",
      backgroundColor: "transparent",
      lightMode: false,
      threadCount: 6,
      speed: 0.2,
      frequency: 5,
      spread: 0.18,
      taper: 1,
      position: 0.5,
      pinch: 0.5,
      nodes: 1,
      angle: 0,
      glow: 0.18,
      falloff: 0.6,
      thickness: 1.15,
      brightness: 0.85,
      opacity: 0.85,
      depth: 0,
      pulses: 0,
      fade: 0.35,
      mirror: true,
      shimmer: false,
      grain: 0.025,
      intro: true,
      mouseInteraction: true,
      mouseStrength: 0.5,
      pulseOnClick: true,
      paused: false,
      dpr: 1.6
    }, options || {});
    props.threadCount = clamp(Math.round(props.threadCount), 1, MAX_THREADS);
    props.nodes = clamp(Math.round(props.nodes), 1, 6);
    props.colors = (Array.isArray(props.colors) ? props.colors : []).slice(0, MAX_COLORS);
    if (!props.colors.length) props.colors = ["#5227FF", "#FF9FFC"];
    const originalStyle = container.getAttribute("style");
    const hadFallback = container.classList.contains("fallback");
    const addedClasses = String(props.className || "").split(/\s+/).filter((name) => name && !container.classList.contains(name));
    addedClasses.forEach((name) => container.classList.add(name));
    if (props.style && typeof props.style === "object") Object.assign(container.style, props.style);
    function restoreContainer() {
      addedClasses.forEach((name) => container.classList.remove(name));
      if (hadFallback) container.classList.add("fallback");
      else container.classList.remove("fallback");
      if (originalStyle === null) container.removeAttribute("style");
      else container.setAttribute("style", originalStyle);
    }

    const canvas = document.createElement("canvas");
    canvas.className = "web-threads-canvas";
    container.appendChild(canvas);
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "low-power"
    });
    if (!gl) {
      container.classList.add("fallback");
      canvas.remove();
      console.warn("WebThreads is unavailable because WebGL 2 is not supported.");
      return restoreContainer;
    }

    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (program) gl.deleteProgram(program);
      container.classList.add("fallback");
      canvas.remove();
      console.error("WebThreads could not create its WebGL program.");
      return restoreContainer;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("WebThreads program linking failed:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      container.classList.add("fallback");
      canvas.remove();
      return restoreContainer;
    }

    const uniforms = {};
    [
      "uResolution", "uMouse", "uTime", "uCount", "uFrequency", "uSpread", "uTaper",
      "uPosition", "uPinch", "uNodes", "uAngle", "uGlow", "uFalloff", "uThickness", "uBrightness",
      "uOpacity", "uDepth", "uPulses", "uFade", "uMirror", "uShimmer", "uGrain", "uMouseActive", "uMouseStrength", "uIntro",
      "uLightMode", "uPulseX", "uPulseTime", "uPulseActive", "uColors", "uColorCount",
      "uCore", "uBackground", "uOpaque"
    ].forEach((name) => { uniforms[name] = gl.getUniformLocation(program, name); });

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const colors = new Float32Array(MAX_COLORS * 3);
    const palette = props.colors.map((color) => parseColor(color, [1, 1, 1]));
    palette.forEach((color, index) => colors.set(color, index * 3));
    const core = parseColor(props.coreColor, [1, 1, 1]);
    const background = props.backgroundColor === "transparent" ? null : parseColor(props.backgroundColor, [0, 0, 0]);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      width: 1, height: 1, time: 0, last: 0, start: 0, raf: 0, visible: false,
      pointer: [0.5, 0.5], inside: false, pulseX: 0.5, pulseTime: -10, pulseActive: false,
      destroyed: false, staticDrawn: false
    };

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, Math.max(0.5, props.dpr));
      const width = Math.max(1, Math.round(container.clientWidth * ratio));
      const height = Math.max(1, Math.round(container.clientHeight * ratio));
      if (width === state.width && height === state.height) return false;
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
      return true;
    }

    function draw(now) {
      if (state.destroyed) return;
      const reduce = reducedMotion.matches;
      const dt = state.last ? Math.min((now - state.last) / 1000, 0.1) : 1 / 60;
      state.last = now;
      if (!props.paused && !reduce) state.time += dt * Math.max(0, props.speed);
      if (reduce && props.intro) state.time = 10;

      resize();
      gl.viewport(0, 0, state.width, state.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.uResolution, state.width, state.height);
      gl.uniform2f(uniforms.uMouse, state.pointer[0], state.pointer[1]);
      gl.uniform1f(uniforms.uTime, state.time);
      gl.uniform1f(uniforms.uCount, props.threadCount);
      gl.uniform1f(uniforms.uFrequency, Math.max(0.1, props.frequency));
      gl.uniform1f(uniforms.uSpread, Math.max(0, props.spread));
      gl.uniform1f(uniforms.uTaper, Math.max(0, props.taper));
      gl.uniform1f(uniforms.uPosition, clamp(props.position, 0, 1));
      gl.uniform1f(uniforms.uPinch, clamp(props.pinch, 0, 1));
      gl.uniform1f(uniforms.uNodes, props.nodes);
      gl.uniform1f(uniforms.uAngle, (props.angle * Math.PI) / 180);
      gl.uniform1f(uniforms.uGlow, Math.max(0, props.glow));
      gl.uniform1f(uniforms.uFalloff, Math.max(0.05, props.falloff));
      gl.uniform1f(uniforms.uThickness, Math.max(0.2, props.thickness));
      gl.uniform1f(uniforms.uBrightness, Math.max(0, props.brightness));
      gl.uniform1f(uniforms.uOpacity, clamp(props.opacity, 0, 1));
      gl.uniform1f(uniforms.uDepth, clamp(props.depth, 0, 1));
      gl.uniform1f(uniforms.uPulses, Math.max(0, props.pulses));
      gl.uniform1f(uniforms.uFade, clamp(props.fade, 0, 1));
      gl.uniform1f(uniforms.uMirror, props.mirror ? 1 : 0);
      gl.uniform1f(uniforms.uShimmer, props.shimmer ? 1 : 0);
      const grain = typeof props.grain === "number" ? Math.max(0, props.grain) : props.grain ? 0.05 : 0;
      gl.uniform1f(uniforms.uGrain, grain);
      gl.uniform1f(uniforms.uMouseActive, props.mouseInteraction && state.inside && !reduce ? 1 : 0);
      gl.uniform1f(uniforms.uMouseStrength, clamp(props.mouseStrength, 0, 1));
      gl.uniform1f(uniforms.uIntro, props.intro ? 1 : 0);
      gl.uniform1f(uniforms.uLightMode, props.lightMode ? 1 : 0);
      gl.uniform1f(uniforms.uPulseX, state.pulseX);
      gl.uniform1f(uniforms.uPulseTime, state.pulseTime);
      gl.uniform1f(uniforms.uPulseActive, props.pulseOnClick && !reduce && state.pulseActive ? 1 : 0);
      gl.uniform3fv(uniforms.uColors, colors);
      gl.uniform1i(uniforms.uColorCount, palette.length);
      gl.uniform3fv(uniforms.uCore, core);
      gl.uniform3fv(uniforms.uBackground, background || [0, 0, 0]);
      gl.uniform1f(uniforms.uOpaque, background ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      state.staticDrawn = true;
    }

    function frame(now) {
      state.raf = 0;
      if (state.destroyed || !state.visible || document.hidden) return;
      draw(now);
      if (!props.paused && !reducedMotion.matches) state.raf = requestAnimationFrame(frame);
    }

    function start() {
      if (state.destroyed || !state.visible || state.raf) return;
      if (reducedMotion.matches || props.paused) {
        draw(performance.now());
        return;
      }
      state.raf = requestAnimationFrame(frame);
    }

    function pointerMove(event) {
      const rect = container.getBoundingClientRect();
      state.inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (state.inside) {
        state.pointer = [(event.clientX - rect.left) / Math.max(rect.width, 1),
          1 - (event.clientY - rect.top) / Math.max(rect.height, 1)];
        if (!state.raf && state.visible) draw(performance.now());
      }
    }

    function pointerLeave() {
      state.inside = false;
      if (!state.raf && state.visible) draw(performance.now());
    }

    function pointerDown(event) {
      if (!props.pulseOnClick || event.button !== 0 || reducedMotion.matches ||
        (event.target instanceof Element && event.target.closest("a, button, input, select, textarea"))) return;
      const rect = container.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) return;
      state.pulseX = (event.clientX - rect.left) / Math.max(rect.width, 1);
      state.pulseTime = state.time;
      state.pulseActive = true;
      start();
    }

    const intersection = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
        state.visible = entries.some((entry) => entry.isIntersecting);
        if (state.visible) start();
        else if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      })
      : null;
    if (intersection) intersection.observe(container);
    else state.visible = true;

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(() => {
      if (state.visible && !state.raf) draw(performance.now());
    }) : null;
    if (resizeObserver) resizeObserver.observe(container);
    else window.addEventListener("resize", start);

    const visibilityChange = () => {
      if (document.hidden && state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      else if (!document.hidden) start();
    };
    const motionChange = () => {
      if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      if (state.visible) start();
    };
    const contextLost = (event) => {
      event.preventDefault();
      state.destroyed = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      container.classList.add("fallback");
      console.warn("WebThreads stopped because the WebGL context was lost.");
    };

    document.addEventListener("visibilitychange", visibilityChange);
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerdown", pointerDown);
    container.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("webglcontextlost", contextLost, false);
    if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", motionChange);
    else if (reducedMotion.addListener) reducedMotion.addListener(motionChange);
    if (!intersection) start();

    return function destroy() {
      state.destroyed = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      if (intersection) { intersection.unobserve(container); intersection.disconnect(); }
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", start);
      document.removeEventListener("visibilitychange", visibilityChange);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
      container.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      if (reducedMotion.removeEventListener) reducedMotion.removeEventListener("change", motionChange);
      else if (reducedMotion.removeListener) reducedMotion.removeListener(motionChange);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      canvas.remove();
      restoreContainer();
    };
  }

  window.WebThreads = { mount };
  const hero = document.getElementById("heroThreads");
  if (hero) {
    mount(hero, {
      colors: ["#5227FF", "#4FA7FF", "#FF9FFC"],
      coreColor: "#FFFFFF",
      threadCount: 7,
      spread: 0.2,
      position: 0.54,
      pinch: 0.51,
      glow: 0.14,
      brightness: 0.7,
      opacity: 0.74,
      fade: 0.25,
      intro: false,
      mouseStrength: 0.55
    });
  }
})();
