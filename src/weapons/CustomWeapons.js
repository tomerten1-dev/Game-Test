import * as THREE from 'three';
import { readScene, baseName } from '../player/CustomSkin.js';
import { WEAPONS } from './WeaponDefs.js';

// Your own gun models: files in <project>/weapons named after the weapon (and optionally its rarity)
// replace that gun's model - e.g. "ar_legendary.glb" is the legendary Assault Rifle, "pump.fbx" every
// Pump Shotgun. Formats as for skins (.glb .gltf .fbx .dae .obj, or .blend with Blender installed).
// The folder is git-ignored, so the models stay on your computer.
// Each model is laid along +Z with its muzzle (the thinner end) forward and the grip / magazine down;
// WeaponModels sizes and places it like the gun it replaces.
const FILES = import.meta.glob('/weapons/**/*.{glb,gltf,fbx,dae,obj,GLB,GLTF,FBX,DAE,OBJ}', { query: '?url', import: 'default', eager: true });
const EXTRAS = import.meta.glob('/weapons/**/*.{bin,png,jpg,jpeg,webp,tga,bmp,gif,mtl,BIN,PNG,JPG,JPEG,WEBP,TGA,BMP,GIF,MTL}', { query: '?url', import: 'default', eager: true });

const RARITY_WORDS = {
  common: 0, gray: 0, grey: 0, uncommon: 1, green: 1, rare: 2, blue: 2, epic: 3, purple: 3,
  legendary: 4, gold: 4, orange: 4, mythic: 5, exotic: 6,
};
// other names for weapon types
const TYPE_WORDS = { assault: 'ar', rifle: 'ar', assaultrifle: 'ar', scar: 'ar', m4: 'ar', shotty: 'pump', tac: 'shotgun', rpg: 'rocket', heavy: 'dmr' };

// 'ar' (every rarity) or 'ar:4' (legendary only) -> { parts: [{ geometry, material }], size, muzzleY }
export const CUSTOM_GUNS = {};
export const customGun = (type, rarity) => CUSTOM_GUNS[`${type}:${rarity}`] || CUSTOM_GUNS[type] || null;

// "ar_legendary" -> { type: 'ar', rarities: [4] }
function parseName(name) {
  const words = name.toLowerCase().split(/[\s_\-.]+/).filter(Boolean);
  let type = null;
  const rarities = [];
  for (const w of words) {
    if (!type && WEAPONS[w]) type = w;
    else if (!type && TYPE_WORDS[w]) type = TYPE_WORDS[w];
    else if (RARITY_WORDS[w] !== undefined) rarities.push(RARITY_WORDS[w]);
    else if (/^[0-6]$/.test(w)) rarities.push(+w);
  }
  return type ? { type, rarities } : null;
}

// One static, forward-facing copy of the model: meshes baked into plain geometry (skinned guns too).
function bake(scene) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) { m.side = THREE.DoubleSide; if (m.map) m.map.anisotropy = 4; }
    parts.push({ geometry, material: Array.isArray(o.material) ? mats : mats[0] });
  });
  if (!parts.length) return null;
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
  const size = box.getSize(new THREE.Vector3());
  // the barrel runs along the longest horizontal side
  const axis = size.x >= size.z ? 'x' : 'z';
  const lo = box.min[axis], hi = box.max[axis], span = hi - lo;
  // the muzzle end is the thinner one: compare how wide the model is near each end
  const ends = [new THREE.Box3(), new THREE.Box3()];
  const v = new THREE.Vector3();
  for (const p of parts) {
    const pos = p.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      const t = (v[axis] - lo) / span;
      if (t < 0.12) ends[0].expandByPoint(v); else if (t > 0.88) ends[1].expandByPoint(v);
    }
  }
  const area = (b) => { if (b.isEmpty()) return Infinity; const s = b.getSize(new THREE.Vector3()); return s.y * (axis === 'x' ? s.z : s.x); };
  const forwardIsHi = area(ends[1]) <= area(ends[0]);
  const dir = new THREE.Vector3(); dir[axis] = forwardIsHi ? 1 : -1;
  const turn = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, 0, 1));
  const muzzleEnd = (forwardIsHi ? ends[1] : ends[0]).getCenter(new THREE.Vector3());
  const m = new THREE.Matrix4().makeRotationFromQuaternion(turn);
  // grip and magazine hang below the barrel: if most of the model is above it, it's upside down
  if (box.max.y - muzzleEnd.y > muzzleEnd.y - box.min.y) m.premultiply(new THREE.Matrix4().makeRotationZ(Math.PI));
  const out = new THREE.Box3();
  for (const p of parts) { p.geometry.applyMatrix4(m); p.geometry.computeBoundingBox(); out.union(p.geometry.boundingBox); p.geometry.computeBoundingSphere(); }
  const muzzle = muzzleEnd.applyMatrix4(m);
  return { parts, box: out, muzzleY: muzzle.y };
}

export async function loadWeaponFolder() {
  for (const [path, url] of Object.entries(FILES)) {
    const segs = path.split('/'), file = segs[segs.length - 1], dir = segs.slice(0, -1).join('/') + '/';
    const stem = file.replace(/\.[^.]+$/, '');
    // "weapons/ar_legendary/scene.gltf" is named by its folder
    const name = /^(scene|model|mesh|untitled)$/i.test(stem) && segs.length > 3 ? segs[segs.length - 2] : stem;
    const what = parseName(name);
    if (!what) { console.warn(`weapons/: "${file}" - start the name with a weapon (ar, pump, smg, sniper...), e.g. ar_legendary`); continue; }
    const files = {};
    for (const [p, u] of Object.entries(EXTRAS)) if (p.startsWith(dir)) files[baseName(p)] = u;
    try {
      const gun = bake(await readScene(await (await fetch(url)).arrayBuffer(), file, files));
      if (!gun) continue;
      for (const key of what.rarities.length ? what.rarities.map((r) => `${what.type}:${r}`) : [what.type]) CUSTOM_GUNS[key] = gun;
    } catch (e) { console.warn('weapon file', path, e); }
  }
}
