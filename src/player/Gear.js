import * as THREE from 'three';
import { isModel, customCosmetic } from './CustomCosmetics.js';
import { makePickaxeMesh } from '../weapons/WeaponModels.js';

// Cosmetic gear built from simple shapes: hats (part of some skins), back blings and harvesting
// tool skins. Sizes are in character-root units (a hero is ~1.95 tall; the head top is ~1.88).

export const HEAD_TOP = 1.86;
const M = {};
const std = (key, o) => (M[key] ||= new THREE.MeshStandardMaterial({ roughness: 0.5, ...o }));
const glow = (c, k = 1.6) => std('g' + c + k, { color: c, emissive: c, emissiveIntensity: k });
const col = (c, r = 0.55, m = 0) => std(`c${c}${r}${m}`, { color: c, roughness: r, metalness: m });

function add(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) m.scale.set(...s);
  m.castShadow = true;
  g.add(m);
  return m;
}

// ---------- hats (y = 0 at the top of the head) ----------
const HATS = {
  ice_horns(g) {
    add(g, new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), col('#cfe9ff', 0.3, 0.6), 0, -0.14, 0);
    add(g, new THREE.TorusGeometry(0.29, 0.03, 6, 22), col('#8fb8d9', 0.3, 0.7), 0, -0.13, 0, Math.PI / 2);
    for (const s of [-1, 1]) add(g, new THREE.ConeGeometry(0.06, 0.36, 8), glow('#9fe6ff', 0.8), s * 0.3, 0.02, 0, 0, 0, -s * 1.05);
  },
  pumpkin(g) {
    // a whole pumpkin over the head
    add(g, new THREE.SphereGeometry(0.46, 18, 14), col('#ff8a2a', 0.6), 0, -0.34, 0, 0, 0, 0, [1.08, 0.92, 1.04]);
    for (let i = 0; i < 6; i++) add(g, new THREE.TorusGeometry(0.45, 0.014, 4, 22), col('#d9651a', 0.7), 0, -0.34, 0, Math.PI / 2, (i / 6) * Math.PI, 0, [1.08, 0.92, 1]);
    add(g, new THREE.CylinderGeometry(0.04, 0.06, 0.16, 6), col('#5b7a2a'), 0, 0.12, 0);
    for (const x of [-0.15, 0.15]) add(g, new THREE.ConeGeometry(0.08, 0.1, 3), glow('#ffd23f', 2), x, -0.26, 0.46, Math.PI / 2, 0, Math.PI);
    add(g, new THREE.BoxGeometry(0.3, 0.06, 0.03), glow('#ffd23f', 2), 0, -0.46, 0.45);
  },
  astro(g) {
    add(g, new THREE.SphereGeometry(0.42, 22, 16), std('glass', { color: '#dff4ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false }), 0, -0.3, 0);
    add(g, new THREE.TorusGeometry(0.34, 0.05, 8, 24), col('#e9eef5', 0.3, 0.6), 0, -0.66, 0, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), col('#c9d3dc', 0.3, 0.7), 0.18, 0.12, 0);
    add(g, new THREE.SphereGeometry(0.04, 8, 6), glow('#ff4d6d', 2), 0.18, 0.26, 0);
  },
  cowboy(g) {
    add(g, new THREE.CylinderGeometry(0.46, 0.46, 0.03, 24), col('#8a5a34', 0.8), 0, -0.08, 0, 0, 0, 0, [1, 1, 0.85]);
    add(g, new THREE.CylinderGeometry(0.2, 0.25, 0.24, 16), col('#8a5a34', 0.8), 0, 0.04, 0);
    add(g, new THREE.CylinderGeometry(0.255, 0.255, 0.05, 16), col('#3b2414', 0.7), 0, -0.04, 0);
  },
  pirate(g) {
    add(g, new THREE.CylinderGeometry(0.34, 0.36, 0.2, 3), col('#1f2433', 0.7), 0, 0.0, 0, 0, Math.PI / 6, 0);
    add(g, new THREE.TorusGeometry(0.3, 0.02, 4, 3), col('#ffc93c', 0.3, 0.8), 0, 0.1, 0, Math.PI / 2, 0, Math.PI / 6);
    add(g, new THREE.SphereGeometry(0.05, 8, 6), col('#ffffff'), 0, 0.02, 0.3);
  },
  ninja(g) {
    add(g, new THREE.TorusGeometry(0.3, 0.045, 6, 24), col('#d62839', 0.6), 0, -0.2, 0, Math.PI / 2 - 0.1);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.05, 0.28, 0.02), col('#d62839', 0.6), s * 0.06, -0.33, -0.3, 0.3, 0, s * 0.3);
  },
  party(g) {
    add(g, new THREE.ConeGeometry(0.16, 0.42, 16), col('#ff7ab8', 0.5), 0.02, 0.12, 0, 0, 0, -0.12);
    for (let i = 0; i < 4; i++) add(g, new THREE.TorusGeometry(0.13 - i * 0.03, 0.012, 4, 16), col(['#ffd23f', '#5fd4ff', '#6ef0a8', '#ffffff'][i]), 0.02 - i * 0.012, 0.0 + i * 0.09, 0, Math.PI / 2 - 0.12, 0, 0);
    add(g, new THREE.SphereGeometry(0.05, 8, 6), col('#ffd23f'), -0.03, 0.34, 0);
  },
  halo(g) {
    add(g, new THREE.TorusGeometry(0.22, 0.03, 8, 28), glow('#fff3b0', 2.2), 0, 0.18, 0, Math.PI / 2);
  },
};

