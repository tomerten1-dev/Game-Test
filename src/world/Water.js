import * as THREE from 'three';
import { WORLD_HALF } from './Terrain.js';

// Tileable normal map from summed sines -> glossy animated water.
function makeWaterNormalMap(size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const TAU = Math.PI * 2;
  const waves = [
    [3, 1, 0.8, 0.2], [1, 4, 0.6, 1.3], [5, -3, 0.35, 2.1], [-2, 6, 0.3, 0.7], [7, 2, 0.2, 4.0], [-6, -5, 0.18, 3.3],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      const u = x / size, v = y / size;
      for (const [kx, ky, a, ph] of waves) {
        const c = Math.cos(TAU * (kx * u + ky * v) + ph) * a;
        dx += c * kx; dy += c * ky;
      }
      const nx = -dx * 0.08, ny = -dy * 0.08, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const o = (y * size + x) * 4;
      img.data[o] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(55, 55);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Stylized water: depth-tinted color from the terrain height texture, shore foam, small waves.
export class Water {
  constructor(scene, heightTex) {
    this.normalMap = makeWaterNormalMap();
    this.uniforms = {
      uTime: { value: 0 },
      uHeightTex: { value: heightTex },
      uHalf: { value: WORLD_HALF },
      uShallow: { value: new THREE.Color('#4fe3d2') },
      uDeep: { value: new THREE.Color('#1560c9') },
    };
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 1,
      normalMap: this.normalMap,
      normalScale: new THREE.Vector2(0.22, 0.22),
      envMapIntensity: 1.3,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
          transformed.y += sin(wp0.x * 0.12 + uTime * 1.1) * 0.09 + sin(wp0.z * 0.17 - uTime * 0.9) * 0.07;
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime, uHalf;
          uniform sampler2D uHeightTex;
          uniform vec3 uShallow, uDeep;
          varying vec3 vWPos;
          float wHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float wNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(wHash(i), wHash(i + vec2(1, 0)), u.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), u.x), u.y);
          }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize(mix(normal, nonPerturbedNormal, smoothstep(18.0, 140.0, length(vViewPosition)) * 0.9));`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 huv = (vWPos.xz + uHalf) / (uHalf * 2.0);
          float ground = (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) ? -8.0 : texture2D(uHeightTex, huv).r;
          float depth = max(0.0, vWPos.y - ground);
          float dk = smoothstep(0.0, 6.5, depth);
          vec3 wcol = mix(uShallow, uDeep, dk);
          // animated shore foam lines
          float n = wNoise(vWPos.xz * 0.35 + uTime * 0.15);
          float band = smoothstep(1.8, 0.0, depth);
          float lines = smoothstep(0.45, 0.85, sin(depth * 7.0 - uTime * 2.0 + n * 3.0) * 0.5 + 0.5);
          float foam = clamp(band * (lines * 0.95 + smoothstep(0.45, 0.0, depth)), 0.0, 1.0) * (0.7 + 0.3 * n);
          // sparse whitecaps out at sea
          foam += smoothstep(0.93, 0.99, wNoise(vWPos.xz * 0.08 + vec2(uTime * 0.05, 0.0))) * 0.25 * dk;
          diffuseColor.rgb = mix(wcol, vec3(1.0), clamp(foam, 0.0, 1.0));
          diffuseColor.a = mix(0.55, 0.93, dk) + foam * 0.4;`);
    };
    const geo = new THREE.PlaneGeometry(1400, 1400, 140, 140);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'water';
    scene.add(this.mesh);
    // far ocean out to the horizon
    const far = new THREE.Mesh(new THREE.RingGeometry(690, 2600, 64, 1), new THREE.MeshStandardMaterial({ color: '#1560c9', roughness: 0.1, metalness: 0.05, envMapIntensity: 1.3 }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.05;
    scene.add(far);
  }

  update(dt, t) {
    this.uniforms.uTime.value = t;
    this.normalMap.offset.set(t * 0.004, t * 0.0025);
  }
}
