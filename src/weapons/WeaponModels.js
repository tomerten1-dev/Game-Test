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
  } else if (type === 'pump') {
    p.push(part(BOX(0.09, 0.1, 0.46), '#3b2a1c', mat(0, 0.0, 0.1)));
    p.push(part(CYL(0.034, 0.66), DARK, mat(0, 0.05, 0.46, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.045, 0.2, 10), '#8a5a2b', mat(0, -0.01, 0.52, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.095, 0.06, 0.12), acc, mat(0, 0.07, -0.02)));
    p.push(part(BOX(0.07, 0.16, 0.28), '#3b2a1c', mat(0, -0.05, -0.24, 0.22, 0, 0)));
    muzzle = 0.8; foregrip = 0.5;
  } else if (type === 'burst') {
    p.push(part(BOX(0.085, 0.13, 0.6), '#39414f', mat(0, 0.02, 0.2)));
    p.push(part(BOX(0.09, 0.045, 0.5), acc, mat(0, 0.1, 0.2)));
    p.push(part(CYL(0.024, 0.26, 8), DARK, mat(0, 0.03, 0.64, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.06, 0.08, 0.16), '#1d2027', mat(0, 0.17, 0.12)));
    p.push(part(CYL(0.03, 0.12, 8), '#6fd0ff', mat(0, 0.17, 0.21, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.06, 0.2, 0.08), DARK, mat(0, -0.12, 0.24, 0.2, 0, 0)));
    p.push(part(BOX(0.05, 0.14, 0.06), MID, mat(0, -0.1, 0.03, -0.25, 0, 0)));
    p.push(part(BOX(0.07, 0.11, 0.22), '#39414f', mat(0, 0.0, -0.2)));
    muzzle = 0.78; foregrip = 0.4;
  } else if (type === 'shotgun') {
    p.push(part(BOX(0.09, 0.11, 0.5), '#6b4a2e', mat(0, 0.0, 0.12)));
    p.push(part(CYL(0.035, 0.6), DARK, mat(0, 0.05, 0.45, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.03, 0.5), MID, mat(0, -0.02, 0.42, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.1, 0.07, 0.16), acc, mat(0, -0.03, 0.4)));
    p.push(part(BOX(0.07, 0.14, 0.24), '#6b4a2e', mat(0, -0.04, -0.2, 0.18, 0, 0)));
    muzzle = 0.76; foregrip = 0.4;
  } else if (type === 'sniper') {
    p.push(part(BOX(0.07, 0.11, 0.62), '#3d4a3a', mat(0, 0.0, 0.18)));
    p.push(part(BOX(0.075, 0.035, 0.5), acc, mat(0, 0.07, 0.2)));
    p.push(part(CYL(0.02, 0.62), DARK, mat(0, 0.02, 0.8, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.035, 0.34), '#1d2027', mat(0, 0.14, 0.14, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.045, 0.05), '#1d2027', mat(0, 0.14, 0.33, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.06, 0.16, 0.26), '#5a4630', mat(0, -0.05, -0.28, 0.12, 0, 0)));
    p.push(part(BOX(0.05, 0.14, 0.06), DARK, mat(0, -0.1, 0.02, -0.25, 0, 0)));
    p.push(part(BOX(0.02, 0.16, 0.02), MID, mat(0.04, -0.1, 0.62, 0.4, 0, 0)));
    p.push(part(BOX(0.02, 0.16, 0.02), MID, mat(-0.04, -0.1, 0.62, 0.4, 0, 0)));
    muzzle = 1.1; foregrip = 0.42;
  } else if (type === 'rocket') {
    p.push(part(CYL(0.1, 1.05, 12), '#4f6b3a', mat(0, 0.06, 0.12, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.115, 0.12, 12), acc, mat(0, 0.06, 0.6, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.115, 0.1, 12), DARK, mat(0, 0.06, -0.38, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.06, 0.16, 0.08), DARK, mat(0, -0.1, 0.12, -0.2, 0, 0)));
    p.push(part(BOX(0.05, 0.14, 0.06), DARK, mat(0, -0.09, 0.36, 0.2, 0, 0)));
    p.push(part(BOX(0.05, 0.08, 0.18), '#1d2027', mat(0.12, 0.12, 0.2)));
    muzzle = 0.66; foregrip = 0.36;
  } else if (type === 'minigun') {
    p.push(part(BOX(0.16, 0.16, 0.42), '#3a3f4a', mat(0, 0.02, -0.05)));
    p.push(part(BOX(0.165, 0.05, 0.3), acc, mat(0, 0.12, -0.05)));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.push(part(CYL(0.018, 0.7, 6), DARK, mat(Math.cos(a) * 0.055, 0.02 + Math.sin(a) * 0.055, 0.5, Math.PI / 2, 0, 0)));
    }
    p.push(part(CYL(0.085, 0.04, 12), MID, mat(0, 0.02, 0.5, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.085, 0.04, 12), MID, mat(0, 0.02, 0.8, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.05, 0.16, 0.06), DARK, mat(0, -0.12, -0.02, -0.2, 0, 0)));
    p.push(part(BOX(0.04, 0.1, 0.22), '#1d2027', mat(0, 0.16, 0.12)));
    muzzle = 0.86; foregrip = 0.3;
  } else if (type === 'launcher') {
    p.push(part(CYL(0.1, 0.18, 12), '#4f5a3a', mat(0, 0.0, 0.12, Math.PI / 2, 0, 0)));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(part(CYL(0.03, 0.19, 8), '#2b2f38', mat(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.12, Math.PI / 2, 0, 0))); }
    p.push(part(CYL(0.045, 0.42, 10), DARK, mat(0, 0.03, 0.42, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.09, 0.05, 0.3), acc, mat(0, 0.1, 0.25)));
    p.push(part(BOX(0.06, 0.16, 0.08), DARK, mat(0, -0.12, 0.02, -0.25, 0, 0)));
    p.push(part(BOX(0.07, 0.1, 0.24), '#4f5a3a', mat(0, -0.02, -0.2)));
    muzzle = 0.66; foregrip = 0.36;
  } else if (type === 'flare') {
    p.push(part(BOX(0.08, 0.1, 0.24), '#d9642a', mat(0, 0.03, 0.06)));
    p.push(part(CYL(0.035, 0.26, 10), '#e8742f', mat(0, 0.05, 0.2, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.085, 0.03, 0.2), acc, mat(0, 0.1, 0.06)));
    p.push(part(BOX(0.06, 0.16, 0.08), '#2b2f38', mat(0, -0.07, -0.02, -0.25, 0, 0)));
    muzzle = 0.34; foregrip = 0.05;
  } else if (type === 'sixshooter') {
    p.push(part(CYL(0.02, 0.36, 8), '#8a8f99', mat(0, 0.05, 0.24, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.05, 0.09, 6), '#6b7079', mat(0, 0.03, 0.03, Math.PI / 2, 0, 0)));
    p.push(part(BOX(0.05, 0.03, 0.34), acc, mat(0, 0.09, 0.14)));
    p.push(part(BOX(0.055, 0.17, 0.08), '#6b4a2e', mat(0, -0.08, -0.06, -0.35, 0, 0)));
    muzzle = 0.42; foregrip = 0.05;
  } else if (type === 'bow') {
    const arc = new THREE.TorusGeometry(0.42, 0.022, 6, 20, Math.PI * 0.9);
    p.push(part(arc, '#5b3b22', mat(0, 0, 0.05, 0, Math.PI / 2, Math.PI / 2 - Math.PI * 0.45)));
    p.push(part(BOX(0.05, 0.2, 0.05), acc, mat(0, 0, 0.47)));
    p.push(part(BOX(0.006, 0.8, 0.006), '#f0ead8', mat(0, 0, 0.23)));
    p.push(part(CYL(0.012, 0.75, 5), '#c9b08a', mat(0, 0.02, 0.3, Math.PI / 2, 0, 0)));
    p.push(part(new THREE.ConeGeometry(0.025, 0.07, 4), '#9fa7b3', mat(0, 0.02, 0.7, Math.PI / 2, 0, 0)));
    muzzle = 0.72; foregrip = 0.47;
  } else if (type === 'blade') {
    p.push(part(BOX(0.035, 0.07, 0.24), '#1d2027', mat(0, 0, -0.08)));
    p.push(part(BOX(0.16, 0.05, 0.05), acc, mat(0, 0, 0.05)));
    p.push(part(BOX(0.018, 0.09, 0.95), '#bfefff', mat(0, 0.0, 0.55)));
    p.push(part(BOX(0.02, 0.025, 0.9), '#4ff4ff', mat(0, 0.045, 0.53)));
    muzzle = 1.0; foregrip = 0.0;
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

// Mod bench attachments drawn on the gun.
const ATT_MAT = new THREE.MeshStandardMaterial({ color: '#23272f', roughness: 0.5, metalness: 0.4 });
const LENS_MAT = new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff2020', emissiveIntensity: 0.8 });
const DRUM_GEO = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 14).rotateZ(Math.PI / 2);
const MOD_GEO = {};
const modGeo = (k, make) => (MOD_GEO[k] ||= make()); // one geometry per attachment shape, shared by every gun
const SPEED_MAT = new THREE.MeshStandardMaterial({ color: '#d9a13a', roughness: 0.5 });
function addMods(group, mods) {
  if (!mods) return group;
  const mz = group.userData.muzzle, len = mz.z;
  const top = (group.userData.top ?? 0.1);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; group.add(o); return o; };
  if (mods.optic === 'reddot' || mods.optic === 'holo') {
    add(modGeo(mods.optic, () => new THREE.BoxGeometry(0.05, 0.05, mods.optic === 'holo' ? 0.12 : 0.07)), ATT_MAT, 0, top + 0.035, len * 0.3);
    add(modGeo('lens', () => new THREE.BoxGeometry(0.03, 0.03, 0.005)), LENS_MAT, 0, top + 0.04, len * 0.3 + 0.03);
  } else if (mods.optic) {
    const L = mods.optic === 'x4' ? 0.3 : 0.2;
    add(modGeo(mods.optic, () => new THREE.CylinderGeometry(0.035, 0.035, L, 10).rotateX(Math.PI / 2)), ATT_MAT, 0, top + 0.05, len * 0.3);
  }
  if (mods.mag === 'drum') add(DRUM_GEO, ATT_MAT, 0, -0.1, len * 0.4);
  else if (mods.mag === 'speed') add(modGeo('speed', () => new THREE.BoxGeometry(0.05, 0.13, 0.07)), SPEED_MAT, 0, -0.1, len * 0.4);
  if (mods.under === 'laser') add(modGeo('laser', () => new THREE.BoxGeometry(0.04, 0.04, 0.12)), LENS_MAT, 0, -0.04, len * 0.72);
  else if (mods.under) add(modGeo(mods.under, () => new THREE.BoxGeometry(0.04, mods.under === 'vertical' ? 0.12 : 0.07, 0.06)), ATT_MAT, 0, -0.08, len * 0.68);
  if (mods.barrel === 'suppressor') { add(modGeo('supp', () => new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10).rotateX(Math.PI / 2)), ATT_MAT, 0, mz.y, len + 0.1); mz.z += 0.2; }
  else if (mods.barrel === 'brake') { add(modGeo('brake', () => new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateX(Math.PI / 2)), ATT_MAT, 0, mz.y, len + 0.03); mz.z += 0.06; }
  return group;
}