export function makeHat(id) {
  const b = HATS[id];
  if (!b) return null;
  const g = new THREE.Group();
  b(g);
  g.name = 'hat';
  return g;
}

// ---------- back blings (y = 0 at the root; sits on the upper back) ----------
const BACK = {
  antenna(g) {
    const bodyMat = col('#1a8f86', 0.5, 0.2), trim = col('#f2f5f8', 0.5);
    add(g, new THREE.BoxGeometry(0.34, 0.36, 0.18), bodyMat);
    add(g, new THREE.BoxGeometry(0.36, 0.08, 0.2), trim, 0, 0.2, 0);
    add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), trim, 0.12, 0.66, -0.02);
    add(g, new THREE.SphereGeometry(0.06, 10, 8), glow('#2ee6c9', 2.5), 0.12, 1.15, -0.02);
  },
  cape(g) {
    const geo = new THREE.PlaneGeometry(0.62, 0.95, 6, 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.cos(x * 4) * 0.04 - (0.47 - y) * 0.12); }
    geo.computeVertexNormals();
    add(g, geo, std('cape', { color: '#c8263d', roughness: 0.8, side: THREE.DoubleSide }), 0, -0.2, -0.05);
    add(g, new THREE.BoxGeometry(0.62, 0.05, 0.05), col('#ffc93c', 0.3, 0.8), 0, 0.27, 0);
  },
  wings(g) {
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      for (let i = 0; i < 4; i++) add(w, new THREE.SphereGeometry(0.22, 10, 6), col(i % 2 ? '#fdfaf3' : '#f1e6c8', 0.7), s * (0.14 + i * 0.1), 0.12 - i * 0.07, 0, 0, 0, s * (0.5 + i * 0.15), [1.4, 0.35, 0.12]);
      w.position.set(s * 0.08, 0.05, -0.05);
      w.rotation.y = s * 0.35;
      g.add(w);
    }
  },
  jetpack(g) {
    for (const s of [-1, 1]) {
      add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.46, 14), col('#c9d3dc', 0.3, 0.8), s * 0.12, 0, 0);
      add(g, new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), col('#ff4d6d', 0.4, 0.3), s * 0.12, 0.23, 0);
      add(g, new THREE.CylinderGeometry(0.06, 0.09, 0.1, 12), col('#3a3f4a', 0.4, 0.6), s * 0.12, -0.28, 0);
      add(g, new THREE.ConeGeometry(0.06, 0.2, 10), glow('#5fd4ff', 2.6), s * 0.12, -0.42, 0, Math.PI);
    }
    add(g, new THREE.BoxGeometry(0.16, 0.3, 0.1), col('#3a3f4a', 0.4, 0.6), 0, 0, 0.02);
  },
  shield(g) {
    add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24), col('#8a5a34', 0.8), 0, 0, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.34, 0.03, 6, 24), col('#c9d3dc', 0.3, 0.8), 0, 0, 0);
    add(g, new THREE.SphereGeometry(0.08, 12, 8), col('#ffc93c', 0.3, 0.8), 0, 0, -0.03);
    add(g, new THREE.BoxGeometry(0.04, 0.6, 0.02), col('#c9d3dc', 0.3, 0.8), 0, 0, -0.03);
    add(g, new THREE.BoxGeometry(0.6, 0.04, 0.02), col('#c9d3dc', 0.3, 0.8), 0, 0, -0.03);
  },
  guitar(g) {
    const body = col('#d9534f', 0.35, 0.1);
    add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), body, 0, -0.15, 0, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.15, 0.15, 0.08, 20), body, 0, 0.1, 0, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.085, 12), col('#1a1a1a'), 0, -0.05, -0.001, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.06, 0.55, 0.04), col('#6b4226', 0.6), 0, 0.45, 0);
    add(g, new THREE.BoxGeometry(0.1, 0.12, 0.04), col('#1a1a1a'), 0, 0.76, 0);
    g.rotation.z = 0.5;
  },
  quiver(g) {
    add(g, new THREE.CylinderGeometry(0.09, 0.08, 0.6, 12), col('#7b5230', 0.8), 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 ? 1 : -1) * 0.03, z = (i < 2 ? 1 : -1) * 0.03;
      add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), col('#d9c7a0'), x, 0.35, z);
      add(g, new THREE.ConeGeometry(0.03, 0.08, 3), col(['#ff4d6d', '#ffd23f', '#5fd4ff', '#6ef0a8'][i]), x, 0.6, z);
    }
    g.rotation.z = -0.45;
  },
  llama(g) {
    const fur = col('#c77dff', 0.8), st = col('#ffd23f', 0.7);
    add(g, new THREE.BoxGeometry(0.22, 0.2, 0.3), fur, 0, 0, 0);
    add(g, new THREE.BoxGeometry(0.23, 0.21, 0.05), st, 0, 0, 0.02);
    add(g, new THREE.BoxGeometry(0.1, 0.24, 0.1), fur, 0, 0.18, 0.1);
    add(g, new THREE.BoxGeometry(0.12, 0.1, 0.15), fur, 0, 0.3, 0.14);
    for (const x of [-0.04, 0.04]) add(g, new THREE.BoxGeometry(0.03, 0.08, 0.03), st, x, 0.39, 0.1);
    for (const [x, z] of [[-0.07, -0.1], [0.07, -0.1], [-0.07, 0.1], [0.07, 0.1]]) add(g, new THREE.BoxGeometry(0.05, 0.12, 0.05), fur, x, -0.14, z);
  },
  crystal(g) {
    add(g, new THREE.OctahedronGeometry(0.16), glow('#8f7bff', 1.8), 0, 0.25, -0.12, 0, 0, 0, [0.8, 1.5, 0.8]);
    for (let i = 0; i < 3; i++) add(g, new THREE.OctahedronGeometry(0.05), glow('#c9b8ff', 1.5), Math.cos(i * 2.1) * 0.22, 0.25 + Math.sin(i * 2.1) * 0.12, -0.12);
    g.userData.float = true;
  },
  sword(g) {
    add(g, new THREE.BoxGeometry(0.1, 0.8, 0.02), col('#dfe6ee', 0.2, 0.9), 0, 0.1, 0);
    add(g, new THREE.ConeGeometry(0.05, 0.12, 4), col('#dfe6ee', 0.2, 0.9), 0, -0.36, 0, Math.PI, Math.PI / 4);
    add(g, new THREE.BoxGeometry(0.3, 0.05, 0.05), col('#ffc93c', 0.3, 0.8), 0, 0.52, 0);
    add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), col('#5a3a20', 0.7), 0, 0.64, 0);
    g.rotation.z = 0.6;
  },
};

