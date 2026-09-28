import * as THREE from 'three';
import { listSkins, addCustomType, blobFiles, baseName } from './CustomSkin.js';
import { registerCustomSkin } from '../meta/Cosmetics.js';

// every model in <project>/skins (or a sub-folder of it) becomes a built-in skin; textures / .bin /
// .mtl files next to a model are found by name
const SKIN_FILES = import.meta.glob('/skins/**/*.{glb,gltf,fbx,dae,obj,GLB,GLTF,FBX,DAE,OBJ}', { query: '?url', import: 'default', eager: true });
const SKIN_EXTRAS = import.meta.glob('/skins/**/*.{bin,png,jpg,jpeg,webp,tga,bmp,gif,mtl,BIN,PNG,JPG,JPEG,WEBP,TGA,BMP,GIF,MTL}', { query: '?url', import: 'default', eager: true });
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { addRim, addHueSwap } from '../effects/Shaders.js';

// KayKit "Adventurers" characters (CC0, Kay Lousberg). All share one rig + animation set.
export const KK_TYPES = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
// Quaternius "Modular Character Outfits - Fantasy" (CC0) on the Universal Animation Library rig
// (CC0). The outfits come without heads, so the library's mannequin supplies one.
export const Q_TYPES = ['Male_Ranger', 'Female_Ranger', 'Male_Peasant', 'Female_Peasant'];
export const CHARACTER_TYPES = [...KK_TYPES, ...Q_TYPES];
// old KayKit hero types -> the outfit character that replaces them (heroes, skins and bosses keep their colours / hats)
const KK_TO_Q = { Knight: 'Male_Ranger', Barbarian: 'Male_Peasant', Rogue: 'Female_Ranger', Rogue_Hooded: 'Male_Ranger', Mage: 'Female_Peasant' };
// The game asks for KayKit clip names; these are the Universal Animation Library equivalents.
const Q_ANIM = {
  Idle: 'Idle_Loop', Unarmed_Idle: 'Idle_Loop', Walking_A: 'Walk_Loop', Walking_C: 'Walk_Formal_Loop', Walking_Backwards: 'Walk_Loop',
  Running_A: 'Jog_Fwd_Loop', Running_B: 'Sprint_Loop', Running_Strafe_Left: 'Jog_Fwd_Loop', Running_Strafe_Right: 'Jog_Fwd_Loop',
  Jump_Start: 'Jump_Start', Jump_Idle: 'Jump_Loop', Jump_Land: 'Jump_Land', Jump_Full_Short: 'Jump_Start',
  Dodge_Forward: 'Roll', Dodge_Left: 'Roll', Hit_A: 'Hit_Chest', Death_A: 'Death01', Death_B: 'Death01',
  '1H_Ranged_Aiming': 'Pistol_Aim_Neutral', '1H_Ranged_Shoot': 'Pistol_Shoot', '1H_Ranged_Shooting': 'Pistol_Shoot', '1H_Ranged_Reload': 'Pistol_Reload',
  '2H_Ranged_Aiming': 'Pistol_Aim_Neutral', '2H_Ranged_Shoot': 'Pistol_Shoot', '2H_Ranged_Shooting': 'Pistol_Shoot', '2H_Ranged_Reload': 'Pistol_Reload',
  '1H_Melee_Attack_Chop': 'Sword_Regular_A', '1H_Melee_Attack_Slice_Diagonal': 'Sword_Regular_B', '2H_Melee_Attack_Spinning': 'Sword_Heavy_Combo',
  Unarmed_Melee_Attack_Kick: 'Punch_Cross', Block: 'Sword_Block', Use_Item: 'Consume', Throw: 'OverhandThrow', PickUp: 'PickUp_Table', Interact: 'Interact',
  Cheer: 'Yes', Spellcasting: 'Spell_Simple_Idle_Loop', Spellcast_Raise: 'Spell_Simple_Idle_Loop', Spellcast_Long: 'Spell_Simple_Shoot',
  Sit_Floor_Idle: 'Sitting_Idle_Loop', Lie_Idle: 'Idle_No_Loop',
};
const Q_SKIN = ['#8a5a3e', '#7a4d34', '#95654a']; // close to the outfits' skin texture
// hand slot on the UAL right-hand bone (bone-local, before the model scale), tuned so held tools
// sit like they do in the KayKit hand slot
// (measured against the KayKit slot in the idle and aiming poses)
const Q_SLOT = { pos: [0, 0.08, 0], quat: [-0.399, -0.615, -0.396, -0.554], scale: 0.761 };
export const HEIGHT = 2.02; // model box incl. hair: puts the top of the head at ~1.92 m, Fortnite's player height
// Main outfit hue band per hero (0..1), used by outfit colours.
const OUTFIT_HUE = { Knight: [0.95, 0.05], Barbarian: [0.5, 0.06], Mage: [0.93, 0.06], Rogue: [0.43, 0.07], Rogue_Hooded: [0.43, 0.07] };

