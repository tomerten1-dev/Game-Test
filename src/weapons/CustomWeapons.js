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

// Eigenvectors of a symmetric 3x3 matrix, largest eigenvalue first (Jacobi rotations).
function principalAxes(A) {
  const a = A.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), cs = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = cs * x - sn * y; a[k][q] = sn * x + cs * y; }
    for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = cs * x - sn * y; a[q][k] = sn * x + cs * y; }
    for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = cs * x - sn * y; V[k][q] = sn * x + cs * y; }
  }
  return [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]).map((i) => new THREE.Vector3(V[0][i], V[1][i], V[2][i]).normalize());
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
  // Orientation from the shape itself (models are often saved tilted, e.g. posed in a hand):
  // the main axis of the vertices is the barrel, the second one runs from the top of the gun to the
  // bottom of the grip / magazine.
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  let n = 0;
  for (const p of parts) { const pos = p.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { c.add(v.fromBufferAttribute(pos, i)); n++; } }
  c.divideScalar(n);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of parts) {
    const pos = p.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).sub(c);
      const q = [v.x, v.y, v.z];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) C[r][k] += q[r] * q[k];
    }
  }
  const [e1, e2] = principalAxes(C);
  // project: a along the barrel, b across it (top <-> grip)
  const proj = [];
  for (const p of parts) { const pos = p.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).sub(c); proj.push([v.dot(e1), v.dot(e2)]); } }
  // the grip / magazine is the long tail across the barrel: that side is down
  let s3 = 0, bMin = Infinity, bMax = -Infinity;
  for (const [, b] of proj) { s3 += b * b * b; bMin = Math.min(bMin, b); bMax = Math.max(bMax, b); }
  const down = s3 > 0 ? 1 : -1; // +e2 is down when the tail points that way
  // the grip sits in the rear half of the gun
  let gA = 0, gN = 0;
  const cut = down > 0 ? bMax - (bMax - bMin) * 0.3 : bMin + (bMax - bMin) * 0.3;
  for (const [a, b] of proj) if (down > 0 ? b > cut : b < cut) { gA += a; gN++; }
  const fwd = gN && gA / gN > 0 ? -1 : 1; // grip toward +e1 -> the muzzle is at -e1
  const F = e1.clone().multiplyScalar(fwd), U = e2.clone().multiplyScalar(-down);
  const X = new THREE.Vector3().crossVectors(U, F).normalize();
  U.crossVectors(F, X).normalize();
  // rotation taking F -> +Z, U -> +Y, X -> +X, about the centre
  const m = new THREE.Matrix4().makeBasis(X, U, F).transpose().multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  // muzzle: the front few percent of the gun
  let aMax = -Infinity; for (const [a] of proj) aMax = Math.max(aMax, a * fwd);
  const muzzleEnd = new THREE.Vector3(); let mN = 0;
  for (const p of parts) { const pos = p.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.clone().sub(c).dot(e1) * fwd > aMax - 0.06 * (aMax * 2)) { muzzleEnd.add(v); mN++; } } }
  muzzleEnd.divideScalar(mN || 1);
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