export function makeBackBling(id) {
  if (isModel(id)) { const g = customCosmetic(id); if (g) g.name = 'backbling'; return g; } // your own back bling model
  const b = BACK[id];
  if (!b) return null;
  const g = new THREE.Group();
  b(g);
  g.name = 'backbling';
  return g;
}

// Root-space point on top of the head (hats, the crown sit here). The Quaternius rig is measured
// from its head bone; the KayKit heroes all share HEAD_TOP.
export function headAnchor(character, lift = 0) {
  if (!character.q || !character.head) return new THREE.Vector3(0, HEAD_TOP + lift, 0);
  character.root.updateMatrixWorld(true);
  const p = character.head.getWorldPosition(new THREE.Vector3());
  character.root.worldToLocal(p);
  return p.set(0, p.y + character.headAbove + lift, p.z);
}

// Attach a back bling to a character (root space, then parented to the torso bone).
export function attachBackBling(character, id) {
  const g = makeBackBling(id);
  if (!g) return null;
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.position.set(0, id === 'cape' ? 1.02 : 0.78, id === 'cape' ? -0.2 : -0.24);
  if (character.q && character.chestBone) {
    // human proportions: hang it from the upper back
    character.root.updateMatrixWorld(true);
    const c = character.root.worldToLocal(character.chestBone.getWorldPosition(new THREE.Vector3()));
    wrap.position.set(0, c.y + (id === 'cape' ? 0.12 : -0.12), c.z + (id === 'cape' ? -0.12 : -0.17));
    wrap.scale.setScalar(0.85);
  }
  character.root.add(wrap);
  character.root.updateMatrixWorld(true);
  const torso = character.chestBone || character.spine;
  if (torso) torso.attach(wrap);
  return wrap;
}

