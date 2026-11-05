#version 300 es
precision highp float;
precision highp int;
in vec2 v_fragCoord;
out vec4 fragColor;

// ============================================================
// Based on "Topo lines" by yuriy_shulga
// https://www.shadertoy.com/view/dtccWB
// ============================================================

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
uniform float u_scrollY;
uniform float u_parallaxY;
uniform float u_parallaxZ;
uniform float u_intro;     // 0..1, eased open on load

const uint M    = 0x5bd1e995u;
const uint SEED = 0x578437adu;
const int   OCTAVES     = 3;
const float FREQUENCY   = 5.0;
const float PERSISTENCE = 0.5;
const float LACUNARITY  = 2.0;
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

// Center + four neighbors one pixel apart: same cells, hash computed once.
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
  vec3  res    = vc * u_colorBase;

  // Flat zones have no outline, so skip the second fbm pass.
  if (q[1] != vc || q[2] != vc || q[3] != vc || q[4] != vc)
  {
    float vback = (fbm1(vec3(pos + vec2(100.0), zLocal)) + 1.0) * 0.5;
    float lap   = lum(q[1]) + lum(q[2]) + lum(q[4]) + lum(q[3]) - 4.0 * lum(vc);
    if (lap > u_edgeThreshold) lap = 1.0;
    res = (u_colorEdgeA * vback + u_colorEdgeB * (1.0 - vback)) * lap + vc * u_colorBase;
  }

  // Intro: circle expands from center; the background uses the base color.
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
