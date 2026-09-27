import * as THREE from 'three';
import { Character } from './Character.js';
import { makeGlider } from './Glider.js';
import { damp, dampAngle } from '../core/noise.js';
import { makeWeaponMesh, makePickaxeMesh } from '../weapons/WeaponModels.js';
import { Pickaxe, Consumable, CONSUMABLES, MAT_CAP } from '../weapons/Items.js';

export const RUN_SPEED = 6.4;
export const SPRINT_SPEED = 9.0;
const CROUCH_SPEED = 3.4;
const SLIDE_TIME = 0.85;
const FALL_SAFE = 17; // landing speed (m/s) before fall damage
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
    this.intent = { mx: 0, mz: 0, jump: false, deploy: false, sprint: false };
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
    // slot 0 = pickaxe, slots 1-5 = guns or stackable consumables
    this.items = [new Pickaxe(), null, null, null, null, null];
    this.slot = 0;
    this.ammo = { light: 0, medium: 0, shells: 0, heavy: 0 };
    this.mats = { wood: 0, stone: 0, metal: 0 };
    this.infiniteAmmo = !isPlayer; // bots don't track reserve ammo
    this.crouched = false;
    this.crouchAmt = 0;
    this.sprinting = false;
    this.slideT = 0;
    this.slideDir = new THREE.Vector3();
    this.useT = 0; // consumable channel time left
    this.buildMode = null; // piece type while in build mode
    this.buildMat = 'wood';
    this.swingT = 0;
    this._stepDist = 0;
    this.distToCam = 0;
    this._animAcc = 0;
  }

  get held() { return this.items[this.slot]; }
  get weapon() { const h = this.items[this.slot]; return h && h.isGun ? h : null; }
  get weapons() { return this.items.filter((i) => i && i.isGun); }
  get matTotal() { return this.mats.wood + this.mats.stone + this.mats.metal; }
  get wood() { return this.mats.wood; }
  set wood(v) { this.mats.wood = Math.max(0, Math.min(MAT_CAP, v)); }

  ammoFor(type) { return this.infiniteAmmo ? Infinity : this.ammo[type] || 0; }

  // Move rounds from the reserve into the magazine when a reload completes.
  finishReload(w) {
    const need = w.def.mag - w.ammo;
    const take = this.infiniteAmmo ? need : Math.min(need, this.ammo[w.def.ammoType] || 0);
    w.ammo += take;
    if (!this.infiniteAmmo) this.ammo[w.def.ammoType] -= take;
  }

  addAmmo(type, n) { this.ammo[type] = Math.min(999, (this.ammo[type] || 0) + n); }
  addMat(type, n) { this.mats[type] = Math.min(MAT_CAP, this.mats[type] + n); }

  // Stack onto existing consumables first, then a free slot. Returns how many didn't fit.
  addConsumable(type, count) {
    const def = CONSUMABLES[type];
    for (const it of this.items) {
      if (!count) break;
      if (it && it.isConsumable && it.type === type && it.count < def.max) {
        const add = Math.min(count, def.max - it.count);
        it.count += add;
        count -= add;
      }
    }
    if (count > 0) {
      const free = this.items.findIndex((it, i) => i > 0 && !it);
      if (free > 0) { this.items[free] = new Consumable(type, Math.min(count, def.max)); count -= Math.min(count, def.max); if (free === this.slot) this._equip(); }
    }
    return count;
  }

  // Consumables: channel for def.time seconds, then apply and use one from the stack.
  startUse() {
    const h = this.held;
    if (!h || !h.isConsumable || this.useT > 0 || !h.usableBy(this)) return false;
    this.useT = h.def.time;
    this.useItem = h;
    this.game.sound?.play('use', this.isPlayer ? null : this.pos, { range: 30 });
    return true;
  }

  // Returns the finished item when a use completes.
  tickUse(dt) {
    if (this.useT <= 0) return null;
    const it = this.useItem;
    if (!it || this.held !== it) { this.useT = 0; return null; }
    this.useT -= dt;
    if (this.useT > 0) return null;
    this.useT = 0;
    it.apply(this);
    if (--it.count <= 0) {
      this.items[this.slot] = null;
      const next = this.items.findIndex((x, i) => i > 0 && x);
      if (!this.switchSlot(next > 0 ? next : 0)) this._equip();
    }
    return it;
  }

  // Slot of a consumable of the given kind ('heal' / 'shield') that helps right now, best first.
  findConsumable(kind) {
    let best = -1, bestV = 0;
    this.items.forEach((it, i) => {
      if (!it || !it.isConsumable || !it.usableBy(this)) return;
      const d = it.def;
      if (kind === 'heal' && !d.heal) return;
      if (kind === 'shield' && !d.shield) return;
      const v = d.heal ? Math.min(d.heal, d.cap - this.health) : Math.min(d.shield, d.cap - this.shield);
      if (v > bestV) { bestV = v; best = i; }
    });
    return best;
  }

  startSlide() {
    if (this.slideT > 0 || !this.onGround) return;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs < 5) return;
    this.slideT = SLIDE_TIME;
    this.slideDir.set(this.vel.x / hs, 0, this.vel.z / hs);
    this.crouched = true;
    this.game.sound?.play('slide', this.isPlayer ? null : this.pos);
    if (this.distToCam < 40) this.game.effects.dust(this.pos, 6, 1.2);
  }

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
      const mlen = Math.hypot(it.mx, it.mz);
      // sprint only when moving roughly forward and not busy
      const fwdDot = mlen > 0.1 ? (it.mx * Math.sin(this.aimYaw) + it.mz * Math.cos(this.aimYaw)) / mlen : 0;
      this.sprinting = !!it.sprint && !this.crouched && this.useT <= 0 && mlen > 0.3 && (fwdDot > 0.3 || !this.aiming) && !this.aiming;
      let speed = this.sprinting ? SPRINT_SPEED : this.crouched ? CROUCH_SPEED : RUN_SPEED;
      if (this.useT > 0) speed = Math.min(speed, 3.2);
      if (this.inWater) speed *= this.groundY < -1.2 ? 0.5 : 0.65;
      const k = this.onGround ? 14 : 3;
      if (this.slideT > 0) {
        this.slideT -= dt;
        const sp = 3 + 9 * Math.max(0, this.slideT / SLIDE_TIME);
        this.vel.x = this.slideDir.x * sp;
        this.vel.z = this.slideDir.z * sp;
        if (this.slideT <= 0 && !this.crouchHeld) this.crouched = false;
      } else {
        this.vel.x = damp(this.vel.x, it.mx * speed, k, dt);
        this.vel.z = damp(this.vel.z, it.mz * speed, k, dt);
      }
      if (it.jump && this.onGround) {
        this.crouched = false;
        this.crouchHeld = false;
        this.slideT = 0;
        this.vel.y = JUMP_VEL;
        this.onGround = false;
        this.character.setPose('Jump_Start', null, 0.08, 1.6);
        this.jumpT = 0;
        this.game.sound?.play('jump', this.pos);
      }
      const wasGround = this.onGround;
      world.moveBody(this, dt);
      if (this.onGround && !wasGround && this.landSpeed > 7) {
        this.onHardLanding?.(this.landSpeed);
        if (this.landSpeed > FALL_SAFE) this.fallDamage(Math.round((this.landSpeed - FALL_SAFE) * 5.5));
      }
      // footsteps
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (this.onGround && hs > 1.5 && !this.crouched && this.slideT <= 0) {
        this._stepDist += hs * dt;
        const stepLen = this.sprinting ? 2.4 : hs > 4 ? 1.9 : 1.3;
        if (this._stepDist > stepLen) {
          this._stepDist = 0;
          if (this.isPlayer) this.game.sound?.play('step', null, { vol: this.sprinting ? 0.35 : 0.22 });
          else if (this.distToCam < 45) this.game.sound?.play('step', this.pos, { range: 45, vol: this.sprinting ? 1.1 : 0.8 });
        }
      }
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

  fallDamage(dmg) {
    if (!this.alive || dmg <= 0) return;
    this.health -= dmg;
    this.lastHurtTime = this.game.time;
    this.flashT = 0.25;
    this.game.sound?.play('fall', this.isPlayer ? null : this.pos);
    if (this.isPlayer) { this.game.hud.hurt(); this.game.effects.damageNumber(this.chest(new THREE.Vector3()), dmg, false, false); }
    if (this.health <= 0) { this.health = 0; this.deathCause = 'fall'; this.die(null); }
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
    const armed = !!this.weapon && this.state === 'ground' && this.alive && !this.victory && !this.sprinting && this.slideT <= 0;
    const held = this.held;
    this.swingT = Math.max(0, this.swingT - dt);
    this.crouchAmt = damp(this.crouchAmt, this.crouched && this.state === 'ground' ? 1 : 0, 12, dt);
    const combat = armed && (this.game.time - this.lastFireTime < 1.5 || this.aiming);
    const w = this.weapon;
    const hand = w && w.type === 'pistol' ? '1H' : '2H';
    const firing = this.game.time - this.lastFireTime < 0.25;
    let upperArmed = !armed ? null : w.reloading ? `${hand}_Ranged_Reload` : firing ? `${hand}_Ranged_Shooting` : `${hand}_Ranged_Aiming`;
    if (this.useT > 0) upperArmed = 'Use_Item';
    else if (held && held.isPickaxe && this.swingT > 0) upperArmed = '1H_Melee_Attack_Chop';
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
      } else if (this.slideT > 0) {
        ch.setPose('Jump_Idle', null, 0.12);
      } else if (this.sprinting && hspeed > 3) {
        ch.setPose('Running_B', upperArmed, 0.15, Math.min(1.4, hspeed / SPRINT_SPEED * 1.15));
      } else if (hspeed > 0.5) {
        // direction of travel relative to where the body faces
        const fx = Math.sin(this.bodyYaw), fz = Math.cos(this.bodyYaw);
        const fwd = (this.vel.x * fx + this.vel.z * fz) / hspeed;
        const right = (this.vel.x * -fz + this.vel.z * fx) / hspeed;
        const rate = Math.min(1.5, Math.max(0.6, hspeed / RUN_SPEED));
        let lower;
        if (hspeed < 3 || this.crouched) lower = fwd > -0.5 ? 'Walking_A' : 'Walking_Backwards';
        else if (fwd > 0.55) lower = 'Running_A';
        else if (fwd < -0.55) lower = 'Walking_Backwards';
        else lower = right > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
        ch.setPose(lower, upperArmed, 0.18, lower === 'Walking_Backwards' ? rate * 1.4 : rate);
      } else {
        ch.setPose(armed ? `${hand}_Ranged_Aiming` : 'Idle', upperArmed, 0.2);
      }
      if (this.onGround && this._wasAir) { this._wasAir = false; this.landT = 0.2; ch.setPose('Jump_Land', upperArmed, 0.08, 1.4); }
      ch.model.rotation.x = damp(ch.model.rotation.x, this.slideT > 0 ? -0.75 : 0, 10, dt);
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
    if (this.state === 'ground' || this.state === 'dead') ch.model.position.y = damp(ch.model.position.y, ch.footOffset - this.crouchAmt * 0.3 - (this.slideT > 0 ? 0.25 : 0), 10, dt);
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
      ch.update(this._animAcc, pitch, armed, this.crouchAmt);
      this._animAcc = 0;
    }
  }

  // --- inventory ---
  giveWeapon(weapon, slot = -1) {
    if (slot < 0) slot = this.items.findIndex((it, i) => i > 0 && !it);
    if (slot < 1) slot = this.slot > 0 ? this.slot : 1;
    const old = this.items[slot];
    this.items[slot] = weapon;
    if (slot === this.slot) this._equip();
    return old;
  }

  switchSlot(i) {
    if (i < 0 || i > 5) return false;
    if (this.buildMode) { this.buildMode = null; if (i === this.slot) { this._equip(); return true; } }
    if (i === this.slot) return false;
    this.weapon?.cancelReload();
    this.useT = 0;
    this.slot = i;
    this._equip();
    return true;
  }

  // Enter/leave build mode (hands are empty while building).
  setBuildMode(piece) {
    if (piece === this.buildMode) return;
    const was = this.buildMode;
    this.buildMode = piece;
    if (piece && !was) { this.weapon?.cancelReload(); this.useT = 0; }
    if (!!piece !== !!was) this._equip();
  }

  _equip() {
    const h = this.held;
    if (this.buildMode) this.character.setWeapon(null);
    else if (h && h.isGun) this.character.setWeapon(makeWeaponMesh(h.type, h.rarity));
    else if (h && h.isPickaxe) this.character.setWeapon(makePickaxeMesh(), true);
    else this.character.setWeapon(null);
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
