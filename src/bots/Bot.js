import * as THREE from 'three';
import { GRID } from '../world/Building.js';
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
const _hit = {};

// AI bot: a slow "think" picks goals/targets; a per-frame update steers, aims and shoots.
export class Bot extends Actor {
  constructor(game, name, color, skill, type = 'Knight', outfit = null) {
    super(game, { name, color, type, outfit, tint: outfit ? 0.1 : undefined });
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
    this.boxed = false;     // sitting in a 1x1 box of our own walls
    this.boxT = 0;
    this.peekT = 0;         // window open toward the target
    this.peekCd = 0;
    this.shootWall = false; // target hides behind a build: shoot through it
    this.climb = null;      // running up a ramp after a quick 90
    this.ninetyCd = 0;
    this.tunnelCd = 0;
    this.coneCd = 0;
    this.settle = 0;        // 0..1: aim settles while tracking the same target
    this.lookYaw = 0;       // where a sound / hit came from
    this.lookT = 0;
    this.push = false;      // enemy is weak / reloading / healing: close in
    this.aimHead = false;
    this.rushT = 0;         // ramp-rushing a higher / weak enemy
    this.rushN = 0;
    this.coverWall = null;  // our own wall we fight behind (edit-peeking through it)
    this.coverT = 0;
    // play style, so bots don't all think alike
    const r = Math.random();
    this.persona = r < 0.3 ? 'rusher' : r < 0.6 ? 'looter' : r < 0.8 ? 'camper' : 'builder';
    const P = { rusher: [1.9, 0.9, 1, 1], looter: [0.5, 1.6, 1, 1], camper: [0.2, 1.1, 1.1, 1], builder: [0.8, 1, 1.6, 1.5] }[this.persona];
    [this.huntMul, this.lootMul, this.wallMul, this.matMul] = P;
    // personal slant on where to stand in the next circle
    this.zoneAngle = (Math.random() - 0.5) * 1.3;
    this.zoneDepth = 0.35 + Math.random() * 0.5;
  }

  get smartLoot() { return true; }

  // Fresh brain for the real match (after the warm-up).
  resetAI() {
    this.climb = null; this.ninetyCd = 0; this.tunnelCd = 0; this.coneCd = 0; this.rushT = 0; this.rushN = 0; this.holdSpot = null;
    this.target = null; this.mode = 'idle'; this.hasGoal = false;
    this.boxed = false; this.retreatT = 0; this.exitT = 0; this.peekT = 0; this.peekWall = null; this.coverWall = null;
    this.lootChest = null; this.pickup = null; this.tree = null; this.huntT = 0;
    this.landTime = undefined; this.useT = 0; this.shootWall = false; this.targetVisible = false;
  }

  get armed() { return this.items.some((it) => it && it.isGun); }

  onDamaged(amount, attacker) {
    if (!this.alive) return;
    this.settle *= 0.7; // flinch
    if (attacker && attacker !== this) { this.lookYaw = this._yawTo(attacker.pos); this.lookT = 1.5; }
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
    const b = this.game.building;
    if (this.boxed) { if (this.peekT > 0) this._closePeek(); return; }
    // badly hurt: box up (or wall + run) and heal
    const canHeal = this.findConsumable('heal') > 0 || this.findConsumable('shield') > 0;
    if (hp < 55 && attacker && b && this.matTotal >= 40 && this.buildCooldown <= 0 && Math.random() < 0.45 + this.skill * 0.5) {
      this._boxUp();
      return;
    }
    if (hp < 45 && canHeal && this.retreatT <= 0 && attacker) {
      this.retreatT = 2.5 + Math.random();
      this.hideYaw = Math.atan2(this.pos.x - attacker.pos.x, this.pos.z - attacker.pos.z);
      if (b?.canAfford(this)) b.buildWallFacing(this, this.hideYaw + Math.PI);
      return;
    }
    // under fire: box up with a wall (skilled bots do it more), or hop
    const wallChance = (0.2 + this.skill * 0.35) * (this.wallMul || 1);
    if (r < wallChance * 0.35 && this.skill > 0.4 && this.matTotal >= 50 && this.buildCooldown <= 0 && attacker && b) this._boxUp();
    else if (r < wallChance && this.buildCooldown <= 0 && b?.canAfford(this) && attacker) {
      this.buildCooldown = 3.5;
      this._takeCover(b.buildPiece(this, 'wall', Math.atan2(attacker.pos.x - this.pos.x, attacker.pos.z - this.pos.z)));
    } else if (r < wallChance + 0.2 && this.onGround) this.wantJump = true;
  }

  _boxUp() {
    const b = this.game.building;
    this.buildCooldown = 4;
    if (b.buildBox(this, this.matTotal >= 60) >= 2 || this._inBox() >= 3) {
      this.boxed = true;
      this.boxT = 0;
      this.peekCd = 1.5 + Math.random();
      this.retreatT = 0;
    }
  }

  // How many sides of our cell are walled.
  _inBox() {
    const b = this.game.building;
    let n = 0;
    for (let k = 0; k < 4; k++) if (b.wallAt(this, (k * Math.PI) / 2)) n++;
    return n;
  }

