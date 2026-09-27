import * as THREE from 'three';
import { addWind } from '../effects/Shaders.js';

// Quaternius "Stylized Nature" trees, bushes and clover (CC0) with painted textures.
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
    this.treeTypes = ['nature/CommonTree_1', 'nature/CommonTree_3'].filter((n) => models.get(n));
    this.detail = this.treeTypes.map((name) => this._detailMeshes(name, 90));
  }

  get ready() { return this.treeTypes.length > 0; }

  _geo(name, part) { return this.models.get(name)?.parts.find((p) => p.name === part)?.geometry; }

  _detailMeshes(name, cap) {
    const bark = new THREE.InstancedMesh(this._geo(name, 'Bark_NormalTree'), this.barkMat, cap);
    const leaves = new THREE.InstancedMesh(this._geo(name, 'Leaves_NormalTree'), this.leafMat, cap);
    leaves.customDepthMaterial = this.leafDepth;
    for (const im of [bark, leaves]) {
      im.count = 0;
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.scene.add(im);
    }
    leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    return { bark, leaves, cap, height: this.models.get(name).size.y };
  }

  // Detailed trees within lodRadius of the camera; returns the set of tree indices shown in detail.
  updateLOD(trees, cam) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const counts = this.detail.map(() => 0);
    const shown = new Set();
    const r2 = this.lodRadius * this.lodRadius;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      if ((t.x - cam.x) ** 2 + (t.z - cam.z) ** 2 > r2) continue;
      const k = t.variant % this.detail.length;
      const d = this.detail[k];
      if (counts[k] >= d.cap) continue;
      const sc = t.height / d.height;
      m.compose(p.set(t.x, t.y - 0.15, t.z), q.setFromAxisAngle(up, t.yaw), s.setScalar(sc));
      d.bark.setMatrixAt(counts[k], m);
      d.leaves.setMatrixAt(counts[k], m);
      d.leaves.setColorAt(counts[k], t.color);
      counts[k]++;
      shown.add(i);
    }
    this.detail.forEach((d, k) => {
      d.bark.count = d.leaves.count = counts[k];
      d.bark.instanceMatrix.needsUpdate = d.leaves.instanceMatrix.needsUpdate = true;
      d.leaves.instanceColor.needsUpdate = true;
    });
    return shown;
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
