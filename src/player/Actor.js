import * as THREE from 'three';
import { Character } from './Character.js';
import { makeGlider } from './Glider.js';
import { damp, dampAngle } from '../core/noise.js';
import { makeWeaponMesh } from '../weapons/WeaponModels.js';

export const RUN_SPEED = 6.4;
const JUMP_VEL = 8.2;
const GLIDE_HEIGHT = 35;

// Shared body for the player and bots: state machine, physics, animation, health.
export class Actor {
  constructor(game, { name, color, isPlayer = false, type = 'Knight' }) {
    this.game = game;
    this.name = name;
    this.isPlayer = isPlayer;
    this.color = new THREE.Color(color);
    this.character = new Character(game.assets, color, type, isPlayer ? 0.35 : 0.3);
    this.root = this.character.root;
    this.glider = makeGlider(color);
    this.root.add(this.glider);
    game.scene.add(this.root);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = 0.42;
    this.height = 1.8;
    this.onGround = false;
    this.intent = { mx: 0, mz: 0, jump: false, deploy: false };
    this.aimYaw = 0;
    this.aimPitch = 0;
    this.bodyYaw = 0;
    this.state = 'ground';
    this.alive = true;
    this.health = 100;
    this.shield = 0;
    this.kills = 0;
    this.lastFireTime = -10;
    this.lastHurtTime = -10;
    this.flashT = 0;
    this.weapons = [null, null, null];
    this.slot = 0;
    this.wood = 0;
    this.distToCam = 0;
    this._animAcc = 0;
  }

  get weapon() { return this.weapons[this.slot]; }

