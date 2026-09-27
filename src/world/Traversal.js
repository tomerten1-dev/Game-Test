import * as THREE from 'three';
import { TOWNS, MOUNTAIN } from './Terrain.js';
import { mulberry32 } from '../core/noise.js';

// Ways to get around the island (Fortnite-style):
//  - lookout towers on hills with a ladder (walk into it to climb) and a zipline down from the top
//  - ziplines: interact to grab on, ride along the cable (forward / back), jump to let go; no fall
//    damage until you land
//  - an ascender up the Rusty Works smokestack: interact to ride it to the catwalk
//  - hot air balloons: step into the basket and ride it up and down

const ZIP_SPEED = 17, ASC_SPEED = 11, LADDER_SPEED = 4.6;
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Traversal {
  constructor(scene, terrain, colliders, towns) {
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    this.towns = towns;
    this.ladders = [];   // { x, z, nx, nz, y0, y1 } (n points away from the wall)
    this.zips = [];      // { a: Vector3, b: Vector3, sag }
    this.ascenders = []; // { x, z, y0, y1, top: { x, z } }
    this.balloons = [];
    const r = mulberry32(555);
    this.wood = new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.85 });
    this.metal = new THREE.MeshStandardMaterial({ color: '#5b6470', roughness: 0.5, metalness: 0.5 });
    this.cable = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.4, metalness: 0.6 });
    this._towers(r);
    for (const s of towns.smoke || []) this._stackAscender(s);
    this._balloons(r);
  }

  _mesh(geo, mat, x, y, z, parent = this.scene) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  _clearOf(x, z, pad) {
    for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return false;
    if (Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < MOUNTAIN.r * 0.7) return false;
    for (const h of this.towns.houses) if (x > h.minX - pad && x < h.maxX + pad && z > h.minZ - pad && z < h.maxZ + pad) return false;
    return true;
  }

  // Wooden lookout towers on hills: ladder up one side, zipline from the top down the slope.
  _towers(r) {
    const spots = [];
    for (let i = 0; i < 900 && spots.length < 4; i++) {
      const a = r() * Math.PI * 2, d = 50 + r() * 230;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (h < 6 || h > 34 || this.terrain.normalAt(x, z).y < 0.93) continue;
      if (!this._clearOf(x, z, 14) || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 90)) continue;
      spots.push({ x, z, h });
    }
    const H = 12, S = 2.2; // platform height and half-size
    for (const { x, z, h } of spots) {
      const top = h + H;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        this._mesh(new THREE.CylinderGeometry(0.16, 0.2, H + 1.2, 6), this.wood, x + sx * (S - 0.2), h + (H + 1.2) / 2 - 0.6, z + sz * (S - 0.2));
        this.colliders.add({ kind: 'circle', x: x + sx * (S - 0.2), z: z + sz * (S - 0.2), r: 0.2, y0: h - 1, y1: top, crate: true, mat: 'wood' });
      }
      for (const yy of [h + H * 0.35, h + H * 0.7]) {
        this._mesh(new THREE.BoxGeometry(S * 2, 0.14, 0.14), this.wood, x, yy, z - S + 0.2);
        this._mesh(new THREE.BoxGeometry(S * 2, 0.14, 0.14), this.wood, x, yy, z + S - 0.2);
      }
      // deck + railing (open on the ladder side and the zipline side)
      this._mesh(new THREE.BoxGeometry(S * 2 + 0.3, 0.3, S * 2 + 0.3), this.wood, x, top - 0.15, z);
      this.colliders.add({ kind: 'box', minX: x - S - 0.15, maxX: x + S + 0.15, minZ: z - S - 0.15, maxZ: z + S + 0.15, y0: top - 0.3, y1: top, crate: true, mat: 'wood' });
      for (const [rx, rz, w, d] of [[0, -S, S * 2, 0.1], [-S, 0, 0.1, S * 2]]) {
        this._mesh(new THREE.BoxGeometry(w, 1.0, d), this.wood, x + rx, top + 0.5, z + rz);
        this.colliders.add({ kind: 'box', minX: x + rx - w / 2, maxX: x + rx + w / 2, minZ: z + rz - d / 2, maxZ: z + rz + d / 2, y0: top, y1: top + 1.0, crate: true, mat: 'wood' });
      }
      this._mesh(new THREE.ConeGeometry(S * 1.7, 1.6, 4), new THREE.MeshStandardMaterial({ color: '#b5463a', roughness: 0.8 }), x, top + 3.4, z).rotation.y = Math.PI / 4;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this._mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5), this.wood, x + sx * (S - 0.2), top + 1.3, z + sz * (S - 0.2));
      // ladder on the +z side
      const lz = z + S + 0.12;
      for (const sx of [-0.35, 0.35]) this._mesh(new THREE.BoxGeometry(0.08, H + 1, 0.08), this.wood, x + sx, h + (H + 1) / 2, lz);
      for (let y = h + 0.4; y < top; y += 0.4) this._mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), this.wood, x, y, lz);
      this.ladders.push({ x, z: lz, nx: 0, nz: 1, y0: h - 0.5, y1: top, halfW: 0.45 });
      // zipline from the +x side of the deck down to the lowest ground 55-80 m away
      let best = null;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, d = 55 + (k % 3) * 12;
        const ex = x + Math.cos(a) * d, ez = z + Math.sin(a) * d, eh = this.terrain.heightAt(ex, ez);
        if (eh < 2 || this.terrain.normalAt(ex, ez).y < 0.9 || !this._clearOf(ex, ez, 4)) continue;
        if (!best || eh < best.h) best = { x: ex, z: ez, h: eh };
      }
      if (best && top - best.h > 6) {
        const a = new THREE.Vector3(x, top + 2.4, z), b = new THREE.Vector3(best.x, best.h + 4.2, best.z);
        this._zip(a, b, true);
      }
      this.towns.houses.push({ minX: x - S, maxX: x + S, minZ: z - S, maxZ: z + S, x, z, y: h, h: H + 3.5, rot: 0 });
      (this.towns.landmarks ||= []).push({ name: 'Lookout Tower', x, z });
    }
  }

  _zip(a, b, poleAtB) {
    const sag = Math.min(3, a.distanceTo(b) * 0.03);
    const z = { a, b, sag };
    // cable: a chain of short segments following the sag
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(this.cablePoint(z, i / 24, new THREE.Vector3()));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 5, false), this.cable);
    this.scene.add(tube);
    // anchor poles
    this._mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), this.metal, a.x, a.y - 1.2, a.z);
    if (poleAtB) {
      const gh = this.terrain.heightAt(b.x, b.z);
      this._mesh(new THREE.CylinderGeometry(0.14, 0.18, b.y - gh + 0.2, 6), this.metal, b.x, (b.y + gh) / 2, b.z);
      this.colliders.add({ kind: 'circle', x: b.x, z: b.z, r: 0.2, y0: gh - 1, y1: b.y, crate: true, mat: 'metal' });
    }
    this.zips.push(z);
  }

  cablePoint(z, t, out) {
    out.lerpVectors(z.a, z.b, t);
    out.y -= z.sag * 4 * t * (1 - t);
    return out;
  }

  // Ascender up the side of the factory smokestack to a catwalk at the top.
  _stackAscender(s) {
    const baseY = s.y - 26 + 0.3, x = s.x + 2.25, z = s.z, top = s.y - 1.6;
    this._mesh(new THREE.CylinderGeometry(0.035, 0.035, top - baseY + 2.2, 4), this.cable, x, (top + baseY) / 2 + 1.1, z);
    this._mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), this.metal, x, top + 2.3, z);
    // catwalk ring around the stack
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.18, 20, 1, true), this.metal);
    ring.position.set(s.x, top, s.z);
    this.scene.add(ring);
    const deck = new THREE.Mesh(new THREE.RingGeometry(1.5, 3.1, 24), this.metal);
    deck.rotation.x = -Math.PI / 2; deck.position.set(s.x, top + 0.02, s.z);
    this.scene.add(deck);
    for (const [dx, dz] of [[2.3, 0], [-2.3, 0], [0, 2.3], [0, -2.3]]) this.colliders.add({ kind: 'box', minX: s.x + dx - 0.9, maxX: s.x + dx + 0.9, minZ: s.z + dz - 0.9, maxZ: s.z + dz + 0.9, y0: top - 0.2, y1: top, crate: true, mat: 'metal' });
    this.ascenders.push({ x, z, y0: baseY, y1: top, top: { x: s.x + 2.2, z: s.z + 0.8 } });
    // and a zipline from the catwalk out over the yard
    const a = new THREE.Vector3(s.x - 2.6, top + 2.2, s.z);
    let best = null;
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2, ex = s.x + Math.cos(ang) * 70, ez = s.z + Math.sin(ang) * 70, eh = this.terrain.heightAt(ex, ez);
      if (eh < 2 || this.terrain.normalAt(ex, ez).y < 0.9 || !this._clearOf(ex, ez, 3)) continue;
      if (!best || Math.abs(ang - Math.PI) < Math.abs(best.ang - Math.PI)) best = { x: ex, z: ez, h: eh, ang };
    }
    if (best) this._zip(a, new THREE.Vector3(best.x, best.h + 4.2, best.z), true);
  }

  // Hot air balloons that slowly rise and sink over the fields.
  _balloons(r) {
    const cols = [['#ff5a4f', '#ffd23f'], ['#3d8dff', '#ffffff'], ['#5bd43b', '#ffe94d']];
    for (let i = 0, tries = 0; i < 3 && tries < 600; tries++) {
      const a = r() * Math.PI * 2, d = 60 + r() * 200;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, h = this.terrain.heightAt(x, z);
      if (h < 3 || h > 30 || this.terrain.normalAt(x, z).y < 0.95 || !this._clearOf(x, z, 10)) continue;
      if (this.balloons.some((b) => Math.hypot(b.x - x, b.z - z) < 80)) continue;
      const g = new THREE.Group();
      g.position.set(x, h, z);
      const [c1, c2] = cols[i];
      const env = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), new THREE.MeshStandardMaterial({ color: c1, roughness: 0.6 }));
      env.scale.y = 1.2; env.position.y = 10.5; env.castShadow = true; g.add(env);
      const band = new THREE.Mesh(new THREE.SphereGeometry(4.25, 16, 3, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.12), new THREE.MeshStandardMaterial({ color: c2, roughness: 0.6 }));
      band.scale.y = 1.2; band.position.y = 10.5; g.add(band);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.6), new THREE.MeshStandardMaterial({ color: '#9a6b3c', roughness: 0.9 }));
      basket.position.y = 0.55; basket.castShadow = true; g.add(basket);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.6, 4), this.cable);
        rope.position.set(sx * 1.6, 3.9, sz * 1.6); rope.rotation.set(sz * 0.35, 0, -sx * 0.35); g.add(rope);
      }
      this.scene.add(g);
      // floor you stand on (top of the basket bottom) and low walls
      const floor = { kind: 'box', minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.2, maxZ: z + 1.2, y0: h - 0.2, y1: h + 0.15, crate: true, mat: 'wood' };
      const walls = [[-1.3, 0, 0.12, 2.6], [1.3, 0, 0.12, 2.6], [0, -1.3, 2.6, 0.12], [0, 1.3, 2.6, 0.12]].map(([dx, dz, w, d2]) => ({ kind: 'box', minX: x + dx - w / 2, maxX: x + dx + w / 2, minZ: z + dz - d2 / 2, maxZ: z + dz + d2 / 2, y0: h, y1: h + 1.1, crate: true, mat: 'wood' }));
      for (const c of [floor, ...walls]) this.colliders.add(c);
      this.balloons.push({ x, z, base: h, y: h, group: g, floor, walls, phase: r() * Math.PI * 2, period: 70 + r() * 20 });
      (this.towns.landmarks ||= []).push({ name: 'Balloon Launch', x, z });
      i++;
    }
  }

  // ---------- riding ----------

  // Zipline or ascender the actor could grab (for the interact prompt).
  nearestInteractable(actor) {
    if (actor.zip || actor.asc || actor.state !== 'ground') return null;
    const p = actor.pos;
    for (const a of this.ascenders) {
      if (Math.hypot(p.x - a.x, p.z - a.z) < 1.6 && p.y < a.y1 - 2 && p.y > a.y0 - 1.5) return { kind: 'ascender', asc: a, text: 'Ride Ascender' };
    }
    let best = null, bd = 2.4;
    for (const z of this.zips) {
      // closest cable point in the horizontal plane (a few samples + refine)
      let bt = 0, bdist = Infinity;
      for (let i = 0; i <= 40; i++) { this.cablePoint(z, i / 40, _v); const d = Math.hypot(_v.x - p.x, _v.z - p.z); if (d < bdist) { bdist = d; bt = i / 40; } }
      this.cablePoint(z, bt, _v);
      const dy = _v.y - p.y;
      if (bdist < bd && dy > 1.0 && dy < 4.2) { bd = bdist; best = { kind: 'zip', zip: z, t: bt, text: 'Ride Zipline' }; }
    }
    return best;
  }

  grab(actor, near) {
    if (near.kind === 'zip') {
      actor.zip = { z: near.zip, t: Math.min(0.98, Math.max(0.02, near.t)), dir: 1 };
      // head toward where you're looking
      _a.subVectors(near.zip.b, near.zip.a);
      actor.zip.dir = actor.zip.t < 0.15 ? 1 : actor.zip.t > 0.85 ? -1 : _a.x * Math.sin(actor.aimYaw) + _a.z * Math.cos(actor.aimYaw) >= 0 ? 1 : -1;
    } else actor.asc = { a: near.asc };
    actor.vel.set(0, 0, 0);
    actor.setBuildMode?.(null);
    actor.game.sound?.play('grapple', actor.isPlayer ? null : actor.pos);
  }

  // Returns true while the actor is riding something (the actor skips normal movement).
  ride(actor, dt, it) {
    if (actor.zip) {
      const Z = actor.zip, z = Z.z;
      const len = z.a.distanceTo(z.b);
      _a.subVectors(z.b, z.a).setY(0).normalize();
      const input = it.mx * _a.x + it.mz * _a.z;
      if (Math.abs(input) > 0.3) Z.dir = Math.sign(input);
      Z.t += (Z.dir * ZIP_SPEED * dt) / len;
      const end = (Z.dir < 0 && Z.t <= 0.01) || (Z.dir > 0 && Z.t >= 0.99);
      Z.t = Math.min(0.99, Math.max(0.01, Z.t));
      this.cablePoint(z, Z.t, _b);
      actor.vel.set(_a.x * Z.dir * ZIP_SPEED, 0, _a.z * Z.dir * ZIP_SPEED);
      actor.pos.set(_b.x, _b.y - 2.05, _b.z);
      actor.bodyYaw = Math.atan2(_a.x * Z.dir, _a.z * Z.dir);
      actor.onGround = false;
      if (it.jumpPress || end) this.release(actor, it.jumpPress ? 6 : 1);
      return true;
    }
    if (actor.asc) {
      const a = actor.asc.a;
      actor.pos.x = a.x; actor.pos.z = a.z;
      actor.pos.y = Math.min(a.y1, actor.pos.y + ASC_SPEED * dt);
      actor.vel.set(0, ASC_SPEED, 0);
      actor.onGround = false;
      if (actor.pos.y >= a.y1 - 0.05) {
        // step off onto the catwalk
        actor.pos.set(a.top.x, a.y1 + 0.05, a.top.z);
        actor.asc = null; actor.vel.set(0, 0, 0); actor.onGround = true;
        return true;
      }
      if (it.jumpPress) this.release(actor, 4);
      return true;
    }
    return false;
  }

  release(actor, up) {
    actor.zip = null; actor.asc = null;
    actor.vel.y = up;
    actor.noFallT = 12; // no fall damage until you land
    actor.flungT = 0.6;
  }

  // Ladders: walking into one climbs it; at the top you step onto the deck.
  climb(actor, it, dt) {
    const mlen = Math.hypot(it.mx, it.mz);
    if (mlen < 0.3) return false;
    for (const l of this.ladders) {
      const dx = actor.pos.x - l.x, dz = actor.pos.z - l.z;
      const out = dx * l.nx + dz * l.nz, side = Math.abs(dx * l.nz - dz * l.nx);
      if (out < -0.2 || out > 0.75 || side > l.halfW + 0.25) continue;
      if (actor.pos.y < l.y0 - 0.5 || actor.pos.y > l.y1 + 0.2) continue;
      const into = -(it.mx * l.nx + it.mz * l.nz) / mlen;
      if (into < 0.5) continue;
      if (actor.pos.y >= l.y1 - 0.9) {
        // top: pull up and over
        actor.pos.set(l.x - l.nx * 1.0, l.y1 + 0.05, l.z - l.nz * 1.0);
        actor.vel.set(0, 0, 0); actor.onGround = true;
        return true;
      }
      actor.pos.x = l.x + l.nx * 0.35; actor.pos.z = l.z + l.nz * 0.35;
      actor.pos.y += LADDER_SPEED * dt;
      actor.vel.set(0, 0, 0);
      actor.onGround = false;
      actor.noFallT = Math.max(actor.noFallT || 0, 0.5);
      actor.bodyYaw = Math.atan2(-l.nx, -l.nz);
      actor.climbing = true;
      return true;
    }
    actor.climbing = false;
    return false;
  }

  update(dt, time, actors) {
    for (const b of this.balloons) {
      const k = (1 - Math.cos((time / b.period) * Math.PI * 2 + b.phase)) / 2;
      const y = b.base + k * 42;
      const dy = y - b.y;
      b.y = y;
      b.group.position.y = y;
      b.floor.y0 = y - 0.2; b.floor.y1 = y + 0.15;
      for (const w of b.walls) { w.y0 = y; w.y1 = y + 1.1; }
      // carry anyone standing in the basket
      for (const a of actors) {
        if (!a.alive || a.state !== 'ground') continue;
        if (Math.abs(a.pos.x - b.x) > 1.25 || Math.abs(a.pos.z - b.z) > 1.25) continue;
        if (Math.abs(a.pos.y - (y - dy + 0.15)) < 0.45) { a.pos.y += dy; if (dy > 0) a.vel.y = Math.max(a.vel.y, 0); }
      }
    }
  }

  reset() {
    for (const b of this.balloons) b.y = b.base;
  }
}
