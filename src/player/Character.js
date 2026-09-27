import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { addRim } from '../effects/Shaders.js';

// KayKit "Adventurers" characters (CC0, Kay Lousberg). All share one rig + animation set.
export const CHARACTER_TYPES = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
const HEIGHT = 1.95;

// Bones driven by the upper-body layer (aiming / shooting / reloading).
const UPPER = /^(spine|chest|upperarm|lowerarm|wrist|hand|handslot|head|elbowIK|handIK)/;
const ONCE = new Set(['Death_A', 'Death_B', 'Jump_Start', 'Jump_Land', '2H_Ranged_Reload', '1H_Ranged_Reload', '2H_Ranged_Shoot', '1H_Ranged_Shoot', 'PickUp', 'Interact', 'Hit_A']);

function splitClip(clip, upper) {
  const tracks = clip.tracks.filter((t) => UPPER.test(t.name.split('.')[0]) === upper);
  return new THREE.AnimationClip(`${clip.name}_${upper ? 'U' : 'L'}`, clip.duration, tracks);
}

export class CharacterAssets {
  static async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const a = new CharacterAssets();
    a.types = {};
    let done = 0;
    const total = CHARACTER_TYPES.length + 1;
    const anims = loader.loadAsync('/models/chars/anims.glb').then((g) => { onProgress(++done / total); return g; });
    await Promise.all(CHARACTER_TYPES.map(async (t) => {
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
    // legacy fields used elsewhere
    const first = a.types[CHARACTER_TYPES[0]];
    a.scale = first.scale;
    a.footOffset = first.footOffset;
    return a;
  }
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _axis = new THREE.Vector3();

export class Character {
  constructor(assets, color = '#2ee6c9', type = 'Knight', tint = 0.28) {
    this.assets = assets;
    const src = assets.types[type] || assets.types.Knight;
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(src.scene);
    model.scale.setScalar(src.scale);
    model.position.y = src.footOffset;
    this.footOffset = src.footOffset;
    this.model = model;
    this.root.add(model);
    this.color = new THREE.Color(color);

    this.materials = [];
    const tintColor = new THREE.Color(1, 1, 1).lerp(this.color, tint);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        const m = o.material.clone();
        m.color.copy(tintColor);
        m.roughness = 0.6;
        m.metalness = 0;
        addRim(m, '#e6f4ff', 0.45);
        o.material = m;
        this.materials.push(m);
      }
      if (o.isBone) {
        if (o.name === 'handslotr') this.handR = o;
        else if (o.name === 'chest') this.chestBone = o;
        else if (o.name === 'spine') this.spine = o;
        else if (o.name === 'head') this.head = o;
      }
    });

    this.mixer = new THREE.AnimationMixer(model);
    this.upperActions = {};
    this.lowerActions = {};
    for (const name of Object.keys(assets.upper)) {
      for (const [layer, store] of [[assets.upper, this.upperActions], [assets.lower, this.lowerActions]]) {
        const act = this.mixer.clipAction(layer[name]);
        if (ONCE.has(name)) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
        store[name] = act;
      }
    }
    this.cur = { upper: null, lower: null };
    this.curName = { upper: null, lower: null };
    this.setPose('Idle', null, 0);

    this.weaponHolder = new THREE.Object3D();
    this.root.add(this.weaponHolder);
    this.weaponMesh = null;
    this.lodSkip = 0;
  }

  get currentName() { return this.curName.lower; }

  _layer(layer, name, fade, timeScale) {
    const store = layer === 'upper' ? this.upperActions : this.lowerActions;
    const next = store[name];
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
      mesh.scale.setScalar(1.55);
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
    this.mixer.update(dt);
    if (this.weaponMesh) this.weaponMesh.visible = this.inHand || armed;
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
      this.weaponHolder.rotation.set(-pitch, 0, 0);
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
