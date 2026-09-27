import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { itemGeometry, makeThrowableMesh } from '../weapons/WeaponModels.js';
import { makeTrapMesh } from './Traps.js';

// Detailed models for consumables (pickups on the ground, held items and hotbar icons).
// Each is built once as a template (a few meshes with proper materials: glass bottles with
// glowing liquid, a medkit with a handle, bandage rolls...) and cloned per use.

const M = {};
function mat(key, opts) { return (M[key] ||= new THREE.MeshStandardMaterial(opts)); }
const glass = () => mat('glass', { color: '#dff4ff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false });
const cork = () => mat('cork', { color: '#9b6a3c', roughness: 0.9 });
const liquid = (c, key = c) => mat('liq' + key, { color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
const plain = (c, r = 0.55, m = 0) => mat(`p${c}${r}${m}`, { color: c, roughness: r, metalness: m });

function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// A potion bottle: glass body with glowing liquid inside, neck and cork.
function bottle(g, { r = 0.16, h = 0.3, neck = 0.06, liq = '#43b4ff', round = true }) {
  if (round) {
    g.add(mesh(new THREE.SphereGeometry(r * 0.9, 18, 14), liquid(liq), 0, r, 0));
    g.add(mesh(new THREE.SphereGeometry(r, 18, 14), glass(), 0, r, 0));
    g.add(mesh(new THREE.CylinderGeometry(neck, neck * 1.2, h * 0.45, 12), glass(), 0, r * 1.9 + h * 0.15, 0));
    g.add(mesh(new THREE.CylinderGeometry(neck * 1.05, neck * 1.05, 0.07, 12), cork(), 0, r * 1.9 + h * 0.4, 0));
  } else {
    g.add(mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, h * 0.8, 16), liquid(liq), 0, h * 0.42, 0));
    g.add(mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 16), glass(), 0, h / 2, 0));
    g.add(mesh(new THREE.CylinderGeometry(neck, neck, 0.1, 12), glass(), 0, h + 0.05, 0));
    g.add(mesh(new THREE.CylinderGeometry(neck * 1.1, neck * 1.1, 0.07, 12), cork(), 0, h + 0.12, 0));
  }
}

// Red cross made of two thin boxes on a face.
function cross(g, size, x, y, z, ry = 0, rx = 0) {
  const red = plain('#ff3b4e', 0.45);
  const grp = new THREE.Group();
  grp.add(mesh(new THREE.BoxGeometry(size, size * 0.3, 0.02), red));
  grp.add(mesh(new THREE.BoxGeometry(size * 0.3, size, 0.02), red));
  grp.position.set(x, y, z); grp.rotation.set(rx, ry, 0);
  g.add(grp);
}

