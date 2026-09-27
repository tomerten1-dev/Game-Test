import * as THREE from 'three';
import { Actor, RUN_SPEED } from '../player/Actor.js';
import { angleDiff, clamp } from '../core/noise.js';

const THINK = 0.3;
const SIGHT = 70;
const _v = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _tp = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

// AI bot: a slow "think" picks goals/targets; a per-frame update steers, aims and shoots.
export class Bot extends Actor {
  constructor(game, name, color, skill, type = 'Knight') {
    super(game, { name, color, type });
    this.skill = skill; // 0..1
    this.thinkT = Math.random() * THINK;
    this.goal = new THREE.Vector3();
    this.hasGoal = false;
    this.mode = 'idle';
    this.target = null;
    this.reactionT = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 0;
    this.burstT = 0;
    this.pauseT = 0;
    this.stuckT = 0;
    this.detourT = 0;
    this.detourDir = 1;
    this.lastSeenT = -10;
    this.lastSeenPos = new THREE.Vector3();
    this.aimErr = new THREE.Vector3();
    this.buildCooldown = 0;
    this.accuracyMult = 1.5 - skill * 0.5;
    this.dropTarget = new THREE.Vector3();
    this.jumpAt = 0;
    this.lootChest = null;
    this.pickup = null;
  }

  onDamaged(amount, attacker) {
    if (!this.alive) return;
    if (attacker && attacker !== this && attacker.alive) {
      if (!this.target || !this.target.alive || this.pos.distanceTo(attacker.pos) < this.pos.distanceTo(this.target.pos) * 1.3) {
        if (this.target !== attacker) this.reactionT = 0.25 + Math.random() * 0.3;
        this.target = attacker;
        this.lastSeenT = this.game.time;
        this.lastSeenPos.copy(attacker.pos);
      }
    }
    if (this.state !== 'ground') return;
    const r = Math.random();
    if (r < 0.25 && this.onGround) this.wantJump = true;
    else if (r < 0.45 && this.buildCooldown <= 0 && this.wood >= 10 && attacker && this.game.building) {
      this.buildCooldown = 5;
      this.game.building.buildWallFacing(this, Math.atan2(attacker.pos.x - this.pos.x, attacker.pos.z - this.pos.z));
    }
  }

  setGoal(x, z) { this.goal.set(x, 0, z); this.hasGoal = true; }

