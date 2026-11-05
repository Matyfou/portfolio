#version 300 es
precision highp float;
precision highp int;
in vec2 v_fragCoord;
out vec4 fragColor;

// Based on "Topo lines" by yuriy_shulga
// https://www.shadertoy.com/view/dtccWB

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform vec3  u_colorEdgeA;
uniform vec3  u_colorEdgeB;
uniform vec3  u_colorBase;
uniform float u_edgeThreshold;
uniform vec2  u_mouse;
uniform float u_mouseRadius;
uniform float u_mouseStrength;
uniform float u_scrollY;
uniform float u_parallaxY;
uniform float u_parallaxZ;
uniform float u_intro;

const uint M = 0x5bd1e995u;

// seed * M, precomputed per octave
const uint H0_A = 0xd8437f7cu;
const uint H0_B = 0xe0b9ae15u;
const uint H0_C = 0x50133ea7u;

const int   OCTAVES     = 3;
const int   BACK_OCT    = 2;
const float FREQUENCY   = 5.0;
const float PERSISTENCE = 0.5;
const float LACUNARITY  = 2.0;

// Max noise change per pixel step = GRAD_BOUND * 15 / resY.
// Lower = faster but edges may break. Raise if outlines look cut.
const float GRAD_BOUND = 2.0;
const float SUM_FREQ_AMP = 15.0;

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

void corners(vec3 q, uint h0, out vec3 fr, out uvec4 hA, out uvec4 hB)
{
  vec3 fp = floor(q);
  fr = q - fp;
  uvec3 c = uvec3(ivec3(fp));
  uint kx0 = mixK(c.x), kx1 = mixK(c.x + 1u);
  uint ky0 = mixK(c.y), ky1 = mixK(c.y + 1u);
  uint kz0 = mixK(c.z), kz1 = mixK(c.z + 1u);
  uint a0  = (h0 ^ kx0) * M;
  uint a1  = (h0 ^ kx1) * M;
  uint b00 = (a0 ^ ky0) * M;
  uint b10 = (a1 ^ ky0) * M;
  uint b01 = (a0 ^ ky1) * M;
  uint b11 = (a1 ^ ky1) * M;
  hA = uvec4(finH(b00 ^ kz0), finH(b10 ^ kz0), finH(b01 ^ kz0), finH(b11 ^ kz0));
  hB = uvec4(finH(b00 ^ kz1), finH(b10 ^ kz1), finH(b01 ^ kz1), finH(b11 ^ kz1));
}

float noiseAt(vec3 fr, uvec4 hA, uvec4 hB)
{
  float v1 = gdot(hA.x, fr);
  float v2 = gdot(hA.y, fr - vec3(1.0, 0.0, 0.0));
  float v3 = gdot(hA.z, fr - vec3(0.0, 1.0, 0.0));
  float v4 = gdot(hA.w, fr - vec3(1.0, 1.0, 0.0));
  float v5 = gdot(hB.x, fr - vec3(0.0, 0.0, 1.0));
  float v6 = gdot(hB.y, fr - vec3(1.0, 0.0, 1.0));
  float v7 = gdot(hB.z, fr - vec3(0.0, 1.0, 1.0));
  float v8 = gdot(hB.w, fr - vec3(1.0, 1.0, 1.0));
  vec3 t = fade(fr);
  return mix(
    mix(mix(v1, v2, t.x), mix(v3, v4, t.x), t.y),
             mix(mix(v5, v6, t.x), mix(v7, v8, t.x), t.y),
             t.z);
}

uint octaveSeed(int i)
{
  return (i == 0) ? H0_A : ((i == 1) ? H0_B : H0_C);
}

float fbmC(vec3 p, int octs)
{
  float val  = 0.0;
  float amp  = 1.0;
  float freq = FREQUENCY;
  for (int i = 0; i < OCTAVES; i++)
  {
    if (i >= octs)
    {
      break;
    }
    vec3 fr;
    uvec4 hA;
    uvec4 hB;
    corners(p * freq, octaveSeed(i), fr, hA, hB);
    val  += noiseAt(fr, hA, hB) * amp;
    amp  *= PERSISTENCE;
    freq *= LACUNARITY;
  }
  return val;
}