const BUILDERS = {
  bandage(g) {
    const white = plain('#f6f3ec', 0.8);
    for (const [x, z] of [[-0.1, 0], [0.1, 0.03]]) {
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 18), white, x, 0.1, z, Math.PI / 2, 0, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.165, 10), plain('#c9c2b3', 0.8), x, 0.1, z, Math.PI / 2, 0, 0));
    }
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2), white, 0.02, 0.006, 0.16, 0, 0.3, 0)); // loose tail
    cross(g, 0.08, -0.1, 0.1, 0.09);
  },
  medkit(g) {
    g.add(mesh(new RoundedBoxGeometry(0.62, 0.34, 0.42, 3, 0.06), plain('#f5f7fb', 0.4), 0, 0.17, 0));
    g.add(mesh(new THREE.BoxGeometry(0.64, 0.05, 0.44), plain('#d7dde8', 0.5), 0, 0.2, 0));
    cross(g, 0.2, 0, 0.345, 0, 0, -Math.PI / 2);
    cross(g, 0.15, 0, 0.17, 0.215);
    cross(g, 0.15, 0, 0.17, -0.215, Math.PI);
    const handle = mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 16, Math.PI), plain('#4a505c', 0.5, 0.3), 0, 0.34, 0);
    g.add(handle);
    for (const x of [-0.2, 0.2]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.44), plain('#aeb6c4', 0.4, 0.4), x, 0.345, 0));
  },
  smallshield(g) { bottle(g, { r: 0.1, h: 0.26, neck: 0.04, liq: '#6fd0ff', round: false }); },
  bigshield(g) {
    bottle(g, { r: 0.17, neck: 0.06, liq: '#2f8dff' });
    g.add(mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24), plain('#e9f7ff', 0.3, 0.6), 0, 0.17, 0, Math.PI / 2));
  },
  medmist(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.32, 16), plain('#7dffb2', 0.35, 0.2), 0, 0.16, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.08, 16), plain('#2b7a55', 0.5), 0, 0.12, 0));
    g.add(mesh(new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), plain('#e9f7ff', 0.3, 0.4), 0, 0.32, 0));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.08, 0.1), plain('#3a3f4a', 0.4), 0, 0.42, 0.02));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), plain('#3a3f4a', 0.4), 0, 0.44, 0.08, Math.PI / 2));
    cross(g, 0.06, 0, 0.2, 0.088);
  },
  slurp(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.28, 18), plain('#7a4dd6', 0.35, 0.1), 0, 0.14, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.03, 18), liquid('#39f0d0', 'slurp'), 0, 0.285, 0));
    for (const y of [0.05, 0.23]) g.add(mesh(new THREE.TorusGeometry(0.145, 0.012, 6, 24), plain('#e9e0ff', 0.3, 0.5), 0, y, 0, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 8), plain('#ffffff', 0.4), 0.05, 0.38, 0, 0, 0, -0.3));
    g.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), liquid('#39f0d0', 'slurp'), -0.06, 0.3, 0.05));
  },
  chug(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 18), liquid('#1fb8ff', 'chug'), 0, 0.22, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.46, 18), glass(), 0, 0.23, 0));
    g.add(mesh(new THREE.SphereGeometry(0.21, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass(), 0, 0.46, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12), plain('#e7eef7', 0.3, 0.5), 0, 0.7, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), cork(), 0, 0.77, 0));
    g.add(mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI * 1.2), plain('#e7eef7', 0.3, 0.5), 0.24, 0.36, 0, 0, 0, -Math.PI * 0.6));
    for (const y of [0.1, 0.36]) g.add(mesh(new THREE.TorusGeometry(0.235, 0.015, 6, 24), plain('#8fd8ff', 0.3, 0.6), 0, y, 0, Math.PI / 2));
  },
  keg(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 18), plain('#2f6fd6', 0.4, 0.3), 0, 0.25, 0));
    for (const y of [0.07, 0.43]) g.add(mesh(new THREE.TorusGeometry(0.245, 0.02, 6, 24), plain('#c9d6e8', 0.3, 0.7), 0, y, 0, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), liquid('#6fd0ff', 'keg'), 0, 0.53, 0));
  },
  campfire(g) {
    const wood = plain('#6b4226', 0.9);
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 7), wood, 0, 0.08, 0, Math.PI / 2 - 0.25, (i * Math.PI * 2) / 3, 0));
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.DodecahedronGeometry(0.06, 0), plain('#8a8a8a', 0.9), Math.cos(i) * 0.26, 0.03, Math.sin(i) * 0.26));
    g.add(mesh(new THREE.ConeGeometry(0.1, 0.24, 8), liquid('#ff8a2a', 'fire'), 0, 0.26, 0));
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 8), liquid('#ffd23f', 'fire2'), 0, 0.28, 0));
  },
};

// fish: a plump body with a tail fin
function fish(g, color, glow = false) {
  const m = glow ? liquid(color, 'fish' + color) : plain(color, 0.35, 0.2);
  const body = mesh(new THREE.SphereGeometry(0.14, 14, 10), m, 0, 0.12, 0); body.scale.set(0.6, 0.8, 1.5); g.add(body);
  g.add(mesh(new THREE.ConeGeometry(0.1, 0.16, 4), m, 0, 0.12, -0.26, -Math.PI / 2));
  for (const x of [-0.06, 0.06]) g.add(mesh(new THREE.SphereGeometry(0.022, 6, 6), plain('#101418', 0.3), x, 0.17, 0.14));
}
Object.assign(BUILDERS, {
  chugsplash(g) { bottle(g, { r: 0.11, h: 0.2, neck: 0.04, liq: '#39d0ff' }); },
  flowberry(g) { bottle(g, { r: 0.09, h: 0.28, neck: 0.035, liq: '#ff6fd0', round: false }); },
  spicytaco(g) {
    const shell = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16, 1, false, 0, Math.PI), plain('#f2c14e', 0.7), 0, 0.18, 0, 0, 0, Math.PI / 2); g.add(shell);
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.3), plain('#e2402b', 0.6), 0, 0.2, 0));
  },
  smallfry(g) { fish(g, '#9fd8ff'); },
  flopper(g) { fish(g, '#3fa4ff'); },
  shieldfish(g) { fish(g, '#3d6dff', true); },
  slurpfish(g) { fish(g, '#b86bff', true); },
  spicyfish(g) { fish(g, '#ff7a3a'); },
  goldfish(g) { fish(g, '#ffd23f', true); },
  rod(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.2, 6), plain('#8a5a2b', 0.7), 0, 0.1, 0.45, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), plain('#c9d6e8', 0.3, 0.7), 0.05, 0.06, 0.02, 0, 0, Math.PI / 2));
  },
  bubble(g) {
    g.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), glass(), 0, 0.15, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 12), plain('#2c3140', 0.5, 0.4), 0, 0.03, 0));
    g.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), liquid('#7fd8ff', 'bub'), 0, 0.15, 0));
  },
  portafort(g) {
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), plain('#9aa7b8', 0.5, 0.6), 0, 0.13, 0));
    g.add(mesh(new THREE.BoxGeometry(0.28, 0.04, 0.28), liquid('#4fc3ff', 'paf'), 0, 0.27, 0));
  },
  stormflip(g) {
    g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), liquid('#c05cff', 'flip'), 0, 0.14, 0));
    g.add(mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 20), plain('#e8d8ff', 0.3, 0.6), 0, 0.14, 0, Math.PI / 2));
  },
  sos(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 10), plain('#e0392b', 0.5), 0, 0.16, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), plain('#f2efe6', 0.5), 0, 0.33, 0));
  },
  scanner(g) {
    g.add(mesh(new THREE.BoxGeometry(0.18, 0.26, 0.05), plain('#2c3140', 0.5, 0.4), 0, 0.13, 0));
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.01), liquid('#c86bff', 'scan'), 0, 0.16, 0.03));
  },
  oneup(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24), plain('#3fbf5a', 0.35, 0.5), 0, 0.2, 0, Math.PI / 2));
    g.add(mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 24), liquid('#7dff8a', 'oneup'), 0, 0.2, 0));
  },
  gascan(g) {
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.34, 0.14), plain('#d4291f', 0.45, 0.3), 0, 0.17, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), plain('#f2c230', 0.5), 0.08, 0.38, 0));
  },
});

