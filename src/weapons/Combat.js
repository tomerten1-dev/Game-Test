import * as THREE from 'three';
import { raySphere } from '../world/Colliders.js';

const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _hit = {};
const _p = new THREE.Vector3();

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

  // Closest hit among actors, colliders and terrain.
  trace(o, d, maxT, ignore) {
    const res = this.result;
    res.actor = null; res.head = false; res.collider = null; res.terrain = false;
    let best = maxT;
    const wh = this.game.world.raycast(o, d, maxT, _hit);
    if (wh) { best = wh.t; res.collider = wh.collider; res.terrain = wh.terrain; }
    for (const a of this.game.actors) {
      if (a === ignore || !a.alive || a.state === 'bus') continue;
      const p = _p.copy(a.pos);
      p.y -= a.crouchAmt * 0.3; // crouching lowers the hitboxes
      // broad phase
      if (raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.95, p.z, 1.25, best) < 0) continue;
      if (a.state !== 'ground') {
        const t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.9, p.z, 0.8, best);
        if (t >= 0 && t < best) { best = t; res.actor = a; res.head = false; res.collider = null; res.terrain = false; }
        continue;
      }
      const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 1.5, p.z, 0.42, best);
      if (th >= 0 && th < best) { best = th; res.actor = a; res.head = true; res.collider = null; res.terrain = false; }
      const tb = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.82, p.z, 0.34, best);
      if (tb >= 0 && tb < best) { best = tb; res.actor = a; res.head = false; res.collider = null; res.terrain = false; }
      const tl = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.36, p.z, 0.28, best);
      if (tl >= 0 && tl < best) { best = tl; res.actor = a; res.head = false; res.collider = null; res.terrain = false; }
    }
    res.t = best;
    res.hit = best < maxT;
    return res;
  }

  // origin/aimDir: the aiming ray (camera ray for the player); muzzle: where the tracer starts.
  fire(shooter, origin, aimDir, muzzle) {
    const g = this.game;
    const w = shooter.weapon;
    if (!w) return false;
    if (!w.canFire()) {
      if (w.ammo <= 0 && !w.reloading) this.reload(shooter);
      return false;
    }
    const hs = Math.hypot(shooter.vel.x, shooter.vel.z);
    const moving = hs > 1.5;
    const spread = w.spread(moving, !shooter.onGround, { crouched: shooter.crouched, still: hs < 0.4, now: g.time, scoped: shooter.aiming && w.def.scope }) * (shooter.accuracyMult ?? 1);
    w.onFire(g.time);
    shooter.lastFireTime = g.time;
    shooter.sprinting = false;
    const def = w.def;
    if (def.projectile) {
      // aim the projectile from the muzzle at whatever the aiming ray points at
      coneDir(aimDir, spread, _dir);
      const r = this.trace(origin, _dir, def.range, shooter);
      _end.copy(origin).addScaledVector(_dir, r.t);
      const pd = _a.copy(_end).sub(muzzle);
      if (r.t > 3 && pd.lengthSq() > 1) _dir.copy(pd.normalize());
      g.projectiles.fireWeapon(shooter, w, muzzle, _dir);
      g.effects.muzzle(muzzle, aimDir, def.key === 'rocket' ? 1.6 : 1.3, shooter.isPlayer || shooter.distToCam < 40);
      g.sound.play(def.key, shooter.isPlayer ? null : shooter.pos, { range: 220 });
      if (shooter.isPlayer) {
        g.rig.recoil += def.recoil;
        g.rig.shake = Math.min(0.6, g.rig.shake + def.shake);
      }
      if (w.ammo <= 0) this.reload(shooter);
      return true;
    }
    const perTarget = new Map();
    for (let i = 0; i < def.pellets; i++) {
      coneDir(aimDir, spread, _dir);
      const r = this.trace(origin, _dir, def.range, shooter);
      _end.copy(origin).addScaledVector(_dir, r.t);
      if (i % 2 === 0 || def.pellets === 1) g.effects.tracer(muzzle, _end, shooter.isPlayer ? '#fff2b0' : '#ffd08a', def.pellets > 1 ? 0.03 : 0.045);
      if (r.actor) {
        const fall = 1 - 0.4 * Math.min(1, Math.max(0, (r.t - def.falloffStart) / (def.range - def.falloffStart)));
        // bots trade damage a bit slower with each other so matches last longer
        const botVsBot = !shooter.isPlayer && !r.actor.isPlayer ? 0.45 : 1;
        const dmg = w.damage * fall * (r.head ? 1.5 : 1) * botVsBot;
        let e = perTarget.get(r.actor);
        if (!e) { e = { dmg: 0, head: false, point: _end.clone() }; perTarget.set(r.actor, e); }
        e.dmg += dmg;
        e.head = e.head || r.head;
      } else if (r.hit) {
        const kind = r.collider ? (r.collider.structure ? (r.collider.structure.mat === 'wood' ? 'wood' : 'stone') : r.collider.house ? 'stone' : r.collider.crate ? 'wood' : r.collider.tree ? 'wood' : r.collider.rock ? 'stone' : 'stone') : 'terrain';
        if (i < 4) g.effects.impact(_end.addScaledVector(_dir, -0.05), kind, _n.copy(_dir).negate());
        if (r.collider?.structure) r.collider.structure.damage(w.damage * 0.9, shooter);
      }
    }
    for (const [target, e] of perTarget) {
      const shieldBefore = target.shield;
      const dealt = target.takeDamage(e.dmg, shooter, e.head);
      g.effects.hitSparks(e.point, e.head ? '#ffd23f' : shieldBefore > 0 ? '#6cc4ff' : '#ffffff');
      if (shooter.isPlayer) {
        g.effects.damageNumber(e.point, dealt, e.head, shieldBefore > 0);
        g.hud?.hitMarker(e.head, !target.alive);
        g.sound.play(e.head ? 'headshot' : shieldBefore > 0 ? 'shieldHit' : 'hit');
      }
    }
    g.effects.muzzle(muzzle, aimDir, def.pellets > 1 ? 1.5 : 1, shooter.isPlayer || shooter.distToCam < 30);
    g.sound.play(def.key, shooter.isPlayer ? null : shooter.pos, { range: 140 });
    if (shooter.isPlayer) {
      g.rig.recoil += def.recoil;
      g.rig.shake = Math.min(0.6, g.rig.shake + def.shake);
    }
    if (w.ammo <= 0) this.reload(shooter);
    return true;
  }

  reload(actor) {
    const w = actor.weapon;
    if (!w) return;
    const reserve = actor.ammoFor(w.def.ammoType);
    if (w.startReload(reserve)) { if (actor.isPlayer) this.game.sound.play('reload'); }
    else if (actor.isPlayer && reserve <= 0 && w.ammo < w.def.mag && !this._noAmmoT) {
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
      if (actor.isPlayer) { g.effects.damageNumber(_end, dealt, false, shieldBefore > 0); g.hud?.hitMarker(false, !r.actor.alive); g.sound.play('hit'); }
      return true;
    }
    const c = r.collider;
    if (c?.structure) { const m = c.structure.mat || 'wood'; c.structure.damage(50, actor); g.effects.impact(_end, m === 'wood' ? 'wood' : 'stone'); g.sound.play(`harvest_${m}`, actor.isPlayer ? null : _end); return true; }
    const mat = r.terrain ? null : c?.mat || (c?.tree || c?.crate ? 'wood' : c?.rock || c?.stone ? 'stone' : c?.house ? 'wood' : null);
    g.effects.impact(_end, mat === 'wood' ? 'wood' : 'stone', _n.copy(dir).negate());
    if (mat) {
      const amount = 7 + Math.floor(Math.random() * 4);
      actor.addMat(mat, amount);
      if (actor.isPlayer) { g.effects.matNumber?.(_end, amount, mat); g.meta?.track('harvest', amount); }
      g.sound.play(`harvest_${mat}`, actor.isPlayer ? null : _end, { range: 50 });
    } else if (actor.isPlayer) g.sound.play('impact');
    return mat || true;
  }
}
