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
const _cols = [];

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
    this.tree = null;       // collider being harvested
    this.retreatT = 0;      // backing off to heal
    this.hideYaw = 0;
    this.noHealT = 0;       // time since last seen an enemy (for safe healing)
    this.huntPos = new THREE.Vector3();
    this.huntT = 0;
    this.rampCooldown = 0;
  }

  get armed() { return this.items.some((it) => it && it.isGun); }

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
    this.noHealT = 0;
    if (this.useT > 0) { this.useT = 0; this._chooseWeapon(attacker ? this.pos.distanceTo(attacker.pos) : 20); }
    const hp = this.health + this.shield;
    const r = Math.random();
    // badly hurt: throw up a wall and back off to heal
    const canHeal = this.findConsumable('heal') > 0 || this.findConsumable('shield') > 0;
    if (hp < 45 && canHeal && this.retreatT <= 0 && attacker) {
      this.retreatT = 2.5 + Math.random();
      this.hideYaw = Math.atan2(this.pos.x - attacker.pos.x, this.pos.z - attacker.pos.z);
      if (this.wood >= 10 && this.game.building) this.game.building.buildWallFacing(this, this.hideYaw + Math.PI);
      return;
    }
    // under fire: box up with a wall (skilled bots do it more), or hop
    const wallChance = 0.2 + this.skill * 0.35;
    if (r < wallChance && this.buildCooldown <= 0 && this.wood >= 10 && attacker && this.game.building) {
      this.buildCooldown = 3.5;
      this.game.building.buildWallFacing(this, Math.atan2(attacker.pos.x - this.pos.x, attacker.pos.z - this.pos.z));
    } else if (r < wallChance + 0.2 && this.onGround) this.wantJump = true;
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

    if (!this.targetVisible) this.noHealT += THINK; else this.noHealT = 0;
    const armed = this.armed;
    // unarmed: only fight back up close, otherwise go find a gun
    if (this.target && !armed) {
      const hitBack = this.lastAttacker === this.target && g.time - this.lastHurtTime < 2.5;
      if (!hitBack || this.pos.distanceTo(this.target.pos) > 6) this.target = null;
    }

    // pick best weapon for the range (never interrupt a heal)
    if (this.useT <= 0) {
      if (this.target) this._chooseWeapon(this.pos.distanceTo(this.target.pos));
      else if (this.mode !== 'harvest') this._chooseWeapon(30);
    }
    if (this.weapon && this.weapon.ammo < this.weapon.def.mag * 0.4 && !this.targetVisible) g.combat.reload(this);

    // refresh aim error
    const d = this.target ? this.pos.distanceTo(this.target.pos) : 10;
    const err = (0.28 + d * 0.024) * (1.45 - this.skill * 0.65);
    this.aimErr.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).multiplyScalar(err * 2);

    const storm = g.storm;
    const zoneGoal = this._zoneGoal();
    this.zoneUrgent = !!zoneGoal?.urgent;

    // retreating to heal
    if (this.retreatT > 0) { this.mode = 'retreat'; return; }

    // heal / shield up when nobody is shooting at us
    if (this.useT > 0) { this.mode = 'heal'; return; }
    if (this.noHealT > 1.2 && !zoneGoal?.urgent) {
      let slot = this.health < 75 ? this.findConsumable('heal') : -1;
      if (slot < 0 && this.shield < 75) slot = this.findConsumable('shield');
      if (slot > 0) {
        this.switchSlot(slot);
        if (this.startUse()) { this.mode = 'heal'; return; }
      }
    }

    if (this.target) {
      this.mode = 'engage';
      if (zoneGoal?.urgent) { this.mode = 'zone'; this.setGoal(zoneGoal.x, zoneGoal.z); }
      return;
    }
    if (zoneGoal) {
      if (this.mode !== 'zone' || !this.hasGoal) this.setGoal(zoneGoal.x, zoneGoal.z);
      this.mode = 'zone';
      return;
    }
    // loot (search further when unarmed)
    const loot = g.loot;
    if (loot) {
      if (this.lootChest && this.lootChest.opened) this.lootChest = null;
      if (!this.lootChest) this.lootChest = loot.nearestChest(this.pos, armed ? 45 : 90, storm);
      if (this.lootChest) {
        this.mode = 'loot';
        this.setGoal(this.lootChest.x, this.lootChest.z);
        if (Math.hypot(this.lootChest.x - this.pos.x, this.lootChest.z - this.pos.z) < 2.2) loot.openChest(this.lootChest, this);
        return;
      }
      if (this.pickup && !this.pickup.alive) this.pickup = null;
      if (!this.pickup) this.pickup = loot.bestPickupFor(this, armed ? 30 : 70);
      if (this.pickup) {
        this.mode = 'pickup';
        this.setGoal(this.pickup.pos.x, this.pickup.pos.z);
        if (Math.hypot(this.pickup.pos.x - this.pos.x, this.pickup.pos.z - this.pos.z) < 2) { loot.collect(this.pickup, this); this.pickup = null; }
        return;
      }
      // ammo boxes on the way
      if (armed && this.weapons.length < 3) {
        const box = loot.ammoBoxes.find((bx) => !bx.opened && Math.hypot(bx.x - this.pos.x, bx.z - this.pos.z) < 3);
        if (box) loot.openAmmoBox(box, this);
      }
    }
    // third-party: go where the shooting is
    if (armed) {
      if (this.huntT > 0 && Math.hypot(this.huntPos.x - this.pos.x, this.huntPos.z - this.pos.z) > 6) {
        this.huntT -= THINK;
        this.mode = 'hunt';
        this.setGoal(this.huntPos.x, this.huntPos.z);
        return;
      }
      const calm = Math.min(1, (g.time - this.landTime) / 140);
      for (const a of g.actors) {
        if (a === this || !a.alive || g.time - a.lastFireTime > 0.6) continue;
        const dd = a.pos.distanceTo(this.pos);
        if (dd < 25 + 60 * calm && Math.random() < 0.15 + this.skill * 0.25 && (!storm || storm.isSafe(a.pos.x, a.pos.z, 10))) {
          this.huntPos.copy(a.pos);
          this.huntT = 12;
          this.mode = 'hunt';
          this.setGoal(a.pos.x, a.pos.z);
          return;
        }
      }
    }
    // gather wood for building when low
    if (this.wood < 40 && g.time - this.landTime > 8) {
      if (this.tree && Math.hypot(this.tree.x - this.pos.x, this.tree.z - this.pos.z) > 30) this.tree = null;
      if (!this.tree || this.mode !== 'harvest') this.tree = this._nearestTree(26);
      if (this.tree) {
        this.mode = 'harvest';
        const dx = this.pos.x - this.tree.x, dz = this.pos.z - this.tree.z, dl = Math.hypot(dx, dz) || 1;
        this.setGoal(this.tree.x + (dx / dl) * (this.tree.r + 0.9), this.tree.z + (dz / dl) * (this.tree.r + 0.9));
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
          x = c.x + Math.cos(a) * rr; z = c.y + Math.sin(a) * rr;
          // stay local-ish
          x = this.pos.x + clamp(x - this.pos.x, -45, 45); z = this.pos.z + clamp(z - this.pos.z, -45, 45);
        } else {
          x = this.pos.x + (Math.random() - 0.5) * 70; z = this.pos.z + (Math.random() - 0.5) * 70;
        }
        if (g.world.heightAt(x, z) > 1.5) { this.setGoal(x, z); break; }
      }
    }
  }

  // Where to go for the zone, or null when there's no need to move yet.
  // Rotates early: leaves once the time left is close to the time needed to get in.
  _zoneGoal() {
    const storm = this.game.storm;
    if (!storm) return null;
    const c = storm.safeCenter(), r = storm.safeRadius();
    const dx = this.pos.x - c.x, dz = this.pos.z - c.y;
    const d = Math.hypot(dx, dz);
    const outsideNow = !storm.isInside(this.pos.x, this.pos.z, -3);
    const margin = Math.min(12, r * 0.3);
    if (d < r - margin * 0.5 && !outsideNow) return null;
    const travel = Math.max(0, d - (r - margin)) / 8.5; // seconds at sprint-ish speed
    const timeLeft = storm.stage === 'wait' ? storm.timer + 12 : 0; // the shrink itself buys a little time
    const urgent = outsideNow || storm.stage !== 'wait' || timeLeft < travel + 10;
    if (!urgent && timeLeft > travel + 25) return null;
    // aim for a point just inside the circle edge, on our side (less walking, avoids the center crowd)
    const k = d > 0.1 ? Math.max(0, r - margin - 4) / d : 0;
    const jitter = (this.skill - 0.5) * 4;
    return { x: c.x + dx * k + jitter, z: c.y + dz * k - jitter, urgent };
  }

  _nearestTree(maxD) {
    const cols = this.game.world.colliders.query(this.pos.x - maxD, this.pos.x + maxD, this.pos.z - maxD, this.pos.z + maxD, _cols);
    let best = null, bd = maxD;
    for (const c of cols) {
      if (!c.tree && !c.crate) continue;
      if (c.kind !== 'circle' && c.kind !== 'box') continue;
      const cx = c.kind === 'circle' ? c.x : (c.minX + c.maxX) / 2, cz = c.kind === 'circle' ? c.z : (c.minZ + c.maxZ) / 2;
      const d = Math.hypot(cx - this.pos.x, cz - this.pos.z);
      if (d < bd && this.game.world.heightAt(cx, cz) > 1) { bd = d; best = { x: cx, z: cz, r: c.kind === 'circle' ? c.r : Math.max(c.maxX - c.minX, c.maxZ - c.minZ) / 2, y: c.y0 + 2, hits: 0 }; }
    }
    return best;
  }

  _chooseWeapon(d) {
    let bestI = -1, bestS = -1;
    for (let i = 1; i < 6; i++) {
      const w = this.items[i];
      if (!w || !w.isGun) continue;
      const k = w.def.key;
      let s = w.score;
      if (k === 'shotgun') s *= d < 10 ? 2.5 : d < 18 ? 0.8 : 0.1;
      else if (k === 'smg') s *= d < 22 ? 1.4 : 0.6;
      else if (k === 'ar') s *= d > 15 ? 1.5 : 0.9;
      if (w.ammo === 0 && w.reloading) s *= 0.3;
      if (s > bestS) { bestS = s; bestI = i; }
    }
    if (bestI < 0) bestI = 0;
    if (bestI !== this.slot) this.switchSlot(bestI);
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
    let wantSprint = false;
    this.rampCooldown -= dt;
    // heals tick while standing still-ish
    if (this.useT > 0) {
      const done = this.tickUse(dt);
      if (done && this.distToCam < 40) g.sound.play(done.def.heal ? 'heal' : 'shield', this.pos, { range: 30 });
    }
    if (this.retreatT > 0) {
      // run away from the threat, then heal behind cover
      this.retreatT -= dt;
      mx = Math.sin(this.hideYaw); mz = Math.cos(this.hideYaw);
      wantSprint = true;
      if (this.retreatT <= 0) this.noHealT = 2;
    } else if (this.mode === 'heal') {
      mx = mz = 0;
    } else if (this.mode === 'engage' && tgt) {
      const dx = tgt.pos.x - this.pos.x, dz = tgt.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const melee = !this.weapon;
      const ideal = melee ? 1.6 : this.weapon.def.idealRange;
      let fwd = 0;
      if (!this.targetVisible) { // chase last seen spot
        const lx = this.lastSeenPos.x - this.pos.x, lz = this.lastSeenPos.z - this.pos.z;
        const ld = Math.hypot(lx, lz);
        if (ld > 2) { mx = lx / ld; mz = lz / ld; }
        wantSprint = ld > 12;
      } else {
        if (d > ideal * 1.3) fwd = 1; else if (d < ideal * 0.6) fwd = -0.8;
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = 0.5 + Math.random() * (1.4 - this.skill * 0.6); this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
        const sx = -dz / d, sz = dx / d;
        const strafe = melee ? 0.3 : 0.85;
        mx = (dx / d) * fwd + sx * this.strafeDir * strafe;
        mz = (dz / d) * fwd + sz * this.strafeDir * strafe;
        if (Math.random() < dt * (0.15 + this.skill * 0.25) && this.onGround) this.wantJump = true;
        wantSprint = melee && d > 4;
        // crouch-peek at long range for accuracy
        this.crouched = !melee && this.skill > 0.35 && d > 25 && fwd === 0 && this.onGround && this.slideT <= 0;
        // take the high ground with a ramp when the enemy is above us
        if (tgt.pos.y - this.pos.y > 2.5 && d < 20 && this.wood >= 10 && this.rampCooldown <= 0 && this.onGround && g.building) {
          this.rampCooldown = 3 - this.skill;
          const yaw = this.aimYaw;
          this.aimYaw = Math.atan2(dx, dz);
          g.building.buildRamp(this);
          this.aimYaw = yaw;
        }
        // swing at close enemies when all we have is the axe
        if (melee && d < 2.6) {
          this.aimYaw = this.bodyYaw = Math.atan2(dx, dz);
          _dir.set(dx / d, (tgt.pos.y - this.pos.y) / d, dz / d).normalize();
          if (this.reactionT <= 0) g.combat.melee(this, this.eye(_eye), _dir, 2.8);
        }
      }
    } else if (this.hasGoal) {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.2) { mx = dx / d; mz = dz / d; }
      wantSprint = d > 10 && (this.mode !== 'wander' || this.zoneUrgent);
      // chop the tree we walked up to
      if (this.mode === 'harvest' && this.tree && d < 1.6) {
        mx = mz = 0;
        const tx = this.tree.x - this.pos.x, tz = this.tree.z - this.pos.z;
        this.aimYaw = this.bodyYaw = Math.atan2(tx, tz);
        if (this.held !== this.items[0]) this.switchSlot(0);
        const r = g.combat.melee(this, this.eye(_eye), _dir.set(tx, 0, tz).normalize(), this.tree.r + 2.2);
        if (r) this.tree.hits++;
        if (this.tree.hits > 6 || this.wood >= 60) { this.tree = null; this.mode = 'wander'; this._chooseWeapon(30); }
      }
    }
    if (this.mode !== 'engage' || !tgt) this.crouched = false;
    it.sprint = wantSprint;
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
