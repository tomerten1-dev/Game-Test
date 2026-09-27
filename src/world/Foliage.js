import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, smoothstep } from '../core/noise.js';
import { jitter, gradientY } from './geomUtils.js';
import { TOWNS, WORLD_HALF, ISLAND_RADIUS, PALETTE } from './Terrain.js';
import { quality } from '../core/device.js';

const TREE_GREENS = ['#4caf50', '#5fc25a', '#3f9e4c', '#78cc5c', '#56b84e'].map((c) => new THREE.Color(c));
const AUTUMN = ['#f39a34', '#e9722c', '#f4b83f', '#d9582b'].map((c) => new THREE.Color(c));
const PINE_GREENS = ['#2f7d52', '#3a915e', '#2b6f49', '#44a066'].map((c) => new THREE.Color(c));

function roundCanopyGeo(rand) {
  const parts = [];
  const blobs = [[0, 0, 0, 1.25], [0.75, -0.25, 0.3, 0.85], [-0.65, -0.2, -0.35, 0.9], [0.1, 0.55, -0.1, 0.85]];
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.deleteAttribute('uv');
    g.translate(x, y, z);
    parts.push(g);
  }
  let geo = mergeGeometries(parts);
  geo = jitter(geo, 0.18, rand);
  return gradientY(geo, new THREE.Color(0.55, 0.6, 0.55), new THREE.Color(1.15, 1.15, 1.05));
}

function pineCanopyGeo() {
  const parts = [];
  const tiers = [[1.7, 1.9, 0], [1.3, 1.7, 1.15], [0.9, 1.5, 2.2]];
  for (const [r, h, y] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 7, 1);
    g.deleteAttribute('uv');
    g.translate(0, y + h / 2, 0);
    parts.push(g.toNonIndexed());
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  return gradientY(geo, new THREE.Color(0.55, 0.6, 0.55), new THREE.Color(1.1, 1.15, 1.05));
}

export class Foliage {
  constructor(scene, terrain, colliders) {
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    this.rand = mulberry32(4242);
    this.occupied = new Set();
    this._trees();
    this._rocks();
    this._bushes();
    this._grass();
  }

  _free(x, z, cell = 3) {
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (this.occupied.has(k)) return false;
    this.occupied.add(k);
    return true;
  }

  _inTown(x, z, pad = 6) {
    for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return true;
    return false;
  }

  _candidate(minH, maxH, minNy) {
    const r = this.rand;
    for (let tries = 0; tries < 60; tries++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (ISLAND_RADIUS + 10);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (this.terrain.normalAt(x, z).y < minNy) continue;
      if (this._inTown(x, z)) continue;
      return { x, z, h };
    }
    return null;
  }

  _trees() {
    const r = this.rand;
    const count = quality.trees;
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.85 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const rounds = new THREE.InstancedMesh(roundCanopyGeo(r), canopyMat, count);
    const pines = new THREE.InstancedMesh(pineCanopyGeo(), canopyMat, count);
    let nT = 0, nR = 0, nP = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const forest = this.terrain.noise;
    for (let i = 0; i < count * 4 && nT < count; i++) {
      const c = this._candidate(2.6, 34, 0.8);
      if (!c) continue;
      // cluster trees into forests
      const f = forest.fbm(c.x * 0.018 + 100, c.z * 0.018, 3);
      if (f < -0.15 && r() > 0.15) continue;
      if (!this._free(c.x, c.z, 4)) continue;
      const pine = c.h > 16 ? r() < 0.8 : r() < 0.3;
      const sc = (pine ? 1.0 : 0.9) + r() * 0.7;
      const trunkH = (pine ? 1.4 : 2.1) * sc;
      const yaw = r() * Math.PI * 2;
      q.setFromAxisAngle(up, yaw);
      m.compose(p.set(c.x, c.h - 0.3, c.z), q, s.set(sc, trunkH + 0.3, sc));
      trunks.setMatrixAt(nT, m);
      trunks.setColorAt(nT, col.set('#7b5335').multiplyScalar(0.85 + r() * 0.3));
      nT++;
      if (pine) {
        m.compose(p.set(c.x, c.h + trunkH * 0.75, c.z), q, s.set(sc, sc * (1 + r() * 0.3), sc));
        pines.setMatrixAt(nP, m);
        pines.setColorAt(nP, col.copy(PINE_GREENS[Math.floor(r() * PINE_GREENS.length)]));
        nP++;
      } else {
        const cs = sc * (1.1 + r() * 0.3);
        m.compose(p.set(c.x, c.h + trunkH + cs * 0.7, c.z), q, s.set(cs * 1.3, cs * 1.15, cs * 1.3));
        rounds.setMatrixAt(nR, m);
        const autumn = r() < 0.13;
        const base = autumn ? AUTUMN[Math.floor(r() * AUTUMN.length)] : TREE_GREENS[Math.floor(r() * TREE_GREENS.length)];
        rounds.setColorAt(nR, col.copy(base).multiplyScalar(0.9 + r() * 0.2));
        nR++;
      }
      this.colliders.add({ kind: 'circle', x: c.x, z: c.z, r: 0.38 * sc, y0: c.h - 2, y1: c.h + trunkH + 4 * sc, tree: true });
    }
    for (const [im, n] of [[trunks, nT], [rounds, nR], [pines, nP]]) {
      im.count = n;
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
    this.treeCount = nT;
  }

  _rocks() {
    const r = this.rand;
    const count = 150;
    let geo = new THREE.DodecahedronGeometry(1, 1);
    geo.deleteAttribute('uv');
    geo = jitter(geo, 0.35, r);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count * 6 && n < count; i++) {
      const mountainBias = r() < 0.4;
      const c = mountainBias ? this._candidate(12, 48, 0.4) : this._candidate(0.5, 30, 0.6);
      if (!c) continue;
      if (!this._free(c.x, c.z, 5)) continue;
      const big = r() < 0.25;
      const base = big ? 1.8 + r() * 1.6 : 0.5 + r() * 0.9;
      s.set(base * (0.8 + r() * 0.5), base * (0.55 + r() * 0.4), base * (0.8 + r() * 0.5));
      q.setFromEuler(e.set(r() * 0.4, r() * Math.PI * 2, r() * 0.4));
      m.compose(p.set(c.x, c.h - s.y * 0.2, c.z), q, s);
      im.setMatrixAt(n, m);
      const g = 0.75 + r() * 0.35;
      im.setColorAt(n, col.set(PALETTE.rock).multiplyScalar(g).lerp(new THREE.Color('#a39e93'), r() * 0.3));
      n++;
      this.colliders.add({ kind: 'circle', x: c.x, z: c.z, r: Math.max(s.x, s.z) * 0.85, y0: c.h - 3, y1: c.h + s.y * 0.8, rock: true });
    }
    im.count = n;
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.scene.add(im);
  }

