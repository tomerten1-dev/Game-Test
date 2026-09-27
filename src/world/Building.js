import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const GRID = 4;
export const HEIGHT = 4;
export const COST = 10;
export const PIECES = ['wall', 'floor', 'ramp', 'cone'];
export const BUILD_MATS = ['wood', 'stone', 'metal'];
// Stronger materials start weaker and take longer to reach full health.
export const MAT_STATS = {
  wood: { hp: 150, start: 0.35, time: 2.5, color: '#b07a45' },
  stone: { hp: 300, start: 0.25, time: 5, color: '#a9adb5' },
  metal: { hp: 450, start: 0.2, time: 8, color: '#7f93a8' },
};
const EDITS = [null, 'door', 'window'];
const CONE_H = 1.8;
const FLOOR_T = 0.22;

function canvasTex(draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const TEXTURES = {
  wood: (ctx) => {
    const planks = 5;
    for (let i = 0; i < planks; i++) {
      const shade = [0xc9, 0xbd, 0xd3, 0xc2, 0xcc][i];
      ctx.fillStyle = `rgb(${shade}, ${Math.round(shade * 0.66)}, ${Math.round(shade * 0.38)})`;
      ctx.fillRect(0, (i * 128) / planks, 128, 128 / planks);
      ctx.fillStyle = 'rgba(70,35,10,0.55)';
      ctx.fillRect(0, (i * 128) / planks, 128, 3);
      ctx.fillStyle = 'rgba(70,35,10,0.35)';
      for (let k = 0; k < 2; k++) ctx.fillRect(10 + ((i * 37 + k * 50) % 100), (i * 128) / planks + 8, 4, 4);
    }
    ctx.strokeStyle = '#7a4a22';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 118, 118);
  },
  stone: (ctx) => {
    ctx.fillStyle = '#6f737b';
    ctx.fillRect(0, 0, 128, 128);
    const rows = 6, h = 128 / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 21 : 0;
      for (let x = -off; x < 128; x += 42) {
        const v = 170 + ((r * 7 + x * 3) % 40);
        ctx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 10})`;
        ctx.fillRect(x + 2, r * h + 2, 38, h - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + 2, r * h + 2, 38, 3);
      }
    }
    ctx.strokeStyle = '#555a62';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 120, 120);
  },
  metal: (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, '#d2d8de');
    g.addColorStop(1, '#9aa4ae');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(60,70,82,0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 112, 112);
    ctx.beginPath(); ctx.moveTo(64, 8); ctx.lineTo(64, 120); ctx.moveTo(8, 64); ctx.lineTo(120, 64); ctx.stroke();
    ctx.fillStyle = 'rgba(230,240,250,0.8)';
    for (const [x, y] of [[16, 16], [112, 16], [16, 112], [112, 112], [56, 16], [72, 112], [16, 56], [112, 72]]) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#5a6570';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 120, 120);
  },
};

// Solid parts of a wall (local x -2..2, y 0..4) for each edit.
function wallRects(edit) {
  if (edit === 'door') return [[-2, -0.7, 0, 4], [0.7, 2, 0, 4], [-0.7, 0.7, 2.9, 4]];
  if (edit === 'window') return [[-2, -0.8, 0, 4], [0.8, 2, 0, 4], [-0.8, 0.8, 0, 1.4], [-0.8, 0.8, 2.6, 4]];
  return [[-2, 2, 0, 4]];
}

function wallGeometry(edit) {
  const parts = wallRects(edit).map(([x0, x1, y0, y1]) => {
    const w = x1 - x0, h = y1 - y0;
    const g = new THREE.BoxGeometry(w, h, 0.24);
    // keep the texture at world scale so edited pieces line up
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + 2) / GRID + uv.getX(i) * (w / GRID), y0 / HEIGHT + uv.getY(i) * (h / HEIGHT));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return g;
  });
  return parts.length === 1 ? parts[0] : mergeGeometries(parts);
}

// Player/bot structures: walls, floors, ramps and cones on a 4 m grid, in wood, stone or metal.
export class Building {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.tex = {};
    for (const m of BUILD_MATS) this.tex[m] = canvasTex(TEXTURES[m]);
    this.structures = [];
    this.keys = new Map();
    this.geo = {
      wall: {},
      floor: new THREE.BoxGeometry(GRID, FLOOR_T, GRID).translate(0, -FLOOR_T / 2 + 0.04, 0),
      ramp: new THREE.BoxGeometry(GRID, 0.2, Math.hypot(GRID, HEIGHT)),
      cone: new THREE.ConeGeometry(GRID / Math.SQRT2, CONE_H, 4, 1).rotateY(Math.PI / 4).translate(0, CONE_H / 2, 0),
    };
    for (const e of EDITS) this.geo.wall[e] = wallGeometry(e);
    // ghost preview
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#5fd4ff', transparent: true, opacity: 0.35, depthWrite: false });
    this.ghostEdge = new THREE.LineBasicMaterial({ color: '#bff0ff', transparent: true, opacity: 0.9 });
    this.ghost = new THREE.Group();
    this.ghostMeshes = {};
    for (const t of PIECES) {
      const geo = t === 'wall' ? this.geo.wall[null] : this.geo[t];
      const m = new THREE.Mesh(geo, this.ghostMat);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.ghostEdge));
      m.visible = false;
      m.renderOrder = 5;
      this.ghost.add(m);
      this.ghostMeshes[t] = m;
    }
    this.ghost.visible = false;
    this.scene.add(this.ghost);
  }

  reset() {
    for (const s of [...this.structures]) this._remove(s, false, false);
    this.structures = [];
    this.keys.clear();
    this.hideGhost();
  }

  static dirFromYaw(yaw) {
    // 0:+Z 1:+X 2:-Z 3:-X
    const i = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
    return [[0, 1], [1, 0], [0, -1], [-1, 0]][i];
  }

  canAfford(actor, mat) { return mat ? actor.mats[mat] >= COST : BUILD_MATS.some((m) => actor.mats[m] >= COST); }

  // Material an actor will build with: the preferred one if affordable, else the one they have most of.
  pickMat(actor, preferred) {
    if (preferred && actor.mats[preferred] >= COST) return preferred;
    let best = null;
    for (const m of BUILD_MATS) if (actor.mats[m] >= COST && (!best || actor.mats[m] > actor.mats[best])) best = m;
    return best;
  }

  // Base height for a new piece: snaps to the levels of nearby structures so builds stack cleanly,
  // otherwise sits on the terrain (or on whatever the actor is standing on).
  _levelY(actor, x, z, ext) {
    const feet = actor.pos.y;
    let anchor = null, bd = 7;
    for (const s of this.structures) {
      if (s.falling) continue;
      const d = Math.hypot(s.cx - x, s.cz - z);
      if (d < bd && Math.abs(s.y0 - feet) < 9) { bd = d; anchor = s.y0; }
    }
    if (anchor !== null) return anchor + Math.floor((feet - anchor + 1.0) / HEIGHT) * HEIGHT;
    const w = this.world;
    const terrain = Math.min(w.heightAt(x, z), w.heightAt(x + ext[0], z + ext[1]), w.heightAt(x - ext[0], z - ext[1]));
    if (feet - w.heightAt(actor.pos.x, actor.pos.z) > 0.8) return feet - 0.05;
    return Math.max(terrain - 0.3, -1);
  }

  // Work out where a piece would go for an actor looking along yaw/pitch.
  plan(actor, type, yaw, pitch = 0) {
    const [dx, dz] = Building.dirFromYaw(yaw);
    const px = actor.pos.x, pz = actor.pos.z;
    const ix = Math.floor(px / GRID), iz = Math.floor(pz / GRID);
    const up = pitch > 0.45 ? 1 : 0;
    let cx, cz, y0, key, box;
    const p = { type, dirX: dx, dirZ: dz };
    if (type === 'wall') {
      let alongX;
      if (dx !== 0) { cx = (dx > 0 ? ix + 1 : ix) * GRID; cz = iz * GRID + GRID / 2; alongX = false; }
      else { cz = (dz > 0 ? iz + 1 : iz) * GRID; cx = ix * GRID + GRID / 2; alongX = true; }
      y0 = this._levelY(actor, cx, cz, alongX ? [GRID / 2, 0] : [0, GRID / 2]) + up * HEIGHT;
      p.alongX = alongX;
      key = `w:${cx}:${cz}:${alongX ? 1 : 0}`;
      const h = 0.12;
      box = alongX ? [cx - 2, cx + 2, y0, y0 + HEIGHT, cz - h, cz + h] : [cx - h, cx + h, y0, y0 + HEIGHT, cz - 2, cz + 2];
    } else {
      let cell;
      if (type === 'floor' && pitch < -0.6) cell = [ix, iz];
      else if (type === 'cone' && up) cell = [ix, iz];
      else cell = [Math.floor((px + dx * 2.6) / GRID), Math.floor((pz + dz * 2.6) / GRID)];
      cx = cell[0] * GRID + GRID / 2; cz = cell[1] * GRID + GRID / 2;
      const lowX = type === 'ramp' ? cx - dx * GRID / 2 : cx, lowZ = type === 'ramp' ? cz - dz * GRID / 2 : cz;
      y0 = this._levelY(actor, lowX, lowZ, type === 'ramp' ? [0, 0] : [GRID / 2, GRID / 2]);
      if (type === 'floor' || type === 'cone') y0 += up * HEIGHT;
      key = `${type === 'floor' ? 'f' : 'm'}:${cx}:${cz}`;
      const top = type === 'floor' ? y0 + 0.04 : type === 'cone' ? y0 + CONE_H : y0 + HEIGHT;
      box = [cx - 2, cx + 2, type === 'floor' ? y0 - FLOOR_T : y0, top, cz - 2, cz + 2];
    }
    p.cx = cx; p.cz = cz; p.y0 = y0; p.box = box;
    p.key = `${key}:${Math.round(y0 * 4)}`;
    return p;
  }

  _grounded(box) {
    const w = this.world;
    const [x0, x1, y0, , z0, z1] = box;
    let top = -Infinity;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) top = Math.max(top, w.heightAt(x, z));
    return y0 <= top + 0.45;
  }

  static _touch(a, b) {
    const e = 0.3;
    return a[0] <= b[1] + e && b[0] <= a[1] + e && a[2] <= b[3] + e && b[2] <= a[3] + e && a[4] <= b[5] + e && b[4] <= a[5] + e;
  }

  // Needs a free slot and something to lean on (terrain or another piece).
  isValid(plan, actor, mat) {
    if (!mat || actor.mats[mat] < COST) return false;
    if (this.keys.has(plan.key)) return false;
    if (this._grounded(plan.box)) return true;
    return this.structures.some((s) => !s.falling && Building._touch(s.box, plan.box));
  }

  showGhost(plan, valid) {
    this.ghost.visible = true;
    for (const t of PIECES) this.ghostMeshes[t].visible = t === plan.type;
    const m = this.ghostMeshes[plan.type];
    this._place(m, plan);
    this.ghostMat.color.set(valid ? '#5fd4ff' : '#ff5a5f');
    this.ghostEdge.color.set(valid ? '#dff7ff' : '#ffc2c4');
  }

  hideGhost() { this.ghost.visible = false; }

  _place(mesh, plan) {
    const { type, cx, cz, y0, dirX, dirZ } = plan;
    mesh.rotation.set(0, 0, 0);
    if (type === 'wall') {
      mesh.position.set(cx, y0, cz);
      mesh.rotation.y = plan.alongX ? 0 : Math.PI / 2;
    } else if (type === 'ramp') {
      mesh.position.set(cx, y0 + HEIGHT / 2, cz);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = Math.atan2(dirX, dirZ);
      mesh.rotation.x = -Math.atan2(HEIGHT, GRID);
    } else mesh.position.set(cx, y0, cz);
  }

  _colliders(s) {
    const { type, cx, cz, y0 } = s;
    if (type === 'wall') {
      const h = 0.12;
      return wallRects(s.edit).map(([a0, a1, b0, b1]) => (s.alongX
        ? { kind: 'box', minX: cx + a0, maxX: cx + a1, minZ: cz - h, maxZ: cz + h, y0: y0 + b0, y1: y0 + b1 }
        : { kind: 'box', minX: cx - h, maxX: cx + h, minZ: cz - a1, maxZ: cz - a0, y0: y0 + b0, y1: y0 + b1 }));
    }
    if (type === 'floor') return [{ kind: 'box', minX: cx - 2, maxX: cx + 2, minZ: cz - 2, maxZ: cz + 2, y0: y0 - FLOOR_T, y1: y0 + 0.04 }];
    if (type === 'ramp') return [{ kind: 'ramp', minX: cx - 2, maxX: cx + 2, minZ: cz - 2, maxZ: cz + 2, y0, y1: y0 + HEIGHT, dirX: s.dirX, dirZ: s.dirZ }];
    return [{ kind: 'cone', minX: cx - 2, maxX: cx + 2, minZ: cz - 2, maxZ: cz + 2, y0, y1: y0 + CONE_H }];
  }

  // Place a planned piece. Returns the structure or null.
  build(actor, plan, mat) {
    mat = this.pickMat(actor, mat);
    if (!plan || actor.state !== 'ground' || !this.isValid(plan, actor, mat)) return null;
    const st = MAT_STATS[mat];
    const material = new THREE.MeshStandardMaterial({ map: this.tex[mat], roughness: mat === 'metal' ? 0.55 : 0.85, metalness: mat === 'metal' ? 0.25 : 0, transparent: true, opacity: 0.6 });
    const geo = plan.type === 'wall' ? this.geo.wall[null] : this.geo[plan.type];
    const mesh = new THREE.Mesh(geo, material);
    this._place(mesh, plan);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const s = {
      ...plan, mat, mesh, edit: null, owner: actor,
      maxHp: st.hp, hp: st.hp * st.start, buildT: 0, buildTime: st.time, grow: 0,
      base: mesh.position.clone(), baseRot: mesh.rotation.clone(),
    };
    s.damage = (amount, by) => this.damage(s, amount, by);
    s.cols = this._colliders(s);
    for (const c of s.cols) { c.dynamic = true; c.structure = s; this.world.colliders.add(c); }
    if (plan.type === 'ramp') mesh.scale.setScalar(0.05); else mesh.scale.set(1, 0.05, 1);
    this.scene.add(mesh);
    this.keys.set(s.key, s);
    this.structures.push(s);
    actor.mats[mat] -= COST;
    this.game.sound.play('build', actor.isPlayer ? null : actor.pos);
    return s;
  }

  buildPiece(actor, type, yaw, pitch = 0, mat) { return this.build(actor, this.plan(actor, type, yaw, pitch), mat); }

  // --- helpers used by bots (and touch quick-build) ---
  buildWallFacing(actor, yaw) { return !!this.buildPiece(actor, 'wall', yaw); }
  buildRamp(actor) { return !!this.buildPiece(actor, 'ramp', actor.aimYaw); }
  buildWall(actor) { return !!this.buildPiece(actor, 'wall', actor.aimYaw); }

  // Four walls around the actor's cell (+ a roof when there are mats to spare).
  buildBox(actor, roof = true) {
    let n = 0;
    for (let k = 0; k < 4; k++) if (this.buildPiece(actor, 'wall', (k * Math.PI) / 2)) n++;
    if (roof && this.canAfford(actor)) this.buildPiece(actor, 'cone', 0, 1);
    return n;
  }

  // Wall on one side of the actor's cell, if any.
  wallAt(actor, yaw) {
    const p = this.plan(actor, 'wall', yaw);
    return this.keys.get(p.key) || null;
  }

  // Cycle a wall's edit (plain → door → window → plain), or set a specific one.
  edit(s, edit) {
    if (!s || s.type !== 'wall' || s.falling) return null;
    const next = edit !== undefined ? edit : EDITS[(EDITS.indexOf(s.edit) + 1) % EDITS.length];
    if (next === s.edit) return next;
    s.edit = next;
    for (const c of s.cols) this.world.colliders.remove(c);
    s.cols = this._colliders(s);
    for (const c of s.cols) { c.dynamic = true; c.structure = s; this.world.colliders.add(c); }
    s.mesh.geometry = this.geo.wall[next];
    this.game.sound.play('click', s.mesh.position);
    return next;
  }

  damage(s, amount) {
    if (s.hp <= 0 || s.falling) return;
    s.hp -= amount;
    s.hitT = 0.12;
    this._tint(s);
    if (s.hp <= 0) this._remove(s, true);
  }

  _tint(s) {
    const k = Math.max(0, Math.min(1, s.hp / s.maxHp));
    s.mesh.material.color.setRGB(0.6 + 0.4 * k, 0.5 + 0.5 * k, 0.45 + 0.55 * k);
  }

  _remove(s, fx, cascade = true) {
    for (const c of s.cols) this.world.colliders.remove(c);
    this.scene.remove(s.mesh);
    s.mesh.material.dispose();
    if (this.keys.get(s.key) === s) this.keys.delete(s.key);
    const i = this.structures.indexOf(s);
    if (i >= 0) this.structures.splice(i, 1);
    s.hp = 0;
    if (fx) {
      const p = s.mesh.position;
      const c = new THREE.Color(MAT_STATS[s.mat].color);
      const n = s.type === 'wall' || s.type === 'floor' ? 26 : 18;
      for (let i = 0; i < n; i++) {
        this.game.effects.debris.emit(p.x + (Math.random() - 0.5) * 3, p.y + (s.type === 'wall' ? Math.random() * 3.5 : 0), p.z + (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 5, Math.random() * 5, (Math.random() - 0.5) * 5, c, 0.9, 0.22, 14);
      }
      this.game.sound.play('break', p);
    }
    if (cascade) this._checkSupport();
  }

  // Anything no longer connected to the ground collapses, piece by piece.
  _checkSupport() {
    const alive = this.structures.filter((s) => !s.falling);
    const supported = new Set();
    const queue = alive.filter((s) => this._grounded(s.box));
    for (const s of queue) supported.add(s);
    while (queue.length) {
      const s = queue.pop();
      for (const o of alive) {
        if (!supported.has(o) && Building._touch(s.box, o.box)) { supported.add(o); queue.push(o); }
      }
    }
    let n = 0;
    for (const s of alive) {
      if (supported.has(s)) continue;
      s.falling = true;
      s.fallT = 0.12 + n++ * 0.07;
      if (this.keys.get(s.key) === s) this.keys.delete(s.key);
    }
  }

  update(dt) {
    for (const s of [...this.structures]) {
      if (s.falling) {
        s.fallT -= dt;
        s.mesh.position.y -= dt * 2;
        if (s.fallT <= 0) this._remove(s, true, false);
        continue;
      }
      if (s.grow < 1) {
        s.grow = Math.min(1, s.grow + dt * 6);
        const k = 1 - Math.pow(1 - s.grow, 3);
        if (s.type === 'ramp') s.mesh.scale.setScalar(Math.max(0.05, k));
        else s.mesh.scale.set(1, Math.max(0.05, k), 1);
      }
      // health fills in while the piece "builds up"
      if (s.buildT < s.buildTime) {
        const step = Math.min(dt, s.buildTime - s.buildT);
        s.buildT += step;
        s.hp = Math.min(s.maxHp, s.hp + (s.maxHp * (1 - MAT_STATS[s.mat].start) * step) / s.buildTime);
        s.mesh.material.opacity = 0.6 + 0.4 * (s.buildT / s.buildTime);
        if (s.buildT >= s.buildTime) { s.mesh.material.transparent = false; s.mesh.material.opacity = 1; s.mesh.material.needsUpdate = true; }
      }
      if (s.hitT > 0) {
        s.hitT -= dt;
        s.mesh.position.copy(s.base);
        if (s.hitT > 0) { s.mesh.position.x += (Math.random() - 0.5) * 0.06; s.mesh.position.z += (Math.random() - 0.5) * 0.06; }
      }
    }
  }
}
