import * as THREE from 'three';
import { Actor } from './Actor.js';
import { TOWNS } from '../world/Terrain.js';

// The human-controlled actor: turns input into movement intent relative to the camera.
export class Player extends Actor {
  constructor(game) {
    const prof = game.meta?.profile;
    const look = (slot) => prof?.equippedItem(slot)?.value;
    const hero = prof?.equippedItem('hero');
    // skins bring their own colours unless you picked an outfit colour
    const outfit = look('tint') || hero?.tint || null;
    super(game, { name: 'You', color: '#20d6c0', isPlayer: true, type: hero?.value || 'Male_Ranger', glider: look('glider'), tint: outfit ? 0.1 : 0.3, outfit });
    this.trail = look('trail') || null;
    this.wrap = look('wrap') || null;
    this.emoteClip = look('emote') || 'Cheer';
    this.victoryEmote = this.emoteClip;
    this.pickaxeSkin = look('pickaxe') || null;
    this.applyGear({ hat: hero?.hat, backbling: prof ? look('backbling') : 'antenna' });
    this._equip?.();
  }

  // Landing quest: which named place did we touch down in?
  onLanded() {
    if (this.game.sound.musicName === 'bus') this.game.sound.music(null);
    for (const t of TOWNS) if (Math.hypot(this.pos.x - t.x, this.pos.z - t.z) < t.r) { this.game.meta?.track('land', 1, t.name); break; }
  }

  onDamaged(amount, attacker) {
    this.game.hud.hurt(attacker);
    const broke = this._shieldWas > 0 && this.shield <= 0;
    this.game.hud.damageTaken(amount, broke);
    if (broke) this.game.sound.play('shieldBreak');
    this.game.sound.play('hurt');
  }

  readInput(dt, input, rig) {
    const look = input.consumeLook();
    const zoom = rig.fov < 40 ? rig.fov / 70 : 1; // slower look while scoped
    rig.addLook(look.x * zoom, look.y * zoom);
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
    // quick 90s: run up the ramp we just built
    if (this.autoRun && (this.autoRun.t -= dt) > 0 && this.pos.y < this.autoRun.top - 0.3) {
      this.intent.mx = this.autoRun.x; this.intent.mz = this.autoRun.z; this.intent.sprint = false;
      this.aimYaw = rig.yaw + Math.PI;
    } else this.autoRun = null;
    this.intent.deploy = this.state === 'skydive' && input.pressed('jump');
    // glider redeploy: jump while falling from high up
    this.intent.redeploy = this.state === 'ground' && !this.onGround && input.pressed('jump');
    this.intent.jumpPress = input.pressed('jump');
  }
}
