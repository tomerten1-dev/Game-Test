import * as THREE from 'three';
import { Actor } from './Actor.js';

// The human-controlled actor: turns input into movement intent relative to the camera.
export class Player extends Actor {
  constructor(game) {
    super(game, { name: 'You', color: '#20d6c0', isPlayer: true, type: 'Rogue_Hooded' });
    this._addBackpack();
  }

  // Little backpack with a glowing antenna so your hero stands out.
  _addBackpack() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#1a8f86', roughness: 0.5, metalness: 0.2 });
    const trim = new THREE.MeshStandardMaterial({ color: '#f2f5f8', roughness: 0.5 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.18), bodyMat);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.2), trim);
    lid.position.y = 0.2;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), trim);
    ant.position.set(0.12, 0.66, -0.02);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#8ffff0', emissive: '#2ee6c9', emissiveIntensity: 2.5 }));
    tip.position.set(0.12, 1.15, -0.02);
    for (const m of [pack, lid, ant, tip]) { m.castShadow = true; g.add(m); }
    g.position.set(0, 0.78, -0.24);
    this.character.root.add(g);
    this.character.root.updateMatrixWorld(true);
    const torso = this.character.chestBone || this.character.spine;
    if (torso) torso.attach(g);
    this.backpack = g;
  }

  onDamaged(amount, attacker) {
    this.game.hud.hurt(attacker);
    this.game.sound.play('hurt');
  }

  readInput(dt, input, rig) {
    const look = input.consumeLook();
    rig.addLook(look.x, look.y);
    this.aimYaw = rig.yaw + Math.PI;
    this.aimPitch = rig.pitch + rig.recoil;
    this.aiming = input.down('aim') && !this.buildMode;
    const m = input.move();
    // camera-relative move direction
    const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
    this.intent.mx = -sy * m.y + cy * m.x;
    this.intent.mz = -cy * m.y - sy * m.x;
    // sprint: hold Shift (touch: push the stick all the way)
    this.intent.sprint = input.down('sprint') || Math.hypot(input.touchMove.x, input.touchMove.y) > 0.95;
    if (input.pressed('crouch') && this.state === 'ground') {
      if (this.sprinting && this.onGround) { this.crouchHeld = false; this.startSlide(); }
      else { this.crouchHeld = !this.crouchHeld; this.crouched = this.crouchHeld; }
    }
    if (input.down('sprint') && this.crouchHeld && this.slideT <= 0) this.crouchHeld = this.crouched = false;
    this.intent.jump = input.down('jump');
    this.intent.deploy = this.state === 'skydive' && input.pressed('jump');
  }
}