// Styloo gun models for every gun (procedural fallback if they fail to load).
let models = null;
export function setWeaponModels(m) { models = m; }
const KENNEY = {
  pistol: { name: 'guns/pew', length: 0.42, rotY: -Math.PI / 2, textured: true },
  smg: { name: 'guns/mac10', length: 0.5, rotY: -Math.PI / 2, textured: true },
  ar: { name: 'guns/ak47', length: 0.95, rotY: -Math.PI / 2, textured: true },
  burst: { name: 'guns/ak47variant', length: 0.95, rotY: -Math.PI / 2, textured: true },
  sniper: { name: 'guns/awp', length: 1.25, rotY: -Math.PI / 2, textured: true },
  pump: { name: 'guns/shotgun', length: 0.95, rotY: -Math.PI / 2, textured: true },
  shotgun: { name: 'guns/shotgun', length: 0.88, rotY: -Math.PI / 2, textured: true },
  rocket: { name: 'guns/rocket', length: 1.15, rotY: -Math.PI / 2, textured: true },
  drum: { name: 'guns/mac10', length: 0.62, rotY: -Math.PI / 2, textured: true, drum: true },
  dmr: { name: 'guns/awp', length: 1.05, rotY: -Math.PI / 2, textured: true },
  handcannon: { name: 'guns/pew', length: 0.52, rotY: -Math.PI / 2, textured: true },
  dualpistol: { name: 'guns/pew', length: 0.4, rotY: -Math.PI / 2, textured: true, dual: true },
  tracker: { name: 'guns/pew', length: 0.44, rotY: -Math.PI / 2, textured: true },
  dub: { name: 'guns/shotgun', length: 0.78, rotY: -Math.PI / 2, textured: true },
  stormscout: { name: 'guns/awp', length: 1.2, rotY: -Math.PI / 2, textured: true },
};
// Higher-rarity launchers get the fancier models.
const RARITY_MODEL = { rocket: { 4: { name: 'guns/rocketvariant' }, 5: { name: 'guns/quadrocket', rotY: -Math.PI / 2, length: 1.05 } } };
const kenneyMats = new Map();
const stripeCache = new Map();