// out: (0,-1) (0,1) (-1,0) (1,0)
vec4 fbmNb(vec3 p, float d)
{
  float amp  = 1.0;
  float freq = FREQUENCY;
  vec4  vn   = vec4(0.0);
  for (int i = 0; i < OCTAVES; i++)
  {
    vec3 fr;
    uvec4 hA;
    uvec4 hB;
    corners(p * freq, octaveSeed(i), fr, hA, hB);
    float dd = d * freq;
    vn.x += noiseAt(fr + vec3(0.0, -dd, 0.0), hA, hB) * amp;
    vn.y += noiseAt(fr + vec3(0.0,  dd, 0.0), hA, hB) * amp;
    vn.z += noiseAt(fr + vec3(-dd, 0.0, 0.0), hA, hB) * amp;
    vn.w += noiseAt(fr + vec3( dd, 0.0, 0.0), hA, hB) * amp;
    amp  *= PERSISTENCE;
    freq *= LACUNARITY;
  }
  return vn;
}

float lum(float v) { return v * 0.59; }

void main()
{
  vec2 fragCoord = v_fragCoord;
  float ar       = u_resolution.x / u_resolution.y;

  vec2 centered     = fragCoord / u_resolution - 0.5;
  centered.x       *= ar;
  float distCenter  = length(centered);
  float maxDist     = length(vec2(ar * 0.5, 0.5));
  float circleEdge  = u_intro * maxDist * 1.05;
  float inCircle    = smoothstep(circleEdge + 0.02, circleEdge - 0.02, distCenter);

  if (inCircle <= 0.0)
  {
    fragColor = vec4(u_colorBase, 1.0);
    return;
  }

  float parallaxOffsetY = u_scrollY * u_parallaxY;
  float z               = u_time * u_speed + u_scrollY * u_parallaxZ;

  vec2 pos = fragCoord / u_resolution;
  pos.y   += parallaxOffsetY;

  float zBoost = 0.0;

  if (u_mouse.x > -0.5)
  {
    vec2 screenUV = vec2(fragCoord.x, u_resolution.y - fragCoord.y) / u_resolution;
    vec2 toMouse  = screenUV - u_mouse;
    toMouse.x    *= ar;
    float dist    = length(toMouse);
    zBoost        = smoothstep(u_mouseRadius, 0.0, dist) * u_mouseStrength;
  }

  float zLocal = z + zBoost;
  pos.x *= ar;

  float d  = 1.0 / u_resolution.y;
  vec3  p  = vec3(pos, zLocal);
  float nc = fbmC(p, OCTAVES);

  float vc  = floor((nc + 1.0) * 0.5 * 10.0) / 10.0;
  vec3  res = vc * u_colorBase;

  float t      = (nc + 1.0) * 5.0;
  float f      = fract(t);
  float margin = GRAD_BOUND * SUM_FREQ_AMP * d * 5.0;

  if (f < margin || f > 1.0 - margin)
  {
    vec4 nn = fbmNb(p, d);
    vec4 qn = floor((nn + vec4(1.0)) * 0.5 * 10.0) / 10.0;

    if (any(notEqual(qn, vec4(vc))))
    {
      float vback = (fbmC(vec3(pos + vec2(100.0), zLocal), BACK_OCT) + 1.0) * 0.5;
      float lap   = lum(qn.x) + lum(qn.y) + lum(qn.w) + lum(qn.z) - 4.0 * lum(vc);
      if (lap > u_edgeThreshold)
      {
        lap = 1.0;
      }
      res = (u_colorEdgeA * vback + u_colorEdgeB * (1.0 - vback)) * lap + vc * u_colorBase;
    }
  }

  res = mix(u_colorBase, res, inCircle);

  fragColor = vec4(res, 1.0);
}
