(function() {

  // ============================================================
  // Based on "Topo lines" by yuriy_shulga
  // https://www.shadertoy.com/view/dtccWB
  // ============================================================

  const CONFIG = {
    speed:          0.002,
    edgeThreshold:  0.01,
    mouseRadius:    0.2,
    mouseStrength:  0.02,
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
      ((n >> 8) & 0xff) / 255,
      (n & 0xff) / 255,
    ];
  }

  function readThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      colorEdgeA: hexToRgb01(style.getPropertyValue('--bright-color').trim()),
      colorEdgeB: hexToRgb01(style.getPropertyValue('--primary-color').trim()),
      colorBase: hexToRgb01(style.getPropertyValue('--bg-color').trim()),
    };
  }

  function lerpColor(a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }

  let currentColors;
  let targetColors;
  let colorsDirty = false;

  document.addEventListener('themechange', function() {
    if (!currentColors) return;
    targetColors = readThemeColors();
    colorsDirty = true;
  });

  // GLSL sources live in /assets/shaders/background.vert and background.frag.
  async function loadShader(name) {
    const response = await fetch(`/assets/shaders/${name}?v=20261105-2`);
    if (!response.ok) {
      throw new Error(`Unable to load ${name} (HTTP ${response.status})`);
    }
    return response.text();
  }

  async function init() {
    const canvas = document.getElementById('bgShaderCanvas');
    if (!canvas) { console.error('bgShader: canvas not found'); return; }
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
    if (!gl) { console.error('bgShader: WebGL2 not supported'); return; }

    const [vsSource, fsSource] = await Promise.all([
      loadShader('background.vert'),
      loadShader('background.frag'),
    ]);

    currentColors = readThemeColors();
    targetColors = currentColors;

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
      resolution: gl.getUniformLocation(prog, 'u_resolution'),
      time: gl.getUniformLocation(prog, 'u_time'),
      speed: gl.getUniformLocation(prog, 'u_speed'),
      colorEdgeA: gl.getUniformLocation(prog, 'u_colorEdgeA'),
      colorEdgeB: gl.getUniformLocation(prog, 'u_colorEdgeB'),
      colorBase: gl.getUniformLocation(prog, 'u_colorBase'),
      edgeThreshold: gl.getUniformLocation(prog, 'u_edgeThreshold'),
      mouse: gl.getUniformLocation(prog, 'u_mouse'),
      mouseRadius: gl.getUniformLocation(prog, 'u_mouseRadius'),
      mouseStrength: gl.getUniformLocation(prog, 'u_mouseStrength'),
      scrollY: gl.getUniformLocation(prog, 'u_scrollY'),
      parallaxY: gl.getUniformLocation(prog, 'u_parallaxY'),
      parallaxZ: gl.getUniformLocation(prog, 'u_parallaxZ'),
      intro: gl.getUniformLocation(prog, 'u_intro'),
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

    const INTRO_DURATION = 1500;
    const startTime = performance.now();

    function render() {
      scrollCurrent += (scrollTarget - scrollCurrent) * 0.08;

      const now    = performance.now();
      const t      = (now - startTime) / 1000.0;
      if (colorsDirty) {
        const smoothing = 0.05;
        currentColors = {
          colorEdgeA: lerpColor(currentColors.colorEdgeA, targetColors.colorEdgeA, smoothing),
          colorEdgeB: lerpColor(currentColors.colorEdgeB, targetColors.colorEdgeB, smoothing),
          colorBase: lerpColor(currentColors.colorBase, targetColors.colorBase, smoothing),
        };

        // Snap once close enough, then stop lerping.
        const d = Math.abs(currentColors.colorBase[0] - targetColors.colorBase[0])
          + Math.abs(currentColors.colorBase[1] - targetColors.colorBase[1])
          + Math.abs(currentColors.colorBase[2] - targetColors.colorBase[2]);
        if (d < 0.001) {
          currentColors = {
            colorEdgeA: targetColors.colorEdgeA.slice(),
            colorEdgeB: targetColors.colorEdgeB.slice(),
            colorBase: targetColors.colorBase.slice(),
          };
          colorsDirty = false;
        }
      }

      const introProgress = Math.min((now - startTime) / INTRO_DURATION, 1.0);
      const intro = 1.0 - Math.pow(1.0 - introProgress, 3);
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
      gl.uniform1f(u.scrollY,       scrollCurrent);
      gl.uniform1f(u.parallaxY,     CONFIG.parallaxY);
      gl.uniform1f(u.parallaxZ,     CONFIG.parallaxZ);
      gl.uniform1f(u.intro,         intro);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();
  }

  init().catch((error) => console.error("bgShader:", error));
})();
