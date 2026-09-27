import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// CC0 Kenney models (see public/models/env/CREDITS.md).
export const ENV_MODELS = [
  'house1', 'house-3', 'house-4', 'house-5', 'house-7', 'tower',
  'palm-long', 'palm-short', 'formation-large-stone', 'formation-stone', 'barrel',
  'blaster', 'blaster-repeater', 'blaster-a',
];

// Loads GLBs and flattens each into "parts" (one merged geometry per material),
// normalized so the model is centered on X/Z with its base at y = 0.
export class Models {
  constructor() { this.lib = new Map(); }

  async load(names = ENV_MODELS, onProgress = () => {}) {
    const loader = new GLTFLoader();
    let done = 0;
    await Promise.all(names.map(async (n) => {
      const gltf = await loader.loadAsync(`/models/env/${n}.glb`);
      this.lib.set(n, this._flatten(gltf.scene));
      onProgress(++done / names.length);
    }));
  }

  _flatten(root) {
    root.updateMatrixWorld(true);
    const byMat = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const textured = !!o.material.map;
      for (const k of Object.keys(g.attributes)) {
        if (k !== 'position' && k !== 'normal' && !(textured && k === 'uv')) g.deleteAttribute(k);
      }
      const key = o.material.name + (textured ? ':t' : '');
      if (!byMat.has(key)) byMat.set(key, { material: o.material, geos: [] });
      byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
    });
    const box = new THREE.Box3();
    const parts = [];
    for (const { material, geos } of byMat.values()) {
      const geometry = geos.length > 1 ? mergeGeometries(geos) : geos[0];
      geometry.computeBoundingBox();
      box.union(geometry.boundingBox);
      parts.push({ name: material.name.replace(/\.\d+$/, ''), material, geometry });
    }
    const c = box.getCenter(new THREE.Vector3());
    for (const p of parts) {
      p.geometry.translate(-c.x, -box.min.y, -c.z);
      p.geometry.computeBoundingSphere();
    }
    const size = box.getSize(new THREE.Vector3());
    return { parts, size };
  }

  get(name) { return this.lib.get(name); }

  // A regular (non-instanced) group, e.g. for held weapons.
  instance(name, materialFn) {
    const m = this.get(name);
    const g = new THREE.Group();
    for (const p of m.parts) {
      const mesh = new THREE.Mesh(p.geometry, materialFn ? materialFn(p) : p.material);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /**
   * One InstancedMesh per part for many placements.
   * placements: [{ x, y, z, rot, rx?, rz?, scale (number | Vector3), colors?: { [partName]: Color } }]
   */
  instanced(name, placements, { castShadow = true, receiveShadow = true, material } = {}) {
    const m = this.get(name);
    const group = new THREE.Group();
    const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const e = new THREE.Euler();
    for (const part of m.parts) {
      const tinted = placements.some((pl) => pl.colors && pl.colors[part.name]);
      let mat = material ? material(part) : part.material.clone();
      if (tinted) mat.color.set('#ffffff');
      const im = new THREE.InstancedMesh(part.geometry, mat, placements.length);
      placements.forEach((pl, i) => {
        q.setFromEuler(e.set(pl.rx || 0, pl.rot || 0, pl.rz || 0, 'YXZ'));
        if (typeof pl.scale === 'number' || pl.scale === undefined) s.setScalar(pl.scale ?? 1); else s.copy(pl.scale);
        mat4.compose(p.set(pl.x, pl.y, pl.z), q, s);
        im.setMatrixAt(i, mat4);
        if (tinted) im.setColorAt(i, pl.colors?.[part.name] || part.material.color);
      });
      im.castShadow = castShadow;
      im.receiveShadow = receiveShadow;
      im.computeBoundingSphere();
      group.add(im);
    }
    return group;
  }
}
