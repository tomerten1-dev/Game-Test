import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';

// Custom skins: character models you load from your own computer (Locker -> Hero -> Load model...) or
// put in the project's skins/ folder. They stay on your computer - never part of the repo.
// Formats: .glb / .gltf, .fbx, .dae (Collada) and .obj (+ .mtl). Texture files (.png, .jpg, .tga…)
// and .bin files that sit next to the model are found by file name.
// Our animations come from the Quaternius Universal Animation Library (Unreal mannequin bone names).
// Other rigs (Mixamo, Blender, 3ds Max Biped, Fortnite-style…) are renamed to match and the clips
// are retargeted onto them: each bone gets the same motion relative to its rest pose, so a model in
// an A-pose, facing another way or with differently rolled bones still moves properly.

export const MODEL_EXT = ['glb', 'gltf', 'fbx', 'dae', 'obj'];
export const EXTRA_EXT = ['bin', 'png', 'jpg', 'jpeg', 'webp', 'tga', 'bmp', 'gif', 'mtl'];
const ext = (name) => name.split('.').pop().toLowerCase();
export const isModelFile = (name) => MODEL_EXT.includes(ext(name));
export const baseName = (url) => decodeURIComponent(String(url).split('?')[0].split(/[\\/]/).pop()).toLowerCase();

// ---- saved skins (IndexedDB, store "skins") -------------------------------------------------------
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
// extras: [{ name, buf }] - textures / .bin / .mtl loaded together with the model
export const saveSkin = (id, name, buf, extras = []) => tx(STORE, 'readwrite', (s) => s.put({ id, name, buf, extras, at: Date.now() }, id));
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
// extra files -> { basename: blob url }
export function blobFiles(extras = []) {
  const out = {};
  for (const f of extras) out[f.name.toLowerCase()] = URL.createObjectURL(new Blob([f.buf]));
  return out;
}

// ---- colours you pick for a skin's parts (Locker), kept in this browser ---------------------------
const COLORS_KEY = 'stormbound_skin_colors';
let colorStore = null;
export function skinColors(id) {
  if (!colorStore) { try { colorStore = JSON.parse(localStorage.getItem(COLORS_KEY)) || {}; } catch { colorStore = {}; } }
  return (colorStore[id] ||= {});
}
export function setSkinColor(id, part, hex) {
  const c = skinColors(id);
  if (hex) c[part] = hex; else delete c[part];
  try { localStorage.setItem(COLORS_KEY, JSON.stringify(colorStore)); } catch { /* storage blocked: colours last this session */ }
}

// ---- reading model files ---------------------------------------------------------------------------
// files: { basename (lower case): url } - where textures / .bin / .mtl are found
export async function readScene(buf, name, files = {}) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (/^(data|blob):/.test(url) ? url : files[baseName(url)] || url));
  manager.addHandler(/\.tga$/i, new TGALoader(manager));
  const e = ext(name);
  if (e === 'glb' || e === 'gltf') return (await new GLTFLoader(manager).parseAsync(buf, '')).scene;
  if (e === 'fbx') return new FBXLoader(manager).parse(buf, '');
  const text = new TextDecoder().decode(buf);
  if (e === 'dae') {
    const r = new ColladaLoader(manager).parse(text, '');
    if (!r) throw new Error('not a Collada file');
    const g = new THREE.Group(); // the loader returns a Scene (with the Z-up fix on it)
    g.rotation.copy(r.scene.rotation);
    g.scale.copy(r.scene.scale);
    g.add(...r.scene.children);
    return g;
  }
  if (e === 'obj') {
    const loader = new OBJLoader(manager);
    const mtl = Object.keys(files).find((k) => k.endsWith('.mtl'));
    if (mtl) {
      const mtlText = await (await fetch(files[mtl])).text();
      const mats = new MTLLoader(manager).parse(mtlText, '');
      mats.preload();
      loader.setMaterials(mats);
    }
    return loader.parse(text);
  }
  throw new Error(`.${e} files are not supported - use .glb, .gltf, .fbx, .dae or .obj`);
}

// ---- bone names --------------------------------------------------------------------------------------
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
// Other rigs (Blender "upper_arm.L", Biped "Bip01 L Thigh", "Arm_L"…): the name without its side word
const LIMB = {
  upperarm: 'upperarm', arm: 'upperarm', forearm: 'lowerarm', lowerarm: 'lowerarm', elbow: 'lowerarm', hand: 'hand', wrist: 'hand',
  clavicle: 'clavicle', shoulder: 'clavicle', collar: 'clavicle', collarbone: 'clavicle',
  thigh: 'thigh', upleg: 'thigh', upperleg: 'thigh', calf: 'calf', shin: 'calf', leg: 'calf', lowerleg: 'calf', knee: 'calf',
  foot: 'foot', ankle: 'foot', toe: 'ball', toes: 'ball', toebase: 'ball', ball: 'ball',
};
const CENTER = { pelvis: 'pelvis', hips: 'pelvis', hip: 'pelvis', neck: 'neck_01', head: 'Head' };
// helper / control bones that must not take a body part's name
const SKIP = /twist|roll|ik|pole|target|nub|tip|ctrl|mch|helper|corrective|socket|weapon|prop|attach|end$|_end|null|jaw|eye|hair|cloth|cape|skirt|bag|finger|thumb|index|middle|ring|pinky/i;