  think() {
    const g = this.game;
    if (this.state === 'skydive' || this.state === 'glide') {
      this.setGoal(this.dropTarget.x, this.dropTarget.z);
      return;
    }
    if (this.state !== 'ground') return;

    // --- perception ---
    if (this.target && (!this.target.alive || this.target.state === 'bus')) this.target = null;
    const eye = this.eye(_eye);
    let best = null, bestD = SIGHT;
    // aggression ramps up after landing: early on bots mostly loot
    if (this.landTime === undefined) this.landTime = g.time;
    const calm = Math.min(1, (g.time - this.landTime) / 140);
    const sight = 18 + (SIGHT - 18) * calm;
    const cands = [];
    for (const a of g.actors) {
      if (a === this || !a.alive || a.state === 'bus') continue;
      const d = a.pos.distanceTo(this.pos);
      const range = a === this.target ? SIGHT + 30 : a.isPlayer ? sight + 12 : calm < 0.4 ? 7 : sight * 0.7;
      if (d < range) cands.push([d, a]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    const fx = Math.sin(this.aimYaw), fz = Math.cos(this.aimYaw);
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const [d, a] = cands[i];
      if (a !== this.target) {
        // must notice them: in front (or close / loud) and a per-think chance
        const dx = (a.pos.x - this.pos.x) / (d || 1), dz = (a.pos.z - this.pos.z) / (d || 1);
        const inView = dx * fx + dz * fz > 0.2 || d < 10;
        const loud = g.time - a.lastFireTime < 1 && d < 55;
        if (!(inView || loud) || Math.random() > (loud ? 0.5 : 0.22) * (1.2 - d / (SIGHT * 1.4))) continue;
      }
      if (g.world.lineOfSight(eye, a.chest(_tp))) {
        // stick with current target unless someone is much closer
        if (a === this.target) { best = a; bestD = d; break; }
        if (d < bestD) { best = a; bestD = d; }
        break;
      }
    }
    if (best) {
      if (best !== this.target) { this.reactionT = 0.5 + Math.random() * 0.7 * (1.3 - this.skill); this.target = best; }
      this.lastSeenT = g.time;
      this.lastSeenPos.copy(best.pos);
      this.targetVisible = true;
    } else {
      this.targetVisible = false;
      if (this.target && g.time - this.lastSeenT > 4) this.target = null;
    }

    // pick best weapon for the range
    if (this.target) this._chooseWeapon(this.pos.distanceTo(this.target.pos));
    else this._chooseWeapon(30);
    if (this.weapon && this.weapon.ammo < this.weapon.def.mag * 0.4 && !this.targetVisible) g.combat.reload(this);

    // refresh aim error
    const d = this.target ? this.pos.distanceTo(this.target.pos) : 10;
    const err = (0.3 + d * 0.026) * (1.45 - this.skill * 0.6);
    this.aimErr.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).multiplyScalar(err * 2);

    const storm = g.storm;
    const inZone = !storm || storm.isSafe(this.pos.x, this.pos.z, -6);

    if (this.target) {
      this.mode = 'engage';
      if (!inZone && storm) { this.mode = 'zone'; const c = storm.safeCenter(); this.setGoal(c.x, c.z); }
      return;
    }
    if (!inZone) {
      this.mode = 'zone';
      const c = storm.safeCenter();
      this.setGoal(c.x + (Math.random() - 0.5) * 10, c.z + (Math.random() - 0.5) * 10);
      return;
    }
    // loot
    const loot = g.loot;
    if (loot) {
      if (this.lootChest && this.lootChest.opened) this.lootChest = null;
      if (!this.lootChest) this.lootChest = loot.nearestChest(this.pos, 45, storm);
      if (this.lootChest) {
        this.mode = 'loot';
        this.setGoal(this.lootChest.x, this.lootChest.z);
        if (Math.hypot(this.lootChest.x - this.pos.x, this.lootChest.z - this.pos.z) < 2.2) loot.openChest(this.lootChest, this);
        return;
      }
      if (this.pickup && !this.pickup.alive) this.pickup = null;
      if (!this.pickup) this.pickup = loot.bestPickupFor(this, 30);
      if (this.pickup) {
        this.mode = 'pickup';
        this.setGoal(this.pickup.pos.x, this.pickup.pos.z);
        if (Math.hypot(this.pickup.pos.x - this.pos.x, this.pickup.pos.z - this.pos.z) < 2) { loot.collect(this.pickup, this); this.pickup = null; }
        return;
      }
    }
    // wander inside the safe area
    if (this.mode !== 'wander' || !this.hasGoal || Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 3) {
      this.mode = 'wander';
      for (let i = 0; i < 8; i++) {
        let x, z;
        if (storm) {
          const c = storm.safeCenter(), r = storm.safeRadius() * 0.8;
          const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
          x = c.x + Math.cos(a) * rr; z = c.z + Math.sin(a) * rr;
          // stay local-ish
          x = this.pos.x + clamp(x - this.pos.x, -45, 45); z = this.pos.z + clamp(z - this.pos.z, -45, 45);
        } else {
          x = this.pos.x + (Math.random() - 0.5) * 70; z = this.pos.z + (Math.random() - 0.5) * 70;
        }
        if (g.world.heightAt(x, z) > 1.5) { this.setGoal(x, z); break; }
      }
    }
  }

  _chooseWeapon(d) {
    let bestI = -1, bestS = -1;
    for (let i = 0; i < 3; i++) {
      const w = this.weapons[i];
      if (!w) continue;
      const k = w.def.key;
      let s = w.score;
      if (k === 'shotgun') s *= d < 10 ? 2.5 : d < 18 ? 0.8 : 0.1;
      else if (k === 'smg') s *= d < 22 ? 1.4 : 0.6;
      else if (k === 'ar') s *= d > 15 ? 1.5 : 0.9;
      if (w.ammo === 0 && w.reloading) s *= 0.3;
      if (s > bestS) { bestS = s; bestI = i; }
    }
    if (bestI >= 0 && bestI !== this.slot) this.switchSlot(bestI);
  }

  update(dt) {
    const g = this.game;
    this.buildCooldown -= dt;
    if (!this.alive) return;
    if (this.state === 'bus') {
      if (g.bus && g.bus.canDrop && g.bus.progress >= this.jumpAt) {
        this.jumpFromBus(g.bus.pos, g.bus.vel);
      }
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = THINK + Math.random() * 0.1; this.think(); }

    const it = this.intent;
    it.mx = 0; it.mz = 0; it.jump = false; it.deploy = false;

    if (this.state === 'skydive' || this.state === 'glide') {
      const dx = this.dropTarget.x - this.pos.x, dz = this.dropTarget.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) { it.mx = dx / d; it.mz = dz / d; }
      return;
    }