const templates = new Map();
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 });

// A fresh mesh (Group) for a consumable type, or null if it has no model.
export function makeConsumableMesh(ctype) {
  const thrown = makeThrowableMesh(ctype, 2.6);
  if (thrown) return thrown;
  if (!templates.has(ctype)) {
    let g = null;
    if (BUILDERS[ctype]) { g = new THREE.Group(); BUILDERS[ctype](g); }
    else if (ctype === 'trap') { g = new THREE.Group(); const t = makeTrapMesh(); t.scale.setScalar(0.42); t.rotation.x = 0.35; t.getObjectByName('spikes').scale.y = 1; g.add(t); }
    else if (['launchpad', 'shockwave', 'grappler', 'rift', 'grenade'].includes(ctype)) {
      g = new THREE.Group();
      const m = mesh(itemGeometry(ctype), vcMat);
      if (ctype === 'launchpad') m.scale.setScalar(0.55);
      g.add(m);
    }
    templates.set(ctype, g);
  }
  const t = templates.get(ctype);
  return t ? t.clone() : null;
}

// A boss medallion: gold disc with a glowing gem in the perk's colour, standing on its edge.
export function makeMedallionMesh(color) {
  const g = new THREE.Group();
  const gold = plain('#ffcf4a', 0.25, 0.9);
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 28), gold, 0, 0, 0, Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), plain('#fff0a8', 0.2, 0.9)));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 6), liquid(color, 'med' + color), 0, 0, 0, Math.PI / 2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), gold, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0));
  }
  return g;
}

// A small stack of gold bars.
export function makeGoldMesh() {
  const g = new THREE.Group();
  const bar = new THREE.CylinderGeometry(0.1, 0.14, 0.09, 4, 1);
  bar.rotateY(Math.PI / 4); bar.scale(1.6, 1, 0.8);
  const m = mat('goldbar', { color: '#ffc93c', roughness: 0.22, metalness: 1, emissive: '#6b4a00', emissiveIntensity: 0.5 });
  for (const [x, y, z, r] of [[-0.13, 0.045, 0, 0], [0.13, 0.045, 0.02, 0.1], [0, 0.135, 0.01, 1.57]]) g.add(mesh(bar, m, x, y, z, 0, r, 0));
  return g;
}

// The Victory Crown: gold band with points and gems.
export function makeCrownMesh() {
  const g = new THREE.Group();
  const gold = mat('crowngold', { color: '#ffc93c', roughness: 0.2, metalness: 1, emissive: '#7a5200', emissiveIntensity: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.12, 20, 1, true), gold, 0, 0.06, 0));
  const gems = ['#ff4d6d', '#4dd2ff', '#7dff8a', '#b86bff', '#ffe94d'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(new THREE.ConeGeometry(0.055, 0.16, 4), gold, Math.cos(a) * 0.19, 0.2, Math.sin(a) * 0.19));
    g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), gold, Math.cos(a) * 0.19, 0.29, Math.sin(a) * 0.19));
    g.add(mesh(new THREE.OctahedronGeometry(0.035), liquid(gems[i], 'crown' + i), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2));
  }
  return g;
}
