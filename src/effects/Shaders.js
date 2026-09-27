import * as THREE from 'three';

// Shared time uniform for wind animation.
export const WIND = { uTime: { value: 0 } };

// Chain onBeforeCompile hooks so several patches can stack on one material.
function patch(material, key, fn) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => { prev?.call(material, shader, r); fn(shader); };
  if (!material.userData.patches) {
    // keep any cache key the material already had (e.g. its own shader patch)
    const own = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey') ? material.customProgramCacheKey : null;
    material.userData.baseKey = own ? own.call(material) : '';
  }
  const keys = (material.userData.patches = [...(material.userData.patches || []), key]);
  material.customProgramCacheKey = () => material.userData.baseKey + '|' + keys.join('|');
}

// Fresnel rim light: bright edge that separates characters from the background.
export function addRim(material, color = '#dff1ff', strength = 0.55, power = 2.6) {
  const uniforms = { uRimColor: { value: new THREE.Color(color) }, uRimStrength: { value: strength } };
  patch(material, `rim${power}`, (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace('#include <opaque_fragment>', `
        float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uRimColor * pow(rimF, ${power.toFixed(2)}) * uRimStrength;
        #include <opaque_fragment>`);
  });
  return uniforms;
}

// Gentle wind sway for foliage. Displacement grows with local height above `pivot`.
export function addWind(material, { amount = 0.12, pivot = 0.0, speed = 1.4 } = {}) {
  patch(material, `wind${amount}${pivot}${speed}`, (shader) => {
    shader.uniforms.uTime = WIND.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 windOrigin = instanceMatrix[3].xz;
        #else
          vec2 windOrigin = modelMatrix[3].xz;
        #endif
        float windH = max(0.0, transformed.y - ${pivot.toFixed(3)});
        float windPh = uTime * ${speed.toFixed(3)} + windOrigin.x * 0.21 + windOrigin.y * 0.17;
        float windS = sin(windPh) * 0.7 + sin(windPh * 2.3 + transformed.x) * 0.3;
        transformed.x += windS * windH * ${amount.toFixed(3)};
        transformed.z += cos(windPh * 0.8) * windH * ${(amount * 0.5).toFixed(3)};`);
  });
}

// Outfit recolour: shifts one hue band of the texture (the outfit's main colour) to a target colour,
// keeping shading, skin and leather untouched.
export function addHueSwap(material, srcHue, range, color) {
  const c = new THREE.Color(color);
  const hsl = {};
  c.getHSL(hsl);
  const uniforms = { uSrcHue: { value: srcHue }, uHueRange: { value: range }, uDstHue: { value: hsl.h }, uDstSat: { value: hsl.s }, uDstLight: { value: hsl.l } };
  patch(material, 'hueswap', (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSrcHue; uniform float uHueRange; uniform float uDstHue; uniform float uDstSat; uniform float uDstLight;
vec3 hs_rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hs_hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 hsv = hs_rgb2hsv(diffuseColor.rgb);
        float dh = abs(fract(hsv.x - uSrcHue + 0.5) - 0.5);
        float w = (1.0 - smoothstep(uHueRange * 0.6, uHueRange, dh)) * smoothstep(0.18, 0.35, hsv.y);
        vec3 swapped = hs_hsv2rgb(vec3(uDstHue, mix(hsv.y, uDstSat, 0.7), clamp(hsv.z * (0.7 + uDstLight * 0.8), 0.0, 1.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, swapped, w);
      }`);
  });
  return uniforms;
}