    // --- movement ---
    let mx = 0, mz = 0;
    const tgt = this.target;
    if (this.mode === 'engage' && tgt) {
      const dx = tgt.pos.x - this.pos.x, dz = tgt.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const ideal = this.weapon ? this.weapon.def.idealRange : 10;
      let fwd = 0;
      if (!this.targetVisible) { // chase last seen spot
        const lx = this.lastSeenPos.x - this.pos.x, lz = this.lastSeenPos.z - this.pos.z;
        const ld = Math.hypot(lx, lz);
        if (ld > 2) { mx = lx / ld; mz = lz / ld; }
      } else {
        if (d > ideal * 1.3) fwd = 1; else if (d < ideal * 0.6) fwd = -0.8;
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 1.3; this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
        const sx = -dz / d, sz = dx / d;
        mx = (dx / d) * fwd + sx * this.strafeDir * 0.85;
        mz = (dz / d) * fwd + sz * this.strafeDir * 0.85;
        if (Math.random() < dt * 0.25 && this.onGround) this.wantJump = true;
      }
    } else if (this.hasGoal) {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.2) { mx = dx / d; mz = dz / d; }
    }
    // obstacle handling: detour sideways when blocked
    const ml = Math.hypot(mx, mz);
    if (ml > 0.1) {
      mx /= ml; mz /= ml;
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (this.blocked || speed < RUN_SPEED * 0.25) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.stuckT > 0.45 && this.detourT <= 0) {
        this.detourT = 0.8 + Math.random() * 0.6;
        this.detourDir = Math.random() < 0.5 ? -1 : 1;
        if (this.onGround && Math.random() < 0.6) this.wantJump = true;
        this.stuckT = 0;
      }
      if (this.detourT > 0) {
        this.detourT -= dt;
        const rx = -mz * this.detourDir, rz = mx * this.detourDir;
        mx = mx * 0.3 + rx; mz = mz * 0.3 + rz;
        const l = Math.hypot(mx, mz); mx /= l; mz /= l;
      }
      // don't walk into deep water
      if (g.world.isDeepWater(this.pos.x + mx * 2, this.pos.z + mz * 2)) { mx = -this.pos.x; mz = -this.pos.z; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
    }
    it.mx = mx; it.mz = mz;
    if (this.wantJump) { it.jump = true; this.wantJump = false; }

    // --- aiming & shooting ---
    if (tgt && this.targetVisible) {
      const eye = this.eye(_eye);
      _tp.set(tgt.pos.x, tgt.pos.y + (tgt.state === 'ground' ? 1.05 : 0.9), tgt.pos.z).add(this.aimErr);
      // slight lead on moving targets (imperfect)
      _tp.addScaledVector(tgt.vel, 0.08 * (0.5 + this.skill));
      _dir.copy(_tp).sub(eye);
      const wantYaw = Math.atan2(_dir.x, _dir.z);
      const wantPitch = Math.atan2(_dir.y, Math.hypot(_dir.x, _dir.z));
      const turn = (4 + this.skill * 5) * dt;
      const dy = angleDiff(this.aimYaw, wantYaw);
      this.aimYaw += clamp(dy, -turn, turn);
      this.aimPitch += clamp(wantPitch - this.aimPitch, -turn, turn);
      this.bodyYaw = this.aimYaw;
      this.aiming = true;
      this.reactionT -= dt;
      const d = _dir.length();
      const w = this.weapon;
      if (this.reactionT <= 0 && w && Math.abs(dy) < 0.12 && d < w.def.range * 0.8 && !(w.def.key === 'shotgun' && d > 20)) {
        // burst pacing so bots aren't lasers
        if (this.pauseT > 0) this.pauseT -= dt;
        else {
          this.burstT += dt;
          if (this.burstT > 0.7 + Math.random() * 0.7) { this.burstT = 0; this.pauseT = 0.5 + Math.random() * 0.8; }
          if (w.canFire()) {
            const cp = Math.cos(this.aimPitch);
            _dir.set(Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp);
            this.root.position.copy(this.pos);
            this.root.rotation.y = this.bodyYaw;
            this.root.updateMatrixWorld(true);
            if (g.combat.fire(this, eye, _dir, this.muzzleWorld(_muzzle))) w.cooldown *= 1.6;
          } else if (w.ammo <= 0) g.combat.reload(this);
        }
      }
    } else {
      this.aiming = false;
      if (Math.hypot(this.vel.x, this.vel.z) > 1) this.aimYaw = Math.atan2(this.vel.x, this.vel.z);
      this.aimPitch *= 0.9;
    }
  }
}
