import * as THREE from 'three';
import { Actor } from './Actor.js';

// The human-controlled actor: turns input into movement intent relative to the camera.
export class Player extends Actor {
  constructor(game) {
    super(game, { name: 'You', color: '#20d6c0', isPlayer: true });
  }

  readInput(dt, input, rig) {
    const look = input.consumeLook();
    rig.addLook(look.x, look.y);
    this.aimYaw = rig.yaw + Math.PI;
    this.aimPitch = rig.pitch + rig.recoil;
    this.aiming = input.down('aim');
    const m = input.move();
    // camera-relative move direction
    const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
    this.intent.mx = -sy * m.y + cy * m.x;
    this.intent.mz = -cy * m.y - sy * m.x;
    this.intent.jump = input.down('jump');
    this.intent.deploy = this.state === 'skydive' && input.pressed('jump');
  }
}
