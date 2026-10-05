// The Atlas Entanglement Shader (entanglement-shader-v1), running live in the browser.
// The engine simulates light bouncing between stacked, ultra-thin conducting layers whose interactions are
// quantum (entangled), and bakes the result into two lookup tables: how much of each colour is reflected (R) and
// transmitted (T) for a given light phase and viewing angle. Because the phase depends on the angle, a surface
// shifts colour as it tilts: iridescence shaped by the quantum simulation. No quantum hardware runs at render time.
//
// `lutColour` below is a line-for-line WebGL 2 port of the engine's entanglement_texture.glsl (in atlas-src/); the
// scenes around it (a living film and two faceted crystals that tilt in sync) only supply surface normals.

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uRTexture;   // reflectance LUT (engine output R_lut)
uniform sampler2D uTTexture;   // transmittance LUT (engine output T_lut)
uniform float uThickness;      // interlayer spacing in nm (engine default 500)
uniform float uTime;
uniform vec2 uRes;
uniform int uMode;             // 0 = film (background), 1 = two crystals

out vec4 outColor;

const float ET_PI_2   = 1.5707963267948966;
const float ET_TWO_PI = 6.283185307179586;

// --- Port of entanglement_texture.glsl (engine output) -------------------------------------------
vec3 lutColour(vec3 normal, vec3 viewDir, float thickness, out vec3 trans) {
  float cosTheta = abs(dot(normalize(normal), normalize(viewDir)));
  float theta    = acos(clamp(cosTheta, 0.0, 1.0));
  float D        = -2.0 * ET_TWO_PI * thickness * cosTheta;
  const vec3 wavelength = vec3(650.0, 530.0, 470.0); // R, G, B in nm
  float s0 = mod(D / wavelength.r, ET_TWO_PI) / ET_TWO_PI;
  float s1 = mod(D / wavelength.g, ET_TWO_PI) / ET_TWO_PI;
  float s2 = mod(D / wavelength.b, ET_TWO_PI) / ET_TWO_PI;
  float t = theta / ET_PI_2;
  trans = vec3(texture(uTTexture, vec2(s0, t)).r, texture(uTTexture, vec2(s1, t)).r, texture(uTTexture, vec2(s2, t)).r);
  return vec3(texture(uRTexture, vec2(s0, t)).r, texture(uRTexture, vec2(s1, t)).r, texture(uRTexture, vec2(s2, t)).r);
}
// -------------------------------------------------------------------------------------------------

// HDR → display: the LUT values run above 1.0. The three colour channels sample the LUT at different phases,
// so the raw mix is pastel; a saturation lift (display grading only, the LUT values are untouched) brings out
// the angle-dependent colour shifts.
vec3 tonemap(vec3 c) {
  vec3 col = 1.0 - exp(-c * 1.35);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), col, 2.2), 0.0, 1.0);
}

// A rippling film: the surface normal comes from an animated height field, so the viewing angle sweeps
// across the LUT and the colours flow.
vec4 film(vec2 p) {
  float t = uTime * 0.25;
  vec2 g = vec2(0.0);
  g += 0.9 * vec2(cos(p.x * 2.1 + t), 0.6 * cos(p.y * 1.7 - t * 0.8));
  g += 0.6 * vec2(0.5 * cos(p.x * 3.3 - p.y * 1.9 + t * 1.3), cos(p.y * 3.1 + p.x * 1.2 + t * 0.7));
  g += 0.35 * vec2(cos(p.x * 5.7 + p.y * 4.3 - t * 1.7), cos(p.y * 6.1 - p.x * 2.8 + t * 1.1));
  vec3 n = normalize(vec3(-g * 0.85, 1.0));
  float thickness = uThickness * (1.0 + 0.12 * sin(p.x * 0.9 + p.y * 0.7 + t * 0.5));
  vec3 trans;
  vec3 r = lutColour(n, vec3(0.0, 0.0, 1.0), thickness, trans);
  return vec4(tonemap(r * 0.9 + trans * 0.35), 1.0);
}

// Point-in-gem test in the gem's own box (x right, y down, 0..1), same outline as the CSS crystals.
bool inGem(vec2 q) {
  vec2 v[5] = vec2[5](vec2(0.5, 0.0), vec2(1.0, 0.3), vec2(0.8, 1.0), vec2(0.2, 1.0), vec2(0.0, 0.3));
  for (int i = 0; i < 5; i++) {
    vec2 a = v[i];
    vec2 b = v[(i + 1) % 5];
    vec2 e = b - a;
    vec2 d = q - a;
    if (e.x * d.y - e.y * d.x < 0.0) return false;
  }
  return true;
}

// One faceted gem. Both gems share the same spin: what one does, its partner does.
vec4 gem(vec2 uv, vec2 centre, float h) {
  vec2 size = vec2(h * 0.62, h);
  vec2 q = (uv - centre) / size + 0.5;
  q.y = 1.0 - q.y;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || !inGem(q)) return vec4(0.0);
  vec2 d = q - vec2(0.5, 0.42);
  float a = atan(d.y, d.x);
  float sector = 6.283185307179586 / 6.0;
  float fa = (floor(a / sector) + 0.5) * sector;
  float tilt = 0.55 + 0.5 * smoothstep(0.0, 0.45, length(d));
  vec3 n = normalize(vec3(cos(fa) * tilt, -sin(fa) * tilt, 1.0));
  // Shared rocking spin about the vertical axis, plus a slow nod.
  float s = sin(uTime * 0.6) * 0.75;
  float c = cos(s);
  float sn = sin(s);
  n = vec3(c * n.x + sn * n.z, n.y, -sn * n.x + c * n.z);
  float nod = sin(uTime * 0.37) * 0.35;
  n = vec3(n.x, cos(nod) * n.y - sin(nod) * n.z, sin(nod) * n.y + cos(nod) * n.z);
  vec3 trans;
  vec3 r = lutColour(n, vec3(0.0, 0.0, 1.0), uThickness, trans);
  vec3 col = tonemap(r * 1.1 + trans * 0.25);
  col += pow(max(n.z, 0.0), 24.0) * 0.18; // a glint where a facet faces the viewer
  // Darken the rim so the outline reads.
  float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.08, edge);
  return vec4(col, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  if (uMode == 0) {
    outColor = film(uv * 3.0);
    return;
  }
  float aspect = uRes.x / uRes.y;
  float spread = min(0.32 * aspect, 0.62);
  vec4 left = gem(uv, vec2(-spread * 0.5 - 0.06, 0.0), 0.86);
  vec4 right = gem(uv, vec2(spread * 0.5 + 0.06, 0.0), 0.86);
  outColor = left.a > 0.0 ? left : right;
}
`;