function buildKenney(type, rarity) {
  const base = KENNEY[type];
  const alt = RARITY_MODEL[type]?.[rarity];
  const cfg = alt && models.get(alt.name) ? { ...base, ...alt } : base;
  const info = models.get(cfg.name);
  if (!info) return null;
  const along = cfg.rotY % Math.PI === 0 ? info.size.z : info.size.x;
  const s = cfg.length / along;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = cfg.rotY;
  inner.scale.setScalar(s);
  inner.position.set(0, -info.size.y * s * 0.45, cfg.length * 0.3);
  for (const p of info.parts) {
    let m = kenneyMats.get(p.material);
    if (!m) {
      m = p.material.clone();
      m.roughness = cfg.textured ? 0.55 : 0.45;
      m.metalness = Math.min(0.3, m.metalness ?? 0);
      kenneyMats.set(p.material, m);
    }
    const mesh = new THREE.Mesh(p.geometry, m);
    mesh.castShadow = true;
    inner.add(mesh);
  }
  group.add(inner);
  if (cfg.dual) { const twin = inner.clone(); twin.position.x -= 0.24; group.add(twin); }
  if (cfg.drum) { const d = new THREE.Mesh(DRUM_GEO, ATT_MAT); d.position.set(0, -0.07, cfg.length * 0.42); group.add(d); }
  // glowing rarity stripe on top
  const key = type + rarity;
  if (!stripeCache.has(key)) stripeCache.set(key, [new THREE.BoxGeometry(0.035, 0.03, cfg.length * 0.55), new THREE.MeshStandardMaterial({ color: RARITIES[rarity].color, emissive: RARITIES[rarity].color, emissiveIntensity: 0.9, roughness: 0.4 })]);
  const stripe = new THREE.Mesh(...stripeCache.get(key));
  stripe.position.set(0, info.size.y * s * (cfg.textured ? 0.42 : 0.55) + 0.01, cfg.length * 0.3);
  group.add(stripe);
  group.userData.muzzle = new THREE.Vector3(0, 0.02, cfg.length * 0.85);
  group.userData.foregrip = cfg.length * 0.45;
  group.userData.top = info.size.y * s * 0.45;
  return group;
}