// Bones driven by the upper-body layer (aiming / shooting / reloading).
const UPPER = /^(spine|chest|upperarm|lowerarm|wrist|hand|handslot|head|elbowIK|handIK|clavicle|neck|index|middle|pinky|ring|thumb)/i;
const ONCE = new Set(['Death_A', 'Death_B', 'Jump_Start', 'Jump_Land', '2H_Ranged_Reload', '1H_Ranged_Reload', '2H_Ranged_Shoot', '1H_Ranged_Shoot', 'PickUp', 'Interact', 'Hit_A', 'Death01', 'Roll', 'Consume', 'OverhandThrow', 'Hit_Chest', 'Punch_Cross', 'Sword_Regular_A', 'Sword_Regular_B']);

function splitClip(clip, upper) {
  const tracks = clip.tracks.filter((t) => UPPER.test(t.name.split('.')[0]) === upper);
  return new THREE.AnimationClip(`${clip.name}_${upper ? 'U' : 'L'}`, clip.duration, tracks);
}

export class CharacterAssets {
  // The mannequin's body, bound to the outfit's skeleton, with everything below the neck cut away in
  // the shader (in bind-pose space), so it only shows as the head.
  static _head(src, outfitScene) {
    if (!src) return null;
    let man = null, skel = null;
    src.scene.traverse((o) => { if (o.isSkinnedMesh && /Main/.test(o.material.name)) man = o; });
    outfitScene.traverse((o) => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
    if (!man || !skel) return null;
    const bones = man.skeleton.bones.map((b) => skel.bones.find((x) => x.name === b.name));
    if (bones.some((b) => !b)) return null;
    const bindY = (name) => new THREE.Matrix4().copy(man.skeleton.boneInverses[man.skeleton.bones.findIndex((b) => b.name === name)]).invert().elements[13];
    const neckY = bindY('neck_01');
    man.geometry.computeBoundingBox();
    const headAbove = man.geometry.boundingBox.max.y - bindY('Head'); // head bone -> top of the head
    const mat = new THREE.MeshStandardMaterial({ color: '#e8b894', roughness: 0.55 });
    mat.name = 'MI_QHead';
    mat.userData.cut = neckY + 0.05;
    const mesh = new THREE.SkinnedMesh(man.geometry, mat);
    mesh.name = 'QHead';
    const parent = skel.bones[0].parent;
    parent.add(mesh);
    mesh.bind(new THREE.Skeleton(bones, man.skeleton.boneInverses), new THREE.Matrix4());
    mesh.userData.headAbove = headAbove;
    return mesh;
  }

  static async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const a = new CharacterAssets();
    a.types = {};
    let done = 0;
    const total = CHARACTER_TYPES.length + 4;
    const tick = (g) => { onProgress(++done / total); return g; };
    const anims = loader.loadAsync('/models/chars/anims.glb').then(tick);
    const ual = ['UAL1_Standard', 'UAL2_Standard', 'Mannequin_F'].map((n) => loader.loadAsync(`/models/anims/${n}.glb`).then(tick).catch(() => null));
    const qScenes = Promise.all(Q_TYPES.map((t) => loader.loadAsync(`/models/outfits/${t}.gltf`).then(tick).catch(() => null)));
    await Promise.all(KK_TYPES.map(async (t) => {
      const g = await loader.loadAsync(`/models/chars/${t}.glb`);
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene);
      const h = box.max.y - box.min.y;
      a.types[t] = { scene: g.scene, scale: HEIGHT / h, footOffset: (-box.min.y * HEIGHT) / h };
      onProgress(++done / total);
    }));
    const clips = (await anims).animations;
    a.upper = {};
    a.lower = {};
    for (const c of clips) {
      a.upper[c.name] = splitClip(c, true);
      a.lower[c.name] = splitClip(c, false);
    }
    // Quaternius characters: outfit + mannequin head, UAL clips under KayKit names
    const [ual1, ual2, manF] = await Promise.all(ual);
    const outfits = await qScenes;
    if (ual1 && ual2) {
      const byName = {};
      for (const c of [...ual1.animations, ...ual2.animations]) byName[c.name] = c;
      a.q = { upper: {}, lower: {} };
      const addClip = (name, clip) => { a.q.upper[name] = splitClip(clip, true); a.q.lower[name] = splitClip(clip, false); };
      for (const [kk, qn] of Object.entries(Q_ANIM)) if (byName[qn]) addClip(kk, byName[qn]);
      for (const [qn, clip] of Object.entries(byName)) if (!a.q.upper[qn]) addClip(qn, clip);
      Q_TYPES.forEach((t, i) => {
        const g = outfits[i];
        if (!g) return;
        const head = CharacterAssets._head((t.startsWith('Female') ? manF : ual1) || ual1, g.scene);
        g.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g.scene);
        const h = Math.max(1.75, box.max.y - box.min.y);
        a.types[t] = { scene: g.scene, scale: HEIGHT / h, footOffset: (-box.min.y * HEIGHT) / h, q: true, head, headAbove: (head?.userData.headAbove ?? 0.2) + (t.includes('Ranger') ? 0.06 : 0) };
      });
    }
    // our rig's rest pose: custom skins' animations are retargeted from it
    if (ual1) a.qRig = { scene: ual1.scene, slot: Q_SLOT, qHeight: HEIGHT };
    // your own models: files in the project's skins/ folder are built-in skins (git-ignored, local only)
    a.customSkins = [];
    for (const [path, url] of Object.entries(SKIN_FILES)) {
      const parts = path.split('/'), file = parts.pop(), dir = parts.join('/') + '/';
      // "skins/fishstick/scene.gltf" is called Fishstick
      const label = parts.length > 2 && /^(scene|model|mesh|untitled)$/i.test(file.replace(/\.[^.]+$/, '')) ? `${parts[parts.length - 1]}.${file.split('.').pop()}` : file;
      const id = 'file_' + path.slice(7).replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_');
      const files = {};
      for (const [p, u] of Object.entries(SKIN_EXTRAS)) if (p.startsWith(dir)) files[baseName(p)] = u;
      for (const [p, u] of Object.entries(SKIN_EXTRAS)) if (p.slice(0, p.lastIndexOf('/') + 1) === dir) files[baseName(p)] = u; // same folder wins
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const res = await addCustomType(a, buf, 1.92, id, { name: file, files });
        a.customSkins.push({ id, name: label, builtin: true, ...res });
        if (res.ok) registerCustomSkin(id, label, true);
      } catch (e) { console.warn('skin file', file, e); }
    }
    // ...and models loaded in the Locker, saved in this browser and loaded every start
    for (const sk of await listSkins()) {
      const res = await addCustomType(a, sk.buf, 1.92, sk.id, { name: sk.name, files: blobFiles(sk.extras) });
      a.customSkins.push({ id: sk.id, name: sk.name, ...res });
      if (res.ok) registerCustomSkin(sk.id, sk.name);
    }
    // legacy fields used elsewhere
    const first = a.types[CHARACTER_TYPES[0]];
    a.scale = first.scale;
    a.footOffset = first.footOffset;
    return a;
  }
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _axis = new THREE.Vector3(), _qI = new THREE.Quaternion();
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const LIMBS = ['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'];
// [bone, child, side (+1 left / -1 right), direction in model space: x = out to that side, y = toward the head, z = toward the chest]
const LIMB_POSE = {
  spread: [
    ['upperarm_l', 'lowerarm_l', 1, [1, 0.45, -0.2]], ['upperarm_r', 'lowerarm_r', -1, [1, 0.45, -0.2]],
    ['thigh_l', 'calf_l', 1, [0.4, -1, -0.25]], ['thigh_r', 'calf_r', -1, [0.4, -1, -0.25]],
  ],
  glide: [
    ['upperarm_l', 'lowerarm_l', 1, [0.35, 1, 0.15]], ['upperarm_r', 'lowerarm_r', -1, [0.35, 1, 0.15]],
  ],
};