function tokens(raw) {
  return raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_.\-:|]+/).map((t) => t.toLowerCase()).filter(Boolean);
}
function guessName(raw) {
  const low = raw.toLowerCase();
  if (BY_LOWER[low]) return BY_LOWER[low];
  if (MIXAMO[low]) return MIXAMO[low];
  if (SKIP.test(raw)) return null;
  const tk = tokens(raw);
  const side = tk.some((t) => t === 'l' || t === 'left') ? 'l' : tk.some((t) => t === 'r' || t === 'right') ? 'r' : null;
  const core = tk.filter((t) => !['l', 'r', 'left', 'right'].includes(t)).join('').replace(/\d+$/, '');
  if (side) return LIMB[core] ? `${LIMB[core]}_${side}` : null;
  return CENTER[core] || null;
}

// Rename the model's skinned bones to the names our clips use; returns how many animated bones matched.
function normalizeBones(scene) {
  const skinBones = new Set();
  scene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b) => skinBones.add(b)); });
  const seen = new Set();
  const byName = {};
  scene.traverse((o) => {
    if (!o.isBone || (skinBones.size && !skinBones.has(o))) return;
    const raw = o.name.replace(/^.*[:|]/, '').replace(/^mixamorig\d*[_\-.]?/i, '').replace(/^(DEF|ORG|Bip0*1|b)[\s_\-.]+/i, '');
    const to = guessName(raw);
    if (to && !seen.has(to)) { o.name = to; seen.add(to); byName[to] = o; }
  });
  // spine: the bones between the pelvis and the neck become spine_01..03
  const top = byName.neck_01 || byName.Head, pelvis = byName.pelvis;
  if (top && pelvis && !seen.has('spine_01')) {
    const chain = [];
    for (let b = top.parent; b && b !== pelvis && b.isBone; b = b.parent) chain.unshift(b);
    const pick = chain.length >= 3 ? [chain[0], chain[Math.floor((chain.length - 1) / 2)], chain[chain.length - 1]] : chain.length === 2 ? [chain[0], null, chain[1]] : [null, null, chain[0]];
    pick.forEach((b, i) => { if (b && !UAL.includes(b.name)) { b.name = `spine_0${i + 1}`; seen.add(b.name); } });
  }
  return seen.size;
}

// ---- retargeting ----------------------------------------------------------------------------------
const CHILD = {
  spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
  clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l',
  clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r',
};
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
function boneMap(scene) {
  const out = {};
  scene.traverse((o) => { if (o.isBone && UAL.includes(o.name) && !out[o.name]) out[o.name] = o; });
  return out;
}
const height = (obj) => { const b = new THREE.Box3().setFromObject(obj); return b.max.y - b.min.y; };
// right / up / forward of a standing skeleton
function bodyFrame(b) {
  if (!b.Head || !b.pelvis || !b.thigh_l || !b.thigh_r) return null;
  const up = wp(b.Head).sub(wp(b.pelvis));
  const right = wp(b.thigh_r).sub(wp(b.thigh_l));
  if (up.lengthSq() < 1e-10 || right.lengthSq() < 1e-10) return null;
  up.normalize();
  right.addScaledVector(up, -right.dot(up)).normalize();
  return new THREE.Matrix4().makeBasis(right, up, new THREE.Vector3().crossVectors(right, up));
}

// Our rig's rest pose, measured once.
function sourceRig(assets) {
  const r = assets.qRig;
  if (!r) return null;
  if (!r.bones) { r.scene.updateMatrixWorld(true); r.bones = boneMap(r.scene); r.height = height(r.scene); r.frame = bodyFrame(r.bones); }
  return r;
}

