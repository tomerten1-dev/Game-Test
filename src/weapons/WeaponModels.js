import * as THREE from 'three';
import { part, merge, mat } from '../world/geomUtils.js';
import { RARITIES } from './WeaponDefs.js';

// Procedural low-poly guns (forward = +Z). Geometry cached per type+rarity.
const cache = new Map();
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25, flatShading: true });

const DARK = '#2b2f38';
const MID = '#4a505c';
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (r, l, s = 8) => new THREE.CylinderGeometry(r, r, l, s);

function build(type, rarity) {
  const acc = new THREE.Color(RARITIES[rarity].color);
  const p = [];
  let muzzle = 0.5, foregrip = 0.3;
  if (type === 'pistol') {
    p.push(part(BOX(0.07, 0.09, 0.3), DARK, mat(0, 0.03, 0.08)));
    p.push(part(BOX(0.075, 0.035, 0.28), acc, mat(0, 0.085, 0.08)));
    p.push(part(BOX(0.06, 0.16, 0.08), MID, mat(0, -0.07, -0.02, -0.25, 0, 0)));
    p.push(part(CYL(0.018, 0.08), DARK, mat(0, 0.04, 0.25, Math.PI / 2, 0, 0)));
    muzzle = 0.3; foregrip = 0.05;
  } else if (type === 'ar') {
    p.push(part(BOX(0.08, 0.12, 0.55), DARK, mat(0, 0.02, 0.2)));
    p.push(part(BOX(0.085, 0.04, 0.5), acc, mat(0, 0.1, 0.2)));
    p.push(part(CYL(0.022, 0.3), MID, mat(0, 0.03, 0.62, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.07, 0.1, 0.22), MID, mat(0, 0.01, -0.17)));
    p.push(part(BOX(0.06, 0.18, 0.08), DARK, mat(0, -0.12, 0.22, 0.25, 0, 0)));
    p.push(part(BOX(0.05, 0.14, 0.06), MID, mat(0, -0.1, 0.02, -0.25, 0, 0)));
    p.push(part(BOX(0.05, 0.05, 0.14), '#1d2027', mat(0, 0.14, 0.14)));
    muzzle = 0.78; foregrip = 0.38;
  } else if (type === 'shotgun') {
    p.push(part(BOX(0.09, 0.11, 0.5), '#6b4a2e', mat(0, 0.0, 0.12)));
    p.push(part(CYL(0.035, 0.6), DARK, mat(0, 0.05, 0.45, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.03, 0.5), MID, mat(0, -0.02, 0.42, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.1, 0.07, 0.16), acc, mat(0, -0.03, 0.4)));
    p.push(part(BOX(0.07, 0.14, 0.24), '#6b4a2e', mat(0, -0.04, -0.2, 0.18, 0, 0)));
    muzzle = 0.76; foregrip = 0.4;
  } else {
    p.push(part(BOX(0.08, 0.12, 0.36), DARK, mat(0, 0.02, 0.1)));
    p.push(part(BOX(0.085, 0.04, 0.3), acc, mat(0, 0.1, 0.1)));
    p.push(part(CYL(0.02, 0.14), MID, mat(0, 0.03, 0.33, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.05, 0.22, 0.06), MID, mat(0, -0.15, 0.14, 0.1, 0, 0)));
    p.push(part(BOX(0.05, 0.13, 0.06), DARK, mat(0, -0.09, -0.04, -0.25, 0, 0)));
    p.push(part(BOX(0.03, 0.05, 0.16), acc, mat(0, 0.0, -0.14)));
    muzzle = 0.41; foregrip = 0.22;
  }
  const geo = merge(p);
  geo.computeBoundingSphere();
  return { geo, muzzle, foregrip };
}

export function makeWeaponMesh(type, rarity) {
  const key = `${type}:${rarity}`;
  let g = cache.get(key);
  if (!g) { g = build(type, rarity); cache.set(key, g); }
  const mesh = new THREE.Mesh(g.geo, material);
  mesh.castShadow = true;
  mesh.userData.muzzle = new THREE.Vector3(0, 0.04, g.muzzle);
  mesh.userData.foregrip = g.foregrip;
  return mesh;
}