export class Character {
  constructor(assets, color = '#2ee6c9', type = 'Knight', tint = 0.28, outfit = null) {
    this.assets = assets;
    // every character uses the same human outfit rigs (the chunky KayKit heroes looked out of place)
    type = KK_TO_Q[type] || type;
    const src = assets.types[type] || assets.types.Knight;
    this.root = new THREE.Group();
    this.root.userData.noCull = true; // actors manage their own visibility
    const model = SkeletonUtils.clone(src.scene);
    model.scale.setScalar(src.scale);
    model.position.y = src.footOffset;
    this.footOffset = src.footOffset;
    this.model = model;
    this.root.add(model);
    this.color = new THREE.Color(color);

    this.materials = [];
    this.q = !!src.q;
    this.headAbove = (src.headAbove || 0) * src.scale; // Quaternius rig: head bone -> top of head (hood)
    this.custom = !!src.custom;
    this.clips = src.clips || (this.q ? assets.q : assets);
    const tintColor = new THREE.Color(1, 1, 1).lerp(this.color, tint);
    const skin = new THREE.Color(Q_SKIN[Math.floor(Math.random() * Q_SKIN.length)]);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (this.custom) {
          // your own model keeps its own colours and textures (and the colours you picked in the
          // Locker); .fbx / .obj meshes can have several materials
          const own = (orig) => {
            const m = orig.clone();
            const pick = src.colors?.[m.name];
            if (pick && m.color) m.color.set(pick);
            if (m.emissive) { addRim(m, '#e6f4ff', 0.3); this.materials.push(m); }
            return m;
          };
          o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
          return;
        }
        const m = o.material.clone();
        if (m.name === 'MI_QHead') {
          // skin-toned head from the mannequin: drop everything below the neck
          m.color.copy(skin).multiply(tintColor);
          const cut = o.material.userData.cut;
          m.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBindY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindY = position.y;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBindY;').replace('#include <clipping_planes_fragment>', `if (vBindY < ${cut.toFixed(3)}) discard;\n#include <clipping_planes_fragment>`);
          };
          m.customProgramCacheKey = () => `qhead${cut.toFixed(3)}`;
          o.castShadow = false;
        } else {
          m.color.copy(tintColor);
          m.roughness = this.q ? Math.max(0.55, m.roughness) : 0.6;
          m.metalness = 0;
          if (outfit && !this.q) { const [h, r] = OUTFIT_HUE[type] || OUTFIT_HUE.Knight; addHueSwap(m, h, r, outfit); }
          else if (outfit) m.color.lerp(new THREE.Color(outfit), 0.35);
          addRim(m, '#e6f4ff', 0.45);
        }
        o.material = m;
        this.materials.push(m);
      }
      if (o.isBone) {
        const n = o.name;
        if (n === 'handslotr' || n === 'hand_r') this.handBone = o;
        else if (n === 'chest' || n === 'spine_03') this.chestBone = o;
        else if (n === 'spine' || n === 'spine_01') this.spine = o;
        else if (n === 'head' || n === 'Head') this.head = o;
        if (LIMBS.includes(n)) (this.limbs ||= {})[n] = o;
      }
    });
    // held items attach to a slot on the right hand (the UAL hand bone points along the fingers)
    this.handR = this.handBone;
    if (this.q && this.handBone) {
      this.handR = new THREE.Object3D();
      this.handR.name = 'handslot_q';
      const slot = src.slot || Q_SLOT; // custom skins: our slot moved into their hand bone
      this.handR.position.fromArray(slot.pos);
      this.handR.quaternion.fromArray(slot.quat).normalize();
      this.handR.scale.setScalar(slot.scale);
      this.handBone.add(this.handR);
    }

    this.mixer = new THREE.AnimationMixer(model);
    this.upperActions = {};
    this.lowerActions = {};
    this.cur = { upper: null, lower: null };
    this.curName = { upper: null, lower: null };
    this.setPose('Idle', null, 0);

    this.weaponHolder = new THREE.Object3D();
    this.root.add(this.weaponHolder);
    this.weaponMesh = null;
    this.lodSkip = 0;
  }

  get currentName() { return this.curName.lower; }

  // Arms / legs posed on top of the animation (UAL rigs, custom skins included):
  // 'spread' = Fortnite skydive (belly down, arms and legs out wide), 'glide' = hands up on the glider.
  _limbPose(dt) {
    const want = this.armPose && this.limbs ? 1 : 0;
    this.limbW = damp(this.limbW || 0, want, 6, dt);
    if (this.limbW < 0.01 || !this.limbs) return;
    if (this.armPose) this._lastPose = this.armPose;
    const L = this.limbs, model = this.model;
    model.updateMatrixWorld(true);
    // which model-space side is the character's left (rigs differ)
    if (this._leftX === undefined && L.thigh_l && L.thigh_r) {
      const a = model.worldToLocal(L.thigh_l.getWorldPosition(new THREE.Vector3())), b = model.worldToLocal(L.thigh_r.getWorldPosition(new THREE.Vector3()));
      this._leftX = Math.sign(a.x - b.x) || 1;
    }
    const mq = model.getWorldQuaternion(new THREE.Quaternion());
    const pose = LIMB_POSE[this._lastPose] || LIMB_POSE.spread;
    for (const [bone, child, side, dir] of pose) {
      const b = L[bone], c = L[child];
      if (!b || !c) continue;
      // target direction in model space (x = the limb's own side), then in world space
      _v.set(dir[0] * side * this._leftX, dir[1], dir[2]).normalize().applyQuaternion(mq);
      const from = c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
      _q2.setFromUnitVectors(from, _v);
      _q2.slerp(_qI, 1 - this.limbW);
      b.getWorldQuaternion(_q).premultiply(_q2);
      b.parent.getWorldQuaternion(_q2);
      b.quaternion.copy(_q2.invert().multiply(_q));
      b.updateMatrixWorld(true);
    }
  }

  // Actions are made the first time a clip is asked for.
  _action(layer, name) {
    const store = layer === 'upper' ? this.upperActions : this.lowerActions;
    if (!store[name]) {
      const clip = this.clips[layer][name];
      if (!clip) return null;
      const act = this.mixer.clipAction(clip);
      if (ONCE.has(name)) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
      store[name] = act;
    }
    return store[name];
  }

  _layer(layer, name, fade, timeScale) {
    const next = this._action(layer, name);
    if (!next) return;
    next.timeScale = timeScale;
    const cur = this.cur[layer];
    if (cur === next) return;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    if (cur && fade > 0) cur.crossFadeTo(next, fade, false);
    else if (cur) cur.stop();
    this.cur[layer] = next;
    this.curName[layer] = name;
  }

  // lower = legs/hips animation, upper = arms/torso (null -> same as lower)
  setPose(lower, upper = null, fade = 0.2, timeScale = 1, upperTimeScale = 1) {
    this._layer('lower', lower, fade, timeScale);
    this._layer('upper', upper || lower, fade, upper ? upperTimeScale : timeScale);
  }

  // Legacy single-animation API.
  play(name, fade = 0.2, timeScale = 1) { this.setPose(name, null, fade, timeScale); }
  setTimeScale(s) { if (this.cur.lower) this.cur.lower.timeScale = s; }

  // inHand: parent to the right-hand bone (melee items animate with the hand);
  // otherwise the gun is placed at the hand but points where the character aims.
  setWeapon(mesh, inHand = false) {
    if (this.weaponMesh) this.weaponMesh.parent?.remove(this.weaponMesh);
    this.weaponMesh = mesh;
    this.inHand = inHand && !!this.handR;
    if (mesh && this.inHand) { this.handR.add(mesh); return; }
    if (mesh) {
      this.weaponHolder.add(mesh);
      // hold point ~ between the grip and the foregrip
      mesh.scale.setScalar(1.1); // a rifle is ~1.05 m in the hands, as in Fortnite
      mesh.position.set(0, 0, -(mesh.userData.foregrip ?? 0.3) * 0.5);
    }
  }

  // Rotate a bone around a world-space axis (used to bend the torso with aim pitch).
  _rotateBoneWorld(bone, axis, angle) {
    bone.getWorldQuaternion(_q);
    _q2.setFromAxisAngle(axis, angle);
    _q.premultiply(_q2);
    bone.parent.getWorldQuaternion(_q2);
    bone.quaternion.copy(_q2.invert().multiply(_q));
  }

  update(dt, pitch = 0, armed = false, crouch = 0) {
    // undo last frame's torso bend first: clips that don't key the chest bone would otherwise let
    // the bend pile up frame after frame (the character spins)
    if (this.chestBone && this._chestRest) this.chestBone.quaternion.copy(this._chestRest);
    this.mixer.update(dt);
    if (this.chestBone) (this._chestRest ||= new THREE.Quaternion()).copy(this.chestBone.quaternion);
    if (this.weaponMesh) this.weaponMesh.visible = (this.inHand || armed) && !this.armPose; // empty hands in the sky
    this._limbPose(dt);
    const bend = (armed ? -pitch * 0.55 : 0) + crouch * 0.35;
    if (this.chestBone && Math.abs(bend) > 0.001) {
      this.root.updateMatrixWorld(true);
      _axis.set(1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(_q)).normalize();
      this._rotateBoneWorld(this.chestBone, _axis, bend);
      this.chestBone.updateMatrixWorld(true);
    }
    if (armed && this.chestBone) {
      // gun sits in the right hand but points where the character aims
      if (this.handR) {
        this.handR.getWorldPosition(_v);
        this.root.worldToLocal(_v);
        this.weaponHolder.position.copy(_v);
      }
      // recoil kick: the gun jumps back and up, then settles
      this.kick = Math.max(0, (this.kick || 0) - dt * 7);
      const k = this.kick * this.kick;
      this.weaponHolder.rotation.set(-pitch - k * 0.35, 0, 0);
      this.weaponHolder.translateZ(-k * 0.14);
    }
  }

  flash(amount) {
    for (const m of this.materials) m.emissive.setRGB(amount, amount, amount);
  }

  dispose() {
    this.mixer.stopAllAction();
    for (const m of this.materials) m.dispose();
  }
}
