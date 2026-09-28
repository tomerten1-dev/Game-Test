import { setting } from '../ui/Settings.js';
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
    const style = hero?.styles?.[prof?.d.heroStyles?.[hero.id] || 0];
    const outfit = style?.[1] || hero?.tint || null;
    super(game, { name: 'You', color: '#20d6c0', isPlayer: true, type: hero?.value || 'Male_Ranger', glider: look('glider'), tint: outfit ? 0.1 : 0.3, outfit });
    this.trail = look('trail') || null;
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
    // auto-run (= by default): keep running forward until you press forward or back
    if (input.pressed('autorun')) this.autoRunning = !this.autoRunning;
    if (this.autoRunning && (input.pressed('forward') || input.pressed('back') || this.state !== 'ground')) this.autoRunning = false;
    const my = this.autoRunning && Math.abs(m.y) < 0.1 ? 1 : m.y;
    // camera-relative move direction
    const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
    this.intent.mx = -sy * my + cy * m.x;
    this.intent.mz = -cy * my - sy * m.x;
    // sprint: hold Shift, or toggle it, or sprint by default (then Shift walks) — see Settings
    const g = this.game;
    let sprintOn;
    if (setting(g, 'sprintByDefault', false)) sprintOn = !input.down('sprint');
    else if (setting(g, 'toggleSprint', false)) {
      if (input.pressed('sprint')) this.sprintToggled = !this.sprintToggled;
      if (Math.hypot(m.x, my) < 0.1) this.sprintToggled = false;
      sprintOn = !!this.sprintToggled;
    } else sprintOn = input.down('sprint');
    this.intent.sprint = sprintOn || Math.hypot(input.touchMove.x, input.touchMove.y) > 0.95;
    if (input.pressed('crouch') && this.state === 'ground') {
      // like Fortnite: crouch while running (sprinting or not) slides
      if (this.onGround && Math.hypot(this.vel.x, this.vel.z) > 4.2 && Math.hypot(m.x, my) > 0.3) { this.crouchHeld = false; this.startSlide(); }
      else { this.crouchHeld = !this.crouchHeld; this.crouched = this.crouchHeld; }
    }
    if (this.intent.sprint && input.down('sprint') && this.crouchHeld && this.slideT <= 0) this.crouchHeld = this.crouched = false;
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
    // roll landing: jump held, or tapped just before touching down
    if (this.intent.jumpPress) this._jumpPressT = g.time;
    this.intent.rollReady = input.down('jump') || g.time - (this._jumpPressT || -9) < 0.3;
  }
}
