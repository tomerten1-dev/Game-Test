import * as THREE from 'three';
import { itemGeometry, makeThrowableMesh } from './WeaponModels.js';
import { CONSUMABLES } from './Items.js';

const _prev = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3(0, 0, 1);

// Physical projectiles: sniper rounds (with drop), rockets and bouncing throwables
// (grenade, smoke, impulse, fire flask). Smoke and fire leave lingering areas.
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.areas = [];
    this.bulletGeo = new THREE.BoxGeometry(0.05, 0.05, 1.4);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: '#fff4c2' });
    this.rocketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.7, 10).rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.5, metalness: 0.3, emissive: '#ff6a2a', emissiveIntensity: 0.25 });
    this.grenadeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5 });
  }

  _add(p, mesh) {
    p.alive = true;
    p.mesh = mesh;
    mesh.position.copy(p.pos);
    this.game.scene.add(mesh);
    this.list.push(p);
    return p;
  }

  fireWeapon(owner, weapon, from, dir) {
    const d = weapon.def, pr = d.projectile;
    const rocket = d.key === 'rocket';
    const mesh = new THREE.Mesh(rocket ? this.rocketGeo : this.bulletGeo, rocket ? this.rocketMat : this.bulletMat);
    return this._add({
      kind: rocket ? 'rocket' : 'bullet', owner, weapon, damage: weapon.damage,
      pos: from.clone(), vel: dir.clone().multiplyScalar(pr.speed), gravity: pr.gravity,
      life: d.range / pr.speed + 0.5, explode: pr.explode, headMult: d.headMult || 1.5,
    }, mesh);
  }

  throwGrenade(owner, from, dir, kind = 'grenade') {
    const def = CONSUMABLES[kind] || CONSUMABLES.grenade;
    const vel = dir.clone().multiplyScalar(21);
    vel.y += 5;
    vel.x += owner.vel.x * 0.4; vel.z += owner.vel.z * 0.4;
    let mesh = makeThrowableMesh(kind);
    if (!mesh) { mesh = new THREE.Mesh(itemGeometry('grenade'), this.grenadeMat); mesh.scale.setScalar(1.3); }
    mesh.traverse((o) => { o.castShadow = true; });
    this.game.sound.play('throw', owner.isPlayer ? null : owner.pos, { range: 40 });
    return this._add({
      kind: 'grenade', nade: kind, def, owner, damage: def.damage || 0, pos: from.clone(), vel, gravity: 24,
      life: def.fuse, fuse: def.fuse, explode: { radius: def.radius, structure: 180 }, spin: 0,
    }, mesh);
  }

  // What a throwable does when its fuse runs out.
  _detonate(p) {
    const g = this.game, pos = p.pos.clone(), def = p.def;
    if (p.nade === 'grenade' || !p.nade) { this._explode(p, pos); return; }
    this._remove(p);
    if (p.nade === 'smoke') {
      const s = { x: pos.x, y: pos.y + 1.2, z: pos.z, r: 0.5 };
      g.world.smokes.push(s);
      this.areas.push({ type: 'smoke', pos, smoke: s, r: def.radius, t: def.duration, dur: def.duration, emit: 0 });
      g.sound.play('bounce', pos, { range: 40 });
    } else if (p.nade === 'fire') {
      this.areas.push({ type: 'fire', pos, owner: p.owner, r: def.radius, t: def.duration, dur: def.duration, emit: 0, dps: def.dps, tick: 0 });
      g.sound.play('explosion', pos, { range: 60, vol: 0.5 });
    } else if (p.nade === 'impulse') {
      impulse(g, pos, def.radius, def.push);
    }
  }

  _updateAreas(dt) {
    const g = this.game, fx = g.effects;
    for (const a of [...this.areas]) {
      a.t -= dt;
      const age = a.dur - a.t;
      if (a.type === 'smoke') {
        // grow quickly, hold, then thin out
        a.smoke.r = a.t < 2 ? a.r * Math.max(0, a.t / 2) : a.r * Math.min(1, 0.3 + age * 0.9);
        a.emit += dt * 26;
        for (; a.emit >= 1; a.emit--) {
          const ang = Math.random() * Math.PI * 2, d = Math.random() * a.r * Math.min(1, 0.3 + age);
          const v = 0.72 + Math.random() * 0.12;
          _c.setRGB(v, v * 1.01, v * 1.04);
          fx.debris.emit(a.pos.x + Math.cos(ang) * d, a.pos.y + 0.4 + Math.random() * 2.2, a.pos.z + Math.sin(ang) * d,
            (Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8, _c, 2.6 + Math.random(), 3.2 + Math.random() * 1.6, -0.15, a.t < 2 ? 0.5 : 0.85);
        }
      } else if (a.type === 'fire') {
        a.emit += dt * 60;
        for (; a.emit >= 1; a.emit--) {
          const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * a.r;
          _c.setHSL(0.01 + Math.random() * 0.055, 1, 0.13 + Math.random() * 0.1);
          fx.sparks.emit(a.pos.x + Math.cos(ang) * d, a.pos.y + 0.1, a.pos.z + Math.sin(ang) * d,
            (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6, _c, 0.5 + Math.random() * 0.45, 0.6 + Math.random() * 0.5, -1);
        }
        if (Math.random() < dt * 8) { _c.setRGB(0.25, 0.23, 0.22); fx.debris.emit(a.pos.x, a.pos.y + 1.2, a.pos.z, 0, 1.2, 0, _c, 2, 1.8, -0.3, 0.5); }
        // burn whoever stands in it (twice a second) and wooden builds
        a.tick -= dt;
        if (a.tick <= 0) {
          a.tick = 0.5;
          for (const act of g.actors) {
            if (!act.alive || act.state === 'bus') continue;
            if ((act.pos.x - a.pos.x) ** 2 + (act.pos.z - a.pos.z) ** 2 > a.r * a.r || Math.abs(act.pos.y - a.pos.y) > 2.5) continue;
            const botVsBot = a.owner && !a.owner.isPlayer && !act.isPlayer ? 0.6 : 1;
            const shieldBefore = act.shield;
            const dealt = act.takeDamage(a.dps * 0.5 * botVsBot, act === a.owner ? null : a.owner, false);
            if (a.owner?.isPlayer && act !== a.owner) { fx.damageNumber(act.chest(_pt), dealt, false, shieldBefore > 0); g.hud?.hitMarker(false, !act.alive); }
          }
          for (const st of [...g.building.structures]) {
            if (st.mat !== 'wood') continue;
            const b = st.box;
            const dx = Math.max(b[0] - a.pos.x, 0, a.pos.x - b[1]), dz = Math.max(b[4] - a.pos.z, 0, a.pos.z - b[5]);
            if (Math.hypot(dx, dz) < a.r && b[2] < a.pos.y + 3 && b[3] > a.pos.y - 1) st.damage(25, a.owner);
          }
        }
      }
      if (a.t <= 0) this._endArea(a);
    }
  }

  _endArea(a) {
    const i = this.areas.indexOf(a);
    if (i >= 0) this.areas.splice(i, 1);
    if (a.smoke) { const j = this.game.world.smokes.indexOf(a.smoke); if (j >= 0) this.game.world.smokes.splice(j, 1); }
  }

  update(dt) {
    const g = this.game;
    this._updateAreas(dt);
    for (const p of [...this.list]) {
      p.life -= dt;
      if (p.kind === 'grenade' && p.life <= 0) { this._detonate(p); continue; }
      if (p.life <= 0) { if (p.kind === 'rocket') this._explode(p, p.pos); else this._remove(p); continue; }
      if (!p.resting) this._step(p, dt);
      if (!p.alive) continue;
      // visuals
      const m = p.mesh;
      if (!m.parent) continue;
      m.position.copy(p.pos);
      if (p.kind === 'grenade') { p.spin += dt * 9; m.rotation.set(p.spin, p.spin * 0.7, 0); }
      else if (p.vel.lengthSq() > 1) m.quaternion.setFromUnitVectors(_fwd, _dir.copy(p.vel).normalize());
      if (p.kind === 'rocket') {
        const back = _pt.copy(p.pos).addScaledVector(_dir, -0.45);
        _c.set('#ffb347');
        g.effects.sparks.emit(back.x, back.y, back.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), _c, 0.18, 0.22, 0);
        _c.set('#b9b9b9');
        g.effects.debris.emit(back.x, back.y, back.z, (Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6, _c, 0.9, 0.35, -0.5, 0.55);
      }
    }
  }

  _step(p, dt) {
    const g = this.game;
    const steps = Math.max(1, Math.ceil((p.vel.length() * dt) / 6));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      _prev.copy(p.pos);
      p.vel.y -= p.gravity * h;
      const len = p.vel.length() * h;
      if (len < 1e-4) return;
      _dir.copy(p.vel).normalize();
      const r = g.combat.trace(_prev, _dir, len, p.owner);
      if (!r.hit) {
        p.pos.addScaledVector(_dir, len);
        if (p.kind === 'bullet') g.effects.tracer(_prev, p.pos, '#fff2b0', 0.05);
        continue;
      }
      _pt.copy(_prev).addScaledVector(_dir, r.t);
      if (p.kind === 'bullet') { g.effects.tracer(_prev, _pt, '#fff2b0', 0.05); this._bulletHit(p, r, _pt); return; }
      if (p.kind === 'rocket') { this._explode(p, _pt.addScaledVector(_dir, -0.3)); return; }
      // grenade: bounce
      this._normal(r, _pt, _n);
      p.pos.copy(_pt).addScaledVector(_n, 0.08);
      const vn = p.vel.dot(_n);
      p.vel.addScaledVector(_n, -1.6 * vn).multiplyScalar(0.5);
      if (p.vel.length() > 3) g.sound.play('bounce', p.pos, { range: 30 });
      if (_n.y > 0.6 && p.vel.length() < 2) { p.resting = true; p.vel.set(0, 0, 0); }
      return;
    }
  }

  // Approximate surface normal at a hit (terrain, boxes, cylinders, slopes).
  _normal(r, pt, out) {
    const w = this.game.world;
    if (r.terrain || !r.collider) return out.copy(w.terrain.normalAt(pt.x, pt.z));
    const c = r.collider;
    if (c.kind === 'circle') return out.set(pt.x - c.x, 0, pt.z - c.z).normalize();
    if (c.kind === 'ramp' || c.kind === 'cone') return out.set(0, 1, 0);
    const d = [pt.x - c.minX, c.maxX - pt.x, pt.z - c.minZ, c.maxZ - pt.z, pt.y - c.y0, c.y1 - pt.y];
    const i = d.indexOf(Math.min(...d));
    return out.set(i === 0 ? -1 : i === 1 ? 1 : 0, i === 4 ? -1 : i === 5 ? 1 : 0, i === 2 ? -1 : i === 3 ? 1 : 0);
  }

  _bulletHit(p, r, pt) {
    const g = this.game, owner = p.owner;
    if (r.actor) {
      const target = r.actor;
      const botVsBot = !owner.isPlayer && !target.isPlayer ? 0.45 : 1;
      const shieldBefore = target.shield;
      const dealt = target.takeDamage(p.damage * (r.head ? p.headMult : 1) * botVsBot, owner, r.head);
      g.effects.hitSparks(pt, r.head ? '#ffd23f' : shieldBefore > 0 ? '#6cc4ff' : '#ffffff');
      if (owner.isPlayer) {
        g.effects.damageNumber(pt, dealt, r.head, shieldBefore > 0);
        g.hud?.hitMarker(r.head, !target.alive);
        g.sound.play(r.head ? 'headshot' : shieldBefore > 0 ? 'shieldHit' : 'hit');
      }
    } else {
      const c = r.collider;
      g.effects.impact(pt, c?.structure ? (c.structure.mat === 'wood' ? 'wood' : 'stone') : c ? 'stone' : 'terrain', _n.copy(_dir).negate());
      if (c?.structure) c.structure.damage(p.damage, owner);
    }
    this._remove(p);
  }

  _explode(p, at) {
    const pos = at.clone();
    this._remove(p);
    explode(this.game, pos, p.owner, p.damage, p.explode.radius, p.explode.structure);
  }

  _remove(p) {
    p.alive = false;
    this.game.scene.remove(p.mesh);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  reset() {
    for (const p of [...this.list]) this._remove(p);
    for (const a of [...this.areas]) this._endArea(a);
  }
}

// Splash damage to actors (no self damage) and builds, with a fireball and a camera kick.
export function explode(game, pos, owner, damage, radius, structureDamage) {
  const fx = game.effects;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = 4 + Math.random() * 9;
    const k = Math.sqrt(1 - u * u);
    _c.setHSL(0.06 + Math.random() * 0.06, 1, 0.55 + Math.random() * 0.2);
    fx.sparks.emit(pos.x, pos.y, pos.z, Math.cos(a) * k * s, u * s + 3, Math.sin(a) * k * s, _c, 0.35 + Math.random() * 0.4, 0.3 + Math.random() * 0.3, 6);
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    _c.setRGB(0.35, 0.33, 0.32);
    fx.debris.emit(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * s, 1 + Math.random() * 2.5, Math.sin(a) * s, _c, 1.4 + Math.random() * 0.8, 0.9 + Math.random() * 0.6, -0.4, 0.6);
  }
  fx.muzzle(pos, _n.set(0, 1, 0), 5, true);
  game.sound.play('explosion', pos, { range: 160 });
  const cam = game.camera.position;
  const cd = cam.distanceTo(pos);
  if (cd < 40) game.rig.shake = Math.min(1.2, game.rig.shake + (1 - cd / 40) * 0.9);
  for (const a of game.actors) {
    if (!a.alive || a.state === 'bus' || a === owner) continue;
    const d = a.chest(_pt).distanceTo(pos);
    if (d > radius) continue;
    const botVsBot = owner && !owner.isPlayer && !a.isPlayer ? 0.6 : 1;
    const shieldBefore = a.shield;
    const dealt = a.takeDamage(damage * (1 - 0.6 * (d / radius)) * botVsBot, owner, false);
    if (owner?.isPlayer) {
      fx.damageNumber(a.chest(_pt), dealt, false, shieldBefore > 0);
      game.hud?.hitMarker(false, !a.alive);
    }
  }
  for (const s of [...game.building.structures]) {
    const b = s.box;
    const dx = Math.max(b[0] - pos.x, 0, pos.x - b[1]), dy = Math.max(b[2] - pos.y, 0, pos.y - b[3]), dz = Math.max(b[4] - pos.z, 0, pos.z - b[5]);
    const d = Math.hypot(dx, dy, dz);
    if (d < radius) s.damage(structureDamage * (1 - 0.5 * (d / radius)), owner);
  }
}

