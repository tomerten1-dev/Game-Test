import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Spike traps: place one on a floor, wall or ceiling you're aiming at (builds, house walls, the
// ground). When anyone other than the owner walks into its zone the spikes shoot out for 75
// damage, then it re-arms after a few seconds. A trap goes away with the surface it's on.

const DAMAGE = 75, REARM = 3, RANGE = 7, SIZE = 1.6;
const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _hit = {};
const UP = new THREE.Vector3(0, 1, 0);

function spikesGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const g = new THREE.ConeGeometry(0.07, 0.5, 5);
    g.translate(-0.6 + i * 0.3, 0.25, -0.6 + j * 0.3);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

// Trap model with local +Y as the surface normal.
export function makeTrapMesh(ghost = false) {
  const g = new THREE.Group();
  const mat = (color, extra = {}) => ghost
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55, ...extra });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(SIZE, 0.08, SIZE), mat('#4b5058'));
  plate.position.y = 0.04;
  g.add(plate);
  // hazard rim
  const rimMat = mat('#ffc629', { metalness: 0.2 });
  for (const [w, d, x, z] of [[SIZE, 0.12, 0, SIZE / 2 - 0.06], [SIZE, 0.12, 0, -SIZE / 2 + 0.06], [0.12, SIZE, SIZE / 2 - 0.06, 0], [0.12, SIZE, -SIZE / 2 + 0.06, 0]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), rimMat);
    r.position.set(x, 0.05, z);
    g.add(r);
  }
  const spikes = new THREE.Mesh(spikesGeometry(), mat('#d6dde6', { metalness: 0.8, roughness: 0.25 }));
  spikes.position.y = 0.06;
  spikes.scale.y = ghost ? 1 : 0.18;
  spikes.name = 'spikes';
  g.add(spikes);
  g.traverse((o) => { if (o.isMesh) o.castShadow = !ghost; });
  return g;
}

