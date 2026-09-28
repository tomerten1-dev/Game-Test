import * as THREE from 'three';
import { setting } from '../ui/Settings.js';
import { raySphere } from '../world/Colliders.js';

const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _hit = {};
const BUBBLE = { kind: 'bubble', bubble: true };
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// Random direction within a cone of half-angle `spread` around `dir`.
export function coneDir(dir, spread, out) {
  if (spread <= 0) return out.copy(dir);
  const r = spread * Math.sqrt(Math.random());
  const th = Math.random() * Math.PI * 2;
  _a.set(Math.abs(dir.y) < 0.99 ? 0 : 1, Math.abs(dir.y) < 0.99 ? 1 : 0, 0).cross(dir).normalize();
  _b.crossVectors(dir, _a);
  return out.copy(dir).addScaledVector(_a, Math.cos(th) * r).addScaledVector(_b, Math.sin(th) * r).normalize();
}

// Hitscan shooting shared by the player and bots.
export class Combat {
  constructor(game) {
    this.game = game;
    this.result = { t: 0, actor: null, head: false, collider: null, terrain: false };
  }

  // Closest hit among actors, colliders and terrain. `pad` widens the actor hitboxes
  // (sniper rounds get a little bullet magnetism).
  trace(o, d, maxT, ignore, pad = 0) {
    const res = this.result;
    res.actor = null; res.head = false; res.collider = null; res.terrain = false;
    let best = maxT;
    const wh = this.game.world.raycast(o, d, maxT, _hit);
    if (wh) { best = wh.t; res.collider = wh.collider; res.terrain = wh.terrain; }
    for (const a of this.game.actors) {
      if (a === ignore || !a.alive || a.state === 'bus' || a.hiddenIn) continue;
      const p = _p.copy(a.pos);
      p.y -= a.crouchAmt * 0.3; // crouching lowers the hitboxes
      // broad phase
      if (raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.95, p.z, 1.25 + pad, best) < 0) continue;
      if (a.state !== 'ground') {
        const t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.9, p.z, 0.8 + pad, best);
        if (t >= 0 && t < best) { best = t; res.actor = a; res.head = false; res.collider = null; res.terrain = false; }
        continue;
      }
      const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 1.5, p.z, 0.42 + pad * 0.5, best);
      if (th >= 0 && th < best) { best = th; res.actor = a; res.head = true; res.collider = null; res.terrain = false; }
      const tb = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.82, p.z, 0.34 + pad, best);
      if (tb >= 0 && tb < best) { best = tb; res.actor = a; res.head = false; res.collider = null; res.terrain = false; }
      const tl = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.36, p.z, 0.28 + pad, best);
      if (tl >= 0 && tl < best) { best = tl; res.actor = a; res.head = false; res.collider = null; res.terrain = false; }
    }
    // Shield Bubbles stop everything that crosses their wall
    if (this.game.gadgets?.bubbles.length) {
      const bt = this.game.gadgets.rayBlock(o, d, best);
      if (bt < best) { best = bt; res.actor = null; res.head = false; res.collider = BUBBLE; res.terrain = false; }
    }
    res.t = best;
    res.hit = best < maxT;
    return res;
  }

  // origin/aimDir: the aiming ray (camera ray for the player); muzzle: where the tracer starts.
  fire(shooter, origin, aimDir, muzzle, opts = {}) {
    const g = this.game;
    const w = shooter.weapon;
    if (!w || shooter.splatT > 0) return false; // no shooting while getting up from a splat
    if (w.def.melee) return this.bladeSwing(shooter, origin, aimDir);
    if (!w.canFire()) {
      if (w.ammo <= 0 && !w.reloading) this.reload(shooter);
      return false;
    }
    // charge weapons (bows): hold to draw, release to loose; bots loose at full draw
    if (w.def.charge) {
      if (g.time - (w.lastTry ?? -9) > 0.25) w.chargeStart = g.time;
      w.lastTry = g.time;
      w.charge = Math.min(1, (g.time - w.chargeStart) / w.def.charge);
      if (shooter.isPlayer ? !opts.release : w.charge < 1) return false;
    }
    // minigun: the barrels spin up while the trigger is held
    if (w.def.spinUp) {
      if (g.time - (w.lastTry ?? -9) > 0.3) { w.spinStart = g.time; g.sound.play('reload', shooter.isPlayer ? null : shooter.pos, { range: 30 }); }
      w.lastTry = g.time;
      if (g.time - w.spinStart < w.def.spinUp) return false;
    }
    const hs = Math.hypot(shooter.vel.x, shooter.vel.z);
    const moving = hs > 1.5;
    const spread = w.spread(moving, !shooter.onGround, { crouched: shooter.crouched, still: hs < 0.4, now: g.time, scoped: shooter.aiming && w.def.scope, aiming: shooter.aiming }) * (shooter.accuracyMult ?? 1);
    w.onFire(g.time);
    if (g.overrides?.has('speedshot')) w.cooldown *= 0.8;
    shooter.lastFireTime = g.time;
    if (shooter.isPlayer) g.meta?.track('shot');
    if (shooter.character) shooter.character.kick = Math.min(1, 0.35 + w.def.shake * 1.5);
    // burst weapons queue the rest of the burst (fired by updateBursts)
    if (w.def.burst && !this._inBurst) { w.burstLeft = w.def.burst - 1; w.burstT = w.def.burstGap; }
    shooter.sprinting = false;
    const def = w.def;
    if (def.projectile) {
      // the round travels along the aiming ray itself (starting level with the muzzle), so there's no
      // parallax between the over-the-shoulder camera and the gun: led shots go where the crosshair is
      coneDir(aimDir, spread, _dir);
      const t0 = Math.max(0, _a.copy(muzzle).sub(origin).dot(_dir));
      const start = _end.copy(origin).addScaledVector(_dir, t0);
      g.projectiles.fireWeapon(shooter, w, start, _dir, def.charge ? w.charge : 1);
      w.charge = 0; w.lastTry = -9;
      if (!def.charge) g.effects.muzzle(muzzle, aimDir, def.key === 'rocket' ? 1.6 : 1.3, shooter.isPlayer || shooter.distToCam < 40);
      this._gunSound(shooter, w, 220);
      if (shooter.isPlayer) {
        g.rig.recoil += w.recoil;
        g.rig.shake = Math.min(0.6, g.rig.shake + def.shake);
      }
      if (w.ammo <= 0) this.reload(shooter);
      return true;
    }
    const perTarget = new Map();
    let buildHits = null;
    for (let i = 0; i < def.pellets; i++) {
      coneDir(aimDir, spread, _dir);
      let r = this.trace(origin, _dir, def.range, shooter);
      // long-range rifles: bullets drop a little (re-trace along the sagging line)
      if (def.drop && r.t > 50) {
        const t = r.t / def.drop, sag = 0.5 * 9.8 * t * t;
        _dir.y -= sag / r.t;
        _dir.normalize();
        r = this.trace(origin, _dir, def.range, shooter);
      }
      if (i === 0 && g.events.supplies.length) g.events.shootBalloon(origin, _dir, r.t);
      _end.copy(origin).addScaledVector(_dir, r.t);
      if (i % 2 === 0 || def.pellets === 1) g.effects.tracer(muzzle, _end, shooter.isPlayer ? '#fff2b0' : '#ffd08a', def.pellets > 1 ? 0.03 : 0.045);
      if (r.actor) {
        const fall = def.pellets > 1 ? w.shotgunFalloff(r.t) : 1 - 0.4 * Math.min(1, Math.max(0, (r.t - def.falloffStart) / (def.range - def.falloffStart)));
        // bots trade damage a bit slower with each other so matches last longer
        const botVsBot = !shooter.isPlayer && !r.actor.isPlayer ? 0.45 : 1;
        const dmg = w.damage * fall * (r.head ? (def.headMult || 1.5) * (g.overrides?.has('headshot') ? 1.25 : 1) : 1) * botVsBot * (def.exotic === 'sixshooter' && shooter.aiming ? 1.5 : 1);
        let e = perTarget.get(r.actor);
        if (!e) { e = { dmg: 0, head: false, heads: 0, bodyDmg: 0, point: _end.clone() }; perTarget.set(r.actor, e); }
        e.dmg += dmg;
        e.bodyDmg += dmg / (r.head ? def.headMult || 1.5 : 1);
        if (r.head) e.heads++;
        e.head = e.head || r.head;
      } else if (r.hit) {
        const kind = r.collider ? (r.collider.structure ? (r.collider.structure.mat === 'wood' ? 'wood' : 'stone') : r.collider.house ? (r.collider.mat === 'wood' ? 'wood' : 'stone') : r.collider.crate ? 'wood' : r.collider.tree ? 'wood' : r.collider.rock ? 'stone' : 'stone') : 'terrain';
        if (i < 4) g.effects.impact(_end.addScaledVector(_dir, -0.05), kind, _n.copy(_dir).negate());
        if (r.collider?.structure) {
          r.collider.structure.damage(w.damage * 0.9, shooter);
          if (shooter.isPlayer && r.collider.structure.owner !== shooter) g.meta?.track('buildDamage', w.damage * 0.9);
          if (shooter.isPlayer) (buildHits ||= { pos: _end.clone(), dmg: 0 }).dmg += w.damage * 0.9;
        }
        else if (r.collider?.breakable) this.damageProp(r.collider, w.damage, shooter);
        else if (r.collider?.part) r.collider.part.damage(w.damage, shooter); // house walls, doors, windows
        else if (r.collider?.obj) g.world.destructibles.damage(r.collider, w.damage, shooter); // trees, rocks
        if (shooter.isPlayer && i < 1) g.hud?.objHp?.(r.collider, _end);
      }
    }
    if (buildHits) g.effects.buildNumber(buildHits.pos, buildHits.dmg);
    if (shooter.isPlayer && perTarget.size) g.meta?.track('hit', 1, [...perTarget.values()].some((e) => e.head));
    for (const [target, e] of perTarget) {
      if (def.pellets > 1) {
        // shotguns: a headshot needs at least 3 pellets on the head, and one blast has a damage cap
        if (e.heads < 3) { e.dmg = e.bodyDmg; e.head = false; }
        e.dmg = Math.min(e.dmg, w.damageCap);
      }
      const shieldBefore = target.shield;
      const dealt = target.takeDamage(e.dmg, shooter, e.head);
      if (def.exotic === 'mark' && target.alive) this.markTarget(target, shooter);
      g.effects.hitSparks(e.point, e.head ? '#ffd23f' : shieldBefore > 0 ? '#6cc4ff' : '#ffffff');
      if (shooter.isPlayer) {
        g.effects.damageNumber(e.point, dealt, e.head, shieldBefore > 0, target);
        g.hud?.hitMarker(e.head, !target.alive, shieldBefore > 0);
        g.sound.play(e.head ? (setting(g, 'legacyHitSound', false) ? 'headshotLegacy' : 'headshot') : shieldBefore > 0 ? 'shieldHit' : 'hit');
      }
    }
    g.effects.muzzle(muzzle, aimDir, (def.pellets > 1 ? 1.5 : 1) * (w.suppressed ? 0.4 : 1), shooter.isPlayer || shooter.distToCam < 30);
    this._gunSound(shooter, w, 140);
    // Six Shooter: aimed shots are slow and heavy
    if (def.exotic === 'sixshooter' && shooter.aiming) w.cooldown = 1 / 1.6;
    // The Dub: every blast throws you backwards
    if (def.push) {
      shooter.vel.x -= aimDir.x * def.push; shooter.vel.z -= aimDir.z * def.push;
      shooter.vel.y = Math.max(shooter.vel.y, 4 - aimDir.y * def.push * 0.7);
      shooter.onGround = false; shooter.noFallT = Math.max(shooter.noFallT || 0, 2); shooter.flungT = 0.6;
    }
    if (shooter.isPlayer) {
      g.rig.recoil += w.recoil;
      g.rig.shake = Math.min(0.6, g.rig.shake + def.shake);
    }
    if (w.ammo <= 0) this.reload(shooter);
    return true;
  }

  // Gunshot: suppressed guns are quiet and only heard (and shown on sound markers) up close.
  _gunSound(shooter, w, range) {
    const at = shooter.isPlayer ? null : shooter.pos;
    if (w.suppressed) this.game.sound.play('suppressed', at, { range: 22, vol: 0.6 });
    else this.game.sound.play(w.def.key, at, { range });
  }

  // Shadow Tracker: the target shows on your map (and through walls) for a few seconds.
  markTarget(target, by) {
    target.markedUntil = this.game.time + 8;
    target.markedBy = by;
  }

  // Kinetic Blade: a wide slash (every third one in a row hits harder); structures take big damage.
  bladeSwing(actor, origin, dir) {
    const g = this.game, w = actor.weapon;
    if (w.cooldown > 0 || w.drawT > 0) return false;
    w.cooldown = 1 / w.def.rate;
    w.combo = g.time - (w.lastShot || -9) < 1.2 ? ((w.combo || 0) + 1) % 3 : 0;
    w.lastShot = g.time;
    actor.swingT = 0.5;
    actor.lastFireTime = g.time;
    if (actor.character) actor.character.kick = 0.8;
    g.sound.play('swing', actor.isPlayer ? null : actor.pos);
    const dmg = w.combo === 2 ? 75 : w.def.damage;
    let hitSomething = false;
    // three rays in a fan so the slash is forgiving
    for (const off of [0, -0.25, 0.25]) {
      _p.copy(dir).applyAxisAngle(_up, off);
      const r = this.trace(origin, _p, w.def.range + (actor.isPlayer ? g.rig.curDist * 0.2 : 0), actor, 0.25);
      if (!r.hit) continue;
      _end.copy(origin).addScaledVector(_p, r.t);
      if (r.actor) {
        const t = r.actor;
        if (t._bladeT === g.time) continue;
        t._bladeT = g.time;
        const shieldBefore = t.shield;
        const dealt = t.takeDamage(dmg * (!actor.isPlayer && !t.isPlayer ? 0.45 : 1), actor, false);
        g.effects.hitSparks(_end, '#9ff4ff');
        if (actor.isPlayer) { g.effects.damageNumber(_end, dealt, false, shieldBefore > 0, t); g.hud?.hitMarker(false, !t.alive, shieldBefore > 0); g.sound.play('hit'); }
        hitSomething = true;
      } else if (off === 0) {
        const c = r.collider;
        if (c?.structure) c.structure.damage(120, actor);
        else if (c?.breakable) this.damageProp(c, 120, actor);
        else if (c?.part) c.part.damage(80, actor);
        g.effects.impact(_end, c?.structure?.mat === 'wood' ? 'wood' : 'stone', _n.copy(_p).negate());
        hitSomething = true;
      }
    }
    return hitSomething || true;
  }

  // Kinetic Blade alt fire: a quick forward dash (6 s cooldown).
  bladeDash(actor, dir) {
    const g = this.game, w = actor.weapon;
    if (!w?.def.dash || g.time < (w.dashReady || 0)) return false;
    w.dashReady = g.time + 6;
    const h = Math.hypot(dir.x, dir.z) || 1;
    actor.vel.x = (dir.x / h) * 24; actor.vel.z = (dir.z / h) * 24;
    actor.vel.y = Math.max(actor.vel.y, 4);
    actor.onGround = false; actor.flungT = 0.35; actor.noFallT = Math.max(actor.noFallT || 0, 1.5);
    g.sound.play('jumppad', actor.isPlayer ? null : actor.pos, { range: 40 });
    g.effects.dust?.(actor.pos, 10, 1.2);
    return true;
  }

  // Fire the queued shots of burst weapons, re-aiming each one.
  updateBursts(dt) {
    const g = this.game;
    for (const a of g.actors) {
      const w = a.weapon;
      if (!w || !w.burstLeft || !a.alive) continue;
      w.burstT -= dt;
      if (w.burstT > 0) continue;
      if (w.ammo <= 0 || w.reloading || a.state !== 'ground') { w.burstLeft = 0; continue; }
      w.burstLeft--;
      w.burstT = w.def.burstGap;
      let origin, dir;
      if (a.isPlayer) {
        dir = g.camera.getWorldDirection(_b);
        origin = _a.copy(g.camera.position).addScaledVector(dir, g.rig.curDist + 0.25);
      } else {
        const cp = Math.cos(a.aimPitch);
        dir = _b.set(Math.sin(a.aimYaw) * cp, Math.sin(a.aimPitch), Math.cos(a.aimYaw) * cp);
        origin = a.eye(_a);
      }
      a.character.root.updateMatrixWorld(true);
      const cd = w.cooldown;
      w.cooldown = 0;
      this._inBurst = true;
      this.fire(a, origin.clone(), dir.clone(), a.muzzleWorld(_p).clone());
      this._inBurst = false;
      w.cooldown = Math.max(cd, w.cooldown);
    }
  }

  reload(actor) {
    const w = actor.weapon;
    if (!w) return;
    const reserve = actor.ammoFor(w.def.ammoType);
    // other players' reloads are audible nearby too
    if (w.startReload(reserve)) this.game.sound.play('reload', actor.isPlayer ? null : actor.pos, { range: 22 });
    else if (actor.isPlayer && reserve <= 0 && w.ammo < w.mag && !this._noAmmoT) {
      this.game.hud.toast(`No ${w.def.ammoType} ammo`);
      this._noAmmoT = setTimeout(() => (this._noAmmoT = null), 1500);
    }
  }

  // Pickaxe swing: hits players (20), damages built walls (50), harvests materials from the world.
  melee(actor, origin, dir, reach) {
    const g = this.game;
    const pick = actor.held;
    if (!pick || !pick.isPickaxe || pick.cooldown > 0) return false;
    pick.cooldown = 0.55;
    actor.swingT = 0.5;
    actor.lastFireTime = g.time - 1.2; // face the aim direction briefly
    g.sound.play('swing', actor.isPlayer ? null : actor.pos);
    const r = this.trace(origin, dir, reach, actor);
    if (!r.hit) return true;
    _end.copy(origin).addScaledVector(dir, r.t);
    if (r.actor) {
      const shieldBefore = r.actor.shield;
      const dealt = r.actor.takeDamage(!actor.isPlayer && !r.actor.isPlayer ? 9 : 20, actor, false);
      g.effects.hitSparks(_end, '#ffffff');
      if (actor.isPlayer) { g.effects.damageNumber(_end, dealt, false, shieldBefore > 0, r.actor); g.hud?.hitMarker(false, !r.actor.alive); g.sound.play('hit'); }
      return true;
    }
    const c = r.collider;
    if (actor.isPlayer && c) g.hud?.objHp?.(c, _end);
    if (c?.structure) { const m = c.structure.mat || 'wood'; c.structure.damage(c.structure.owner && c.structure.owner !== actor ? 75 : 50, actor); g.effects.impact(_end, m === 'wood' ? 'wood' : 'stone'); g.sound.play(`harvest_${m}`, actor.isPlayer ? null : _end); return true; }
    if (c?.breakable) this.damageProp(c, 35, actor);
    if (c?.part) c.part.damage(c.mat === 'glass' ? 1 : 55, actor); // house walls break after a few swings
    const mat = r.terrain ? null : c?.mat === 'glass' ? null : c?.mat || (c?.tree || c?.crate ? 'wood' : c?.rock || c?.stone ? 'stone' : c?.house ? 'wood' : null);
    g.effects.impact(_end, mat === 'wood' ? 'wood' : 'stone', _n.copy(dir).negate());
    if (mat) {
      let amount = 7 + Math.floor(Math.random() * 4);
      // weak point: hitting the glowing spot doubles the harvest and moves it
      if (actor.isPlayer && c?.kind === 'circle') {
        const crit = this.weak?.c === c && _end.distanceTo(this.weak.pos) < 0.6;
        if (crit) { amount *= 2; g.sound.play('hit'); g.effects.hitSparks(this.weak.pos, '#6cd8ff'); }
        if (c.obj) {
          // trees and rocks lose HP; the last hit knocks them down for a bonus
          if (g.world.destructibles.damage(c, crit ? 100 : 50, actor)) { amount += 12; if (this.weak?.c === c) { this.weak = null; this.weakMesh.visible = false; } }
          else this._placeWeak(c, actor, _end.y, crit);
        } else this._placeWeak(c, actor, _end.y, crit);
      } else if (c?.obj) g.world.destructibles.damage(c, 50, actor);
      actor.addMat(mat, amount);
      if (actor.isPlayer) { g.effects.matNumber?.(_end, amount, mat); g.meta?.track('harvest', amount); }
      g.sound.play(`harvest_${mat}`, actor.isPlayer ? null : _end, { range: 50 });
    } else if (actor.isPlayer) g.sound.play('impact');
    return mat || true;
  }

  // Place (or move) the harvest weak point on a round collider (tree trunk, rock), on the side facing the actor.
  _placeWeak(c, actor, y, moved) {
    if (!this.weakMesh) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.26, 24), new THREE.MeshBasicMaterial({ color: '#58d0ff', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
      m.add(new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.85, depthWrite: false })));
      m.renderOrder = 5;
      this.game.scene.add(m);
      this.weakMesh = m;
    }
    if (this.weak?.c === c && !moved) { this.weak.t = this.game.time; return; }
    const base = Math.atan2(actor.pos.z - c.z, actor.pos.x - c.x);
    const a = base + (this.weak?.c === c ? (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.35) : (Math.random() - 0.5) * 0.5);
    const r = c.r + 0.04;
    const wy = Math.max(c.y0 + 2.4, Math.min(c.y1 - 0.3, y + (Math.random() - 0.5) * 1.0, actor.pos.y + 2.1));
    const pos = new THREE.Vector3(c.x + Math.cos(a) * r, Math.max(wy, actor.pos.y + 0.5), c.z + Math.sin(a) * r);
    this.weak = { c, pos, t: this.game.time };
    this.weakMesh.position.copy(pos);
    this.weakMesh.lookAt(pos.x + Math.cos(a), pos.y, pos.z + Math.sin(a));
    this.weakMesh.visible = true;
  }

  // Hide the weak point when the player walks away, puts the axe down or stops harvesting.
  updateWeak(p) {
    const w = this.weak;
    if (!w) return;
    const far = (p.pos.x - w.pos.x) ** 2 + (p.pos.z - w.pos.z) ** 2 > 16;
    if (!p.alive || !p.held?.isPickaxe || far || this.game.time - w.t > 5) { this.weak = null; this.weakMesh.visible = false; return; }
    const s = 1 + Math.sin(this.game.time * 8) * 0.08;
    this.weakMesh.scale.setScalar(s);
  }

  damageProp(c, amount, by = null) {
    const b = c.breakable;
    if (!b || b.broken) return;
    b.hp -= amount;
    if (by) b.lastHit = by;
    if (b.hp <= 0) this.game.world.towns.breakProp(c, this.game);
  }
}
