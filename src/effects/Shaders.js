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