  _yawTo(p) { return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  // Edit our wall toward the target to shoot through, then close it again. The edit fits the fight:
  // a half wall to shoot up at a higher enemy, a wide arch for close shotgun shots, else a window.
  _openPeek(wall) {
    const t = this.target;
    const w = wall || (t && this.game.building.wallAt(this, this._yawTo(t.pos)));
    if (!t || !w || w.owner !== this || w.hp <= 0) return false;
    const kind = this._peekKind(t);
    this.game.building.edit(w, kind);
    this.peekWall = w;
    this.peekT = (kind === 'arch' ? 0.8 : 1.2) + this.skill * 1.1;
    this._chooseWeapon(this.pos.distanceTo(t.pos));
    return true;
  }

  _peekKind(t) {
    const above = t.pos.y - this.pos.y, d = this.pos.distanceTo(t.pos);
    if (above > 2.2) return 'half';
    if (d < 9 && this.items.some((it) => it?.isGun && (it.def.key === 'pump' || it.def.key === 'shotgun'))) return 'arch';
    return 'window';
  }

  // Fight from behind a wall we just built (skilled bots): hold behind it and edit-peek.
  _takeCover(s) {
    if (!s || this.skill < 0.3 || this.boxed) return;
    this.coverWall = s;
    this.coverT = 5 + this.skill * 4;
    this.peekCd = 0.5 + Math.random() * 0.6;
  }

  _dropCover() {
    if (this.peekT > 0 && this.peekWall === this.coverWall) this._closePeek();
    this.coverWall = null;
  }

  // Steer behind the cover wall and run the peek cycle. False when the cover no longer applies.
  _holdCover(tgt, dt) {
    const w = this.coverWall;
    if (!w) return false;
    if (w.hp <= 0 || w.falling || !this.game.building.structures.includes(w)) { this.coverWall = null; return false; }
    this.coverT -= dt;
    const d = this.pos.distanceTo(tgt.pos);
    if (this.coverT <= 0 || this.push || this.rushT > 0 || this.retreatT > 0 || d < 5 || this.zoneUrgent) { this._dropCover(); return false; }
    const nx = w.alongX ? 0 : 1, nz = w.alongX ? 1 : 0; // wall normal
    const sMe = (this.pos.x - w.cx) * nx + (this.pos.z - w.cz) * nz;
    const sT = (tgt.pos.x - w.cx) * nx + (tgt.pos.z - w.cz) * nz;
    if (Math.sign(sMe) === Math.sign(sT) || Math.abs(sMe) > GRID + 0.6 || Math.abs(this.pos.y - w.y0) > 2.5) { this._dropCover(); return false; }
    // stand 1.2 m behind the middle of the wall
    const side = Math.sign(sMe) || 1;
    const ox = w.cx + nx * side * 1.2 - this.pos.x, oz = w.cz + nz * side * 1.2 - this.pos.z, ol = Math.hypot(ox, oz);
    this._hx = ol > 0.3 ? ox / ol : 0; this._hz = ol > 0.3 ? oz / ol : 0;
    this.peekCd -= dt;
    if (this.peekT > 0) { this.peekT -= dt; if (this.peekT <= 0) this._closePeek(); }
    else if (this.armed && this.useT <= 0 && this.peekCd <= 0 && !this.weapon?.reloading) { if (!this._openPeek(w)) this.peekCd = 1; }
    return true;
  }

  _closePeek() {
    if (this.peekWall && this.peekWall.hp > 0) this.game.building.edit(this.peekWall, null);
    this.peekWall = null;
    this.peekT = 0;
    this.peekCd = 1.2 + Math.random() * 1.5;
  }

  // Leave the box through a door on the side we want to go.
  _leaveBox(yaw) {
    if (this.peekT > 0) this._closePeek();
    const w = this.game.building.wallAt(this, yaw);
    if (w) {
      // our own wall: door it; someone else's: just break it
      if (w.owner === this) this.game.building.edit(w, 'door'); else w.damage(9999, this);
      const [dx, dz] = w.alongX ? [0, Math.sign(w.cz - this.pos.z)] : [Math.sign(w.cx - this.pos.x), 0];
      this.exitPt = new THREE.Vector3(w.cx + dx * 1.8, 0, w.cz + dz * 1.8);
      this.exitT = 2;
    }
    this.boxed = false;
  }

  setGoal(x, z, y = null) { this.goal.set(x, 0, z); this.goalY = y; this.hasGoal = true; }

  think() {
    const g = this.game;
    if (this.state === 'skydive' || this.state === 'glide') {
      this.setGoal(this.dropTarget.x, this.dropTarget.z);
      return;
    }
    if (this.state !== 'ground') return;
    if (this.npc) { this._npcThink(); return; }

    // --- perception ---
    if (this.target && (!this.target.alive || this.target.state === 'bus')) this.target = null;
    const eye = this.eye(_eye);
    let best = null, bestD = SIGHT;
    // aggression ramps up after landing: early on bots mostly loot
    if (this.landTime === undefined) this.landTime = g.time;
    const calm = Math.min(1, (g.time - this.landTime) / 140);
    const late = Math.min(1, (g.storm?.phase || 0) / 4); // late game: everyone is hunting
    // darkness and heavy rain shorten how far bots notice people
    const sight = (18 + (SIGHT - 18) * calm + late * 30) * (1 - 0.22 * (g.dayCycle?.dark || 0) - 0.1 * (g.weather?.rain || 0));
    const cands = [];
    for (const a of g.actors) {
      if (a === this || !a.alive || a.state === 'bus') continue;
      const d = a.pos.distanceTo(this.pos);
      if (a.hiddenIn && d > 2.5) continue; // can't see into a haystack / dumpster
      const range = a === this.target ? SIGHT + 30 : a.isPlayer ? sight + 12 : Math.max(22, sight * 0.85);
      if (d < range) cands.push([d, a]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    const fx = Math.sin(this.aimYaw), fz = Math.cos(this.aimYaw);
    let bestS = Infinity, checks = 0;
    for (let i = 0; i < cands.length && checks < 3; i++) {
      const [d, a] = cands[i];
      if (a !== this.target) {
        // must notice them: in front (or close / loud) and a per-think chance
        const dx = (a.pos.x - this.pos.x) / (d || 1), dz = (a.pos.z - this.pos.z) / (d || 1);
        // a wide field of view, and you hear footsteps / gunfire around you
        const inView = dx * fx + dz * fz > -0.25 || d < 12;
        const hs = Math.hypot(a.vel.x, a.vel.z);
        const heard = (g.time - a.lastFireTime < 1 && d < 60) || (hs > 2 && !a.crouched && d < (a.sprinting ? 30 : 20));
        const shotMe = this.lastAttacker === a && g.time - this.lastHurtTime < 2;
        if (!shotMe && (!(inView || heard) || Math.random() > (heard ? 0.6 : 0.4) * (1.25 - d / (SIGHT * 1.4)))) continue;
      }
      checks++;
      if (!g.world.lineOfSight(eye, a.chest(_tp))) continue;
      // threat score (lower first): close enemies, whoever is shooting us, weak or busy enemies; stick with the current target
      let sc = d;
      if (a === this.target) sc -= 15;
      if (this.lastAttacker === a && g.time - this.lastHurtTime < 3) sc -= 20;
      const hp = a.health + a.shield;
      if (hp < 70) sc -= 12 * (1 - hp / 70);
      if (a.useT > 0 || a.weapon?.reloading) sc -= 6;
      if (sc < bestS) { bestS = sc; best = a; bestD = d; }
    }
    if (best) {
      if (best !== this.target) { this.reactionT = 0.5 + Math.random() * 0.7 * (1.3 - this.skill); this.target = best; this.settle = 0; }
      this.lastSeenT = g.time;
      this.lastSeenPos.copy(best.pos);
      this.targetVisible = true;
    } else {
      this.targetVisible = false;
      if (this.target && g.time - this.lastSeenT > 4) this.target = null;
    }

    // hearing: turn toward nearby gunfire when we have nobody to fight
    if (!this.target && this.lookT <= 0) {
      let loudD = 60 + this.skill * 20;
      for (const a of g.actors) {
        if (a === this || !a.alive || g.time - a.lastFireTime > 0.5) continue;
        const d = a.pos.distanceTo(this.pos);
        if (d < loudD) { loudD = d; this.lookYaw = this._yawTo(a.pos); this.lookT = 1.2; }
      }
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
    if (this.weapon && this.weapon.ammo < this.weapon.mag * 0.4 && !this.targetVisible) g.combat.reload(this);

    // refresh aim error
    const d = this.target ? this.pos.distanceTo(this.target.pos) : 10;
    const err = (0.28 + d * 0.024) * (1.45 - this.skill * 0.65);
    this.aimErr.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).multiplyScalar(err * 2);
    this.aimHead = this.weapon?.def.key === 'sniper' ? Math.random() < 0.25 + this.skill * 0.5 : Math.random() < this.skill * 0.15;

    const storm = g.storm;
    const zoneGoal = this._zoneGoal();
    this.zoneUrgent = !!zoneGoal?.urgent;

    // size up the fight: push weak / reloading / healing enemies, get out of fights we're losing
    this.push = false;
    if (this.target && this.targetVisible && armed && !this.boxed && this.useT <= 0) {
      const my = this.health + this.shield, their = this.target.health + this.target.shield;
      const dd = this.pos.distanceTo(this.target.pos);
      this.push = my > 60 && dd < 40 && (their < 60 || this.target.useT > 0 || !!this.target.weapon?.reloading || their < my - 70);
      const canHeal = this.findConsumable('heal') > 0 || this.findConsumable('shield') > 0;
      if (my < 45 && their > my + 50 && this.retreatT <= 0 && this.buildCooldown <= 0 && Math.random() < 0.3 + this.skill * 0.5) {
        if (g.building && this.matTotal >= 40) this._boxUp();
        else if (canHeal) {
          this.retreatT = 2.5 + Math.random();
          this.hideYaw = Math.atan2(this.pos.x - this.target.pos.x, this.pos.z - this.target.pos.z);
          _v.copy(this.pos).lerp(this.target.pos, Math.min(0.5, 5 / Math.max(1, dd)));
          this._throwAt(['smoke'], _v);
        }
      }
    }

    // shoot through builds the target hides behind
    this.shootWall = false;
    if (this.target && !this.targetVisible && armed && this.target.state === 'ground') {
      const dd = this.pos.distanceTo(this.target.pos);
      if (dd < 35) {
        const tc = this.target.chest(_tp);
        _dir.copy(tc).sub(eye).normalize();
        const hit = g.world.raycast(eye, _dir, dd, _hit);
        this.shootWall = !!hit?.collider?.structure && hit.collider.structure.owner !== this && hit.t > 1.2;
        if (this.shootWall) { this.lastSeenPos.copy(this.target.pos); this.lastSeenT = g.time; }
      }
    }

    // build fights (skilled bots with mats)
    this.ninetyCd -= THINK;
    if (this.target && armed && !this.boxed && this.useT <= 0 && this.onGround && g.building && this.skill > 0.35 && !this.climb) {
      const t = this.target, dd = this.pos.distanceTo(t.pos), above = t.pos.y - this.pos.y;
      // enemy has height and is close: quick 90s to take it back
      if (above > 3 && dd < 16 && this.matTotal >= 60 && this.ninetyCd <= 0) {
        const dir = g.building.do90(this);
        if (dir) {
          this.climb = { x: dir.x, z: dir.z, t: dir.dist / 6.4 + 0.15, top: dir.top };
          this.ninetyCd = 2.2 + Math.random() * 1.5;
          return;
        }
      }
      // enemy sits in a box next to us: box up too and fight it out through peeks
      if (t.boxed && dd < 9 && this.matTotal >= 60 && this.buildCooldown <= 0 && this.health + this.shield > 50) {
        this._boxUp();
        if (this.boxed) return;
      }
      // enemy above at range (or weak): ramp-rush toward them behind walls
      if ((above > 2 || this.push) && dd > 7 && dd < 38 && this.matTotal >= 40 && this.rushT <= 0 && (above > 2 || g.time - this.lastHurtTime < 3)) {
        this.rushT = 2.5 + this.skill * 2;
        this.rushN = 0;
        this.rushHigh = above > 2; // rushing for height (stop once we have it) vs. pushing under cover
      }
    }

    // throwables: frag / fire at enemies hiding behind builds, impulse to knock them out of a box
    this.nadeCd = (this.nadeCd || 0) - THINK;
    if (this.target && this.nadeCd <= 0 && this.useT <= 0 && !this.boxed) {
      const dd = this.pos.distanceTo(this.target.pos);
      const hiding = this.shootWall || this.target.boxed;
      let kinds = null;
      if (this.target.boxed && dd > 5 && dd < 14) kinds = ['impulse', 'grenade', 'fire'];
      else if (dd > 6 && dd < 30 && (hiding || Math.random() < 0.08)) kinds = ['grenade', 'fire'];
      if (kinds && this._throwAt(kinds, this.target.pos)) this.nadeCd = 4 + Math.random() * 3;
    }

    // in a box: heal up, peek through windows, leave when it's time
    if (this.boxed) {
      this.boxT += THINK;
      let walls = this._inBox();
      // a wall got shot out: put it back straight away (the side facing the enemy first)
      if (walls >= 2 && walls < 4 && g.building?.canAfford(this)) {
        const first = this.target ? this._yawTo(this.target.pos) : 0;
        for (let k = 0; k < 4; k++) {
          const yaw = first + (k * Math.PI) / 2;
          if (!g.building.wallAt(this, yaw) && g.building.buildPiece(this, 'wall', yaw)) walls++;
        }
      }
      const needHeal = (this.health < 75 && this.findConsumable('heal') > 0) || (this.shield < 75 && this.findConsumable('shield') > 0);
      const lost = !this.target || g.time - this.lastSeenT > 5;
      if (walls < 2) this.boxed = false;
      else if (zoneGoal?.urgent || this.boxT > 25 || (lost && !needHeal && this.useT <= 0)) {
        const to = zoneGoal ? { x: zoneGoal.x, z: zoneGoal.z } : this.target ? this.target.pos : this.hasGoal ? this.goal : { x: this.pos.x + 1, z: this.pos.z };
        this._leaveBox(this._yawTo(to));
      } else {
        this.mode = 'boxed';
        // skilled bots take the high ground with quick 90s instead of sitting tight
        const b = g.building;
        if (!needHeal && this.useT <= 0 && this.target && this.skill > 0.3 && this.matTotal >= 60 && this.ninetyCd <= 0 &&
            this.target.pos.y > this.pos.y - 1.5 && this.peekT <= 0 && b) {
          if (this.peekT > 0) this._closePeek();
          const dir = b.do90(this);
          if (dir) {
            this.climb = { x: dir.x, z: dir.z, t: dir.dist / 6.4 + 0.15, top: dir.top };
            this.ninetyCd = 2.2 + Math.random() * 1.5;
            this.boxed = false;
            this.mode = 'engage';
            return;
          }
        }
        if (this.useT <= 0 && needHeal && this.peekT <= 0) {
          let slot = this.health < 75 ? this.findConsumable('heal') : -1;
          if (slot < 0) slot = this.findConsumable('shield');
          if (slot > 0) { this.switchSlot(slot); this.startUse(); }
        }
        return;
      }
    }

    // retreating to heal
    if (this.retreatT > 0) { this.mode = 'retreat'; return; }

    // heal / shield up when nobody is shooting at us
    if (this.useT > 0) { this.mode = 'heal'; return; }
    if (this.noHealT > 1.2 && !zoneGoal?.urgent) {
      let slot = this.health < 75 ? this.findConsumable('heal') : -1;
      if (slot < 0 && this.shield < 75) slot = this.findConsumable('shield');
      // a long heal with enemies around: box up first (the box logic heals inside)
      const long = slot > 0 && this.items[slot].def.time > 3;
      if (long && g.building && this.matTotal >= 40 && this.buildCooldown <= 0 && this._enemyNear(35)) { this._boxUp(); if (this.boxed) return; }
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
      this.setGoal(zoneGoal.x, zoneGoal.z);
      this.mode = 'zone';
      this._rotateWithItems(zoneGoal);
      return;
    }
    // loot (search further when unarmed)
    const loot = g.loot;
    if (loot) {
      // supply drops are worth a detour
      const sup = armed && g.events?.nearestSupply(this.pos, 110);
      if (sup && (!storm || storm.isSafe(sup.x, sup.z, 5))) {
        this.mode = 'loot';
        this.setGoal(sup.x, sup.z);
        if (sup.landed && Math.hypot(sup.x - this.pos.x, sup.z - this.pos.z) < 2.4) g.events.openSupply(sup, this);
        return;
      }
      if (this.lootChest && this.lootChest.opened) this.lootChest = null;
      if (!this.lootChest) {
        this.lootChest = loot.nearestChest(this.pos, (armed ? 45 : 90) * this.lootMul, storm, this);
        if (this.lootChest) { this.lootChest.claim = this; this.lootChest.claimUntil = g.time + 25; }
      }
      if (this.lootChest) {
        this.mode = 'loot';
        this.setGoal(this.lootChest.x, this.lootChest.z, this.lootChest.y);
        if (Math.hypot(this.lootChest.x - this.pos.x, this.lootChest.z - this.pos.z) < 2.2 && Math.abs(this.lootChest.y - this.pos.y) < 2) loot.openChest(this.lootChest, this);
        return;
      }
      if (this.pickup && !this.pickup.alive) this.pickup = null;
      if (!this.pickup) {
        this.pickup = loot.bestPickupFor(this, (armed ? 30 : 70) * this.lootMul);
        if (this.pickup) { this.pickup.claim = this; this.pickup.claimUntil = g.time + 15; }
      }
      if (this.pickup) {
        this.mode = 'pickup';
        this.setGoal(this.pickup.pos.x, this.pickup.pos.z, this.pickup.pos.y);
        if (Math.hypot(this.pickup.pos.x - this.pos.x, this.pickup.pos.z - this.pos.z) < 2 && Math.abs(this.pickup.pos.y - this.pos.y) < 2) { loot.collect(this.pickup, this); this.pickup = null; }
        return;
      }
      // ammo boxes on the way
      if (armed && this.weapons.length < 3) {
        const box = loot.ammoBoxes.find((bx) => !bx.opened && Math.hypot(bx.x - this.pos.x, bx.z - this.pos.z) < 3);
        if (box) loot.openAmmoBox(box, this);
      }
    }
    // spare materials and a bench nearby: upgrade the best gun
    if (armed && this.gold >= 100 && (this.benchCd || 0) < g.time && g.events?.benches?.length) {
      const bench = g.events.nearestBench(this.pos, 35);
      const gun = this.items.filter((it) => it?.isGun && it.rarity < 4).sort((a, b) => b.score - a.score)[0];
      const cost = gun && g.events.constructor.upgradeCost(gun);
      if (bench && cost && this.gold >= cost[1]) {
        this.mode = 'upgrade';
        this.setGoal(bench.x, bench.z);
        if (Math.hypot(bench.x - this.pos.x, bench.z - this.pos.z) < 2.6) {
          this.switchSlot(this.items.indexOf(gun));
          g.events.upgrade(bench, this);
          this.benchCd = g.time + 20;
        }
        return;
      }
    }

    // third-party: go where the shooting is (only when healthy enough to take another fight)
    if (armed && this.health + this.shield >= 80) {
      if (this.huntT > 0 && Math.hypot(this.huntPos.x - this.pos.x, this.huntPos.z - this.pos.z) > 6) {
        this.huntT -= THINK;
        this.mode = 'hunt';
        this.setGoal(this.huntPos.x, this.huntPos.z);
        return;
      }
      const calm = Math.min(1, (g.time - this.landTime) / 140);
      // medallion carriers are on everyone's map: confident bots go after them
      if (this.skill > 0.45 && calm > 0.5 && !this.medallions.size) {
        for (const a of g.actors) {
          if (a === this || !a.alive || a.npc || !a.medallions?.size || a.state !== 'ground') continue;
          const dd = a.pos.distanceTo(this.pos);
          if (dd < 170 && (!storm || storm.isSafe(a.pos.x, a.pos.z, 10)) &&
              g.bots.filter((o) => o.mode === 'hunt' && o.alive && (o.huntPos.x - a.pos.x) ** 2 + (o.huntPos.z - a.pos.z) ** 2 < 1600).length < 4) {
            this.huntPos.copy(a.pos);
            this.huntT = 14;
            this.mode = 'hunt';
            this.setGoal(a.pos.x, a.pos.z);
            return;
          }
        }
      }
      for (const a of g.actors) {
        if (a === this || !a.alive || g.time - a.lastFireTime > 0.6) continue;
        const dd = a.pos.distanceTo(this.pos);
        if (dd < (25 + 60 * calm + late * 60) * Math.min(1.3, this.huntMul) && Math.random() < (0.15 + this.skill * 0.25 + late * 0.3) * this.huntMul && (!storm || storm.isSafe(a.pos.x, a.pos.z, 10)) &&
            g.bots.filter((o) => o.mode === 'hunt' && o.alive && (o.huntPos.x - a.pos.x) ** 2 + (o.huntPos.z - a.pos.z) ** 2 < 900).length < 3) {
          this.huntPos.copy(a.pos);
          this.huntT = 12;
          this.mode = 'hunt';
          this.setGoal(a.pos.x, a.pos.z);
          return;
        }
      }
    }
    // gather wood for building when low
    const matGoal = ((g.storm?.phase || 0) >= 3 ? 150 : 90) * this.matMul;
    if (this.matTotal < (this.mode === 'harvest' ? matGoal : matGoal * 0.5) && g.time - this.landTime > 8) {
      if (this.tree && (this.tree.obj?.dead || Math.hypot(this.tree.x - this.pos.x, this.tree.z - this.pos.z) > 30)) this.tree = null;
      if (!this.tree || this.mode !== 'harvest') this.tree = this._nearestTree(26);
      if (this.tree) {
        this.mode = 'harvest';
        const dx = this.pos.x - this.tree.x, dz = this.pos.z - this.tree.z, dl = Math.hypot(dx, dz) || 1;
        this.setGoal(this.tree.x + (dx / dl) * (this.tree.r + 0.9), this.tree.z + (dz / dl) * (this.tree.r + 0.9));
        return;
      }
    }
    // campers find some high ground inside the circle and hold it
    if (this.persona === 'camper' && storm && armed) {
      if (!this.holdSpot || !storm.isSafe(this.holdSpot.x, this.holdSpot.z, 4)) {
        let best = null;
        const c = storm.safeCenter(), r = storm.safeRadius() * 0.8;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
          const x = this.pos.x + Math.max(-60, Math.min(60, c.x + Math.cos(a) * rr - this.pos.x)), z = this.pos.z + Math.max(-60, Math.min(60, c.y + Math.sin(a) * rr - this.pos.z));
          const h = g.world.heightAt(x, z);
          if (h > 2 && storm.isSafe(x, z, 4) && (!best || h > best.h)) best = { x, z, h };
        }
        this.holdSpot = best;
      }
      if (this.holdSpot) {
        this.mode = Math.hypot(this.holdSpot.x - this.pos.x, this.holdSpot.z - this.pos.z) < 3 ? 'hold' : 'wander';
        this.setGoal(this.holdSpot.x, this.holdSpot.z);
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

  // Throw the first throwable we carry of the given kinds at a point. Returns true if thrown.
  _throwAt(kinds, at) {
    let gi = -1;
    for (const k of kinds) { gi = this.items.findIndex((it) => it?.def?.throw === k); if (gi > 0) break; }
    if (gi <= 0) return false;
    const dd = Math.hypot(at.x - this.pos.x, at.z - this.pos.z);
    this.switchSlot(gi);
    _dir.set(at.x - this.pos.x, 0, at.z - this.pos.z).normalize();
    _dir.y = 0.08 + dd * 0.012 + (at.y - this.pos.y) / Math.max(8, dd);
    _dir.normalize();
    this.aimYaw = this.bodyYaw = Math.atan2(_dir.x, _dir.z);
    this.throwHeld(_dir);
    this._chooseWeapon(this.target ? this.pos.distanceTo(this.target.pos) : 30);
    return true;
  }

  // Far from a closing zone: rift out, or shockwave ourselves toward it.
  _rotateWithItems(zg) {
    const g = this.game;
    if (!zg.urgent || this.useT > 0 || !this.onGround || (this.mobCd || 0) > g.time) return;
    const dx = zg.x - this.pos.x, dz = zg.z - this.pos.z, d = Math.hypot(dx, dz);
    const rift = this.items.findIndex((it) => it?.def?.rift);
    if (rift > 0 && d > 90) {
      this.switchSlot(rift);
      if (this.startUse()) { this.dropTarget.set(zg.x, 0, zg.z); this.mobCd = g.time + 3; }
      return;
    }
    if (d > 40) {
      // a shockwave just behind us throws us forward
      _v.set(this.pos.x - (dx / d) * 2, this.pos.y, this.pos.z - (dz / d) * 2);
      if (this._throwAt(['shockwave'], _v)) this.mobCd = g.time + 3;
    }
  }

  _enemyNear(r) {
    for (const a of this.game.actors) {
      if (a === this || !a.alive || a.state !== 'ground') continue;
      if ((a.pos.x - this.pos.x) ** 2 + (a.pos.z - this.pos.z) ** 2 < r * r) return true;
    }
    return false;
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
    const margin = Math.min(14, r * 0.3);
    // moving zone still waiting: the next circle may lie outside the current one — stay inside the
    // current circle on the side facing the next one until the shrink starts
    if (storm.moving && storm.stage === 'wait' && Math.hypot(c.x - storm.center.x, c.y - storm.center.y) + r > storm.radius - 2) {
      const ox = c.x - storm.center.x, oz = c.y - storm.center.y, ol = Math.hypot(ox, oz) || 1;
      const edge = Math.max(0, storm.radius - Math.max(6, storm.radius * 0.25));
      const gx = storm.center.x + (ox / ol) * edge, gz = storm.center.y + (oz / ol) * edge;
      if (!outsideNow && Math.hypot(this.pos.x - gx, this.pos.z - gz) < 8) return null;
      return { x: gx, z: gz, urgent: outsideNow || storm.timer < 12 };
    }
    if (d < r - margin * 0.5 && !outsideNow) return null;
    const travel = Math.max(0, d - (r - margin)) / 8; // seconds at sprint speed
    const timeLeft = storm.stage === 'wait' ? storm.timer + 10 : 0; // the shrink itself buys a little time
    const urgent = outsideNow || storm.stage !== 'wait' || timeLeft < travel + 25;
    if (!urgent && timeLeft > travel + 50) return null;
    // aim for a point inside the circle, roughly on our side but with our own slant and depth
    // (bots coming from the same area don't all converge on one spot)
    const ang = Math.atan2(dz, dx) + this.zoneAngle * Math.min(1, r / 60);
    const depth = Math.max(0, (r - margin - 3) * this.zoneDepth + Math.min(r * 0.25, 8));
    const rr = Math.min(Math.max(0, r - margin - 2), depth);
    return { x: c.x + Math.cos(ang) * rr, z: c.y + Math.sin(ang) * rr, urgent };
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

  // Boss / guards: defend a home area, fight anyone who comes close, never loot or rotate.
  _npcThink() {
    const g = this.game, L = this.leash, eye = this.eye(_eye);
    const far = (a) => Math.hypot(a.pos.x - L.x, a.pos.z - L.z) > L.r + 30;
    if (this.target && (!this.target.alive || far(this.target))) this.target = null;
    let best = null, bd = 55;
    for (const a of g.actors) {
      // bosses and guards fight players; a hired NPC fights anyone but whoever hired it
      if (a === this || !a.alive || a.state !== 'ground' || (this.hiredBy ? a === this.hiredBy || a.hiredBy === this.hiredBy : a.npc)) continue;
      const d = a.pos.distanceTo(this.pos);
      if (d < bd && !far(a) && g.world.lineOfSight(eye, a.chest(_tp))) { best = a; bd = d; }
    }
    if (best) {
      if (best !== this.target) this.reactionT = 0.35 + Math.random() * 0.3;
      this.target = best;
      this.lastSeenT = g.time;
      this.lastSeenPos.copy(best.pos);
      this.targetVisible = true;
    } else {
      this.targetVisible = false;
      if (this.target && g.time - this.lastSeenT > 5) this.target = null;
    }
    this._chooseWeapon(this.target ? this.pos.distanceTo(this.target.pos) : 30);
    if (this.weapon && this.weapon.ammo < this.weapon.mag * 0.4 && !this.targetVisible) g.combat.reload(this);
    const d = this.target ? this.pos.distanceTo(this.target.pos) : 10;
    const err = (0.25 + d * 0.022) * (1.45 - this.skill * 0.65);
    this.aimErr.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).multiplyScalar(err * 2);
    if (this.target) { this.mode = 'engage'; return; }
    this.mode = 'wander';
    if (!this.hasGoal || Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 2 || Math.random() < 0.02) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * L.r * 0.45;
      this.setGoal(L.x + Math.cos(a) * r, L.z + Math.sin(a) * r);
    }
  }

  // Empty mag mid-fight: swap to a loaded gun, else wall off (if close) and reload.
  _outOfAmmo(tgt, d) {
    const g = this.game;
    const loaded = this.items.some((it, i) => i > 0 && it?.isGun && it !== this.weapon && it.ammo > 0);
    if (loaded) { this._chooseWeapon(d); return; }
    if (d < 25 && this.buildCooldown <= 0 && g.building?.canAfford(this) && this.onGround) {
      this.buildCooldown = 2.5;
      this._takeCover(g.building.buildPiece(this, 'wall', this._yawTo(tgt.pos)));
    }
    g.combat.reload(this);
  }

  _chooseWeapon(d) {
    let bestI = -1, bestS = -1;
    for (let i = 1; i < 6; i++) {
      const w = this.items[i];
      if (!w || !w.isGun) continue;
      const k = w.def.key;
      let s = w.score;
      if (k === 'shotgun' || k === 'pump') s *= d < 10 ? 2.5 : d < 18 ? 0.8 : 0.1;
      else if (k === 'burst') s *= d > 15 ? 1.5 : 0.9;
      else if (k === 'smg') s *= d < 22 ? 1.4 : 0.6;
      else if (k === 'ar') s *= d > 15 ? 1.5 : 0.9;
      else if (k === 'sniper') s *= d > 45 ? 2.2 : d > 25 ? 1 : 0.15;
      else if (k === 'rocket' || k === 'launcher') s *= d > 9 && d < 70 ? (this.shootWall || this.target?.boxed ? 2.4 : 1.1) : 0.05;
      else if (w.def.melee) s *= d < 5 ? 2 : 0.2;
      else if (k === 'bow' || k === 'dmr' || k === 'stormscout') s *= d > 25 ? 1.7 : 0.6;
      else if (w.def.pellets > 1) s *= d < 10 ? 2.5 : d < 18 ? 0.8 : 0.1;
      else if (k === 'flare') s *= 0.5;
      if (w.ammo === 0) s *= 0.25; // swap to a loaded gun instead of reloading mid-fight
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
    if (this.thinkT <= 0) {
      // far from the camera: think less often (nobody is watching closely)
      const far = this.distToCam > 160 && !this.target;
      this.thinkT = (far ? THINK * 2.5 : THINK) + Math.random() * 0.1;
      this.think();
    }

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
    if (this.climb && (this.climb.t -= dt) > 0 && this.pos.y < this.climb.top - 0.3) {
      mx = this.climb.x; mz = this.climb.z;
      this.stuckT = 0; this.detourT = 0;
    } else if (this.exitT > 0) {
      // walk straight out through the door we just cut
      this.exitT -= dt;
      const ex = this.exitPt.x - this.pos.x, ez = this.exitPt.z - this.pos.z, el = Math.hypot(ex, ez);
      if (el > 0.4) { mx = ex / el; mz = ez / el; } else this.exitT = 0;
      this.stuckT = 0; this.detourT = 0;
    } else if (this.retreatT > 0) {
      // run away from the threat, then heal behind cover
      this.retreatT -= dt;
      mx = Math.sin(this.hideYaw); mz = Math.cos(this.hideYaw);
      wantSprint = true;
      if (this.retreatT <= 0) this.noHealT = 2;
    } else if (this.mode === 'heal') {
      mx = mz = 0;
    } else if (this.boxed) {
      // hold the middle of the box; peek through a window now and then
      const cx = (Math.floor(this.pos.x / GRID) + 0.5) * GRID, cz = (Math.floor(this.pos.z / GRID) + 0.5) * GRID;
      const ox = cx - this.pos.x, oz = cz - this.pos.z;
      if (Math.hypot(ox, oz) > 0.4) { mx = ox; mz = oz; }
      this.peekCd -= dt;
      if (this.peekT > 0) { this.peekT -= dt; if (this.peekT <= 0) this._closePeek(); }
      else if (tgt && this.armed && this.useT <= 0 && this.peekCd <= 0 && this.health + this.shield > 50) {
        if (!this._openPeek()) this.peekCd = 2;
        else this._chooseWeapon(this.pos.distanceTo(tgt.pos));
      }
    } else if (this.mode === 'engage' && tgt && this._holdCover(tgt, dt)) {
      mx = this._hx; mz = this._hz;
    } else if (this.mode === 'engage' && tgt) {
      const dx = tgt.pos.x - this.pos.x, dz = tgt.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const melee = !this.weapon;
      const ideal = melee ? 1.6 : this.weapon.def.idealRange;
      let fwd = 0;
      if (!this.targetVisible) { // chase last seen spot (through doors when it's inside a house)
        const wp = g.homes?.route(this.pos, this.lastSeenPos.x, this.lastSeenPos.z, this.lastSeenPos.y);
        const lx = (wp ? wp.x : this.lastSeenPos.x) - this.pos.x, lz = (wp ? wp.z : this.lastSeenPos.z) - this.pos.z;
        const ld = Math.hypot(lx, lz);
        if (ld > 2) { mx = lx / ld; mz = lz / ld; }
        wantSprint = ld > 12;
      } else {
        if (d > ideal * 1.3) fwd = 1; else if (d < ideal * 0.6) fwd = -0.8;
        // enemy is weak / reloading / healing: close the gap
        if (this.push && !melee) fwd = d > 3.5 ? 1 : 0;
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = 0.5 + Math.random() * (1.4 - this.skill * 0.6); this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
        const sx = -dz / d, sz = dx / d;
        // snipers hold still (crouched) to line up the shot, unless they're being hit
        const sniping = this.weapon?.def.key === 'sniper' && d > 30 && g.time - this.lastHurtTime > 1.2;
        const strafe = melee ? 0.3 : sniping ? 0 : 0.85;
        if (sniping) fwd = 0;
        mx = (dx / d) * fwd + sx * this.strafeDir * strafe;
        mz = (dz / d) * fwd + sz * this.strafeDir * strafe;
        if (!sniping && Math.random() < dt * (0.15 + this.skill * 0.25) && this.onGround) this.wantJump = true;
        wantSprint = (melee && d > 4) || (this.push && d > 9);
        // crouch-peek at long range for accuracy
        this.crouched = !melee && this.skill > 0.35 && (d > 25 || sniping) && fwd === 0 && this.onGround && this.slideT <= 0;
        const bld = g.building;
        this.tunnelCd -= dt; this.coneCd -= dt;
        // pushing a higher enemy under fire: walls on both sides + a cone overhead ("tunnel")
        if (bld && this.skill > 0.45 && fwd > 0 && tgt.pos.y - this.pos.y > 2 && g.time - this.lastHurtTime < 2 && this.matTotal >= 40 && this.tunnelCd <= 0 && this.onGround) {
          this.tunnelCd = 1.4;
          const yaw = Math.atan2(dx, dz);
          bld.buildPiece(this, 'wall', yaw + Math.PI / 2);
          bld.buildPiece(this, 'wall', yaw - Math.PI / 2);
          bld.buildPiece(this, 'cone', 0, 1);
        }
        // above an enemy box next to us: cap it with a cone so they can't take our height
        if (bld && this.skill > 0.35 && d < 6.5 && this.pos.y - tgt.pos.y > 2.5 && this.matTotal >= 10 && this.coneCd <= 0) {
          this.coneCd = 3;
          bld.buildPiece(this, 'cone', Math.atan2(dx, dz), 0);
        }
        // ramp rush: a ramp + a wall in front of it every half second while closing in
        if (this.rushT > 0) {
          this.rushT -= dt;
          this.rushCd = (this.rushCd || 0) - dt;
          const done = (this.rushHigh && this.pos.y > tgt.pos.y + 1.5) || d < 6 || this.matTotal < 20 || this.rushN >= 5;
          if (done) this.rushT = 0;
          else {
            mx = dx / d; mz = dz / d; wantSprint = false;
            if (this.rushCd <= 0 && this.onGround) {
              this.rushCd = 0.55 - this.skill * 0.15;
              if (bld?.rampRush(this, Math.atan2(dx, dz))) this.rushN++;
            }
          }
        }
        // take the high ground with a ramp when the enemy is above us
        if (tgt.pos.y - this.pos.y > 2.5 && d < 20 && g.building?.canAfford(this) && this.rampCooldown <= 0 && this.onGround && g.building) {
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
      // inside / into houses: head for the next door or stair on the way
      const wp = g.homes?.route(this.pos, this.goal.x, this.goal.z, this.goalY);
      const gx = wp ? wp.x : this.goal.x, gz = wp ? wp.z : this.goal.z;
      const dx = gx - this.pos.x, dz = gz - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > (wp ? 0.2 : 1.2)) { mx = dx / d; mz = dz / d; }
      wantSprint = d > 10 && (this.mode !== 'wander' || this.zoneUrgent);
      // progress check: running back and forth in a pocket doesn't trip the speed-based stuck test,
      // so also watch whether we get any closer; if not, sidestep + jump, then ramp over it
      if (Math.hypot(gx - (this.progGX ?? 1e9), gz - (this.progGZ ?? 1e9)) > (wp ? 1.5 : 6)) {
        this.progGX = gx; this.progGZ = gz; this.progBest = d; this.progT = 0; this.progFails = 0;
      }
      if (d < this.progBest - 1.5) { this.progBest = d; this.progT = 0; }
      else if (d > 3 && this.mode !== 'harvest' && this.onGround) this.progT += dt;
      if (this.progT > 3.5) {
        this.progT = 0; this.progBest = d; this.progFails++;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.escapeT = 1.4;
        this.escapeX = -mz * side * 0.9 - mx * 0.45; this.escapeZ = mx * side * 0.9 - mz * 0.45;
        this.wantJump = true;
        if (this.progFails >= 2 && g.building?.canAfford(this)) {
          const yaw = this.aimYaw;
          this.aimYaw = Math.atan2(mx, mz);
          g.building.buildRamp(this);
          this.aimYaw = yaw;
        }
      }
      if (this.escapeT > 0) { this.escapeT -= dt; mx = this.escapeX; mz = this.escapeZ; }
      // chop the tree we walked up to
      if (this.mode === 'harvest' && this.tree && d < 1.6) {
        mx = mz = 0;
        const tx = this.tree.x - this.pos.x, tz = this.tree.z - this.pos.z;
        this.aimYaw = this.bodyYaw = Math.atan2(tx, tz);
        if (this.held !== this.items[0]) this.switchSlot(0);
        const r = g.combat.melee(this, this.eye(_eye), _dir.set(tx, 0, tz).normalize(), this.tree.r + 2.2);
        if (r) this.tree.hits++;
        if (this.tree.hits > 6 || this.tree.obj?.dead || this.matTotal >= 160) { this.tree = null; this.mode = 'wander'; this._chooseWeapon(30); }
      }
    }
    if (this.mode !== 'engage' || !tgt) this.crouched = false;
    // step out of fire
    for (const a of g.projectiles?.areas || []) {
      if (a.type !== 'fire') continue;
      const fx = this.pos.x - a.pos.x, fz = this.pos.z - a.pos.z, fd = Math.hypot(fx, fz);
      if (fd < a.r + 0.8 && Math.abs(this.pos.y - a.pos.y) < 2.5) { mx = fx / (fd || 1); mz = fz / (fd || 1); wantSprint = true; this.crouched = false; break; }
    }
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
    this.lookT -= dt;
    if (tgt && (this.targetVisible || this.shootWall) && !this.swimming) {
      const eye = this.eye(_eye);
      const w0 = this.weapon, key = w0?.def.key;
      // aim settles while we keep tracking the same target; moving, airborne or a fast target spoil it
      this.settle = Math.min(1, this.settle + dt * (0.5 + this.skill * 0.9));
      const tSpeed = Math.hypot(tgt.vel.x, tgt.vel.z), mySpeed = Math.hypot(this.vel.x, this.vel.z);
      const errMul = (1.35 - 0.85 * this.settle) * (mySpeed > 4 ? 1.2 : 1) * (this.onGround ? 1 : 1.3) * (1 + Math.min(0.5, tSpeed * 0.03));
      // aim point: rockets at the feet (splash), snipers go for the head, otherwise upper body
      const onFoot = tgt.state === 'ground';
      const ay = !onFoot ? 0.9 : key === 'rocket' && tgt.onGround ? 0.25 : this.aimHead ? 1.5 : 1.05;
      _tp.set(tgt.pos.x, tgt.pos.y + ay, tgt.pos.z).addScaledVector(this.aimErr, errMul);
      // lead moving targets by the bullet's travel time and hold over for drop
      const pr = w0?.def.projectile;
      const dist = eye.distanceTo(_tp);
      const tof = pr ? dist / pr.speed : 0.04;
      _tp.addScaledVector(tgt.vel, (tof + 0.04) * (0.5 + 0.5 * this.skill));
      if (pr?.gravity) _tp.y += 0.5 * pr.gravity * tof * tof * (0.7 + 0.3 * this.skill);
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
      const wd = w0?.def;
      const single = key === 'sniper' || key === 'pump' || key === 'shotgun' || key === 'rocket' || !!(wd && (wd.charge || wd.spinUp || wd.melee || wd.projectile || wd.rate < 2.5));
      // snipers wait until the aim has settled; shotguns only fire in their range
      const ready = key === 'sniper' ? this.settle > 0.55 && Math.abs(dy) < 0.035 : Math.abs(dy) < 0.12;
      if (this.reactionT <= 0 && w && ready && d < (w.def.melee ? w.def.range : w.def.range * 0.8) && !(w.def.pellets > 1 && d > 15)) {
        // burst pacing on automatic guns so bots aren't lasers
        if (this.pauseT > 0 && !single) this.pauseT -= dt;
        else {
          this.burstT += dt;
          if (!single && this.burstT > 0.7 + Math.random() * 0.7) { this.burstT = 0; this.pauseT = 0.5 + Math.random() * 0.8; }
          if (w.canFire()) {
            const cp = Math.cos(this.aimPitch);
            _dir.set(Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp);
            this.root.position.copy(this.pos);
            this.root.rotation.y = this.bodyYaw;
            this.root.updateMatrixWorld(true);
            if (g.combat.fire(this, eye, _dir, this.muzzleWorld(_muzzle))) w.cooldown *= single ? 1.15 : 1.6;
          } else if (w.ammo <= 0) this._outOfAmmo(tgt, d);
        }
      }
    } else {
      this.aiming = false;
      this.settle = Math.max(0, this.settle - dt * 0.8);
      const turn = (3 + this.skill * 4) * dt;
      if (tgt && !this.targetVisible) {
        // pre-aim where they were last seen
        this.aimYaw += clamp(angleDiff(this.aimYaw, this._yawTo(this.lastSeenPos)), -turn, turn);
      } else if (this.lookT > 0) {
        // glance toward a gunshot / whoever hit us
        this.aimYaw += clamp(angleDiff(this.aimYaw, this.lookYaw), -turn, turn);
      } else if (Math.hypot(this.vel.x, this.vel.z) > 1) this.aimYaw = Math.atan2(this.vel.x, this.vel.z);
      this.aimPitch *= 0.9;
    }
  }
}
