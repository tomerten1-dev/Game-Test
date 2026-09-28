import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Custom skins: .glb / .gltf characters you load from your own computer (Locker -> Hero -> Load model...).
// The files are kept in this browser only (IndexedDB) - never part of the game files or the repo.
// Our animations come from the Quaternius Universal Animation Library, whose skeleton uses the Unreal
// mannequin bone names (pelvis, spine_01, thigh_l, hand_r…). Fortnite-style and Unreal rigs use the same
// names, so their bones are driven directly; Mixamo rigs are renamed to match.

// Every model you load is saved in this browser (IndexedDB, store "skins") and comes back on its own
// each time the game starts - one Locker card per model.
const DB = 'stormbound', OLD = 'files', STORE = 'skins';

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(OLD)) r.result.createObjectStore(OLD);
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export const newSkinId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const saveSkin = (id, name, buf) => tx(STORE, 'readwrite', (s) => s.put({ id, name, buf, at: Date.now() }, id));
export const deleteSkin = (id) => tx(STORE, 'readwrite', (s) => s.delete(id));
// all saved skins, oldest first (a skin saved by the first version of this feature is moved over)
export async function listSkins() {
  try {
    const old = await tx(OLD, 'readonly', (s) => s.get('customSkin'));
    if (old?.buf) { await saveSkin('first', old.name, old.buf); await tx(OLD, 'readwrite', (s) => s.delete('customSkin')); }
    const all = (await tx(STORE, 'readonly', (s) => s.getAll())) || [];
    return all.sort((x, y) => (x.at || 0) - (y.at || 0));
  } catch (e) { console.warn('custom skins', e); return []; }
}

// bone names the animations drive
const UAL = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];
const BY_LOWER = Object.fromEntries(UAL.map((n) => [n.toLowerCase(), n]));
// Mixamo -> Unreal mannequin names
const MIXAMO = {
  hips: 'pelvis', spine: 'spine_01', spine1: 'spine_02', spine2: 'spine_03', neck: 'neck_01', head: 'Head',
  leftshoulder: 'clavicle_l', leftarm: 'upperarm_l', leftforearm: 'lowerarm_l', lefthand: 'hand_l',
  rightshoulder: 'clavicle_r', rightarm: 'upperarm_r', rightforearm: 'lowerarm_r', righthand: 'hand_r',
  leftupleg: 'thigh_l', leftleg: 'calf_l', leftfoot: 'foot_l', lefttoebase: 'ball_l',
  rightupleg: 'thigh_r', rightleg: 'calf_r', rightfoot: 'foot_r', righttoebase: 'ball_r',
};

// Rename the model's bones to the names our clips use; returns how many animated bones matched.
function normalizeBones(scene) {
  let matched = 0;
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.isBone) return;
    const raw = o.name.replace(/^mixamorig\d*[:_]?/i, '').replace(/^(Bip01|b_)[\s_]*/i, '');
    const key = raw.toLowerCase();
    const to = BY_LOWER[key] || MIXAMO[key];
    if (to && !seen.has(to)) { o.name = to; seen.add(to); matched++; }
  });
  return matched;
}

// Clips for custom skins: the UAL clips without position tracks (other rigs have other bone lengths /
// units, so moving bones would stretch them - rotations alone animate the body).
// Only tracks for bones this model actually has are kept (no warnings, nothing wasted).
function rotationOnly(clips, bones) {
  const out = {};
  for (const [name, clip] of Object.entries(clips)) {
    const c = clip.clone();
    c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') && bones.has(t.name.slice(0, t.name.lastIndexOf('.'))));
    out[name] = c;
  }
  return out;
}

// Parse a model file and register it as character type `Custom:<id>`. Returns { ok, animated, matched, error, type }.
export async function addCustomType(assets, buf, height, id) {
  try {
    const g = await new GLTFLoader().parseAsync(buf, '');
    const scene = g.scene;
    let skinned = false;
    scene.traverse((o) => {
      if (o.isSkinnedMesh) skinned = true;
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
    });
    const matched = normalizeBones(scene);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y;
    if (!(h > 0)) return { ok: false, error: 'The model has no visible geometry' };
    const bones = new Set();
    scene.traverse((o) => { if (o.isBone) bones.add(o.name); });
    const clips = assets.q ? { upper: rotationOnly(assets.q.upper, bones), lower: rotationOnly(assets.q.lower, bones) } : null;
    const type = `Custom:${id}`;
    assets.types[type] = { scene, scale: height / h, footOffset: (-box.min.y * height) / h, q: true, custom: true, clips, head: null, headAbove: 0.12 * (h / height) };
    return { ok: true, animated: skinned && matched >= 10, matched, type };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}
