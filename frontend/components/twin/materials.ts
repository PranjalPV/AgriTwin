import * as THREE from "three";

/** Global uniforms shared by every animated material in the scene. */
export const globalUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

/** Deterministic PRNG so the farm layout is identical on every render. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIND_CHUNK = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 ip = instanceMatrix[3].xyz;
  #else
    vec3 ip = vec3(0.0);
  #endif
  float wk = clamp(position.y / uH, 0.0, 1.6);
  wk *= wk;
  float gust = 0.55 + 0.45 * sin(uTime * 0.37 + ip.x * 0.045 + ip.z * 0.03);
  float w1 = sin(uTime * 1.6 + ip.x * 0.33 + ip.z * 0.21);
  float w2 = sin(uTime * 3.3 + ip.x * 0.91 - ip.z * 0.57) * 0.3;
  transformed.x += (w1 + w2) * uAmp * wk * gust * uWind;
  transformed.z += cos(uTime * 1.25 + ip.z * 0.41 + ip.x * 0.1) * uAmp * 0.45 * wk * uWind;
`;

function patchWind(shader: THREE.WebGLProgramParametersWithUniforms, amp: number, h: number) {
  shader.uniforms.uTime = globalUniforms.uTime;
  shader.uniforms.uWind = globalUniforms.uWind;
  shader.uniforms.uAmp = { value: amp };
  shader.uniforms.uH = { value: h };
  shader.vertexShader =
    "uniform float uTime;\nuniform float uWind;\nuniform float uAmp;\nuniform float uH;\n" +
    shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + WIND_CHUNK);
}

/** Standard PBR material whose vertices sway in the wind (more at the top). */
export function windMaterial(params: THREE.MeshStandardMaterialParameters, amp = 0.08, height = 1) {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, vertexColors: true, ...params });
  m.onBeforeCompile = (s) => patchWind(s, amp, height);
  m.customProgramCacheKey = () => `wind-${amp}-${height}`;
  return m;
}

/** Matching depth material so shadows sway with the plants. */
export function windDepthMaterial(amp = 0.08, height = 1) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => patchWind(s, amp, height);
  m.customProgramCacheKey = () => `wdepth-${amp}-${height}`;
  return m;
}

/* ------------------------------------------------------------------ soil */
const SOIL_NOISE = /* glsl */ `
  varying vec3 vWPos;
  varying float vH;
  uniform float uMoist;
  uniform float uCrack;
  uniform float uRidge;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  vec2 h22(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.07; a*=0.5; } return s; }
  // distance to voronoi cell border -> dry-mud cracks
  float crackEdge(vec2 p){
    vec2 n = floor(p), f = fract(p); vec2 mg, mr; float md = 8.0;
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 g = vec2(float(i),float(j)); vec2 o = h22(n+g); vec2 r = g+o-f; float d = dot(r,r);
      if(d<md){ md=d; mr=r; mg=g; }
    }
    md = 8.0;
    for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){
      vec2 g = mg+vec2(float(i),float(j)); vec2 o = h22(n+g); vec2 r = g+o-f;
      if(dot(mr-r,mr-r)>0.00001) md = min(md, dot(0.5*(mr+r), normalize(r-mr)));
    }
    return md;
  }
`;

export function soilMaterial() {
  const uniforms = { uMoist: { value: 0.5 }, uCrack: { value: 0 }, uRidge: { value: 0.1 } };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = "varying vec3 vWPos;\nvarying float vH;\n" + s.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vH = transformed.y;",
    );
    s.fragmentShader = SOIL_NOISE + s.fragmentShader
      .replace("#include <color_fragment>", /* glsl */ `
        #include <color_fragment>
        vec2 p = vWPos.xz;
        float n = fbm(p * 1.7);
        float fine = vnoise(p * 23.0);
        vec3 dry = vec3(0.70, 0.56, 0.39);
        vec3 mid = vec3(0.45, 0.32, 0.21);
        vec3 wet = vec3(0.20, 0.135, 0.085);
        vec3 col = uMoist < 0.5 ? mix(dry, mid, uMoist * 2.0) : mix(mid, wet, (uMoist - 0.5) * 2.0);
        col *= 0.82 + 0.3 * n + 0.08 * fine;
        // ridge tops dry out first and look lighter
        float top = clamp(vH / max(uRidge, 0.001), 0.0, 1.0);
        col = mix(col, col * 1.18 + 0.02, top * (1.0 - uMoist) * 0.8);
        // furrow bottoms stay darker / wetter
        col *= mix(0.78, 1.0, top);
        // cracks
        float e = crackEdge(p * 2.4 + n * 0.6);
        float ck = 1.0 - smoothstep(0.0, 0.055, e);
        col *= 1.0 - ck * uCrack * 0.75;
        // small clods / pebbles
        col = mix(col, col * 1.25, step(0.965, fine) * 0.6);
        diffuseColor.rgb = col;
      `)
      .replace("#include <roughnessmap_fragment>", /* glsl */ `
        float roughnessFactor = mix(0.98, 0.42, smoothstep(0.55, 1.0, uMoist));
      `);
  };
  m.customProgramCacheKey = () => "soil";
  return { material: m, uniforms };
}