  // Eye/chest height helpers
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.15, this.pos.z); }

  spawnGround(x, z) {
    this.pos.set(x, this.game.world.heightAt(x, z) + 0.1, z);
    this.vel.set(0, 0, 0);
    this.setState('ground');
  }

  setState(s) {
    this.state = s;
    this.glider.visible = s === 'glide';
    this.root.visible = s !== 'bus';
    this.character.model.rotation.x = 0;
    if (s === 'dead') this.character.setPose('Death_A', null, 0.15);
    else if (s === 'skydive' || s === 'glide') this.character.setPose('Jump_Idle', null, 0.25);
  }

  jumpFromBus(busPos, busVel) {
    this.pos.copy(busPos);
    this.pos.y -= 2;
    this.vel.set(busVel.x * 0.5, -4, busVel.z * 0.5);
    this.setState('skydive');
  }

  heightAboveGround() { return this.pos.y - this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y); }

  updateMovement(dt) {
    const world = this.game.world;
    const it = this.intent;
    if (this.state === 'bus' || this.state === 'dead') {
      if (this.state === 'dead') {
        this.vel.x = this.vel.z = 0;
        world.moveBody(this, dt);
      }
      return;
    }
    if (this.state === 'ground') {
      const speed = this.inWater ? RUN_SPEED * (this.groundY < -1.2 ? 0.5 : 0.65) : RUN_SPEED;
      const k = this.onGround ? 14 : 3;
      this.vel.x = damp(this.vel.x, it.mx * speed, k, dt);
      this.vel.z = damp(this.vel.z, it.mz * speed, k, dt);
      if (it.jump && this.onGround) {
        this.vel.y = JUMP_VEL;
        this.onGround = false;
        this.character.setPose('Jump_Start', null, 0.08, 1.6);
        this.jumpT = 0;
        this.game.sound?.play('jump', this.pos);
      }
      const wasGround = this.onGround;
      world.moveBody(this, dt);
      if (this.onGround && !wasGround && this.landSpeed > 7) this.onHardLanding?.(this.landSpeed);
      // dust puffs while running (only near the camera)
      if (this.onGround && this.distToCam < 35 && Math.hypot(this.vel.x, this.vel.z) > 4.5) {
        this._dustT = (this._dustT || 0) - dt;
        if (this._dustT <= 0) { this._dustT = 0.22; this.game.effects.dust(this.pos, 1, 0.6); }
      }
    } else if (this.state === 'skydive') {
      const hs = 17;
      this.vel.x = damp(this.vel.x, it.mx * hs, 2.2, dt);
      this.vel.z = damp(this.vel.z, it.mz * hs, 2.2, dt);
      const dive = Math.hypot(it.mx, it.mz) > 0.1 ? -30 : -24;
      this.vel.y = damp(this.vel.y, dive, 1.5, dt);
      world.moveBody(this, dt, 0);
      const hag = this.heightAboveGround();
      if (hag < GLIDE_HEIGHT || it.deploy) this.setState('glide');
      if (this.onGround) this.land();
    } else if (this.state === 'glide') {
      const hs = 12;
      this.vel.x = damp(this.vel.x, it.mx * hs, 2.5, dt);
      this.vel.z = damp(this.vel.z, it.mz * hs, 2.5, dt);
      this.vel.y = damp(this.vel.y, -6.5, 3, dt);
      world.moveBody(this, dt, 0);
      if (this.onGround) this.land();
    }
  }

  onHardLanding(speed) {
    if (this.distToCam < 50) this.game.effects.dust(this.pos, Math.min(14, Math.round(speed * 0.8)), 1.8);
    if (this.isPlayer) this.game.rig.bob = Math.min(0.55, speed * 0.03);
  }

  land() {
    this.onHardLanding(12);
    this.setState('ground');
    this.vel.y = 0;
    this.character.setPose('Jump_Land', null, 0.1, 1.3);
    this.landT = 0.25;
    this.onLanded?.();
  }

  updateVisual(dt, camPos) {
    const ch = this.character;
    this.distToCam = camPos ? this.pos.distanceTo(camPos) : 0;
    this.root.position.copy(this.pos);
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const armed = !!this.weapon && this.state === 'ground' && this.alive && !this.victory;
    const combat = armed && (this.game.time - this.lastFireTime < 1.5 || this.aiming);
    const w = this.weapon;
    const hand = w && w.type === 'pistol' ? '1H' : '2H';
    const firing = this.game.time - this.lastFireTime < 0.25;
    const upperArmed = !armed ? null : w.reloading ? `${hand}_Ranged_Reload` : firing ? `${hand}_Ranged_Shooting` : `${hand}_Ranged_Aiming`;
    if (this.state === 'ground') {
      let targetYaw = this.bodyYaw;
      if (combat) targetYaw = this.aimYaw;
      else if (hspeed > 0.6) targetYaw = Math.atan2(this.vel.x, this.vel.z);
      else if (armed) targetYaw = this.aimYaw;
      this.bodyYaw = dampAngle(this.bodyYaw, targetYaw, combat ? 25 : 12, dt);
      this.airT = this.onGround ? 0 : (this.airT || 0) + dt;
      if (this.victory) ch.setPose('Cheer', null, 0.3);
      else if (!this.alive) { /* death pose set in setState */ }
      else if (this.airT > 0.12 && this.vel.y > -25) {
        ch.setPose('Jump_Idle', upperArmed, 0.15);
        this._wasAir = this.airT > 0.35;
      } else if (this.landT > 0) {
        this.landT -= dt;
      } else if (hspeed > 0.5) {
        // direction of travel relative to where the body faces
        const fx = Math.sin(this.bodyYaw), fz = Math.cos(this.bodyYaw);
        const fwd = (this.vel.x * fx + this.vel.z * fz) / hspeed;
        const right = (this.vel.x * -fz + this.vel.z * fx) / hspeed;
        const rate = Math.min(1.5, Math.max(0.6, hspeed / RUN_SPEED));
        let lower;
        if (hspeed < 3) lower = fwd > -0.5 ? 'Walking_A' : 'Walking_Backwards';
        else if (fwd > 0.55) lower = 'Running_A';
        else if (fwd < -0.55) lower = 'Walking_Backwards';
        else lower = right > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
        ch.setPose(lower, upperArmed, 0.18, lower === 'Walking_Backwards' ? rate * 1.4 : rate);
      } else {
        ch.setPose(armed ? `${hand}_Ranged_Aiming` : 'Idle', upperArmed, 0.2);
      }
      if (this.onGround && this._wasAir) { this._wasAir = false; this.landT = 0.2; ch.setPose('Jump_Land', upperArmed, 0.08, 1.4); }
      ch.model.rotation.x = damp(ch.model.rotation.x, 0, 10, dt);
    } else if (this.state === 'skydive') {
      if (hspeed > 1) this.bodyYaw = dampAngle(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z), 4, dt);
      ch.setPose('Jump_Idle', null, 0.3);
      ch.model.rotation.x = damp(ch.model.rotation.x, 1.25, 4, dt);
      ch.model.position.y = damp(ch.model.position.y, 0.9, 4, dt);
    } else if (this.state === 'glide') {
      if (hspeed > 1) this.bodyYaw = dampAngle(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z), 4, dt);
      ch.setPose('Jump_Idle', null, 0.3);
      ch.model.rotation.x = damp(ch.model.rotation.x, 0.2, 4, dt);
      ch.model.position.y = damp(ch.model.position.y, ch.footOffset, 4, dt);
      this.glider.rotation.z = Math.sin(this.game.time * 1.3) * 0.05;
    }
    if (this.state === 'ground' || this.state === 'dead') ch.model.position.y = damp(ch.model.position.y, ch.footOffset, 10, dt);
    this.root.rotation.y = this.bodyYaw;

    // Damage flash
    if (this.flashT > 0) { this.flashT -= dt; ch.flash(Math.max(0, this.flashT) * 2.5); if (this.flashT <= 0) ch.flash(0); }

    // Animation LOD: far characters animate at a lower rate.
    const far = this.distToCam > 70;
    const veryFar = this.distToCam > 160;
    if (veryFar && !this.isPlayer) { this.root.visible = this.state !== 'bus' && this.distToCam < 330; }
    this._animAcc += dt;
    const every = veryFar ? 0.1 : far ? 0.05 : 0;
    if (this._animAcc >= every) {
      const pitch = this.state === 'ground' ? this.aimPitch : 0;
      ch.update(this._animAcc, pitch, armed);
      this._animAcc = 0;
    }
  }

  // --- inventory ---
  giveWeapon(weapon, slot = -1) {
    if (slot < 0) slot = this.weapons.findIndex((w) => !w);
    if (slot < 0) slot = this.slot;
    const old = this.weapons[slot];
    this.weapons[slot] = weapon;
    if (slot === this.slot) this._equip();
    return old;
  }

  switchSlot(i) {
    if (i === this.slot || i < 0 || i > 2) return false;
    this.weapon?.cancelReload();
    this.slot = i;
    this._equip();
    return true;
  }

  _equip() {
    const w = this.weapon;
    this.character.setWeapon(w ? makeWeaponMesh(w.type, w.rarity) : null);
  }

  muzzleWorld(out = new THREE.Vector3()) {
    const m = this.character.weaponMesh;
    if (!m) return this.chest(out);
    return m.localToWorld(out.copy(m.userData.muzzle));
  }

  // --- combat state ---
  takeDamage(amount, attacker, headshot = false) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.shield > 0) {
      const s = Math.min(this.shield, dmg);
      this.shield -= s;
      dmg -= s;
    }
    this.health -= dmg;
    this.lastHurtTime = this.game.time;
    this.lastAttacker = attacker;
    this.flashT = 0.25;
    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker);
    }
    this.onDamaged?.(amount, attacker, headshot);
    return amount;
  }

  die(killer) {
    if (!this.alive) return;
    this.alive = false;
    this.setState('dead');
    this.killer = killer;
    this.game.onActorDied?.(this, killer);
  }

  destroy() {
    this.game.scene.remove(this.root);
    this.character.dispose();
  }
}
