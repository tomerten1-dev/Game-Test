import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { addRim } from '../effects/Shaders.js';

// Shared robot asset; every player/bot gets its own SkeletonUtils clone.
export class CharacterAssets {
  static async load(url = '/models/RobotExpressive.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    const a = new CharacterAssets();
    a.scene = gltf.scene;
    a.clips = {};
    for (const c of gltf.animations) a.clips[c.name] = c;
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const h = box.max.y - box.min.y;
    a.scale = 1.8 / h;
    a.footOffset = -box.min.y * a.scale;
    return a;
  }
}

const LOOP_ONCE = new Set(['Death', 'Jump', 'Punch', 'WalkJump', 'Yes', 'No', 'ThumbsUp', 'Wave', 'Sitting', 'Standing']);

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

export class Character {
  constructor(assets, color = '#2ee6c9') {
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(assets.scene);
    model.scale.setScalar(assets.scale);
    model.position.y = assets.footOffset;
    this.model = model;
    this.root.add(model);
    this.color = new THREE.Color(color);

    this.materials = [];
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        const src = o.material;
        const m = src.clone();
        if (src.name === 'Main') {
          m.color.copy(this.color);
          m.roughness = 0.45;
          m.metalness = 0.15;
        } else if (src.name === 'Grey') {
          m.color.set('#e8ecf2');
          m.roughness = 0.5;
        } else {
          m.roughness = 0.4;
        }
        if (src.name !== 'Black') addRim(m, '#e6f4ff', src.name === 'Main' ? 0.55 : 0.35);
        o.material = m;
        this.materials.push(m);
      }
      if (o.isBone) {
        const n = o.name;
        if (n === 'UpperArmR') this.upperArmR = o;
        else if (n === 'LowerArmR') this.lowerArmR = o;
        else if (n === 'UpperArmL') this.upperArmL = o;
        else if (n === 'LowerArmL') this.lowerArmL = o;
        else if (n === 'Palm2R') this.palmR = o;
        else if (n === 'Palm2L') this.palmL = o;
        else if (n === 'Head' && !this.head) this.head = o;
        else if (n === 'Abdomen') this.spine = o;
      }
    });

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const [name, clip] of Object.entries(assets.clips)) {
      const act = this.mixer.clipAction(clip);
      if (LOOP_ONCE.has(name)) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
      this.actions[name] = act;
    }
    this.current = null;
    this.play('Idle', 0);

    // Weapon pivot at shoulder height; rotates with aim pitch.
    this.aimPivot = new THREE.Object3D();
    this.aimPivot.position.set(0, 1.28, 0);
    this.root.add(this.aimPivot);
    this.weaponHolder = new THREE.Object3D();
    this.weaponHolder.position.set(-0.24, -0.05, 0.42);
    this.aimPivot.add(this.weaponHolder);
    this.weaponMesh = null;
    this.gripR = new THREE.Object3D();
    this.gripL = new THREE.Object3D();
    this.weaponHolder.add(this.gripR, this.gripL);
    this.gripR.position.set(0, -0.02, -0.08);
    this.gripL.position.set(0, -0.02, 0.35);
    this.armsAiming = false;
    this.lodSkip = 0;
  }

  play(name, fade = 0.2, timeScale = 1) {
    const next = this.actions[name];
    if (!next) return;
    next.timeScale = timeScale;
    if (this.current === next) return;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    if (this.current && fade > 0) this.current.crossFadeTo(next, fade, false);
    else if (this.current) this.current.stop();
    this.current = next;
    this.currentName = name;
  }

  setTimeScale(s) { if (this.current) this.current.timeScale = s; }

  setWeapon(mesh) {
    if (this.weaponMesh) this.weaponHolder.remove(this.weaponMesh);
    this.weaponMesh = mesh;
    if (mesh) {
      this.weaponHolder.add(mesh);
      this.gripL.position.z = mesh.userData.foregrip ?? 0.35;
    }
  }

  // Rotate a bone so the direction bone->child points at a world target.
  _aimBone(bone, child, target) {
    if (!bone || !child) return;
    bone.getWorldPosition(_v1);
    child.getWorldPosition(_v2);
    const cur = _v2.sub(_v1).normalize();
    const want = _v3.copy(target).sub(_v1).normalize();
    _q1.setFromUnitVectors(cur, want);
    bone.getWorldQuaternion(_q2);
    bone.parent.getWorldQuaternion(_q3);
    _q2.premultiply(_q1);
    bone.quaternion.copy(_q3.invert().multiply(_q2));
    bone.updateMatrixWorld(true);
  }

  update(dt, pitch = 0, aimArms = false, skipIK = false) {
    this.mixer.update(dt);
    this.aimPivot.rotation.x = -pitch;
    if (this.weaponMesh) this.weaponMesh.visible = aimArms;
    if (aimArms && !skipIK && this.upperArmR) {
      this.root.updateMatrixWorld(true);
      const gR = this.gripR.getWorldPosition(_tR);
      const gL = this.gripL.getWorldPosition(_tL);
      this._aimBone(this.upperArmR, this.lowerArmR, gR);
      this._aimBone(this.lowerArmR, this.palmR, _tmp.copy(gR).addScaledVector(_fwd.set(0, 0, 1).applyQuaternion(this.weaponHolder.getWorldQuaternion(_q1)), 0.25));
      this._aimBone(this.upperArmL, this.lowerArmL, gL);
      this._aimBone(this.lowerArmL, this.palmL, _tmp.copy(gL).addScaledVector(_fwd.set(0, 0, 1).applyQuaternion(this.weaponHolder.getWorldQuaternion(_q1)), 0.2));
    }
  }

  flash(amount) {
    for (const m of this.materials) {
      m.emissive.setRGB(amount, amount, amount);
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    for (const m of this.materials) m.dispose();
  }
}

const _tR = new THREE.Vector3(), _tL = new THREE.Vector3(), _tmp = new THREE.Vector3(), _fwd = new THREE.Vector3();
