import * as THREE from 'three';
import { raySphere } from '../world/Colliders.js';

const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _hit = {};

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
      const p = a.pos;
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
    w.onFire();
    shooter.lastFireTime = g.time;
    const moving = Math.hypot(shooter.vel.x, shooter.vel.z) > 1.5;
    const spread = w.spread(moving, !shooter.onGround) * (shooter.accuracyMult ?? 1);
    const def = w.def;
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
        const kind = r.collider ? (r.collider.structure ? 'wood' : r.collider.house ? 'stone' : r.collider.crate ? 'wood' : r.collider.tree ? 'wood' : r.collider.rock ? 'stone' : 'stone') : 'terrain';
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
    if (w && w.startReload() && actor.isPlayer) this.game.sound.play('reload');
  }
}
