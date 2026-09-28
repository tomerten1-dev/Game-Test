import * as THREE from 'three';
import { WATER_LEVEL, WORLD_HALF } from './Terrain.js';
import { mulberry32 } from '../core/noise.js';
import { Weapon } from '../weapons/Weapon.js';
import { rollWeaponType } from '../weapons/WeaponDefs.js';
import { CONSUMABLES } from '../weapons/Items.js';
import { GRID, HEIGHT } from './Building.js';

const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _oc = new THREE.Vector3();

// Fortnite gadgets and utility items that live in the world for a while: Shield Bubbles, Storm Flips,
// healing mists / Flowberry splashes, Port-a-Forts, SOS flares and fishing (spots, bobber, catches).
export class Gadgets {
  constructor(game) {
    this.game = game;
    this.bubbles = [];
    this.flips = [];
    this.splashes = []; // mist / fizz areas
    this.casts = new Map(); // actor -> fishing cast
    this._makeSpots();
  }

  // ---------- Shield Bubble: a dome that stops every shot crossing it, both ways ----------
  bubble(pos, owner) {
    const def = CONSUMABLES.bubble, g = this.game;
    const y = g.world.groundAt(pos.x, pos.z, pos.y + 0.5, 0.3);
    this.bubbleMat ||= new THREE.MeshStandardMaterial({ color: '#8fe3ff', emissive: '#3aa8ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.22, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(this.domeGeo ||= new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), this.bubbleMat);
    mesh.position.set(pos.x, y, pos.z);
    mesh.scale.setScalar(0.1);
    mesh.renderOrder = 4;
    g.scene.add(mesh);
    this.bubbles.push({ c: new THREE.Vector3(pos.x, y, pos.z), r: def.radius, t: def.duration, mesh, grow: 0, owner });
    g.sound.play('jumppad', pos, { range: 50 });
  }

  // Distance along a ray to the first bubble wall it crosses (Infinity when none).
  rayBlock(o, d, maxT) {
    let best = Infinity;
    for (const b of this.bubbles) {
      const r = b.r * Math.min(1, b.grow);
      _oc.copy(o).sub(b.c);
      const bq = _oc.dot(d), cq = _oc.lengthSq() - r * r;
      const disc = bq * bq - cq;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      // inside: the exit point; outside: the entry point (only the dome above the ground)
      const t = cq < 0 ? -bq + sq : -bq - sq;
      if (t < 0.02 || t > maxT || t > best) continue;
      if (o.y + d.y * t < b.c.y - 0.2) continue;
      best = t;
    }
    return best;
  }

  // ---------- Storm Flip ----------
  flip(pos, owner) {
    const def = CONSUMABLES.stormflip, g = this.game;
    const inStorm = !g.storm.isInside(pos.x, pos.z);
    const mat = new THREE.MeshStandardMaterial({ color: inStorm ? '#7fd8ff' : '#c05cff', emissive: inStorm ? '#3aa8ff' : '#8a2be2', emissiveIntensity: 0.5, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(this.flipGeo ||= new THREE.SphereGeometry(1, 28, 16), mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.1);
    g.scene.add(mesh);
    this.flips.push({ c: pos.clone(), r: def.radius, t: def.duration + 2, mesh, grow: 0, safe: inStorm, owner });
    g.sound.play('phase', pos, { range: 60 });
  }

  // 'safe' inside a flipped bubble in the storm, 'storm' inside a flip thrown in the safe zone.
  stormAt(p) {
    for (const f of this.flips) {
      const r = f.r * Math.min(1, f.grow / 2);
      if ((p.x - f.c.x) ** 2 + (p.y + 1 - f.c.y) ** 2 + (p.z - f.c.z) ** 2 < r * r) return f.safe ? 'safe' : 'storm';
    }
    return null;
  }

  // ---------- healing splashes ----------
  // Med-Mist: +10 health a second in the cloud. Flowberry Fizz: +5 shield every half second and low gravity.
  splash(kind, pos, owner) {
    const def = CONSUMABLES[kind === 'fizz' ? 'flowberry' : kind];
    this.splashes.push({ kind, c: pos.clone(), r: kind === 'fizz' ? 4 : def.radius, t: kind === 'fizz' ? 3 : def.duration, tick: 0, emit: 0, owner });
    this.game.sound.play(kind === 'fizz' ? 'shield' : 'heal', pos, { range: 30 });
  }

  fizz(a) { this.splash('fizz', a.pos, a); }

  chugSplash(pos, owner) {
    const g = this.game, r = CONSUMABLES.chugsplash.radius;
    for (const a of g.actors) {
      if (!a.alive || a.state === 'bus' || a.pos.distanceTo(pos) > r + 0.8) continue;
      let give = 20;
      const h = Math.min(give, 100 - a.health); a.health += h; give -= h;
      a.shield = Math.min(100, a.shield + give);
      if (a.isPlayer) g.hud?.pickupNote?.('+20 Chug Splash', '#39d0ff');
    }
    for (let i = 0; i < 40; i++) {
      const an = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
      _c.set(i % 2 ? '#39d0ff' : '#9ff4ff');
      g.effects.sparks.emit(pos.x, pos.y + 0.3, pos.z, Math.cos(an) * s, 2 + Math.random() * 3, Math.sin(an) * s, _c, 0.4, 0.5, 8);
    }
    g.sound.play('shield', pos, { range: 30 });
  }

  // ---------- Port-a-Fort: a three-storey metal tower with a bounce tire inside ----------
  portaFort(pos, owner) {
    const g = this.game, B = g.building;
    if (g.zeroBuild) { this.bubble(pos, owner); return; } // no builds in Zero Build: a bubble instead
    const H = HEIGHT;
    const cx = Math.floor(pos.x / GRID) * GRID + GRID / 2, cz = Math.floor(pos.z / GRID) * GRID + GRID / 2;
    const ground = Math.min(...[[-GRID / 2, -GRID / 2], [GRID / 2, -GRID / 2], [-GRID / 2, GRID / 2], [GRID / 2, GRID / 2], [0, 0]].map(([dx, dz]) => g.world.heightAt(cx + dx, cz + dz)));
    const base = Math.max(ground - 0.3, WATER_LEVEL - 1);
    const who = owner || g.player;
    const saved = { ...who.mats };
    who.mats.metal = 10000;
    const plans = [B.floorUnder({ cx, cz, y0: base })];
    for (let k = 0; k < 4; k++) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plans.push(B.edgeWallPlan(cx, cz, dx, dz, base + k * H));
    }
    plans.push(B.floorUnder({ cx, cz, y0: base + 3 * H }));
    const oldState = who.state;
    who.state = 'ground';
    for (const pl of plans) {
      const st = B.build(who, pl, 'metal');
      if (st) { st.hp = st.maxHp; st.buildT = st.buildTime; st.mesh.material.transparent = false; st.mesh.material.opacity = 1; st.mesh.material.needsUpdate = true; }
    }
    who.state = oldState;
    Object.assign(who.mats, saved);
    // the tire in the middle bounces you onto the top floor
    g.events.addBouncePad(cx, base + 0.05, cz, 'tire', owner);
    g.sound.play('build', pos, { range: 60 });
  }

  // ---------- SOS flare: a supply drop comes down on you ----------
  sos(a) {
    const g = this.game;
    for (let i = 0; i < 30; i++) {
      _c.set(i % 2 ? '#ff4a3a' : '#ffd23f');
      g.effects.sparks.emit(a.pos.x, a.pos.y + 2 + i * 1.5, a.pos.z, (Math.random() - 0.5) * 0.6, 3, (Math.random() - 0.5) * 0.6, _c, 1.2, 0.5, 0);
    }
    g.sound.play('launch', a.isPlayer ? null : a.pos, { range: 120 });
    const s = g.events._spawnSupply({ x: a.pos.x + 3, z: a.pos.z + 3 });
    if (s) { s.y = s.ground + 60; s.group.position.y = s.y; }
    if (a.isPlayer) g.hud?.banner?.('SOS sent · a supply drop is coming to you', 3);
  }

  // ---------- fishing ----------
  _makeSpots() {
    const g = this.game, T = g.world.terrain, rnd = mulberry32(9191);
    this.spots = [];
    for (let i = 0; i < 12000 && this.spots.length < 40; i++) {
      const x = (rnd() * 2 - 1) * (WORLD_HALF - 30), z = (rnd() * 2 - 1) * (WORLD_HALF - 30);
      const h = T.heightAt(x, z);
      if (h > -1 || h < -4) continue;
      // near land so you can reach it from the shore
      let shore = false;
      for (let k = 0; k < 8 && !shore; k++) { const a = (k / 8) * Math.PI * 2; if (T.heightAt(x + Math.cos(a) * 10, z + Math.sin(a) * 10) > 1.2) shore = true; }
      if (!shore || this.spots.some((s) => Math.hypot(s.x - x, s.z - z) < 40)) continue;
      this.spots.push({ x, z, left: 3, ring: null });
    }
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.7, depthWrite: false });
    for (const s of this.spots) {
      const grp = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.6 + k * 0.5, 0.72 + k * 0.5, 24), this.ringMat);
        r.rotation.x = -Math.PI / 2; r.userData.k = k;
        grp.add(r);
      }
      grp.position.set(s.x, WATER_LEVEL + 0.05, s.z);
      g.scene.add(grp);
      s.ring = grp;
    }
  }

  // Cast (or reel in) with the held rod. Returns a message for the player, or null.
  useRod(a, origin, dir) {
    const g = this.game;
    const c = this.casts.get(a);
    if (c) { this._reel(a, c); return null; }
    // where the line lands: the aim ray meets the water within 24 m
    let hit = null;
    if (dir.y < -0.02) {
      const t = (origin.y - WATER_LEVEL) / -dir.y;
      if (t < 34) {
        _v.copy(origin).addScaledVector(dir, t);
        if (Math.hypot(_v.x - a.pos.x, _v.z - a.pos.z) < 24 && g.world.terrain.heightAt(_v.x, _v.z) < WATER_LEVEL - 0.4) hit = _v.clone();
      }
    }
    if (!hit) return 'Aim at water to cast';
    const spot = this.spots.find((s) => s.left > 0 && Math.hypot(s.x - hit.x, s.z - hit.z) < 3.5);
    this.bobberGeo ||= new THREE.SphereGeometry(0.1, 10, 8);
    this.bobberMat ||= new THREE.MeshStandardMaterial({ color: '#ff4a3a', roughness: 0.4 });
    const bob = new THREE.Mesh(this.bobberGeo, this.bobberMat);
    bob.position.copy(hit);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.pos, hit]), this.lineMat ||= new THREE.LineBasicMaterial({ color: '#f0f0f0' }));
    line.frustumCulled = false;
    g.scene.add(bob, line);
    this.casts.set(a, { at: hit, spot, bob, line, wait: spot ? 1 + Math.random() * 2.5 : 2 + Math.random() * 5, bite: 0, t: 0 });
    g.sound.play('throw', a.isPlayer ? null : a.pos, { range: 30 });
    return null;
  }

  _reel(a, c, silent = false) {
    const g = this.game;
    g.scene.remove(c.bob, c.line);
    c.line.geometry.dispose();
    this.casts.delete(a);
    if (silent) return;
    if (c.bite <= 0) { if (a.isPlayer) g.hud?.toast?.(c.wait > 0 ? 'Too early' : 'It got away'); return; }
    const item = this._catch(!!c.spot || !!g.overrides?.has('bigfish'));
    if (c.spot && --c.spot.left <= 0) c.spot.ring.visible = false;
    g.loot.spawnPickup(item, c.at.clone().setY(WATER_LEVEL + 0.3), new THREE.Vector3((a.pos.x - c.at.x) * 0.6, 7, (a.pos.z - c.at.z) * 0.6));
    g.sound.play('pickup', a.isPlayer ? null : a.pos);
    if (a.isPlayer) g.meta?.track?.('fish');
  }

  _catch(spot) {
    const r = Math.random();
    const fishT = spot
      ? [['flopper', 25], ['shieldfish', 18], ['slurpfish', 16], ['spicyfish', 10], ['smallfry', 6], ['goldfish', 1.5], ['weapon', 22], ['gold', 1.5]]
      : [['smallfry', 34], ['flopper', 30], ['shieldfish', 10], ['slurpfish', 6], ['spicyfish', 8], ['weapon', 8], ['gold', 4]];
    let k = r * fishT.reduce((s, x) => s + x[1], 0), pick = fishT[0][0];
    for (const [t, w] of fishT) if ((k -= w) <= 0) { pick = t; break; }
    if (pick === 'weapon') {
      const w = new Weapon(rollWeaponType(spot ? 'chest' : 'floor'), spot ? 2 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2)).withRandomMods();
      return { type: 'weapon', weapon: w };
    }
    if (pick === 'gold') return { type: 'gold', amount: 50 };
    return { type: 'consumable', ctype: pick, count: 1 };
  }

  update(dt) {
    const g = this.game, fx = g.effects, now = g.time;
    for (const b of [...this.bubbles]) {
      b.grow = Math.min(1, b.grow + dt * 2.5);
      b.t -= dt;
      const s = b.r * (b.t < 0.6 ? Math.max(0.01, b.t / 0.6) : b.grow);
      b.mesh.scale.setScalar(s);
      if (b.t <= 0) { g.scene.remove(b.mesh); this.bubbles.splice(this.bubbles.indexOf(b), 1); }
    }
    for (const f of [...this.flips]) {
      f.grow += dt;
      f.t -= dt;
      const s = f.r * (f.t < 0.8 ? Math.max(0.01, f.t / 0.8) : Math.min(1, f.grow / 2));
      f.mesh.scale.setScalar(s);
      f.mesh.material.opacity = 0.16 + 0.06 * Math.sin(now * 4);
      if (f.t <= 0) { g.scene.remove(f.mesh); f.mesh.material.dispose(); this.flips.splice(this.flips.indexOf(f), 1); }
    }
    for (const a of [...this.splashes]) {
      a.t -= dt;
      a.emit += dt * 30;
      for (; a.emit >= 1; a.emit--) {
        const an = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * a.r;
        _c.set(a.kind === 'fizz' ? (Math.random() < 0.5 ? '#ff6fd0' : '#6fd0ff') : '#7dffb2');
        fx.debris.emit(a.c.x + Math.cos(an) * d, a.c.y + 0.3 + Math.random() * 1.2, a.c.z + Math.sin(an) * d, 0, 0.6, 0, _c, 1.2, 1.1, -0.2, 0.45);
      }
      if ((a.tick -= dt) <= 0) {
        a.tick = 0.5;
        for (const act of g.actors) {
          if (!act.alive || act.state === 'bus' || (act.pos.x - a.c.x) ** 2 + (act.pos.z - a.c.z) ** 2 > a.r * a.r || Math.abs(act.pos.y - a.c.y) > 3) continue;
          if (a.kind === 'fizz') { act.shield = Math.min(100, act.shield + 5); act.lowGravT = 10; }
          else act.health = Math.min(100, act.health + 5);
        }
      }
      if (a.t <= 0) this.splashes.splice(this.splashes.indexOf(a), 1);
    }
    // fishing spots bubble; casts wait for a bite
    for (const s of this.spots) {
      if (!s.ring.visible) continue;
      for (const r of s.ring.children) { const k = ((now * 0.6 + r.userData.k / 3) % 1); r.scale.setScalar(0.6 + k * 1.2); }
    }
    for (const [a, c] of this.casts) {
      if (!a.alive || a.held?.def?.rod !== true || a.pos.distanceTo(c.at) > 30) { this._reel(a, c, true); continue; }
      c.t += dt;
      const tip = a.muzzleWorld ? a.muzzleWorld(_v) : _v.copy(a.pos).setY(a.pos.y + 1.5);
      const pos = c.line.geometry.attributes.position;
      pos.setXYZ(0, tip.x, tip.y, tip.z); pos.setXYZ(1, c.bob.position.x, c.bob.position.y, c.bob.position.z); pos.needsUpdate = true;
      if (c.wait > 0) {
        c.wait -= dt;
        c.bob.position.y = WATER_LEVEL + 0.05 + Math.sin(c.t * 3) * 0.03;
        if (c.wait <= 0) { c.bite = 1.3; g.sound.play('bounce', a.isPlayer ? null : c.at, { range: 30 }); if (a.isPlayer) g.hud?.toast?.('Bite! Reel it in'); }
      } else if (c.bite > 0) {
        c.bite -= dt;
        c.bob.position.y = WATER_LEVEL - 0.15 + Math.sin(c.t * 18) * 0.05;
        if (Math.random() < dt * 20) { _c.set('#e8f8ff'); fx.debris.emit(c.at.x, WATER_LEVEL + 0.1, c.at.z, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, _c, 0.3, 0.4, 6); }
        if (c.bite <= 0) { c.wait = 2 + Math.random() * 4; } // it got away; wait for the next one
      }
    }
  }

  reset() {
    for (const b of this.bubbles) this.game.scene.remove(b.mesh);
    for (const f of this.flips) this.game.scene.remove(f.mesh);
    for (const [a, c] of this.casts) this._reel(a, c, true);
    this.bubbles = []; this.flips = []; this.splashes = [];
    for (const s of this.spots) { s.left = 3; s.ring.visible = true; }
  }
}