// Throwables / placeables (grenade, launch pad): small procedural meshes.
const itemGeoCache = {};
export function itemGeometry(kind) {
  if (itemGeoCache[kind]) return itemGeoCache[kind];
  let g;
  if (kind === 'shockwave') {
    g = merge([
      part(new THREE.SphereGeometry(0.12, 14, 10), '#8f7bff', mat(0, 0.12, 0)),
      part(new THREE.TorusGeometry(0.125, 0.02, 6, 16), '#e6e0ff', mat(0, 0.12, 0, Math.PI / 2, 0, 0)),
      part(new THREE.TorusGeometry(0.125, 0.02, 6, 16), '#e6e0ff', mat(0, 0.12, 0)),
    ]);
  } else if (kind === 'grappler') {
    g = merge([
      part(new THREE.BoxGeometry(0.1, 0.12, 0.36), '#3a3f4a', mat(0, 0.1, 0)),
      part(new THREE.BoxGeometry(0.06, 0.14, 0.07), '#2b2f38', mat(0, 0.0, -0.1, -0.25, 0, 0)),
      part(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), '#ffd23f', mat(0, 0.12, 0.22, Math.PI / 2, 0, 0)),
      part(new THREE.ConeGeometry(0.06, 0.1, 4), '#c9d6e8', mat(0, 0.12, 0.32, Math.PI / 2, 0, 0)),
    ]);
  } else if (kind === 'rift') {
    g = merge([
      part(new THREE.SphereGeometry(0.14, 14, 10), '#c86bff', mat(0, 0.16, 0)),
      part(new THREE.TorusGeometry(0.2, 0.025, 6, 20), '#f0d4ff', mat(0, 0.16, 0, Math.PI / 2 - 0.4, 0, 0)),
      part(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 10), '#3a2a55', mat(0, 0.02, 0)),
    ]);
  } else if (kind === 'grenade') {
    g = merge([
      part(new THREE.SphereGeometry(0.11, 12, 10), '#5f8f3e', mat(0, 0.11, 0)),
      part(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 8), '#3a3f47', mat(0, 0.23, 0)),
      part(new THREE.TorusGeometry(0.035, 0.01, 6, 10), '#d8dde4', mat(0.05, 0.27, 0, 0, Math.PI / 2, 0)),
      part(new THREE.BoxGeometry(0.03, 0.12, 0.02), '#3a3f47', mat(-0.06, 0.18, 0, 0, 0, 0.35)),
    ]);
  } else {
    g = merge([
      part(new THREE.CylinderGeometry(0.62, 0.7, 0.14, 20), '#2c3140', mat(0, 0.07, 0)),
      part(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), '#ffcf3f', mat(0, 0.16, 0)),
      part(new THREE.ConeGeometry(0.22, 0.18, 3), '#2c3140', mat(0, 0.24, 0.12, Math.PI / 2, 0, 0)),
      part(new THREE.ConeGeometry(0.22, 0.18, 3), '#2c3140', mat(0, 0.24, -0.12, Math.PI / 2, 0, 0)),
    ]);
  }
  g.computeBoundingSphere();
  return (itemGeoCache[kind] = g);
}
export function makeItemMesh(kind) {
  const m = new THREE.Mesh(itemGeometry(kind), material);
  m.castShadow = true;
  return m;
}

