import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';

export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.42).normalize();
export const SKY_TOP = new THREE.Color('#1c5ad8');
export const SKY_HORIZON = new THREE.Color('#aedcff');

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

const skyFrag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.38));
  col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.3, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.78, 0.5) * pow(s, 6.0) * 0.22;
  col += vec3(1.0, 0.9, 0.7) * pow(s, 90.0) * 0.8;
  col = mix(col, vec3(1.0, 0.97, 0.88) * 4.0, smoothstep(0.99935, 0.99965, s));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSkyMesh(radius = 950) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    uniforms: {
      uTop: { value: SKY_TOP },
      uHorizon: { value: SKY_HORIZON },
      uSunDir: { value: SUN_DIR },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  return mesh;
}

function makeCloudGeometry(rand) {
  const parts = [];
  const puffs = 5 + Math.floor(rand() * 4);
  const len = 14 + rand() * 14;
  for (let i = 0; i < puffs; i++) {
    const t = puffs === 1 ? 0.5 : i / (puffs - 1);
    const r = (4 + rand() * 4) * (1 - Math.abs(t - 0.5) * 0.9);
    const g = new THREE.IcosahedronGeometry(r, 2);
    g.translate((t - 0.5) * len, r * 0.25 + rand() * 1.5, (rand() - 0.5) * 6);
    parts.push(g);
  }
  // a couple of top puffs for volume
  for (let i = 0; i < 2; i++) {
    const r = 5 + rand() * 3;
    const g = new THREE.IcosahedronGeometry(r, 2);
    g.translate((rand() - 0.5) * len * 0.5, r * 0.8 + 2, (rand() - 0.5) * 3);
    parts.push(g);
  }
  const geo = mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }));
  // flatten bottoms
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.25);
  geo.computeVertexNormals();
  return geo;
}

export class Clouds {
  constructor(scene, count = 26) {
    const rand = mulberry32(99);
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#aebfd9', emissiveIntensity: 0.45, fog: false });
    this.templates = [];
    this.items = [];
    const perTemplate = Math.ceil(count / 4);
    for (let t = 0; t < 4; t++) {
      const im = new THREE.InstancedMesh(makeCloudGeometry(rand), mat, perTemplate);
      im.frustumCulled = false;
      scene.add(im);
      this.templates.push(im);
      for (let i = 0; i < perTemplate; i++) {
        const ang = rand() * Math.PI * 2;
        const dist = 60 + rand() * 420;
        this.items.push({
          im, index: i,
          x: Math.cos(ang) * dist, z: Math.sin(ang) * dist,
          y: 125 + rand() * 60,
          s: 0.9 + rand() * 1.1,
          rot: rand() * Math.PI,
          speed: 2 + rand() * 2.5,
        });
      }
    }
    this.dummy = new THREE.Object3D();
    this.update(0);
  }

  update(dt) {
    const d = this.dummy;
    for (const c of this.items) {
      c.x += c.speed * dt;
      if (c.x > 520) c.x = -520;
      d.position.set(c.x, c.y, c.z);
      d.rotation.set(0, c.rot, 0);
      d.scale.setScalar(c.s);
      d.updateMatrix();
      c.im.setMatrixAt(c.index, d.matrix);
    }
    for (const im of this.templates) im.instanceMatrix.needsUpdate = true;
  }
}
