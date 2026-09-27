import * as THREE from 'three';
import { explode } from '../weapons/Projectiles.js';

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const MAX_GROUND = 36; // most ground fires burning at once
const MAX_GEN = 3; // how many times a grass fire can hop on

// Fire that spreads (Fortnite): flames catch on wooden builds, grass and trees, and jump to
// neighbouring wood. Ground fires are the Projectiles' 'fire' areas (they burn whoever stands in them);
// this adds burning builds and trees, grass spread, and fuel barrels / gas cans that explode.
export class Fire {
  constructor(game) {
    this.game = game;
    this.builds = new Map(); // structure -> { t, owner, tick, emit }
    this.trees = new Map(); // tree collider -> { t, owner, tick, emit }
    this.blasts = []; // delayed explosions (barrel chains go off one after another)
    this.cans = []; // gas cans set down by players
  }

  // A thrown gas can sits where it lands until something shoots, burns or blows it up.
  placeGasCan(pos, owner) {
    const g = this.game;
    const y = g.world.groundAt(pos.x, pos.z, pos.y + 0.6, 0.3);
    if (!this.canGeo) {
      this.canGeo = new THREE.BoxGeometry(0.32, 0.42, 0.18);
      this.canMat = new THREE.MeshStandardMaterial({ color: '#d4291f', roughness: 0.45, metalness: 0.3 });
      this.capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8);
      this.capMat = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5 });
    }
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(this.canGeo, this.canMat); body.position.y = 0.21; body.castShadow = true;
    const cap = new THREE.Mesh(this.capGeo, this.capMat); cap.position.set(0.1, 0.46, 0);
    mesh.add(body, cap);
    mesh.position.set(pos.x, y, pos.z);
    mesh.rotation.y = Math.random() * Math.PI;
    g.scene.add(mesh);
    const col = { kind: 'circle', x: pos.x, z: pos.z, r: 0.3, y0: y, y1: y + 0.5, crate: true, breakable: { type: 'gascan', idx: [], hp: 1, loot: 0, explosive: true, blastDmg: 90, mesh, lastHit: owner } };
    g.world.colliders.add(col);
    this.cans.push(col);
  }

  get grounds() { return this.game.projectiles.areas.filter((a) => a.type === 'fire'); }

  // A patch of burning ground. gen counts hops from the first flame.
  ignite(pos, owner, { r = 2.4, dur = 6, dps = 14, gen = 0 } = {}) {
    const P = this.game.projectiles;
    if (this.grounds.length >= MAX_GROUND) return null;
    const a = { type: 'fire', pos: pos.clone(), owner, r, t: dur, dur, emit: 0, dps, tick: 0, gen, spreadT: 1 + Math.random() };
    P.areas.push(a);
    return a;
  }

  igniteStructure(st, owner) {
    if (!st || st.mat !== 'wood' || st.dead || this.builds.has(st)) return;
    this.builds.set(st, { t: 7, owner, tick: 0.5, emit: 0 });
  }

  igniteTree(col, owner) {
    if (!col?.obj || col.obj.kind !== 'tree' || col.obj.dead || this.trees.has(col)) return;
    this.trees.set(col, { t: 9, owner, tick: 0.5, emit: 0 });
  }

  isGrass(x, z) {
    const T = this.game.world.terrain;
    const y = T.heightAt(x, z);
    if (y < 2.6 || y > 30) return false;
    return T.sampleGrid(T.grass, x, z) > 0.35 && T.normalAt(x, z).y > 0.8;
  }

  // Fuel barrels and gas cans: a delayed blast (so a row of barrels goes off in a chain) plus fire.
  blast(pos, owner, damage = 80, radius = 5.5) {
    this.blasts.push({ pos: pos.clone(), owner, damage, radius, t: 0.12 + Math.random() * 0.1 });
  }

  update(dt) {
    const g = this.game, fx = g.effects;
    for (const b of [...this.blasts]) {
      if ((b.t -= dt) > 0) continue;
      this.blasts.splice(this.blasts.indexOf(b), 1);
      explode(g, b.pos, b.owner, b.damage, b.radius, 260);
      this.ignite(b.pos, b.owner, { r: 3.2, dur: 6, gen: 1 });
    }
    // ground fires: hop onto nearby grass, catch trees and wooden builds they touch
    for (const a of this.grounds) {
      if (a.spreadT === undefined || (a.spreadT -= dt) > 0) continue;
      a.spreadT = 1.2 + Math.random() * 0.8;
      if (a.gen < MAX_GEN && a.t > 1.5 && Math.random() < 0.55) {
        const ang = Math.random() * Math.PI * 2, d = a.r + 0.6 + Math.random() * 1.4;
        const x = a.pos.x + Math.cos(ang) * d, z = a.pos.z + Math.sin(ang) * d;
        if (this.isGrass(x, z) && !this.grounds.some((o) => (o.pos.x - x) ** 2 + (o.pos.z - z) ** 2 < 2.5 * 2.5)) {
          this.ignite(_v.set(x, g.world.terrain.heightAt(x, z) + 0.05, z), a.owner, { r: 2 + Math.random() * 0.6, dur: 5 + Math.random() * 2, dps: a.dps, gen: a.gen + 1 });
        }
      }
      for (const c of g.world.colliders.query(a.pos.x - a.r, a.pos.x + a.r, a.pos.z - a.r, a.pos.z + a.r, [])) {
        if (c.obj?.kind === 'tree' && Math.hypot(c.x - a.pos.x, c.z - a.pos.z) < a.r + (c.r || 0.5)) this.igniteTree(c, a.owner);
        if (c.structure && c.structure.mat === 'wood' && c.y0 < a.pos.y + 2 && Math.random() < 0.6) this.igniteStructure(c.structure, a.owner);
        if (c.breakable?.explosive && !c.breakable.broken) { c.breakable.lastHit = a.owner; g.world.towns.breakProp(c, g); }
      }
    }
    // burning builds: lose HP over time and set neighbouring wood alight
    for (const [st, f] of this.builds) {
      const b = st.box;
      if (st.dead || !g.building.structures.includes(st)) { this.builds.delete(st); continue; }
      f.t -= dt;
      f.emit += dt * 30;
      for (; f.emit >= 1; f.emit--) {
        _c.setHSL(0.02 + Math.random() * 0.06, 1, 0.5 + Math.random() * 0.15);
        fx.sparks.emit(b[0] + Math.random() * (b[1] - b[0]), b[2] + Math.random() * (b[3] - b[2]), b[4] + Math.random() * (b[5] - b[4]),
          (Math.random() - 0.5) * 0.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.5, _c, 0.45 + Math.random() * 0.4, 0.5 + Math.random() * 0.4, -1);
      }
      if ((f.tick -= dt) <= 0) {
        f.tick = 0.5;
        st.damage(10, f.owner);
        if (Math.random() < 0.3) {
          for (const o of g.building.structures) {
            if (o === st || o.mat !== 'wood' || this.builds.has(o)) continue;
            const q = o.box;
            if (q[0] <= b[1] + 0.4 && q[1] >= b[0] - 0.4 && q[2] <= b[3] + 0.4 && q[3] >= b[2] - 0.4 && q[4] <= b[5] + 0.4 && q[5] >= b[4] - 0.4) { this.igniteStructure(o, f.owner); break; }
          }
        }
      }
      if (f.t <= 0) this.builds.delete(st);
    }
    // burning trees: flames up the trunk, drop fire at the foot, then fall
    for (const [c, f] of this.trees) {
      if (c.obj.dead) { this.trees.delete(c); continue; }
      f.t -= dt;
      f.emit += dt * 40;
      const h = (c.y1 ?? c.y0 + 6) - c.y0;
      for (; f.emit >= 1; f.emit--) {
        _c.setHSL(0.02 + Math.random() * 0.06, 1, 0.5 + Math.random() * 0.15);
        const rr = (c.r || 0.5) * 2.5 * Math.random(), an = Math.random() * Math.PI * 2;
        fx.sparks.emit(c.x + Math.cos(an) * rr, c.y0 + 1 + Math.random() * h, c.z + Math.sin(an) * rr, (Math.random() - 0.5) * 0.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.5, _c, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, -1);
      }
      if ((f.tick -= dt) <= 0) {
        f.tick = 0.5;
        g.world.destructibles.damage(c, 18, f.owner);
        if (Math.random() < 0.12) this.ignite(_v.set(c.x + (Math.random() - 0.5) * 3, g.world.terrain.heightAt(c.x, c.z) + 0.05, c.z + (Math.random() - 0.5) * 3), f.owner, { r: 2.2, dur: 5, gen: 1 });
      }
      if (f.t <= 0) this.trees.delete(c);
    }
  }

  reset() {
    this.builds.clear(); this.trees.clear(); this.blasts = [];
    for (const c of this.cans) { c.breakable.mesh.parent?.remove(c.breakable.mesh); if (!c.breakable.broken) this.game.world.colliders.remove(c); }
    this.cans = [];
  }
}
