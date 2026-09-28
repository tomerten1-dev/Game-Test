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
const _arcP = new THREE.Vector3(), _arcV = new THREE.Vector3();

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

  // charge (bows): 0..1 draw; a weak draw flies slower, drops more and hits softer
  fireWeapon(owner, weapon, from, dir, charge = 1) {
    const d = weapon.def, pr = d.projectile;
    const rocket = d.key === 'rocket';
    let kind = rocket ? 'rocket' : 'bullet', mesh, speed = pr.speed, damage = weapon.damage, gravity = pr.gravity;
    if (pr.arrow) {
      kind = 'bullet';
      const k = Math.max(0.15, charge);
      speed = pr.speed * (0.35 + 0.65 * k); damage = weapon.damage * (0.3 + 0.7 * k); gravity = pr.gravity * (1.6 - 0.6 * k);
      mesh = new THREE.Mesh(this.arrowGeo ||= new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5).rotateX(Math.PI / 2), this.arrowMat ||= new THREE.MeshStandardMaterial({ color: '#c9b08a', roughness: 0.6 }));
    } else if (pr.flare) {
      kind = 'flare';
      mesh = new THREE.Mesh(this.flareGeo ||= new THREE.SphereGeometry(0.12, 8, 6), this.flareMat ||= new THREE.MeshBasicMaterial({ color: '#ff5a2a' }));
    } else if (pr.bounce) {
      kind = 'glnade';
      mesh = new THREE.Mesh(this.glGeo ||= new THREE.SphereGeometry(0.1, 10, 8), this.glMat ||= new THREE.MeshStandardMaterial({ color: '#46553a', roughness: 0.5, emissive: '#ff3a1a', emissiveIntensity: 0.3 }));
    } else mesh = new THREE.Mesh(rocket ? this.rocketGeo : this.bulletGeo, rocket ? this.rocketMat : this.bulletMat);
    return this._add({
      kind, owner, weapon, damage, arrow: !!pr.arrow,
      pos: from.clone(), vel: dir.clone().multiplyScalar(speed), gravity,
      life: pr.fuse || d.range / speed + 0.5, explode: pr.explode, headMult: d.headMult || 1.5,
    }, mesh);
  }

  throwGrenade(owner, from, dir, kind = 'grenade') {
    const def = CONSUMABLES[kind] || CONSUMABLES.grenade;
    const vel = dir.clone().multiplyScalar(21);
    vel.y += 5;
    vel.x += owner.vel.x * 0.4; vel.z += owner.vel.z * 0.4;
    let mesh = makeThrowableMesh(kind);
    if (!mesh) { mesh = new THREE.Mesh(itemGeometry(kind === 'shockwave' ? 'shockwave' : 'grenade'), this.grenadeMat); mesh.scale.setScalar(1.3); }
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
    if (p.nade === 'gascan') { g.fire?.placeGasCan(pos, p.owner); return; }
    const G = g.gadgets;
    if (p.nade === 'bubble') { G.bubble(pos, p.owner); return; }
    if (p.nade === 'stormflip') { G.flip(pos.setY(pos.y + 0.5), p.owner); return; }
    if (p.nade === 'medmist') { G.splash('medmist', pos, p.owner); return; }
    if (p.nade === 'chugsplash') { G.chugSplash(pos, p.owner); return; }
    if (p.nade === 'portafort') { G.portaFort(pos, p.owner); return; }
    if (p.nade === 'goldfish') {
      // the Mythic Goldfish flops back onto the ground to be thrown again
      g.loot.spawnPickup({ type: 'consumable', ctype: 'goldfish', count: 1 }, pos.setY(pos.y + 0.3), new THREE.Vector3(0, 3, 0));
      return;
    }
    if (p.nade === 'crashpad') {
      g.events.addBouncePad(pos.x, g.world.groundAt(pos.x, pos.z, pos.y + 0.5, 0.5), pos.z, 'crash', p.owner);
      g.sound.play('bounce', pos, { range: 40 });
      return;
    }
    if (p.nade === 'smoke') {
      const s = { x: pos.x, y: pos.y + 1.2, z: pos.z, r: 0.5 };
      g.world.smokes.push(s);
      this.areas.push({ type: 'smoke', pos, smoke: s, r: def.radius, t: def.duration, dur: def.duration, emit: 0 });
      g.sound.play('bounce', pos, { range: 40 });
    } else if (p.nade === 'fire') {
      g.fire ? g.fire.ignite(pos, p.owner, { r: def.radius, dur: def.duration, dps: def.dps, gen: 0 }) : this.areas.push({ type: 'fire', pos, owner: p.owner, r: def.radius, t: def.duration, dur: def.duration, emit: 0, dps: def.dps, tick: 0 });
      g.sound.play('explosion', pos, { range: 60, vol: 0.5 });
    } else if (p.nade === 'impulse') {
      impulse(g, pos, def.radius, def.push);
    } else if (p.nade === 'shockwave') {
      impulse(g, pos, def.radius, def.push, true);
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
            if (a.owner?.isPlayer && act !== a.owner) { fx.damageNumber(act.chest(_pt), dealt, false, shieldBefore > 0, act); g.hud?.hitMarker(false, !act.alive); }
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

  // Blue arc showing where a held throwable would fly and land (same launch and gravity as
  // throwGrenade). Call every frame while aiming a throwable; it hides itself when not asked.
  showArc(owner, dir) {
    if (!this.arc) {
      const N = 180;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
      // round dots
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(16, 16, 13, 0, Math.PI * 2); cx.fill();
      const line = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#6cc4ff', size: 0.13, sizeAttenuation: true, map: new THREE.CanvasTexture(cv), alphaTest: 0.4, transparent: true, depthWrite: false }));
      line.frustumCulled = false;
      line.renderOrder = 5;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 28), new THREE.MeshBasicMaterial({ color: '#58b8ff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 5;
      this.game.scene.add(line, ring);
      this.arc = { line, ring, N, t: 0 };
    }
    const a = this.arc;
    a.t = 0.12;
    const pos = owner.chest(_arcP).addScaledVector(dir, 0.6);
    pos.y += 0.4;
    const vel = _arcV.copy(dir).multiplyScalar(21);
    vel.y += 5; vel.x += owner.vel.x * 0.4; vel.z += owner.vel.z * 0.4;
    const arr = a.line.geometry.attributes.position.array;
    let n = 0, landed = false;
    const h = 0.018;
    arr[0] = pos.x; arr[1] = pos.y; arr[2] = pos.z; n = 1;
    for (; n < a.N; n++) {
      _prev.copy(pos);
      vel.y -= 24 * h;
      const len = vel.length() * h;
      _dir.copy(vel).normalize();
      const r = this.game.combat.trace(_prev, _dir, len, owner, 0);
      if (r.hit) { pos.copy(_prev).addScaledVector(_dir, r.t); landed = true; }
      else pos.addScaledVector(_dir, len);
      arr[n * 3] = pos.x; arr[n * 3 + 1] = pos.y; arr[n * 3 + 2] = pos.z;
      if (landed) { n++; break; }
    }
    const skip = Math.min(8, Math.max(0, n - 2)); // not right at the hand, where the dots would be huge
    a.line.geometry.setDrawRange(skip, n - skip);
    a.line.geometry.attributes.position.needsUpdate = true;
    a.line.visible = true;
    a.ring.visible = landed;
    if (landed) a.ring.position.set(pos.x, pos.y + 0.05, pos.z);
  }

  update(dt) {
    if (this.arc && (this.arc.t -= dt) <= 0) { this.arc.line.visible = false; this.arc.ring.visible = false; }
    const g = this.game;
    this._updateAreas(dt);
    for (const p of [...this.list]) {
      p.life -= dt;
      if (p.kind === 'grenade' && p.life <= 0) { this._detonate(p); continue; }
      if (p.life <= 0) { if (p.kind === 'rocket' || p.kind === 'glnade') this._explode(p, p.pos); else if (p.kind === 'flare') this._flareLand(p, p.pos, null); else this._remove(p); continue; }
      if (!p.resting) this._step(p, dt);
      if (!p.alive) continue;
      // visuals
      const m = p.mesh;
      if (!m.parent) continue;
      m.position.copy(p.pos);
      if (p.kind === 'grenade') { p.spin += dt * 9; m.rotation.set(p.spin, p.spin * 0.7, 0); }
      else if (p.vel.lengthSq() > 1) m.quaternion.setFromUnitVectors(_fwd, _dir.copy(p.vel).normalize());
      if (p.kind === 'flare') {
        _c.set('#ff7a3a');
        g.effects.sparks.emit(p.pos.x, p.pos.y, p.pos.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), _c, 0.3, 0.35, 0);
      }
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
      const r = g.combat.trace(_prev, _dir, len, p.owner, p.kind === 'bullet' ? p.weapon?.def.projectile?.pad || 0 : 0);
      if (p.kind === 'bullet' && g.events.supplies.length && g.events.shootBalloon(_prev, _dir, r.hit ? r.t : len)) { this._remove(p); return; }
      if (!r.hit) {
        p.pos.addScaledVector(_dir, len);
        if (p.kind === 'bullet' && !p.arrow) g.effects.tracer(_prev, p.pos, '#fff2b0', 0.05);
        continue;
      }
      _pt.copy(_prev).addScaledVector(_dir, r.t);
      if (p.kind === 'bullet') { g.effects.tracer(_prev, _pt, '#fff2b0', 0.05); this._bulletHit(p, r, _pt); return; }
      if (p.kind === 'rocket') { this._explode(p, _pt.addScaledVector(_dir, -0.3)); return; }
      if (p.kind === 'flare') { this._flareLand(p, _pt.addScaledVector(_dir, -0.2), r); return; }
      // launcher grenades go off when they hit a player, otherwise bounce until the fuse runs out
      if (p.kind === 'glnade' && r.actor) { this._explode(p, _pt); return; }
      // shockwaves go off on impact; other throwables bounce
      if (p.def?.impact) {
        if (p.nade === 'goldfish' && r.actor) {
          const t = r.actor, shieldBefore = t.shield;
          const dealt = t.takeDamage(p.def.damage * (!p.owner?.isPlayer && !t.isPlayer ? 0.45 : 1), p.owner, false);
          if (p.owner?.isPlayer) { g.effects.damageNumber(_pt, dealt, false, shieldBefore > 0, t); g.hud?.hitMarker(false, !t.alive, shieldBefore > 0); g.sound.play('hit'); }
        } else if (p.nade === 'goldfish' && r.collider?.structure) r.collider.structure.damage(p.def.damage, p.owner);
        p.pos.copy(_pt).addScaledVector(_dir, -0.2); this._detonate(p); return;
      }
      this._normal(r, _pt, _n);
      p.pos.copy(_pt).addScaledVector(_n, 0.08);
      const vn = p.vel.dot(_n);
      p.vel.addScaledVector(_n, -1.6 * vn).multiplyScalar(0.5);
      if (p.vel.length() > 3) g.sound.play('bounce', p.pos, { range: 30 });
      if (p.kind === 'glnade') { if (_n.y > 0.6 && p.vel.length() < 2) p.vel.set(0, 0, 0); return; }
      if (_n.y > 0.6 && p.vel.length() < 2) { p.resting = true; p.vel.set(0, 0, 0); }
      return;
    }
  }

  // Approximate surface normal at a hit (terrain, boxes, cylinders, slopes).
  _normal(r, pt, out) {
    const w = this.game.world;
    if (r.terrain || !r.collider) return out.copy(w.terrain.normalAt(pt.x, pt.z));
    const c = r.collider;
    if (c.bubble) return out.copy(_dir).negate();
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
      const dealt = target.takeDamage(p.damage * (r.head ? p.headMult * (g.overrides?.has('headshot') ? 1.25 : 1) : 1) * botVsBot, owner, r.head);
      g.effects.hitSparks(pt, r.head ? '#ffd23f' : shieldBefore > 0 ? '#6cc4ff' : '#ffffff');
      if (owner.isPlayer) {
        g.meta?.track('hit', 1, r.head);
        g.effects.damageNumber(pt, dealt, r.head, shieldBefore > 0, target);
        g.hud?.hitMarker(r.head, !target.alive);
        g.sound.play(r.head ? 'headshot' : shieldBefore > 0 ? 'shieldHit' : 'hit');
      }
    } else {
      const c = r.collider;
      g.effects.impact(pt, c?.structure ? (c.structure.mat === 'wood' ? 'wood' : 'stone') : c ? 'stone' : 'terrain', _n.copy(_dir).negate());
      if (c?.structure) { c.structure.damage(p.damage, owner); if (owner?.isPlayer && c.structure.owner !== owner) g.meta?.track('buildDamage', p.damage); }
      else if (c?.breakable) g.combat.damageProp(c, p.damage, owner);
      else if (c?.part) c.part.damage(p.damage, owner);
      else if (c?.obj) g.world.destructibles.damage(c, p.damage, owner);
      if (owner?.isPlayer) g.hud?.objHp?.(c, pt);
    }
    this._remove(p);
  }

  // Flare: a small hit, then the spot catches fire (and wooden builds, grass and trees nearby).
  _flareLand(p, at, r) {
    const g = this.game, pos = at.clone();
    this._remove(p);
    if (r?.actor) {
      const t = r.actor, shieldBefore = t.shield;
      const dealt = t.takeDamage(p.damage * (!p.owner?.isPlayer && !t.isPlayer ? 0.45 : 1), p.owner, false);
      if (p.owner?.isPlayer) { g.effects.damageNumber(pos, dealt, false, shieldBefore > 0, t); g.hud?.hitMarker(false, !t.alive, shieldBefore > 0); }
    }
    if (r?.collider?.structure) g.fire?.igniteStructure(r.collider.structure, p.owner);
    if (r?.collider?.obj) g.fire?.igniteTree(r.collider, p.owner);
    g.fire?.ignite(pos, p.owner, { r: 2.6, dur: 7, gen: 0 });
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
      fx.damageNumber(a.chest(_pt), dealt, false, shieldBefore > 0, a);
      game.hud?.hitMarker(false, !a.alive);
    }
  }
  for (const c of game.world.colliders.query(pos.x - radius, pos.x + radius, pos.z - radius, pos.z + radius, [])) {
    if (c.breakable && !c.breakable.broken) { c.breakable.lastHit ||= owner; game.world.towns.breakProp(c, game); }
    if (c.obj && !c.obj.dead && Math.hypot(c.x - pos.x, c.z - pos.z) < radius + c.r) game.world.destructibles.damage(c, (structureDamage || damage) * 0.6, owner);
  }
  game.homes?.explode(pos, radius, structureDamage || damage);
  for (const s of [...game.building.structures]) {
    const b = s.box;
    const dx = Math.max(b[0] - pos.x, 0, pos.x - b[1]), dy = Math.max(b[2] - pos.y, 0, pos.y - b[3]), dz = Math.max(b[4] - pos.z, 0, pos.z - b[5]);
    const d = Math.hypot(dx, dy, dz);
    if (d < radius) s.damage(structureDamage * (1 - 0.5 * (d / radius)), owner);
  }
}

// Impulse grenade: no damage, flings everyone nearby (including the thrower) away from the blast.
export function impulse(game, pos, radius, push, shockwave = false) {
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
    a.vel.y = Math.max(a.vel.y, shockwave ? 14 + f * 0.4 : 9 + f * 0.35);
    a.onGround = false;
    a.pos.y += 0.15;
    if (shockwave) { a.noFallT = 6; a.flungT = 2.5; } // shockwaves carry you far and never cause fall damage
  }
}