// Impulse grenade: no damage, flings everyone nearby (including the thrower) away from the blast.
export function impulse(game, pos, radius, push) {
  const fx = game.effects;
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = 6 + Math.random() * 8;
    const k = Math.sqrt(1 - u * u);
    _c.setHSL(0.55 + Math.random() * 0.05, 1, 0.6 + Math.random() * 0.2);
    fx.sparks.emit(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * k * s, u * s * 0.6 + 2, Math.sin(a) * k * s, _c, 0.3 + Math.random() * 0.25, 0.3 + Math.random() * 0.2, 2);
  }
  game.sound.play('jumppad', pos, { range: 80 });
  const cd = game.camera.position.distanceTo(pos);
  if (cd < 25) game.rig.shake = Math.min(1, game.rig.shake + (1 - cd / 25) * 0.5);
  for (const a of game.actors) {
    if (!a.alive || a.state !== 'ground') continue;
    const dx = a.pos.x - pos.x, dz = a.pos.z - pos.z, dy = a.pos.y + 0.9 - pos.y;
    const d = Math.hypot(dx, dy, dz);
    if (d > radius) continue;
    const h = Math.hypot(dx, dz) || 1;
    const f = push * (1 - 0.5 * (d / radius));
    a.vel.x = (dx / h) * f;
    a.vel.z = (dz / h) * f;
    a.vel.y = Math.max(a.vel.y, 9 + f * 0.35);
    a.onGround = false;
    a.pos.y += 0.15;
  }
}
