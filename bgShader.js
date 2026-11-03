(function() {

  // ============================================================
  // Based on "Topo lines" by yuriy_shulga
  // https://www.shadertoy.com/view/dtccWB
  // ============================================================

  // ============================================================
  // CONFIGURATION — edit and reload browser tab
  // ============================================================
  const CONFIG = {
    speed:          0.003,
    frequency:      5,
    octaves:        3,
    persistence:    0.5,
    lacunarity:     2.0,
    edgeThreshold:  0.01,
    mouseRadius:    0.25,
    mouseStrength:  0.02,
    mouseGlow:      0.4,
    parallaxY:      0.0001,
    parallaxZ:      0.00003,
  };
  // ============================================================

  // Parse a CSS hex color (#rrggbb or #rgb) to [r,g,b] in 0..1
  function hexToRgb01(hex) {
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const n = parseInt(hex, 16);
    return [
      ((n >> 16) & 0xff) / 255,
 ((n >>  8) & 0xff) / 255,
 ( n        & 0xff) / 255,
    ];
  }

  function readThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      colorEdgeA: hexToRgb01(style.getPropertyValue('--bright-color').trim()),
 colorEdgeB: hexToRgb01(style.getPropertyValue('--primary-color').trim()),
 colorBase:  hexToRgb01(style.getPropertyValue('--bg-color').trim()),
    };
  }

  function lerpColor(a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }

  let currentColors = null;
  let targetColors  = null;
  let colorsDirty   = false;  // true only after an actual theme change post-init

  // Called externally or internally when theme changes
  window.bgShaderOnThemeChange = function() {
    targetColors = readThemeColors();
    colorsDirty  = true;
  };

  // Watch <html> attribute/class mutations (data-theme, class, color-scheme…)
  function watchThemeMutations() {
    const observer = new MutationObserver(function(mutations) {
      const relevant = mutations.some(function(m) {
        return m.attributeName === 'class' ||
        m.attributeName === 'data-theme' ||
        m.attributeName === 'color-scheme' ||
        m.attributeName === 'data-color-scheme';
      });
      if (relevant) window.bgShaderOnThemeChange();
    });
      observer.observe(document.documentElement, { attributes: true });
  }

  // Watch OS-level prefers-color-scheme changes
  function watchMediaQuery() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function() {
      window.bgShaderOnThemeChange();
    });
  }

  function init() {
    // Read theme immediately — catches correct state on every page load
    currentColors = readThemeColors();
    targetColors  = readThemeColors();

    watchThemeMutations();
    watchMediaQuery();

    const canvas = document.getElementById('bgShaderCanvas');
    if (!canvas) { console.error('bgShader: canvas not found'); return; }
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
    if (!gl) { console.error('bgShader: WebGL2 not supported'); return; }

    const vsSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_fragCoord;
    uniform vec2 u_resolution;
    void main() {
      v_fragCoord = (a_position * 0.5 + 0.5) * u_resolution;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
    `;

    const fsSource = `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 v_fragCoord;
    out vec4 fragColor;
    uniform vec2  u_resolution;
    uniform float u_time;
    uniform float u_speed;
    uniform vec3  u_colorEdgeA;
    uniform vec3  u_colorEdgeB;
    uniform vec3  u_colorBase;
    uniform float u_edgeThreshold;
    uniform vec2  u_mouse;       // normalized [0..1], raw screen space
    uniform float u_mouseRadius;
    uniform float u_mouseStrength;
    uniform float u_mouseGlow;
    uniform float u_scrollY;
    uniform float u_parallaxY;
    uniform float u_parallaxZ;
    uniform float u_intro;     // 0..1, eased open on load

    const uint M    = 0x5bd1e995u;
    const uint SEED = 0x578437adu;
    const int   OCTAVES     = ${CONFIG.octaves};
    const float FREQUENCY   = ${CONFIG.frequency.toFixed(1)};
    const float PERSISTENCE = ${CONFIG.persistence.toFixed(6)};
    const float LACUNARITY  = ${CONFIG.lacunarity.toFixed(6)};
    const vec2  OFF[5]      = vec2[5](vec2(0.0), vec2(0.0,-1.0), vec2(0.0,1.0), vec2(-1.0,0.0), vec2(1.0,0.0));

    uint hashU(uint x, uint seed)
    {
      uint h = seed;
      uint k = x;
      k *= M; k ^= k >> 24u; k *= M;
      h *= M; h ^= k;
      h ^= h >> 13u; h *= M; h ^= h >> 15u;
      return h;
    }

    uint mixK(uint k)
    {
      k *= M; k ^= k >> 24u; k *= M;
      return k;
    }

    uint finH(uint h)
    {
      h ^= h >> 13u; h *= M; h ^= h >> 15u;
      return h;
    }

    float gdot(uint h, vec3 d)
    {
      uint i = h & 15u;
      i = (i == 13u) ? 14u : ((i == 14u) ? 13u : i);
      float u = (i < 8u) ? d.x : d.y;
      float v = (i < 4u) ? d.y : ((i == 12u || i == 14u) ? d.x : d.z);
      return (((i & 1u) == 0u) ? u : -u) + (((i & 2u) == 0u) ? v : -v);
    }

    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    void corners(vec3 q, uint seed, out vec3 fr, out uint h[8])
    {
      vec3 fp = floor(q);
      fr = q - fp;
      uvec3 c = uvec3(fp);
      uint kx0 = mixK(c.x), kx1 = mixK(c.x + 1u);
      uint ky0 = mixK(c.y), ky1 = mixK(c.y + 1u);
      uint kz0 = mixK(c.z), kz1 = mixK(c.z + 1u);
      uint h0  = seed * M;
      uint a0  = (h0 ^ kx0) * M;
      uint a1  = (h0 ^ kx1) * M;
      uint b00 = (a0 ^ ky0) * M;
      uint b10 = (a1 ^ ky0) * M;
      uint b01 = (a0 ^ ky1) * M;
      uint b11 = (a1 ^ ky1) * M;
      h[0] = finH(b00 ^ kz0);
      h[1] = finH(b10 ^ kz0);
      h[2] = finH(b01 ^ kz0);
      h[3] = finH(b11 ^ kz0);
      h[4] = finH(b00 ^ kz1);
      h[5] = finH(b10 ^ kz1);
      h[6] = finH(b01 ^ kz1);
      h[7] = finH(b11 ^ kz1);
    }

    float noiseAt(vec3 fr, uint h[8])
    {
      float v1 = gdot(h[0], fr);
      float v2 = gdot(h[1], fr - vec3(1,0,0));
      float v3 = gdot(h[2], fr - vec3(0,1,0));
      float v4 = gdot(h[3], fr - vec3(1,1,0));
      float v5 = gdot(h[4], fr - vec3(0,0,1));
      float v6 = gdot(h[5], fr - vec3(1,0,1));
      float v7 = gdot(h[6], fr - vec3(0,1,1));
      float v8 = gdot(h[7], fr - vec3(1,1,1));
      vec3 t = fade(fr);
      return mix(
        mix(mix(v1,v2,t.x), mix(v3,v4,t.x), t.y),
                 mix(mix(v5,v6,t.x), mix(v7,v8,t.x), t.y),
                 t.z);
    }

    float fbm1(vec3 p)
    {
      uint  seed = SEED;
      float val  = 0.0;
      float amp  = 1.0;
      float freq = FREQUENCY;
      for (int i = 0; i < OCTAVES; i++)
      {
        seed = hashU(seed, 0u);
        vec3 fr; uint h[8];
        corners(p * freq, seed, fr, h);
        val  += noiseAt(fr, h) * amp;
        amp  *= PERSISTENCE;
        freq *= LACUNARITY;
      }
      return val;
    }

    // centre + 4 voisins a 1px : memes cellules, hash calcule une seule fois
    void fbm5(vec3 p, float d, out float val[5])
    {
      uint  seed = SEED;
      float amp  = 1.0;
      float freq = FREQUENCY;
      for (int j = 0; j < 5; j++) val[j] = 0.0;
      for (int i = 0; i < OCTAVES; i++)
      {
        seed = hashU(seed, 0u);
        vec3 fr; uint h[8];
        corners(p * freq, seed, fr, h);
        float dd = d * freq;
        for (int j = 0; j < 5; j++)
        {
          val[j] += noiseAt(fr + vec3(OFF[j] * dd, 0.0), h) * amp;
        }
        amp  *= PERSISTENCE;
        freq *= LACUNARITY;
      }
    }

    float lum(float v) { return v * 0.59; }

    void main()
    {
      vec2 fragCoord = v_fragCoord;
      float ar       = u_resolution.x / u_resolution.y;

      float parallaxOffsetY = u_scrollY * u_parallaxY;
      float z               = u_time * u_speed + u_scrollY * u_parallaxZ;

      vec2 pos = fragCoord / u_resolution;
      pos.y   += parallaxOffsetY;

      float mouseFalloff = 0.0;
      float zBoost       = 0.0;

      if (u_mouse.x > -0.5)
      {
        vec2 screenUV = vec2(fragCoord.x, u_resolution.y - fragCoord.y) / u_resolution;
        vec2 toMouse  = screenUV - u_mouse;
        toMouse.x    *= ar;
        float dist    = length(toMouse);
        mouseFalloff  = smoothstep(u_mouseRadius, 0.0, dist);
        zBoost        = mouseFalloff * u_mouseStrength;
      }

      float zLocal = z + zBoost;
      pos.x *= ar;

      float n[5];
      fbm5(vec3(pos, zLocal), 1.0 / u_resolution.y, n);

      float q[5];
      for (int j = 0; j < 5; j++)
      {
        q[j] = floor((n[j] + 1.0) * 0.5 * 10.0) / 10.0;
      }

      float vc     = q[0];
      float lapRaw = 0.0;
      vec3  res    = vc * u_colorBase;

      // zones plates : aucun contour, on saute le 2e fbm
      if (q[1] != vc || q[2] != vc || q[3] != vc || q[4] != vc)
      {
        float vback = (fbm1(vec3(pos + vec2(100.0), zLocal)) + 1.0) * 0.5;
        float lap   = lum(q[1]) + lum(q[2]) + lum(q[4]) + lum(q[3]) - 4.0 * lum(vc);
        lapRaw = abs(lap);
        if (lap > u_edgeThreshold) lap = 1.0;
        res = (u_colorEdgeA * vback + u_colorEdgeB * (1.0 - vback)) * lap + vc * u_colorBase;
      }

      float glowStrength = clamp(mouseFalloff * u_mouseGlow * lapRaw * 80.0, 0.0, 1.0);
      res += glowStrength * (vec3(1.0) - res) * mouseFalloff;

      // Intro: circle expands from center, behind = #171724
      vec2 centered     = fragCoord / u_resolution - 0.5;
      centered.x       *= ar;
      float distCenter  = length(centered);
      float maxDist     = length(vec2(ar * 0.5, 0.5));
      float circleEdge  = u_intro * maxDist * 1.05;
      float inCircle    = smoothstep(circleEdge + 0.02, circleEdge - 0.02, distCenter);
      vec3  bgColor     = u_colorBase;
      res               = mix(bgColor, res, inCircle);

      fragColor = vec4(res, 1.0);
    }
    `;

    function compileShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error('bgShader compile:', gl.getShaderInfoLog(s));
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   vsSource));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      console.error('bgShader link:', gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      resolution:    gl.getUniformLocation(prog, 'u_resolution'),
 time:          gl.getUniformLocation(prog, 'u_time'),
 speed:         gl.getUniformLocation(prog, 'u_speed'),
 colorEdgeA:    gl.getUniformLocation(prog, 'u_colorEdgeA'),
 colorEdgeB:    gl.getUniformLocation(prog, 'u_colorEdgeB'),
 colorBase:     gl.getUniformLocation(prog, 'u_colorBase'),
 edgeThreshold: gl.getUniformLocation(prog, 'u_edgeThreshold'),
 mouse:         gl.getUniformLocation(prog, 'u_mouse'),
 mouseRadius:   gl.getUniformLocation(prog, 'u_mouseRadius'),
 mouseStrength: gl.getUniformLocation(prog, 'u_mouseStrength'),
 mouseGlow:     gl.getUniformLocation(prog, 'u_mouseGlow'),
 scrollY:       gl.getUniformLocation(prog, 'u_scrollY'),
 parallaxY:     gl.getUniformLocation(prog, 'u_parallaxY'),
 parallaxZ:     gl.getUniformLocation(prog, 'u_parallaxZ'),
 intro:         gl.getUniformLocation(prog, 'u_intro'),
    };

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    let mouseX = -99.0, mouseY = -99.0;
    window.addEventListener('mousemove', function(e) {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    });
    window.addEventListener('mouseleave', function() { mouseX = -99.0; mouseY = -99.0; });

    let scrollCurrent = 0.0;
    let scrollTarget  = 0.0;
    window.addEventListener('scroll', function() {
      scrollTarget = window.scrollY;
    }, { passive: true });

    const SESSION_INTRO_KEY = 'bgShader_introDone';
    const introDone         = sessionStorage.getItem(SESSION_INTRO_KEY) === '1';
    const INTRO_DURATION    = 1500;
    const introStart        = performance.now();
    const startTime         = performance.now();

    function render() {
      scrollCurrent += (scrollTarget - scrollCurrent) * 0.08;

      const now    = performance.now();
      const t      = (now - startTime) / 1000.0;
      if (colorsDirty) {
        const s = 0.05;
        currentColors = {
          colorEdgeA: lerpColor(currentColors.colorEdgeA, targetColors.colorEdgeA, s),
 colorEdgeB: lerpColor(currentColors.colorEdgeB, targetColors.colorEdgeB, s),
 colorBase:  lerpColor(currentColors.colorBase,  targetColors.colorBase,  s),
        };
        // Snap once close enough, stop lerping
        const d = Math.abs(currentColors.colorBase[0] - targetColors.colorBase[0])
        + Math.abs(currentColors.colorBase[1] - targetColors.colorBase[1])
        + Math.abs(currentColors.colorBase[2] - targetColors.colorBase[2]);
        if (d < 0.001) {
          currentColors = { colorEdgeA: targetColors.colorEdgeA.slice(),
            colorEdgeB: targetColors.colorEdgeB.slice(),
 colorBase:  targetColors.colorBase.slice() };
 colorsDirty = false;
        }
      }

      let intro = 1.0;
      if (!introDone) {
        const rawIntro = Math.min((now - introStart) / INTRO_DURATION, 1.0);
        intro = 1.0 - Math.pow(1.0 - rawIntro, 3);
        if (rawIntro >= 1.0) sessionStorage.setItem(SESSION_INTRO_KEY, '1');
      }
      gl.uniform2f(u.resolution,    canvas.width, canvas.height);
      gl.uniform1f(u.time,          t);
      gl.uniform1f(u.speed,         CONFIG.speed);
      gl.uniform3fv(u.colorEdgeA,   currentColors.colorEdgeA);
      gl.uniform3fv(u.colorEdgeB,   currentColors.colorEdgeB);
      gl.uniform3fv(u.colorBase,    currentColors.colorBase);
      gl.uniform1f(u.edgeThreshold, CONFIG.edgeThreshold);
      gl.uniform2f(u.mouse,         mouseX, mouseY);
      gl.uniform1f(u.mouseRadius,   CONFIG.mouseRadius);
      gl.uniform1f(u.mouseStrength, CONFIG.mouseStrength);
      gl.uniform1f(u.mouseGlow,     CONFIG.mouseGlow);
      gl.uniform1f(u.scrollY,       scrollCurrent);
      gl.uniform1f(u.parallaxY,     CONFIG.parallaxY);
      gl.uniform1f(u.parallaxZ,     CONFIG.parallaxZ);
      gl.uniform1f(u.intro,         intro);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