export class Traps {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.ghost = makeTrapMesh(true);
    this.ghost.visible = false;
    game.scene.add(this.ghost);
    this.showGhost = false;
    this._checkT = 0;
  }

  // Where a trap would go for someone aiming along (origin, dir): { pos, normal, support } or null.
  plan(actor, origin, dir) {
    const w = this.game.world;
    const hit = w.raycast(origin, dir, 40, _hit);
    if (!hit) return null;
    const pos = new THREE.Vector3().copy(origin).addScaledVector(dir, hit.t);
    if (pos.distanceTo(actor.pos) > RANGE) return null;
    const c = hit.collider;
    let n;
    if (!c) n = w.terrain.normalAt(pos.x, pos.z).y > 0.75 ? UP.clone() : null;
    else if (c.kind === 'box') {
      // the face of the box we hit
      const d = [[pos.x - c.minX, -1, 0, 0], [c.maxX - pos.x, 1, 0, 0], [pos.y - c.y0, 0, -1, 0], [c.y1 - pos.y, 0, 1, 0], [pos.z - c.minZ, 0, 0, -1], [c.maxZ - pos.z, 0, 0, 1]];
      d.sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]));
      n = new THREE.Vector3(d[0][1], d[0][2], d[0][3]);
    } else if (c.kind === 'ramp' || c.kind === 'cone') n = UP.clone();
    else n = null; // trees, rocks, props
    if (!n || c?.mat === 'glass' || c?.obj) return null;
    // Fortnite spike traps only go on floors (the ground, build floors, ramps and roofs)
    if (n.y < 0.7) return null;
    if (n.dot(dir) > 0) return null;
    // no stacking traps on top of each other
    if (this.list.some((t) => t.pos.distanceTo(pos) < 1.2)) return null;
    return { pos: pos.addScaledVector(n, 0.02), normal: n, support: c };
  }

  // Player: show where the held trap would go.
  preview(actor, origin, dir) {
    const plan = this.plan(actor, origin, dir);
    this.showGhost = true;
    if (!plan) { this.ghost.visible = false; this._plan = null; return null; }
    this.ghost.position.copy(plan.pos);
    this.ghost.quaternion.setFromUnitVectors(UP, plan.normal);
    this._plan = plan;
    return plan;
  }

  place(actor, plan) {
    if (!plan) return false;
    const mesh = makeTrapMesh();
    mesh.position.copy(plan.pos);
    mesh.quaternion.setFromUnitVectors(UP, plan.normal);
    this.game.scene.add(mesh);
    this.list.push({ owner: actor, pos: plan.pos.clone(), normal: plan.normal.clone(), support: plan.support, mesh, spikes: mesh.getObjectByName('spikes'), cd: 0.6, popT: 0 });
    this.game.sound.play('build', actor.isPlayer ? null : plan.pos);
    return true;
  }

  // Is this actor inside a trap's zone (in front of the plate, within its footprint)?
  static inZone(t, a) {
    _p.set(a.pos.x, a.pos.y + 0.9, a.pos.z).sub(t.pos);
    const h = _p.dot(t.normal);
    if (h < -0.4 || h > 2.2) return false;
    _v.copy(t.normal).multiplyScalar(h);
    return _p.sub(_v).length() < SIZE * 0.75;
  }

  update(dt, actors) {
    this.ghost.visible = this.showGhost && !!this._plan;
    this.showGhost = false;
    this._checkT -= dt;
    const checkSupport = this._checkT <= 0;
    if (checkSupport) this._checkT = 0.4;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      if (checkSupport) {
        const s = t.support;
        if (s && ((s.structure && (s.structure.hp <= 0 || s.structure.falling)) || s.part?.broken)) { this._remove(i, true); continue; }
      }
      // spike animation: shoot out fast, retract slowly
      if (t.popT > 0) {
        t.popT -= dt;
        t.spikes.scale.y = t.popT > 0.8 ? 1 : Math.max(0.18, t.popT / 0.8);
      }
      if (t.spent > 0) { if ((t.spent -= dt) <= 0) this._remove(i, true); continue; }
      if (t.cd > 0) { t.cd -= dt; continue; }
      let fired = false;
      for (const a of actors) {
        if (!a.alive || a === t.owner || a.state === 'bus' || a.hiddenIn) continue;
        if (Math.abs(a.pos.x - t.pos.x) > 3 || Math.abs(a.pos.z - t.pos.z) > 3 || Math.abs(a.pos.y - t.pos.y) > 3.5) continue;
        if (!Traps.inZone(t, a)) continue;
        if (!fired) this._fire(t);
        fired = true;
        const shieldBefore = a.shield;
        const dealt = a.takeDamage(DAMAGE, t.owner, false);
        if (t.owner?.isPlayer) {
          this.game.effects.damageNumber(a.chest(_v), dealt, false, shieldBefore > 0, a);
          this.game.hud?.hitMarker(false, !a.alive);
        }
        if (a.isPlayer) this.game.rig.shake = Math.min(1, this.game.rig.shake + 0.5);
      }
      // single use: the trap breaks after it springs
      if (fired) t.spent = 1.2;
    }
  }

  _fire(t) {
    t.cd = REARM;
    t.popT = 1.1;
    t.spikes.scale.y = 1;
    this.game.sound.play('trap', t.pos, { range: 50 });
    const fx = this.game.effects;
    const c = new THREE.Color('#dfe6ee');
    for (let i = 0; i < 12; i++) fx.sparks.emit(t.pos.x, t.pos.y + 0.2, t.pos.z, t.normal.x * 4 + (Math.random() - 0.5) * 3, t.normal.y * 4 + Math.random() * 2, t.normal.z * 4 + (Math.random() - 0.5) * 3, c, 0.25, 0.12, 8);
  }

  _remove(i, fx) {
    const t = this.list[i];
    this.game.scene.remove(t.mesh);
    t.mesh.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    if (fx) this.game.sound.play('break', t.pos);
    this.list.splice(i, 1);
  }

  reset() {
    for (let i = this.list.length - 1; i >= 0; i--) this._remove(i, false);
    this.ghost.visible = false;
  }
}