// Styloo throwables (grenade, smoke, impulse, fire flask), scaled up so they read in the world.
const THROWABLE_MODEL = { grenade: 'guns/nade', smoke: 'guns/smoke', impulse: 'guns/flashbang', fire: 'guns/incendiary' };
export function makeThrowableMesh(kind, scale = 2.2) {
  const name = THROWABLE_MODEL[kind];
  if (!name || !models?.get(name)) return null;
  const inner = models.instance(name);
  inner.scale.setScalar(scale);
  inner.position.y = -models.get(name).size.y * scale * 0.5;
  const g = new THREE.Group();
  g.add(inner);
  g.userData.muzzle = new THREE.Vector3();
  g.userData.foregrip = 0;
  return g;
}

// Styloo bullets: a few rounds of the ammo type stood on the pickup.
const BULLET_MODEL = { light: 'guns/bullet_light', medium: 'guns/bullet_medium', shells: 'guns/bullet_shells', heavy: 'guns/bullet_heavy' };
export function makeAmmoPickupMesh(ammoType) {
  const box = makeAmmoBoxMesh(1.6);
  if (!box) return null;
  const g = new THREE.Group();
  g.add(box);
  const name = BULLET_MODEL[ammoType];
  const info = name && models.get(name);
  if (info) {
    const s = 0.16 / info.size.y;
    const top = models.get('guns/ammobox').size.y * 1.6;
    for (let i = 0; i < 3; i++) {
      const b = models.instance(name);
      b.scale.setScalar(s);
      b.position.set((i - 1) * 0.07, top, 0);
      g.add(b);
    }
  }
  return g;
}

// Styloo ammo box for ammo pickups (null if not loaded).
let ammoMat = null;
export function makeAmmoBoxMesh(scale = 1) {
  const info = models?.get('guns/ammobox');
  if (!info) return null;
  // the texture is quite dark; brighten it so boxes read at a distance
  if (!ammoMat) { ammoMat = info.parts[0].material.clone(); ammoMat.color.setRGB(1.7, 2.0, 1.6); }
  const m = models.instance('guns/ammobox', () => ammoMat);
  m.scale.setScalar(scale);
  return m;
}

// KayKit axe used as the harvesting tool; keeps its original units so it fits the hand slot.
export function makePickaxeMesh() {
  const info = models?.get('kk/axe_1handed');
  if (!info) return null;
  const m = info.scene.clone(true);
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return m;
}

export function makeWeaponMesh(type, rarity, mods = null) {
  const k = models && KENNEY[type] ? buildKenney(type, rarity) : null;
  if (k) return addMods(k, mods);
  const key = `${type}:${rarity}`;
  let g = cache.get(key);
  if (!g) { g = build(type, rarity); cache.set(key, g); }
  const mesh = new THREE.Mesh(g.geo, material);
  mesh.castShadow = true;
  mesh.userData.muzzle = new THREE.Vector3(0, 0.04, g.muzzle);
  mesh.userData.foregrip = g.foregrip;
  return addMods(mesh, mods);
}
