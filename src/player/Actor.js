import * as THREE from 'three';
import { Character } from './Character.js';
import { makeGlider } from './Glider.js';
import { damp, dampAngle } from '../core/noise.js';

export const RUN_SPEED = 6.4;
const JUMP_VEL = 8.2;
const GLIDE_HEIGHT = 35;

// Shared body for the player and bots: state machine, physics, animation, health.
export class Actor {
  constructor(game, { name, color, isPlayer = false }) {
    this.game = game;
    this.name = name;
    this.isPlayer = isPlayer;
    this.color = new THREE.Color(color);
    this.character = new Character(game.assets, color);
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
    if (s === 'dead') this.character.play('Death', 0.15);
    else if (s === 'skydive' || s === 'glide') this.character.play('Jump', 0.25, 0.6);
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
      const speed = this.inWater ? RUN_SPEED * 0.6 : RUN_SPEED;
      const k = this.onGround ? 14 : 3;
      this.vel.x = damp(this.vel.x, it.mx * speed, k, dt);
      this.vel.z = damp(this.vel.z, it.mz * speed, k, dt);
      if (it.jump && this.onGround) {
        this.vel.y = JUMP_VEL;
        this.onGround = false;
        this.character.play('Jump', 0.1, 1.4);
        this.jumpT = 0;
        this.game.sound?.play('jump', this.pos);
      }
      world.moveBody(this, dt);
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

  land() {
    this.setState('ground');
    this.vel.y = 0;
    this.character.play('Idle', 0.2);
    this.onLanded?.();
  }

  updateVisual(dt, camPos) {
    const ch = this.character;
    this.distToCam = camPos ? this.pos.distanceTo(camPos) : 0;
    this.root.position.copy(this.pos);
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const armed = !!this.weapon && this.state === 'ground' && this.alive && !this.victory;
    const combat = armed && (this.game.time - this.lastFireTime < 1.5 || this.aiming);
    if (this.state === 'ground') {
      let targetYaw = this.bodyYaw;
      if (combat) targetYaw = this.aimYaw;
      else if (hspeed > 0.6) targetYaw = Math.atan2(this.vel.x, this.vel.z);
      else if (armed) targetYaw = this.aimYaw;
      this.bodyYaw = dampAngle(this.bodyYaw, targetYaw, combat ? 25 : 12, dt);
      if (this.victory) ch.play('Dance', 0.3);
      else if (!this.onGround && this.vel.y > -20) {
        this.jumpT = (this.jumpT || 0) + dt;
        if (ch.currentName !== 'Jump') ch.play('Jump', 0.15, 1.2);
      } else if (hspeed > 3.2) {
        ch.play('Running', 0.2);
        ch.setTimeScale(Math.min(1.5, Math.max(0.6, hspeed / RUN_SPEED)) * 1.0);
      } else if (hspeed > 0.5) {
        ch.play('Walking', 0.2);
        ch.setTimeScale(Math.max(0.6, hspeed / 2.4));
      } else {
        ch.play('Idle', 0.2);
      }
      ch.model.rotation.x = damp(ch.model.rotation.x, 0, 10, dt);
    } else if (this.state === 'skydive') {
      if (hspeed > 1) this.bodyYaw = dampAngle(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z), 4, dt);
      ch.model.rotation.x = damp(ch.model.rotation.x, 1.2, 4, dt);
      ch.model.position.y = damp(ch.model.position.y, 0.9, 4, dt);
    } else if (this.state === 'glide') {
      if (hspeed > 1) this.bodyYaw = dampAngle(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z), 4, dt);
      ch.model.rotation.x = damp(ch.model.rotation.x, 0.25, 4, dt);
      ch.model.position.y = damp(ch.model.position.y, this.game.assets.footOffset, 4, dt);
      this.glider.rotation.z = Math.sin(this.game.time * 1.3) * 0.05;
    }
    if (this.state === 'ground' || this.state === 'dead') ch.model.position.y = damp(ch.model.position.y, this.game.assets.footOffset, 10, dt);
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
      ch.update(this._animAcc, pitch, armed, far);
      this._animAcc = 0;
    }
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