export function attachHat(character, id) {
  const g = makeHat(id);
  if (!g) return null;
  // hats were made for big cartoon heads: shrink them onto the outfit characters' heads
  if (character.q) g.scale.setScalar(0.52);
  g.position.copy(headAnchor(character, character.q ? -0.02 : 0));
  character.root.add(g);
  character.root.updateMatrixWorld(true);
  if (character.head) character.head.attach(g);
  return g;
}

// ---------- harvesting tools (handle along +y from the grip, head at the top, like the KayKit axe) ----------
function tintedAxe(color, emissive, k = 0.6, metal = 0.8) {
  const m = makePickaxeMesh();
  if (!m) return null;
  const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k, metalness: metal, roughness: 0.25 });
  m.traverse((o) => { if (o.isMesh) o.material = mat; });
  return m;
}

const TOOLS = {
  gold: () => tintedAxe('#ffc93c', '#6b4a00', 0.5),
  crystal: () => tintedAxe('#9fe6ff', '#2a7fbf', 0.9, 0.2),
  candy() {
    const g = new THREE.Group();
    for (let i = 0; i < 10; i++) add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), col(i % 2 ? '#ffffff' : '#e8323c', 0.4), 0, 0.05 + i * 0.1, 0);
    const hook = new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI);
    add(g, hook, col('#e8323c', 0.4), 0.14, 1.0, 0);
    add(g, new THREE.ConeGeometry(0.06, 0.2, 8), col('#ffffff', 0.4), 0.28, 0.93, 0, 0, 0, Math.PI);
    return g;
  },
  pan() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.03, 0.035, 0.7, 10), col('#2b2b2b', 0.5, 0.3), 0, 0.35, 0);
    add(g, new THREE.CylinderGeometry(0.26, 0.22, 0.06, 24), col('#3a3a3a', 0.35, 0.7), 0, 0.95, 0, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.062, 24), col('#1c1c1c', 0.3, 0.8), 0, 0.95, 0.003, Math.PI / 2);
    return g;
  },
  hammer() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.035, 0.04, 1.05, 10), col('#8a5a34', 0.8), 0, 0.5, 0);
    add(g, new THREE.BoxGeometry(0.42, 0.2, 0.2), col('#8f99a6', 0.3, 0.9), 0, 1.02, 0);
    add(g, new THREE.BoxGeometry(0.06, 0.22, 0.22), col('#ffc93c', 0.3, 0.8), 0.18, 1.02, 0);
    return g;
  },
  neon() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.3, 12), col('#2b2f3a', 0.3, 0.8), 0, 0.12, 0);
    add(g, new THREE.BoxGeometry(0.12, 0.04, 0.06), col('#c9d3dc', 0.3, 0.8), 0, 0.28, 0);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 10), glow('#ff4fd8', 3), 0, 0.75, 0);
    return g;
  },
  wrench() {
    const g = new THREE.Group();
    add(g, new THREE.BoxGeometry(0.07, 0.95, 0.04), col('#c9d3dc', 0.25, 0.9), 0, 0.47, 0);
    const jaw = col('#c9d3dc', 0.25, 0.9);
    add(g, new THREE.BoxGeometry(0.28, 0.08, 0.05), jaw, 0.05, 0.98, 0);
    add(g, new THREE.BoxGeometry(0.07, 0.18, 0.05), jaw, 0.16, 1.07, 0);
    add(g, new THREE.BoxGeometry(0.07, 0.12, 0.05), jaw, -0.06, 1.04, 0);
    add(g, new THREE.BoxGeometry(0.09, 0.3, 0.06), col('#e8323c', 0.5), 0, 0.15, 0);
    return g;
  },
};

