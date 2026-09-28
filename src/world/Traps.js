import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRID, HEIGHT } from './Building.js';

// Chapter 1 Damage Traps: they go on a floor, wall or ceiling you built and cover that whole tile.
// Anyone else who steps into the tile takes 150; the trap re-arms after a few seconds and keeps
// working until the piece it's on is destroyed.

const DAMAGE = 150, REARM = 3, RANGE = 9, SIZE = 1.6, FLOOR_T = 0.22, WALL_T = 0.12;
const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _hit = {};
const UP = new THREE.Vector3(0, 1, 0);

function spikesGeometry(w, d) {
  const parts = [], nx = Math.max(5, Math.round(w / 0.32)), nz = Math.max(5, Math.round(d / 0.32));
  const sx = (w - 0.2) / nx, sz = (d - 0.2) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const g = new THREE.ConeGeometry(0.07, 0.5, 5);
    g.translate(-w / 2 + 0.1 + (i + 0.5) * sx, 0.25, -d / 2 + 0.1 + (j + 0.5) * sz);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

// Trap model with local +Y as the surface normal, w x d across it.
export function makeTrapMesh(ghost = false, w = SIZE, d = SIZE) {
  const g = new THREE.Group();
  const mat = (color, extra = {}) => ghost
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55, ...extra });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat('#4b5058'));
  plate.position.y = 0.04;
  g.add(plate);
  // hazard rim
  const rimMat = mat('#ffc629', { metalness: 0.2 });
  for (const [rw, rd, x, z] of [[w, 0.12, 0, d / 2 - 0.06], [w, 0.12, 0, -d / 2 + 0.06], [0.12, d, w / 2 - 0.06, 0], [0.12, d, -w / 2 + 0.06, 0]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.1, rd), rimMat);
    r.position.set(x, 0.05, z);
    g.add(r);
  }
  const spikes = new THREE.Mesh(spikesGeometry(w, d), mat('#d6dde6', { metalness: 0.8, roughness: 0.25 }));
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
    this.ghosts = { floor: makeTrapMesh(true, GRID - 0.1, GRID - 0.1), wall: makeTrapMesh(true, GRID - 0.1, HEIGHT - 0.1) };
    for (const gh of Object.values(this.ghosts)) { gh.visible = false; game.scene.add(gh); }
    this.ghost = this.ghosts.floor;
    this.showGhost = false;
    this._checkT = 0;
  }

  // Where a trap would go for someone aiming along (origin, dir): the face of a built floor (top or
  // underside) or wall it hits, covering the whole tile. { pos, normal, xAxis, w, d, support, key } or null.
  plan(actor, origin, dir) {
    const world = this.game.world, hit = world.raycast(origin, dir, 40, _hit);
    if (!hit) return null;
    const at = _p.copy(origin).addScaledVector(dir, hit.t);
    let support = hit.collider;
    // a floor built on the ground sits level with it: the ray may stop on the terrain first
    if (!support?.structure) support = world.colliders.query(at.x - 0.1, at.x + 0.1, at.z - 0.1, at.z + 0.1, []).find((c) => c.structure?.type === 'floor' && Math.abs(c.y1 - at.y) < 0.4) || null;
    const st = support?.structure;
    if (!st || (st.type !== 'floor' && st.type !== 'wall') || st.hp <= 0 || st.falling) return null;
    if (at.distanceTo(actor.pos) > RANGE) return null;
    let pos, normal, w = GRID - 0.1, d = GRID - 0.1;
    if (st.type === 'floor') {
      const up = dir.y < 0; // looking down at it: on top; looking up: on the ceiling
      normal = new THREE.Vector3(0, up ? 1 : -1, 0);
      pos = new THREE.Vector3(st.cx, up ? st.y0 + 0.06 : st.y0 - FLOOR_T - 0.02, st.cz);
    } else {
      normal = st.alongX ? new THREE.Vector3(0, 0, dir.z > 0 ? -1 : 1) : new THREE.Vector3(dir.x > 0 ? -1 : 1, 0, 0);
      pos = new THREE.Vector3(st.cx, st.y0 + HEIGHT / 2, st.cz).addScaledVector(normal, WALL_T + 0.02);
      d = HEIGHT - 0.1;
    }
    const key = `${st.key}|${normal.x},${normal.y},${normal.z}`;
    if (this.list.some((t) => t.key === key)) return null; // one trap per face
    // across the face: X horizontal, Z the other way (up the wall / across the floor)
    const xAxis = Math.abs(normal.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(UP, normal).normalize();
    return { pos, normal, xAxis, w, d, support, key, wall: st.type === 'wall' };
  }

  static orient(obj, plan) {
    const z = new THREE.Vector3().crossVectors(plan.xAxis, plan.normal);
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(plan.xAxis, plan.normal, z));
  }

  // Player: show where the held trap would go.
  preview(actor, origin, dir) {
    const plan = this.plan(actor, origin, dir);
    this.showGhost = true;
    for (const gh of Object.values(this.ghosts)) gh.visible = false;
    if (!plan) { this._plan = null; return null; }
    this.ghost = plan.wall ? this.ghosts.wall : this.ghosts.floor;
    this.ghost.position.copy(plan.pos);
    Traps.orient(this.ghost, plan);
    this.ghost.visible = true;
    this._plan = plan;
    return plan;
  }

  place(actor, plan) {
    if (!plan) return false;
    const mesh = makeTrapMesh(false, plan.w, plan.d);
    mesh.position.copy(plan.pos);
    Traps.orient(mesh, plan);
    this.game.scene.add(mesh);
    const zAxis = new THREE.Vector3().crossVectors(plan.xAxis, plan.normal);
    this.list.push({ owner: actor, pos: plan.pos.clone(), normal: plan.normal.clone(), xAxis: plan.xAxis.clone(), zAxis, w: plan.w, d: plan.d, key: plan.key, support: plan.support, mesh, spikes: mesh.getObjectByName('spikes'), cd: 0.6, popT: 0 });
    this.game.sound.play('build', actor.isPlayer ? null : plan.pos);
    return true;
  }

  // Is this actor inside a trap's tile (in front of the plate, over its whole area)?
  static inZone(t, a) {
    _p.set(a.pos.x, a.pos.y + 0.9, a.pos.z).sub(t.pos);
    const h = _p.dot(t.normal);
    if (h < -0.6 || h > (t.normal.y ? 2.6 : 1.4)) return false;
    return Math.abs(_p.dot(t.xAxis)) < t.w / 2 + 0.3 && Math.abs(_p.dot(t.zAxis)) < t.d / 2 + (t.normal.y ? 0.3 : 1);
  }

  update(dt, actors) {
    if (!this.showGhost) for (const gh of Object.values(this.ghosts)) gh.visible = false;
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
      if (t.cd > 0) { t.cd -= dt; continue; }
      let fired = false;
      for (const a of actors) {
        if (!a.alive || a === t.owner || a.hiredBy === t.owner || a.state === 'bus' || a.hiddenIn) continue;
        if (Math.abs(a.pos.x - t.pos.x) > 4 || Math.abs(a.pos.z - t.pos.z) > 4 || Math.abs(a.pos.y - t.pos.y) > 4) continue;
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
    for (const gh of Object.values(this.ghosts)) gh.visible = false;
  }
}