// Clips for a custom skin, retargeted from our rig onto the model's skeleton.
// For bone b with rest world rotations S(b) (ours) and T(b) (the model's, turned so its limbs point
// the way ours do in rest), the model's local rotation is  T(parent)^-1 · S(parent) · ours · S(b)^-1 · T(b)
// - the same world-space motion relative to the rest pose. The pelvis also gets its height changes.
function retarget(clips, src, sb, tb, restT, ratio) {
  const cache = {};
  const fix = (name) => {
    if (cache[name] !== undefined) return cache[name];
    const s = sb[name], t = tb[name];
    if (!s || !t) return (cache[name] = null);
    const A = restT(t.parent).invert().multiply(wq(s.parent));
    const B = wq(s).invert().multiply(restT(t));
    let P = null;
    if (name === 'pelvis') {
      const ms = new THREE.Matrix3().setFromMatrix4(s.parent.matrixWorld);
      const mt = new THREE.Matrix3().setFromMatrix4(t.parent.matrixWorld).invert();
      P = { ms, mt, s0: s.position.clone(), t0: t.position.clone() };
    }
    return (cache[name] = { A, B, P });
  };
  const q = new THREE.Quaternion(), v = new THREE.Vector3();
  const out = {};
  for (const [key, clip] of Object.entries(clips)) {
    const tracks = [];
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const bone = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
      const f = fix(bone);
      if (!f) continue;
      if (prop === 'quaternion') {
        const vals = new Float32Array(tr.values.length);
        for (let i = 0; i < vals.length; i += 4) q.fromArray(tr.values, i).premultiply(f.A).multiply(f.B).toArray(vals, i);
        tracks.push(new THREE.QuaternionKeyframeTrack(tr.name, tr.times, vals));
      } else if (prop === 'position' && f.P) {
        const vals = new Float32Array(tr.values.length);
        for (let i = 0; i < vals.length; i += 3) {
          v.fromArray(tr.values, i).sub(f.P.s0).applyMatrix3(f.P.ms).multiplyScalar(ratio).applyMatrix3(f.P.mt).add(f.P.t0).toArray(vals, i);
        }
        tracks.push(new THREE.VectorKeyframeTrack(tr.name, tr.times, vals));
      }
    }
    out[key] = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }
  return out;
}

// Parse a model and register it as character type `Custom:<id>`.
// opts: { name: file name (for the format), files: { basename: url } for textures etc. }
// Returns { ok, animated, matched, parts, error, type }.
export async function addCustomType(assets, buf, targetHeight, id, opts = {}) {
  try {
    const scene = await readScene(buf, opts.name || 'model.glb', opts.files);
    let skinned = false, n = 0;
    const parts = [];
    scene.traverse((o) => {
      if (o.isSkinnedMesh) skinned = true;
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.name) m.name = `Part ${++n}`;
        if (!parts.some((p) => p.name === m.name)) parts.push({ name: m.name, color: `#${m.color ? m.color.getHexString() : 'ffffff'}`, textured: !!m.map });
      }
    });
    const matched = normalizeBones(scene);
    // stand the model up and face it the way our characters face
    const root = new THREE.Group();
    root.add(scene);
    root.updateMatrixWorld(true);
    const src = sourceRig(assets);
    let tb = boneMap(root);
    const tFrame = bodyFrame(tb);
    if (src?.frame && tFrame) {
      const m = src.frame.clone().multiply(tFrame.clone().transpose());
      root.quaternion.setFromRotationMatrix(m);
      root.updateMatrixWorld(true);
    }
    const h = height(root);
    if (!(h > 0)) return { ok: false, error: 'The model has no visible geometry' };
    const box = new THREE.Box3().setFromObject(root);
    const type = `Custom:${id}`;
    const entry = { scene: root, scale: targetHeight / h, footOffset: (-box.min.y * targetHeight) / h, q: true, custom: true, clips: null, head: null, headAbove: 0.12 * (h / targetHeight), colors: skinColors(`custom_${id}`) };
    if (src && assets.q) {
      tb = boneMap(root);
      const sb = src.bones;
      // limbs of the model turned to point where ours point in rest (A-pose -> T-pose etc.)
      const D = new Map(), I = new THREE.Quaternion();
      root.traverse((o) => {
        let d = D.get(o.parent) || I;
        const c = CHILD[o.name];
        if (o.isBone && c && tb[o.name] === o && tb[c] && sb[o.name] && sb[c]) {
          const dt = wp(tb[c]).sub(wp(o)), ds = wp(sb[c]).sub(wp(sb[o.name]));
          if (dt.lengthSq() > 1e-12 && ds.lengthSq() > 1e-12) d = new THREE.Quaternion().setFromUnitVectors(dt.normalize(), ds.normalize());
        }
        D.set(o, d);
      });
      const restT = (o) => (D.get(o) || I).clone().multiply(wq(o));
      const ratio = h / src.height;
      entry.clips = { upper: retarget(assets.q.upper, src, sb, tb, restT, ratio), lower: retarget(assets.q.lower, src, sb, tb, restT, ratio) };
      // hand slot for held items, moved from our hand bone into the model's
      if (sb.hand_r && tb.hand_r && src.slot) {
        const Rs = wq(sb.hand_r), RtInv = restT(tb.hand_r).invert();
        const k = (sb.hand_r.getWorldScale(new THREE.Vector3()).x / src.height) * (h / tb.hand_r.getWorldScale(new THREE.Vector3()).x);
        const sq = new THREE.Quaternion().fromArray(src.slot.quat).normalize();
        entry.slot = {
          pos: new THREE.Vector3().fromArray(src.slot.pos).applyQuaternion(Rs).applyQuaternion(RtInv).multiplyScalar(k).toArray(),
          quat: RtInv.clone().multiply(Rs).multiply(sq).toArray(),
          scale: src.slot.scale * k,
        };
      }
    }
    assets.types[type] = entry;
    return { ok: true, animated: skinned && matched >= 10, matched, parts, type };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}