// A harvesting tool mesh for a skin id (null/'default' = the KayKit axe).
export function makeHarvestTool(id) {
  if (isModel(id)) return customCosmetic(id, makePickaxeMesh()) || makePickaxeMesh(); // your own pickaxe model
  const t = id && TOOLS[id];
  const m = t ? t() : null;
  if (m) { m.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return m; }
  return makePickaxeMesh();
}

export const HAT_IDS = Object.keys(HATS);
export const BACK_IDS = Object.keys(BACK);
export const TOOL_IDS = Object.keys(TOOLS);

// Kicks: a pair of sneakers over the outfit's boots, fixed to the foot bones (outfit characters only).
// v: { base, sole, accent } colours.
export function attachKicks(character, v) {
  if (!v || !character?.root) return null;
  const feet = [];
  character.root.traverse((o) => { if (o.isBone && (o.name === 'foot_l' || o.name === 'foot_r')) feet.push(o); });
  if (feet.length !== 2) return null;
  const mk = (c, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const base = mk(v.base), sole = mk(v.sole, 0.8), acc = mk(v.accent, 0.4);
  character.root.updateMatrixWorld(true);
  const rootQ = character.root.getWorldQuaternion(new THREE.Quaternion());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ);
  const out = [];
  for (const f of feet) {
    const shoe = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.27), base); upper.position.set(0, 0.06, 0.03);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), base); toe.scale.set(1, 0.75, 1.1); toe.position.set(0, 0.045, 0.16);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.035, 0.32), sole); s.position.set(0, 0.0, 0.04);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.03, 0.12), acc); stripe.position.set(0, 0.075, 0.02);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), acc); heel.position.set(0, 0.08, -0.1);
    for (const m of [upper, toe, s, stripe, heel]) { m.castShadow = true; shoe.add(m); }
    // place it under the ankle, pointing where the character faces, then hand it to the foot bone
    const fp = f.getWorldPosition(new THREE.Vector3());
    const ground = character.root.getWorldPosition(new THREE.Vector3()).y;
    shoe.position.set(fp.x, ground + 0.005, fp.z).addScaledVector(fwd, 0.02);
    shoe.quaternion.copy(rootQ);
    character.root.add(shoe);
    shoe.position.sub(character.root.getWorldPosition(new THREE.Vector3())).applyQuaternion(rootQ.clone().invert());
    shoe.quaternion.identity();
    shoe.scale.divideScalar(character.root.scale.x || 1);
    character.root.updateMatrixWorld(true);
    f.attach(shoe);
    out.push(shoe);
  }
  return out;
}
