import * as THREE from 'three';
import { addWind } from '../effects/Shaders.js';
import { TOWNS } from './Terrain.js';
import { VARIANT_KEY } from './Variant.js';

// Quaternius "Stylized Nature" trees, bushes and clover (CC0) and Elijah Cobden's Stylized Trees
// (oaks, columnar trees, pines, willows, swiggly and dead trees) with painted textures.
// Detailed trees are expensive, so they are shown only near the camera (instanced LOD);
// the cheap procedural round trees stand in further away.

const loader = new THREE.TextureLoader();
function tex(url, srgb = true) {
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

// Leaves keep the painted detail (texture luminance) but take their hue from the instance color,
// so one texture gives green, lime and autumn trees.
function leafMaterial(map, gain) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec4 leafTex = texture2D(map, vMapUv);
      float leafL = dot(leafTex.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = vec3(clamp(leafL * ${gain.toFixed(2)}, 0.45, 1.5));
      diffuseColor.a *= leafTex.a;`);
  };
  m.customProgramCacheKey = () => `leaf${gain}`;
  return m;
}

function depthMaterial(map) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42 });
}

export class Nature {
  constructor(scene, models, quality) {
    this.scene = scene;
    this.models = models;
    const leaves = tex('/models/nature/leaves_tree.png');
    const white = tex('/models/nature/leaves_white.png');
    const flowers = tex('/models/nature/flowers.png');
    const barkN = tex('/models/nature/bark_normal.png', false);
    barkN.wrapS = barkN.wrapT = THREE.RepeatWrapping;

    this.leafMat = leafMaterial(leaves, 11.5);
    addWind(this.leafMat, { amount: 0.035, pivot: 2.5, speed: 1.3 });
    this.barkMat = new THREE.MeshStandardMaterial({ color: '#8a5c3a', normalMap: barkN, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 0.9 });
    this.flowerMat = new THREE.MeshStandardMaterial({ map: flowers, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
    addWind(this.flowerMat, { amount: 0.06, pivot: 0.4, speed: 1.6 });
    this.bushLeafMat = leafMaterial(leaves, 11.5);
    addWind(this.bushLeafMat, { amount: 0.06, pivot: 0.4, speed: 1.6 });
    this.cloverMat = new THREE.MeshStandardMaterial({ map: white, alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 });
    addWind(this.cloverMat, { amount: 0.1, pivot: 0.1, speed: 1.9 });
    this.leafDepth = depthMaterial(leaves);

    this.lodRadius = quality.trees > 300 ? 95 : 55;
    this.treeTypes = ['nature/CommonTree_1', 'nature/CommonTree_3', 'trees/STOak1', 'trees/STOak2', 'trees/STOak3', 'trees/STColumnar1', 'trees/STColumnar3']
      .filter((n) => models.get(n));
    // per-type caps keep the detailed-tree budget near the old two-type setup; nearest trees win
    const hi = quality.trees > 300;
    this.detail = this.treeTypes.map((name) => this._detailMeshes(name, hi ? 28 : 16));
    this.pineDetail = ['trees/STPine1', 'trees/STPine2', 'trees/STPine3', 'trees/STPine4'].filter((n) => models.get(n)).map((name) => this._detailMeshes(name, hi ? 30 : 16));
  }

  get ready() { return this.treeTypes.length > 0; }

  _geo(name, part) { return this.models.get(name)?.parts.find((p) => p.name === part)?.geometry; }

  _part(name, re) { return this.models.get(name)?.parts.find((p) => re.test(p.name)); }

  // Bark + leaf materials for a model: the shared Quaternius ones, or ones made from the model's own textures.
  _mats(name) {
    if (name.startsWith('nature/')) return { bark: this.barkMat, leaves: this.leafMat, depth: this.leafDepth };
    const fam = name.replace(/\d+$/, '');
    if (this.stMats?.has(fam)) return this.stMats.get(fam);
    const barkPart = this._part(name, /Trunk|Bark/), leafPart = this._part(name, /Leaves/);
    const bark = barkPart.material.clone();
    bark.roughness = 0.9; bark.metalness = 0;
    let leaves = null, depth = null;
    if (leafPart?.material.map) {
      leaves = leafMaterial(leafPart.material.map, 1.0);
      addWind(leaves, { amount: /Willow/.test(fam) ? 0.06 : 0.035, pivot: 2.5, speed: 1.2 });
      depth = depthMaterial(leafPart.material.map);
    }
    const m = { bark, leaves, depth };
    (this.stMats || (this.stMats = new Map())).set(fam, m);
    return m;
  }

  _detailMeshes(name, cap) {
    const mats = this._mats(name);
    const bark = new THREE.InstancedMesh(this._part(name, /Trunk|Bark/).geometry, mats.bark, cap);
    const leafPart = this._part(name, /Leaves/);
    const leaves = leafPart && mats.leaves ? new THREE.InstancedMesh(leafPart.geometry, mats.leaves, cap) : null;
    if (leaves) leaves.customDepthMaterial = mats.depth;
    for (const im of [bark, leaves]) {
      if (!im) continue;
      im.count = 0;
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.scene.add(im);
    }
    if (leaves) leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    return { bark, leaves, cap, height: this.models.get(name).size.y };
  }

  // Detailed trees within lodRadius of the camera; returns the set of tree indices shown in detail.
  updateLOD(trees, cam, detail = this.detail) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const counts = detail.map(() => 0);
    const shown = new Set();
    if (!detail.length) return shown;
    const r2 = this.lodRadius * this.lodRadius;
    const near = [];
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const d2 = (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2;
      if (d2 < r2) near.push(i, d2);
    }
    const order = [];
    for (let j = 0; j < near.length; j += 2) order.push(j);
    order.sort((a, b) => near[a + 1] - near[b + 1]);
    for (const j of order) {
      const i = near[j], t = trees[i];
      const k = t.variant % detail.length;
      const d = detail[k];
      if (counts[k] >= d.cap) continue;
      const sc = t.height / d.height;
      m.compose(p.set(t.x, t.y - 0.15, t.z), q.setFromAxisAngle(up, t.yaw), s.setScalar(sc));
      d.bark.setMatrixAt(counts[k], m);
      if (d.leaves) { d.leaves.setMatrixAt(counts[k], m); d.leaves.setColorAt(counts[k], t.color); }
      counts[k]++;
      shown.add(i);
    }
    detail.forEach((d, k) => {
      d.bark.count = counts[k];
      d.bark.instanceMatrix.needsUpdate = true;
      if (d.leaves) {
        d.leaves.count = counts[k];
        d.leaves.instanceMatrix.needsUpdate = true;
        d.leaves.instanceColor.needsUpdate = true;
      }
    });
    return shown;
  }

  // Always-visible feature trees: willows by the lake and low coast, swiggly trees in meadows,
  // dead trees on the mountain and around Rusty Works (lots more on the desert island).
  scatterFeatureTrees(candidate, free, rand, colliders, greens) {
    const place = {}; // model -> placements
    const add = (name, x, y, z, height, color, colR) => {
      const info = this.models.get(name);
      if (!info) return;
      const sc = height / info.size.y;
      (place[name] || (place[name] = [])).push({ x, y: y - 0.2, z, yaw: rand() * Math.PI * 2, sc, color });
      colliders.add({ kind: 'circle', x, z, r: colR, y0: y - 2, y1: y + height * 0.7, tree: true });
      this.occluders?.push({ x, y: y + height * 0.55, z, r: info.size.x * sc * 0.35 });
    };
    const green = () => greens[Math.floor(rand() * greens.length)].clone().multiplyScalar(0.9 + rand() * 0.2);
    const desert = VARIANT_KEY === 'desert';
    // willows ring the lake
    const lake = TOWNS.find((t) => t.kind === 'lake');
    if (lake && !desert) {
      for (let i = 0; i < 40 && (place['trees/STWillow1']?.length || 0) + (place['trees/STWillow2']?.length || 0) + (place['trees/STWillow3']?.length || 0) < 9; i++) {
        const a = rand() * Math.PI * 2, d = lake.r * (1.05 + rand() * 0.45);
        const x = lake.x + Math.cos(a) * d, z = lake.z + Math.sin(a) * d;
        const pt = candidate(1.2, 14, 0.8, x, z);
        if (!pt || !free(pt.x, pt.z, 6)) continue;
        add(`trees/STWillow${1 + Math.floor(rand() * 3)}`, pt.x, pt.y, pt.z, 9 + rand() * 3, green(), 0.7);
      }
    }
    for (let i = 0; i < 60 && !desert; i++) {
      if (i > 20) break;
      const pt = candidate(1.4, 4.5, 0.85);
      if (!pt || !free(pt.x, pt.z, 6)) continue;
      add(`trees/STWillow${1 + Math.floor(rand() * 3)}`, pt.x, pt.y, pt.z, 8 + rand() * 3, green(), 0.7);
    }
    // swiggly trees in little clusters
    for (let c = 0; c < (desert ? 3 : 7); c++) {
      const pt = candidate(3, 22, 0.88);
      if (!pt) continue;
      for (let k = 0; k < 3 + Math.floor(rand() * 3); k++) {
        const q = candidate(3, 24, 0.85, pt.x + (rand() - 0.5) * 14, pt.z + (rand() - 0.5) * 14);
        if (!q || !free(q.x, q.z, 4)) continue;
        add(`trees/STSwiggly${1 + Math.floor(rand() * 4)}`, q.x, q.y, q.z, 4.5 + rand() * 2.5, green(), 0.4);
      }
    }
    // dead trees
    const dead = ['trees/STPine5', 'trees/STPine6', 'trees/STPine7', 'trees/STOak5', 'trees/STColumnar5'];
    const deadH = { 'trees/STPine5': 9, 'trees/STPine6': 4, 'trees/STPine7': 6, 'trees/STOak5': 7, 'trees/STColumnar5': 8 };
    const works = TOWNS.find((t) => t.kind === 'factory');
    const nDead = desert ? 70 : 22;
    for (let i = 0, n = 0; i < nDead * 5 && n < nDead; i++) {
      let pt;
      if (!desert && works && i % 3 === 0) pt = candidate(1.5, 40, 0.8, works.x + (rand() - 0.5) * works.r * 3.2, works.z + (rand() - 0.5) * works.r * 3.2);
      else pt = desert ? candidate(2, 60, 0.8) : candidate(18, 70, 0.75);
      if (!pt || !free(pt.x, pt.z, 5)) continue;
      const name = dead[Math.floor(rand() * dead.length)];
      add(name, pt.x, pt.y, pt.z, deadH[name] * (0.8 + rand() * 0.4), null, 0.35);
      n++;
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of Object.entries(place)) {
      const mats = this._mats(name);
      const leafPart = this._part(name, /Leaves/);
      const bark = new THREE.InstancedMesh(this._part(name, /Trunk|Bark/).geometry, mats.bark, list.length);
      const leaves = leafPart && mats.leaves ? new THREE.InstancedMesh(leafPart.geometry, mats.leaves, list.length) : null;
      if (leaves) leaves.customDepthMaterial = mats.depth;
      list.forEach((pl, i) => {
        m.compose(p.set(pl.x, pl.y, pl.z), q.setFromAxisAngle(up, pl.yaw), s.setScalar(pl.sc));
        bark.setMatrixAt(i, m);
        if (leaves) { leaves.setMatrixAt(i, m); leaves.setColorAt(i, pl.color || new THREE.Color(1, 1, 1)); }
      });
      for (const im of [bark, leaves]) {
        if (!im) continue;
        im.castShadow = true;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        this.scene.add(im);
      }
    }
    return Object.fromEntries(Object.entries(place).map(([k, v]) => [k, v.length]));
  }

  // Flowering bushes (some without flowers) and clover ground cover.
  scatterUndergrowth(candidate, free, rand, counts) {
    const bushName = 'nature/Bush_Common_Flowers';
    const bush = this.models.get(bushName);
    if (bush) {
      const leafGeo = this._geo(bushName, 'Leaves_NormalTree'), flowerGeo = this._geo(bushName, 'Flowers');
      const leafIM = new THREE.InstancedMesh(leafGeo, this.bushLeafMat, counts.bushes);
      const flowerIM = new THREE.InstancedMesh(flowerGeo, this.flowerMat, counts.bushes);
      leafIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(counts.bushes * 3), 3);
      let nl = 0, nf = 0;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const c = new THREE.Color();
      for (let i = 0; i < counts.bushes * 6 && nl < counts.bushes; i++) {
        const pt = candidate(2.4, 26, 0.82);
        if (!pt || !free(pt.x, pt.z, 3)) continue;
        const sc = 0.7 + rand() * 0.6;
        m.compose(p.set(pt.x, pt.y - 0.1, pt.z), q.setFromAxisAngle(up, rand() * 6.28), s.setScalar(sc));
        leafIM.setMatrixAt(nl, m);
        leafIM.setColorAt(nl, c.setHSL(0.24 + rand() * 0.08, 0.6, 0.42 + rand() * 0.1));
        nl++;
        if (rand() < 0.55) flowerIM.setMatrixAt(nf++, m);
        this.occluders?.push({ x: pt.x, y: pt.y + 0.7 * sc, z: pt.z, r: 1.0 * sc });
      }
      leafIM.count = nl; flowerIM.count = nf;
      for (const im of [leafIM, flowerIM]) { im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im); }
    }
    const clovers = ['nature/Clover_1', 'nature/Clover_2'].filter((n) => this.models.get(n));
    for (const name of clovers) {
      const geo = this._geo(name, 'Leaves');
      const n = Math.round(counts.clovers / clovers.length);
      const im = new THREE.InstancedMesh(geo, this.cloverMat, n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const c = new THREE.Color();
      let k = 0;
      for (let i = 0; i < n * 5 && k < n; i++) {
        const pt = candidate(2.5, 24, 0.85);
        if (!pt || !free(pt.x, pt.z, 1.5)) continue;
        const sc = 0.45 + rand() * 0.35;
        m.compose(p.set(pt.x, pt.y - 0.05, pt.z), q.setFromAxisAngle(up, rand() * 6.28), s.setScalar(sc));
        im.setMatrixAt(k, m);
        im.setColorAt(k, c.setHSL(0.26 + rand() * 0.07, 0.55, 0.38 + rand() * 0.12));
        k++;
      }
      im.count = k;
      im.castShadow = false;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
  }
}