  _bushes() {
    const r = this.rand;
    const count = 260;
    let geo = new THREE.IcosahedronGeometry(1, 1);
    geo.deleteAttribute('uv');
    geo = jitter(geo, 0.25, r);
    gradientY(geo, new THREE.Color(0.5, 0.55, 0.5), new THREE.Color(1.15, 1.2, 1.05));
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.9 });
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count * 5 && n < count; i++) {
      const c = this._candidate(2.4, 28, 0.8);
      if (!c) continue;
      if (!this._free(c.x, c.z, 2)) continue;
      const sc = 0.6 + r() * 0.7;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m.compose(p.set(c.x, c.h + sc * 0.25, c.z), q, s.set(sc * 1.2, sc * 0.8, sc * 1.2));
      im.setMatrixAt(n, m);
      const flower = r() < 0.12;
      im.setColorAt(n, flower ? col.set(['#ff8fb1', '#ffd166', '#c792ea'][Math.floor(r() * 3)]) : col.copy(TREE_GREENS[Math.floor(r() * TREE_GREENS.length)]).multiplyScalar(0.95));
      n++;
    }
    im.count = n;
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.scene.add(im);
  }

  _grass() {
    const r = mulberry32(777);
    const count = quality.grassCount;
    const radius = quality.grassRadius;
    const size = radius * 2;
    // one tuft = 5 blades (triangles)
    const blades = 5;
    const pos = [], tip = [], nor = [];
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + r() * 0.8;
      const d = r() * 0.18;
      const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
      const w = 0.055 + r() * 0.035;
      const h = 0.3 + r() * 0.28;
      const lean = 0.12 + r() * 0.12;
      const px = Math.cos(a + Math.PI / 2) * w, pz = Math.sin(a + Math.PI / 2) * w;
      pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean);
      tip.push(0, 0, 1);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      off[i * 4] = r() * size;
      off[i * 4 + 1] = r() * size;
      off[i * 4 + 2] = r() * Math.PI * 2;
      off[i * 4 + 3] = 0.75 + r() * 0.7;
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 4));
    geo.instanceCount = count;

    const uniforms = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2() },
      uSize: { value: size },
      uRadius: { value: radius },
      uHalf: { value: WORLD_HALF },
      uHeightTex: { value: this.terrain.buildDataTexture() },
      uGrassA: { value: PALETTE.grassA.clone() },
      uGrassB: { value: PALETTE.grassB.clone() },
    };
    this.grassUniforms = uniforms;
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aOffset;
          attribute float aTip;
          uniform float uTime, uSize, uRadius, uHalf;
          uniform vec2 uCenter;
          uniform sampler2D uHeightTex;
          varying float vTip;
          varying float vVar;`)
        .replace('#include <begin_vertex>', `
          vec2 base = uCenter + mod(aOffset.xy - uCenter + uSize * 0.5, uSize) - uSize * 0.5;
          vec2 tuv = (base + uHalf) / (uHalf * 2.0);
          vec4 hd = texture2D(uHeightTex, tuv);
          float dist = length(base - uCenter);
          float fade = 1.0 - smoothstep(uRadius * 0.65, uRadius, dist);
          float sc = aOffset.w * smoothstep(0.25, 0.6, hd.g) * fade;
          float cr = cos(aOffset.z), sr = sin(aOffset.z);
          vec3 p = vec3(position.x * cr - position.z * sr, position.y, position.x * sr + position.z * cr) * sc;
          float w = sin(uTime * 1.7 + base.x * 0.13 + base.y * 0.09) * 0.6 + sin(uTime * 3.3 + base.x * 0.5 + base.y * 0.3) * 0.25;
          p.x += w * aTip * 0.2 * sc;
          p.z += w * aTip * 0.1 * sc;
          vec3 transformed = vec3(base.x, hd.r - 0.04, base.y) + p;
          vTip = aTip;
          vVar = hd.b;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uGrassA, uGrassB;
          varying float vTip;
          varying float vVar;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 gcol = mix(uGrassA, uGrassB, vVar);
          diffuseColor.rgb = mix(gcol * 0.6, gcol * 1.25 + vec3(0.03, 0.04, 0.0), vTip);`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.name = 'grass';
    this.scene.add(mesh);
    this.grassMesh = mesh;
  }

  update(dt, t, focus) {
    if (!this.grassUniforms) return;
    this.grassUniforms.uTime.value = t;
    this.grassUniforms.uCenter.value.set(focus.x, focus.z);
  }
}
