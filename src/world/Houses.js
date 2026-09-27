import * as THREE from 'three';

// Enterable houses built from the Medieval Village MegaKit (Quaternius, CC0): plaster / brick wall
// pieces on a 2 m grid with round-top doors and windows, tiled gable roofs with brick gable ends,
// one or two stories (interior stairs + upper floor), furnished with the Fantasy Props MegaKit.
// Every 2 m wall piece is a panel that breaks (bullets, axe, explosions) and gives materials;
// windows shatter; doors open with interact (bots open them as they walk up). Everything resets
// per match.
//
// Houses are built in local space (x across the front, +z out of the front door, y up from the
// ground-floor top) and placed with a 90-degree rotation so every collider stays axis-aligned.
// All kit pieces of all houses are drawn by one InstancedMesh per piece part (KitBatch); a broken
// panel just hides its instances.

const T = 0.4;           // wall thickness (the kit's wall pieces span z -0.31..0.09)
const STORY = 3.12;      // kit wall height
const SLAB = 0.2;
const DOOR_W = 1.12, DOOR_H = 2.38;
const WIN_W = 1.2, WIN_Y0 = 1.02, WIN_Y1 = 2.74;
const GLASS_W = 1.08, GLASS_Y0 = 1.06, GLASS_Y1 = 2.62;
const PANEL_HP = 220, DOOR_HP = 120;
export const YARD = 3.2;  // depth of a fenced front yard (Towns draws the fence)

// per-kind layout: footprint, roof and gable pieces with their measured extents
const KINDS = {
  one: { W: 6, D: 8, stories: 1, pz: 0, frontDoor: 0, partDoor: 0, roof: 'village/Roof_RoundTiles_6x8', gable: 'village/Roof_Front_Brick6', rx: 4.12, rz: 4.85, eave: -0.64, ridge: 4.89, gH: 4.38 },
  two: { W: 8, D: 10, stories: 2, pz: -1, frontDoor: 1, partDoor: 0.9, backDoor: 3, roof: 'village/Roof_RoundTiles_8x10', gable: 'village/Roof_Front_Brick8', rx: 4.98, rz: 5.9, eave: -0.57, ridge: 6.0, gH: 5.31 },
};
// stairs in two-story houses: along the left wall, low end at the front, climbing toward -z
const STAIR = { x0: -3.6, x1: -1.95, z0: -1.0, z1: 3.35, cx: -2.78 };

// plaster and roof-tile tints per house colour (multiplied over the kit textures)
const PALETTES = {
  blue: { plaster: '#e3ebf7', roof: '#aebfe8' },
  red: { plaster: '#f7e2d8', roof: '#ffffff' },
  yellow: { plaster: '#f7eccb', roof: '#f1d6a6' },
  green: { plaster: '#e3f0da', roof: '#bcd9a8' },
};
const FOUND = '#8f8b82', CEIL = '#d9c7a3', BEAM = '#5d4230', RAIL = '#6d4c33';

const _c = new THREE.Color();
const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Tiny vertex-colored geometry builder (foundations, ceilings, railings, rugs).
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; }

  quad(a, b, c, d, n, col) {
    _e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_e1, _e2);
    const flip = _n.x * n[0] + _n.y * n[1] + _n.z * n[2] < 0;
    const tri = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    _c.set(col);
    for (const v of tri) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(_c.r, _c.g, _c.b); }
  }

  // Axis-aligned box. style(face) -> null (skip) or a color; or a plain color for every face.
  box(x0, x1, y0, y1, z0, z1, style) {
    const faces = {
      px: { n: [1, 0, 0], q: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
      nx: { n: [-1, 0, 0], q: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
      py: { n: [0, 1, 0], q: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
      ny: { n: [0, -1, 0], q: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
      pz: { n: [0, 0, 1], q: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
      nz: { n: [0, 0, -1], q: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]] },
    };
    for (const k in faces) {
      const s = typeof style === 'function' ? style(k) : style;
      if (s) this.quad(...faces[k].q, faces[k].n, s);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// All kit pieces of every house: one InstancedMesh per (model, part). add() before finish(),
// hide()/show() after.
class KitBatch {
  constructor(models) {
    this.models = models;
    this.slots = new Map(); // key -> { part, mats: Matrix4[], colors: (Color|null)[] }
    this.meshes = new Map();
  }

  // Returns [{ key, idx }] handles, one per part (filter(partName) picks parts).
  add(type, matrix, { tint = null, filter = null } = {}) {
    const m = this.models.get(type);
    if (!m) return [];
    const out = [];
    m.parts.forEach((part, i) => {
      if (filter && !filter(part.name)) return;
      const key = `${type}#${i}`;
      if (!this.slots.has(key)) this.slots.set(key, { part, mats: [], colors: [] });
      const s = this.slots.get(key);
      s.mats.push(matrix.clone());
      s.colors.push(tint?.[part.name] || null);
      out.push({ key, idx: s.mats.length - 1 });
    });
    return out;
  }

  finish(scene) {
    const group = new THREE.Group();
    group.name = 'house-kit';
    for (const [key, s] of this.slots) {
      const tinted = s.colors.some(Boolean);
      const im = new THREE.InstancedMesh(s.part.geometry, s.part.material, s.mats.length);
      s.mats.forEach((mt, i) => {
        im.setMatrixAt(i, mt);
        if (tinted) im.setColorAt(i, s.colors[i] || _c.set('#ffffff'));
      });
      const glass = /Glass/.test(s.part.name);
      im.castShadow = !glass;
      im.receiveShadow = true;
      if (glass) im.renderOrder = 2;
      im.computeBoundingSphere();
      group.add(im);
      this.meshes.set(key, im);
    }
    scene.add(group);
    this.group = group;
  }

  set(handles, on) {
    const touched = new Set();
    for (const hd of handles) {
      const im = this.meshes.get(hd.key);
      if (!im) continue;
      im.setMatrixAt(hd.idx, on ? this.slots.get(hd.key).mats[hd.idx] : ZERO);
      touched.add(im);
    }
    for (const im of touched) im.instanceMatrix.needsUpdate = true;
  }
}

export class Houses {
  // placeProp(type, x, y, z, height, rot, colR) puts a (breakable) prop at a world position and
  // returns its instance index.
  constructor(scene, colliders, rand, models, placeProp) {
    this.scene = scene;
    this.colliders = colliders;
    this.rand = rand;
    this.models = models;
    this.placeProp = placeProp;
    this.kit = new KitBatch(models);
    this.list = [];
    this.doors = [];
    this.lootSpots = [];   // { x, y, z } floor loot inside houses
    this.chestSpots = [];  // { x, y, z, rot }
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 });
    // the kit's window glass (WeatherFX lights it up at night)
    this.glassMat = models.sharedMats?.get('MI_WindowGlass') || new THREE.MeshStandardMaterial({ color: '#cdeeff', transparent: true, opacity: 0.35 });
    if (this.glassMat.isMeshStandardMaterial) this.glassMat.depthWrite = false;
    this._t = 0;
  }

  // ---------- building ----------

  // Footprint size for a house kind (before rotation).
  static size(kind) { const k = KINDS[kind] || KINDS.one; return { W: k.W, D: k.D }; }

  // Local x of the front door.
  static doorX(kind) { return (KINDS[kind] || KINDS.one).frontDoor; }

  add({ x, z, y, rot, color = 'blue', kind = 'one' }) {
    const K = KINDS[kind] || KINDS.one;
    const r = this.rand;
    const pal = PALETTES[color] || PALETTES.blue;
    const h = {
      x, z, y, rot, W: K.W, D: K.D, stories: K.stories, K, kind,
      cos: Math.cos(rot), sin: Math.sin(rot),
      panels: [], glass: [], doors: [], cols: [], portals: [], handles: [],
      top: K.stories * STORY, pz: K.pz,
      tint: { MI_Plaster: new THREE.Color(pal.plaster), MI_RoundTiles: new THREE.Color(pal.roof) },
      brick: kind === 'two' || r() < 0.3, // brick ground floor
    };
    h.stairs = K.stories === 2 ? STAIR : null;
    // group holds the static mesh and doors in local space
    h.group = new THREE.Group();
    h.group.position.set(x, y, z);
    h.group.rotation.y = rot;
    this.scene.add(h.group);

    this._layout(h, r);
    this._staticColliders(h);
    this._shell(h, r);
    this._furnish(h, r);
    this._buildDoors(h);
    this.list.push(h);
    return h;
  }

  // Build the instanced kit meshes once every house is placed.
  finish() { this.kit.finish(this.scene); }

  // local (lx, lz) -> world [x, z]
  w(h, lx, lz) { return [h.x + lx * h.cos + lz * h.sin, h.z - lx * h.sin + lz * h.cos]; }

  // local axis-aligned box -> world collider box
  wbox(h, x0, x1, y0, y1, z0, z1, extra = {}) {
    const a = this.w(h, x0, z0), b = this.w(h, x1, z1);
    return { kind: 'box', minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]), y0: h.y + y0, y1: h.y + y1, ...extra };
  }

  // local ramp rising toward local direction (dx, dz) -> world ramp collider
  wramp(h, x0, x1, y0, y1, z0, z1, dx, dz, mat = 'wood') {
    const c = this.wbox(h, x0, x1, y0, y1, z0, z1);
    const wx = dx * h.cos + dz * h.sin, wz = -dx * h.sin + dz * h.cos;
    return { ...c, kind: 'ramp', dirX: Math.round(wx), dirZ: Math.round(wz), house: true, mat };
  }

  // Place a kit piece at a local position / rotation (and scale) in house h.
  _piece(h, type, lx, ly, lz, lrot = 0, sx = 1, sy = 1, sz = 1, opts = {}) {
    const [x, z] = this.w(h, lx, lz);
    _q.setFromAxisAngle(UP, h.rot + lrot);
    _m.compose(_p.set(x, h.y + ly, z), _q, _s.set(sx, sy, sz));
    return this.kit.add(type, _m, { tint: h.tint, ...opts });
  }

  _layout(h, r) {
    const { W, D, stories, K } = h;
    const hw = W / 2, hd = D / 2;
    const centers = (len) => Array.from({ length: len / 2 }, (_, i) => -len / 2 + 1 + i * 2);
    const win = (p) => (r() < p ? 'window' : 'solid');
    for (let s = 0; s < stories; s++) {
      const y0 = s * STORY;
      for (const uc of centers(W)) {
        const front = s === 0 && uc === K.frontDoor ? 'door' : s === 0 ? win(0.75) : win(0.6);
        const back = s === 0 && uc === K.backDoor ? 'door' : win(0.5);
        this._panel(h, { side: 'front', uc, y0, type: front });
        this._panel(h, { side: 'back', uc, y0, type: back });
      }
      for (const uc of centers(D)) {
        // no windows behind the stairs
        const behindStairs = s === 0 && h.stairs && uc > h.stairs.z0 && uc < h.stairs.z1;
        this._panel(h, { side: 'left', uc, y0, type: behindStairs ? 'solid' : win(0.55) });
        this._panel(h, { side: 'right', uc, y0, type: win(0.55) });
      }
    }
    // ground-floor partition (along x at z = pz) with an interior door; the kit pieces are
    // squeezed to fit between the side walls
    const inner = W - 2 * T, n = W / 2, sx = inner / W;
    for (let i = 0; i < n; i++) {
      const uc = -inner / 2 + (i + 0.5) * (inner / n);
      const isDoor = Math.abs(uc - K.partDoor) < 0.5;
      this._panel(h, { side: 'part', uc, y0: 0, type: isDoor ? 'door' : 'solid', sx });
    }

    // portals between regions (for bot routing): [regionA, pointA, regionB, pointB]
    const fd = K.frontDoor, pd = K.partDoor;
    h.portals.push(['out', [fd, hd + 1.3], 'A', [fd, hd - 1.4]]);
    h.portals.push(['A', [pd, h.pz + 1.2], 'B', [pd, h.pz - 1.2]]);
    if (K.backDoor !== undefined) h.portals.push(['out', [K.backDoor, -hd - 1.3], 'B', [K.backDoor, -hd + 1.4]]);
    if (h.stairs) {
      const s = h.stairs;
      h.portals.push(['A', [s.cx, hd - 0.9], 'stair', [s.cx, s.z1 - 0.6]]);
      h.portals.push(['stair', [s.cx, s.z0 + 1.3], 'up', [s.cx, s.z0 - 1.0]]);
    }
  }

  // One 2 m wall panel: its collider rects (u along the wall, v up), opening, glass and door.
  _panel(h, { side, uc, y0, type, sx = 1 }) {
    const H = STORY, half = sx;
    const u0 = uc - half, u1 = uc + half;
    const rects = [];
    const ow = (type === 'door' ? DOOR_W : WIN_W) * sx;
    if (type === 'solid') rects.push([u0, u1, 0, H]);
    else {
      rects.push([u0, uc - ow / 2, 0, H], [uc + ow / 2, u1, 0, H]);
      if (type === 'window') rects.push([uc - ow / 2, uc + ow / 2, 0, WIN_Y0], [uc - ow / 2, uc + ow / 2, WIN_Y1, H]);
      else rects.push([uc - ow / 2, uc + ow / 2, DOOR_H, H]);
    }
    const p = { house: h, side, u0, u1, y0, type, uc, sx, rects, hp: PANEL_HP, maxHp: PANEL_HP, broken: false, cols: [], mat: h.brick && y0 === 0 && side !== 'part' ? 'stone' : 'wood', handles: [] };
    p.damage = (amount) => this.damagePanel(p, amount);
    if (type === 'window') {
      const g = { house: h, panel: p, hp: 1, broken: false, mat: 'glass', handles: [] };
      g.box = this._wallBox(h, side, uc - GLASS_W / 2, uc + GLASS_W / 2, y0 + GLASS_Y0, y0 + GLASS_Y1, 0.03);
      g.damage = () => this.breakGlass(g);
      p.glass = g;
      h.glass.push(g);
    }
    if (type === 'door') {
      const d = { house: h, panel: p, side, uc, y0, w: DOOR_W * sx, hp: DOOR_HP, maxHp: DOOR_HP, open: false, angle: 0, broken: false, mat: 'wood' };
      d.damage = (amount) => this.damageDoor(d, amount);
      p.door = d;
      h.doors.push(d);
      this.doors.push(d);
    }
    h.panels.push(p);
  }

  // Local box of a rect on a wall side (u along the wall, v up), with optional thickness override.
  _wallBox(h, side, a0, a1, v0, v1, thick = T) {
    const hw = h.W / 2, hd = h.D / 2;
    const mid = (x) => [x - thick / 2, x + thick / 2];
    switch (side) {
      case 'front': { const [z0, z1] = mid(hd - T / 2); return [a0, a1, v0, v1, z0, z1]; }
      case 'back': { const [z0, z1] = mid(-hd + T / 2); return [a0, a1, v0, v1, z0, z1]; }
      case 'left': { const [x0, x1] = mid(-hw + T / 2); return [x0, x1, v0, v1, a0, a1]; }
      case 'right': { const [x0, x1] = mid(hw - T / 2); return [x0, x1, v0, v1, a0, a1]; }
      default: { const [z0, z1] = mid(h.pz); return [a0, a1, v0, v1, z0, z1]; }
    }
  }

  // Kit transform of a wall piece on a side: [lx, lz, lrot] (the piece's outer face is local +z).
  _wallFrame(h, side, uc) {
    const hw = h.W / 2, hd = h.D / 2, o = 0.09;
    switch (side) {
      case 'front': return [uc, hd - o, 0];
      case 'back': return [uc, -hd + o, Math.PI];
      case 'left': return [-hw + o, uc, -Math.PI / 2];
      case 'right': return [hw - o, uc, Math.PI / 2];
      default: return [uc, h.pz + 0.11, 0];
    }
  }

  _staticColliders(h) {
    const { W, D, K } = h;
    const hw = W / 2, hd = D / 2;
    const add = (c) => { c.house = true; c.mat ||= 'wood'; this.colliders.add(c); h.cols.push(c); return c; };
    // ground floor / foundation
    add(this.wbox(h, -hw, hw, -3, 0, -hd, hd, { mat: 'stone' }));
    // upper floor with the stair hole
    if (h.stairs) {
      const s = h.stairs, yb = STORY - SLAB, yt = STORY;
      const ix0 = -hw + T, ix1 = hw - T, iz0 = -hd + T, iz1 = hd - T;
      add(this.wbox(h, s.x1, ix1, yb, yt, iz0, iz1));
      add(this.wbox(h, ix0, s.x1, yb, yt, iz0, s.z0));
      add(this.wbox(h, ix0, s.x1, yb, yt, s.z1 - 0.35, iz1));
      add(this.wramp(h, s.x0, s.x1, 0, STORY, s.z0, s.z1, 0, -1));
      // closet under the high half of the stairs (so nobody walks under them)
      add(this.wbox(h, s.x0, s.x1, 0, 0.95, s.z0, s.z1 - (s.z1 - s.z0) / STORY));
      // railing around the stair hole upstairs
      add(this.wbox(h, s.x1, s.x1 + 0.08, STORY, STORY + 1.0, s.z0 + 0.5, s.z1 - 0.35));
      add(this.wbox(h, ix0, s.x1 + 0.08, STORY, STORY + 1.0, s.z1 - 0.43, s.z1 - 0.35));
    }
    // ceiling under the roof
    add(this.wbox(h, -hw, hw, h.top - SLAB, h.top, -hd, hd));
    // roof: two steep slopes meeting at the ridge (which runs front to back)
    const ey = h.top + K.eave, ry = h.top + K.ridge;
    add(this.wramp(h, 0, K.rx, ey, ry, -K.rz, K.rz, -1, 0));
    add(this.wramp(h, -K.rx, 0, ey, ry, -K.rz, K.rz, 1, 0));
    // brick gable ends (stepped)
    for (const zs of [1, -1]) {
      const z0 = zs > 0 ? hd - T : -hd, z1 = z0 + T;
      for (let k = 0; k < 3; k++) {
        const a = hw * (1 - k / 3);
        add(this.wbox(h, -a, a, h.top + (K.gH * k) / 3, h.top + (K.gH * (k + 1)) / 3, z0, z1, { mat: 'stone' }));
      }
    }
    // chimney on the right slope
    const cx = hw * 0.5, cz = -hd * 0.45;
    const surf = (x) => h.top + K.ridge - ((K.ridge - K.eave) / K.rx) * Math.abs(x);
    h.chimney = { x: cx, z: cz, y: surf(cx + 0.5) - 0.25 };
    add(this.wbox(h, cx - 0.5, cx + 0.5, h.chimney.y, h.chimney.y + 3.1, cz - 0.5, cz + 0.5, { mat: 'stone' }));
    // panels
    for (const p of h.panels) this._panelColliders(p);
    for (const g of h.glass) this._glassCollider(g);
    for (const d of h.doors) this._doorCollider(d, true);
    // door steps
    add(this.wbox(h, K.frontDoor - 1.0, K.frontDoor + 1.0, -3, -0.12, hd, hd + 0.9, { mat: 'stone' }));
    if (K.backDoor !== undefined) add(this.wbox(h, K.backDoor - 0.9, K.backDoor + 0.9, -3, -0.12, -hd - 0.9, -hd, { mat: 'stone' }));
  }

  _glassCollider(g) {
    g.col = { ...this.wbox(g.house, ...g.box), house: true, mat: 'glass', part: g };
    this.colliders.add(g.col);
  }

  _panelColliders(p) {
    const h = p.house;
    for (const [a0, a1, v0, v1] of p.rects) {
      const b = this._wallBox(h, p.side, a0, a1, p.y0 + v0, p.y0 + v1);
      const c = { ...this.wbox(h, ...b), house: true, mat: p.mat, part: p };
      this.colliders.add(c);
      p.cols.push(c);
    }
  }

  // The door leaf's collider (only while closed).
  _doorCollider(d, on) {
    if (d.col) { this.colliders.remove(d.col); d.col = null; }
    if (!on || d.broken) return;
    const b = this._wallBox(d.house, d.side, d.uc - d.w / 2, d.uc + d.w / 2, d.y0, d.y0 + DOOR_H, 0.12);
    d.col = { ...this.wbox(d.house, ...b), house: true, mat: 'wood', part: d };
    this.colliders.add(d.col);
  }

  // ---------- kit visuals ----------

  _shell(h, r) {
    const { W, D, K } = h;
    const hw = W / 2, hd = D / 2;
    const P = (n) => `village/${n}`;
    // walls
    for (const p of h.panels) {
      const brick = h.brick && p.y0 === 0 && p.side !== 'part';
      const [lx, lz, lr] = this._wallFrame(h, p.side, p.uc);
      let type;
      if (p.type === 'door') type = brick ? 'Wall_UnevenBrick_Door_Round' : 'Wall_Plaster_Door_Round';
      else if (p.type === 'window') type = brick ? 'Wall_UnevenBrick_Window_Wide_Round' : 'Wall_Plaster_Window_Wide_Round';
      else type = brick ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_Straight';
      p.handles.push(...this._piece(h, P(type), lx, p.y0, lz, lr, p.sx));
      if (p.type === 'window') {
        p.handles.push(...this._piece(h, P('Window_Wide_Round1'), lx, p.y0, lz, lr, 1, 1, 1, { filter: (n) => !/Glass/.test(n) }));
        p.glass.handles = this._piece(h, P('Window_Wide_Round1'), lx, p.y0, lz, lr, 1, 1, 1, { filter: (n) => /Glass/.test(n) });
        if (p.y0 === 0 && r() < 0.45) p.handles.push(...this._piece(h, P('WindowShutters_Wide_Round_Open'), lx, p.y0, lz, lr));
      }
      // ivy on some outside walls
      if (p.side !== 'part' && p.type === 'solid' && r() < 0.18) p.handles.push(...this._piece(h, P(r() < 0.5 ? 'Prop_Vine1' : 'Prop_Vine4'), lx, p.y0 + STORY - 0.4, lz, lr));
    }
    // corner posts
    for (let s = 0; s < h.stories; s++) {
      for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) h.handles.push(...this._piece(h, P('Corner_Exterior_Wood'), cx - Math.sign(cx) * 0.02, s * STORY, cz - Math.sign(cz) * 0.02, 0, 1, STORY / 3));
    }
    // floors
    const tile = (type, y, skip) => {
      for (let ix = -hw + 1; ix < hw; ix += 2) for (let iz = -hd + 1; iz < hd; iz += 2) {
        if (skip?.(ix, iz)) continue;
        h.handles.push(...this._piece(h, P(type), ix, y, iz));
      }
    };
    const keep = h.handles;
    h.handles = h.groundHandles = [];
    tile('Floor_WoodDark', 0.005);
    h.handles = keep;
    if (h.stairs) {
      const s = h.stairs;
      tile('Floor_WoodDark', STORY + 0.005, (ix, iz) => ix < s.x1 && iz > s.z0 && iz < s.z1 - 0.35);
      h.handles.push(...this._piece(h, P('Stair_Interior_Rails'), s.cx, 0, s.z1, 0, 0.95, STORY / 3.03, 1));
    }
    // roof, gables, chimney
    h.handles.push(...this._piece(h, K.roof, 0, h.top, 0));
    h.handles.push(...this._piece(h, K.gable, 0, h.top, hd - 0.09, 0));
    h.handles.push(...this._piece(h, K.gable, 0, h.top, -hd + 0.09, Math.PI));
    h.handles.push(...this._piece(h, P('Prop_Chimney'), h.chimney.x, h.chimney.y, h.chimney.z));

    // static vertex-coloured bits: foundation, eave fill, ceilings, railings, steps
    const g = new Geo();
    g.box(-hw - 0.06, hw + 0.06, -1.6, 0.02, -hd - 0.06, hd + 0.06, (f) => (f === 'ny' || f === 'py' ? null : FOUND));
    // the kit roof sits a little above the long walls: close that gap
    for (const sx of [-1, 1]) g.box(sx > 0 ? hw - T : -hw, sx > 0 ? hw : -hw + T, h.top, h.top + 0.5, -hd, hd, (f) => (f === 'ny' ? null : BEAM));
    if (h.stairs) {
      const s = h.stairs, yb = STORY - SLAB;
      const ix0 = -hw + T, ix1 = hw - T, iz0 = -hd + T, iz1 = hd - T;
      const ceil = (f) => (f === 'ny' ? CEIL : f === 'py' ? null : BEAM);
      g.box(s.x1, ix1, yb, STORY, iz0, iz1, ceil);
      g.box(ix0, s.x1, yb, STORY, iz0, s.z0, ceil);
      g.box(ix0, s.x1, yb, STORY, s.z1 - 0.35, iz1, ceil);
      // railing around the hole
      g.box(s.x1, s.x1 + 0.08, STORY + 0.92, STORY + 1.0, s.z0 + 0.5, s.z1 - 0.35, RAIL);
      g.box(ix0, s.x1 + 0.08, STORY + 0.92, STORY + 1.0, s.z1 - 0.43, s.z1 - 0.35, RAIL);
      for (let z = s.z0 + 0.5; z < s.z1 - 0.4; z += 0.5) g.box(s.x1 + 0.01, s.x1 + 0.07, STORY, STORY + 0.92, z, z + 0.06, RAIL);
      for (let x = ix0 + 0.3; x < s.x1; x += 0.5) g.box(x, x + 0.06, STORY, STORY + 0.92, s.z1 - 0.42, s.z1 - 0.36, RAIL);
    }
    // door steps
    g.box(K.frontDoor - 1.0, K.frontDoor + 1.0, -0.45, -0.12, hd, hd + 0.9, (f) => (f === 'ny' ? null : FOUND));
    if (K.backDoor !== undefined) g.box(K.backDoor - 0.9, K.backDoor + 0.9, -0.45, -0.12, -hd - 0.9, -hd, (f) => (f === 'ny' ? null : FOUND));
    for (const [x0, x1, y0, y1, z0, z1, st] of h.rugs || []) g.box(x0, x1, y0, y1, z0, z1, st);
    h.mesh = new THREE.Mesh(g.geometry(), this.mat);
    h.mesh.castShadow = true;
    h.mesh.receiveShadow = true;
    h.group.add(h.mesh);
  }

  // Door leaves: a kit door per opening, on its own pivot so it can swing.
  _buildDoors(h) {
    const m = this.models.get('village/Door_1_Round');
    const hd = h.D / 2;
    for (const d of h.doors) {
      const pivot = new THREE.Group();
      if (m) for (const part of m.parts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.castShadow = !/Glass/.test(part.name);
        pivot.add(mesh);
      }
      const sx = d.w / DOOR_W;
      pivot.scale.set(sx, 1, 1);
      // hinge at the low-u end of the opening, leaf along +x
      const zc = d.side === 'front' ? hd - 0.2 : d.side === 'back' ? -hd + 0.2 : h.pz;
      pivot.position.set(d.uc - d.w / 2 + 0.01, d.y0, zc);
      d.baseRot = 0;
      // front doors and the partition door swing inward (-z), back doors inward (+z)
      d.openDelta = d.side === 'back' ? -Math.PI / 2 : Math.PI / 2;
      d.pivot = pivot;
      h.group.add(pivot);
    }
  }

  // ---------- furniture & loot ----------

  _furnish(h, r) {
    const { W, D } = h;
    const hw = W / 2, hd = D / 2;
    h.rugs = [];
    // kit prop at real scale; col: true adds a breakable box collider sized from the model
    const put = (name, lx, ly, lz, lrot = 0, { col = true, hp = 90, loot = 0.35, scale = 1 } = {}) => {
      const type = `props/${name}`;
      const info = this.models.get(type);
      if (!info) return;
      const [x, z] = this.w(h, lx, lz);
      const idx = this.placeProp(type, x, h.y + ly, z, info.size.y * scale, h.rot + lrot, 0);
      if (!col || idx === undefined) return;
      const q = Math.round(lrot / (Math.PI / 2)) % 2 !== 0;
      const ex = ((q ? info.size.z : info.size.x) * scale) / 2 - 0.05, ez = ((q ? info.size.x : info.size.z) * scale) / 2 - 0.05;
      const c = this.wbox(h, lx - ex, lx + ex, ly, ly + info.size.y * scale, lz - ez, lz + ez, { crate: true, mat: 'wood', breakable: { type, idx: [idx], hp, loot } });
      this.colliders.add(c);
    };
    const spot = (lx, ly, lz, list, extra = {}) => { const [x, z] = this.w(h, lx, lz); list.push({ x, y: h.y + ly, z, ...extra }); };
    const rug = (x0, x1, z0, z1, c1, c2, y = 0) => {
      h.rugs.push([x0, x1, y + 0.012, y + 0.025, z0, z1, (f) => (f === 'py' ? c1 : f === 'ny' ? null : c2)]);
      h.rugs.push([x0 + 0.18, x1 - 0.18, y + 0.025, y + 0.032, z0 + 0.18, z1 - 0.18, (f) => (f === 'py' ? c2 : null)]);
    };
    const rugCols = [['#8e3b33', '#b5654e'], ['#2f4f7a', '#577bb0'], ['#4f6b35', '#7d9c55'], ['#7a5a2a', '#b08a4a']];
    const rc = () => rugCols[Math.floor(r() * rugCols.length)];
    const PI = Math.PI;

    if (h.kind === 'one') {
      // front room: dining table, bookcase, barrels
      put('Table_Large', -1.85, 0, 1.9, PI / 2);
      put('Chair_1', -0.95, 0, 1.3, -PI / 2);
      put('Chair_1', -0.95, 0, 2.5, -PI / 2);
      put('Chandelier', -1.85, STORY - 0.02, 1.9, 0, { col: false });
      put('Bookcase_2', 2.35, 0, 1.6, -PI / 2);
      put(r() < 0.5 ? 'Barrel' : 'Barrel_Apples', 2.1, 0, 3.1, r() * 6);
      rug(-0.7, 0.7, 0.6, 3.2, ...rc());
      spot(1.1, 0.02, 2.9, this.lootSpots);
      // back room: bedroom
      put(r() < 0.5 ? 'Bed_Twin1' : 'Bed_Twin2', -1.5, 0, -2.35, 0);
      put('Nightstand_Shelf', -0.2, 0, -3.3, 0);
      put('Cabinet', 2.3, 0, -1.2, -PI / 2);
      put('CandleStick_Stand', 2.2, 0, -3.2, 0, { col: false });
      rug(0.2, 1.8, -3.0, -0.8, ...rc());
      spot(0.9, 0.02, -1.4, this.lootSpots);
      spot(1.5, 0.02, -3.0, this.chestSpots, { rot: h.rot });
    } else {
      // front room: table by the right wall, storage under the stairs
      put('Table_Large', 2.85, 0, 1.6, PI / 2);
      put('Chair_1', 2.0, 0, 1.0, -PI / 2);
      put('Chair_1', 2.0, 0, 2.2, -PI / 2);
      put('Chandelier', 2.85, STORY - 0.02, 1.6, 0, { col: false });
      put('Barrel_Apples', -1.35, 0, -0.3, r() * 6);
      put('Crate_Wooden', -1.35, 0, 0.75, 0);
      put('WeaponStand', -0.3, 0, -0.45, 0);
      rug(-1.2, 0.3, 1.5, 3.4, ...rc());
      spot(-0.5, 0.02, 2.4, this.lootSpots);
      spot(3.0, 0.02, 4.0, this.chestSpots, { rot: h.rot + PI });
      // back room: workshop
      put('Workbench', -2.4, 0, -4.05, 0);
      put('Cauldron', -0.4, 0, -3.95, 0);
      put('Stool', -2.4, 0, -2.9, 0);
      put('Barrel', -3.15, 0, -1.75, r() * 6);
      put('Shelf_Small_Bottles', 1.6, 0, -4.4, 0, { col: false });
      spot(1.6, 0.02, -2.6, this.lootSpots);
      // upstairs: bedroom
      const y = STORY;
      put('Bed_Twin1', 2.4, y, -3.4, 0);
      put('Bed_Twin2', -0.1, y, -3.4, 0);
      put('Nightstand_Shelf', 1.18, y, -4.3, 0);
      put('Bookcase_2', 0.8, y, 4.35, PI);
      put('BookStand', 2.8, y, 2.6, -PI / 2);
      put('CandleStick_Stand', 3.2, y, 4.2, 0, { col: false });
      rug(-0.6, 2.4, -1.4, 1.8, ...rc(), y);
      spot(1.4, y + 0.02, 0.2, this.lootSpots);
      if (r() < 0.6) spot(-1.2, y + 0.02, 4.0, this.chestSpots, { rot: h.rot + PI });
    }
    // a lantern by the front door
    put('Lantern_Wall', h.K.frontDoor + 1.0, 1.1, hd, 0, { col: false });
    // a banner on a plain upper wall
    const plain = h.panels.find((p) => p.side === 'front' && p.y0 === STORY && p.uc === -3 && p.type === 'solid');
    if (plain && r() < 0.8) put('Banner_1', -3.8, STORY + 2.55, hd + 0.1, 0, { col: false });
  }

  // ---------- damage ----------

  damagePanel(p, amount) {
    if (p.broken) return;
    p.hp -= amount;
    if (p.hp > 0) return;
    p.broken = true;
    for (const c of p.cols) this.colliders.remove(c);
    p.cols = [];
    this.kit.set(p.handles, false);
    if (p.glass && !p.glass.broken) { p.glass.broken = true; if (p.glass.col) this.colliders.remove(p.glass.col); p.glass.col = null; this.kit.set(p.glass.handles, false); }
    if (p.door && !p.door.broken) { p.door.broken = true; this._doorCollider(p.door, false); p.door.pivot.visible = false; }
    this._debris(p.house, this._panelCenter(p), p.mat === 'stone' ? '#a39a8c' : '#e8dcc4', 30);
    this.game?.sound.play('break', this._panelCenter(p));
    // knock out most of the outer walls and the whole house comes down (Fortnite: buildings flatten)
    const h = p.house, outer = h.panels.filter((q) => q.side !== 'part');
    if (!h.collapsed && outer.filter((q) => q.broken).length >= outer.length * 0.7) this.collapse(h);
  }

  // Flatten a house: every wall, the upper floor, stairs, roof and chimney go; the ground floor stays.
  collapse(h) {
    h.collapsed = true;
    for (const q of h.panels) if (!q.broken) { q.broken = true; for (const c of q.cols) this.colliders.remove(c); q.cols = []; this.kit.set(q.handles, false); }
    for (const gl of h.glass) if (!gl.broken) { gl.broken = true; if (gl.col) this.colliders.remove(gl.col); gl.col = null; this.kit.set(gl.handles, false); }
    for (const d of h.doors) if (!d.broken) { d.broken = true; this._doorCollider(d, false); d.pivot.visible = false; }
    h.upperCols = h.cols.filter((c) => c.y1 > h.y + 0.3);
    for (const c of h.upperCols) this.colliders.remove(c);
    this.kit.set(h.handles, false);
    if (h.mesh) h.mesh.visible = false;
    const fx = this.game?.effects;
    for (let i = 0; i < 6; i++) {
      const [x, z] = this.w(h, (Math.random() - 0.5) * h.W, (Math.random() - 0.5) * h.D);
      this._debris(h, new THREE.Vector3(x, h.y + 1 + Math.random() * h.top, z), i % 2 ? '#e8dcc4' : '#8a5a3a', 30, 0.3);
    }
    if (fx) this.game.rig.shake = Math.min(1, this.game.rig.shake + (this.game.camera.position.distanceTo(new THREE.Vector3(h.x, h.y, h.z)) < 40 ? 0.5 : 0));
    this.game?.sound.play('explosion', new THREE.Vector3(h.x, h.y + 3, h.z), { range: 120 });
    // anyone upstairs drops down
    for (const a of this.game?.actors || []) if (Math.abs(a.pos.x - h.x) < h.W && Math.abs(a.pos.z - h.z) < h.D && a.pos.y > h.y + 1) a.onGround = false;
  }

  breakGlass(gl) {
    if (gl.broken) return;
    gl.broken = true;
    if (gl.col) this.colliders.remove(gl.col);
    gl.col = null;
    this.kit.set(gl.handles, false);
    const pos = this._center(gl.house, gl.box);
    this._debris(gl.house, pos, '#d9f3ff', 22, 0.12);
    this.game?.sound.play('glass', pos);
  }

  damageDoor(d, amount) {
    if (d.broken) return;
    d.hp -= amount;
    if (d.hp > 0) return;
    d.broken = true;
    this._doorCollider(d, false);
    d.pivot.visible = false;
    this._debris(d.house, this._doorCenter(d), '#7a4f2c', 24);
    this.game?.sound.play('break', this._doorCenter(d));
  }

  // Grenades / rockets: damage panels, doors and windows nearby.
  explode(pos, radius, dmg) {
    for (const h of this.list) {
      if (Math.abs(h.x - pos.x) > radius + 8 || Math.abs(h.z - pos.z) > radius + 8) continue;
      for (const p of h.panels) {
        if (p.broken) continue;
        const d = this._panelCenter(p).distanceTo(pos);
        if (d < radius + 1) p.damage(dmg * (1 - 0.5 * Math.min(1, d / (radius + 1))));
      }
      for (const gl of h.glass) if (!gl.broken && this._center(h, gl.box).distanceTo(pos) < radius + 2) this.breakGlass(gl);
      for (const d of h.doors) if (!d.broken && this._doorCenter(d).distanceTo(pos) < radius + 1) this.damageDoor(d, dmg);
    }
  }

  _center(h, b) { const [x, z] = this.w(h, (b[0] + b[1]) / 2, (b[4] + b[5]) / 2); return new THREE.Vector3(x, h.y + (b[2] + b[3]) / 2, z); }
  _panelCenter(p) { return this._center(p.house, this._wallBox(p.house, p.side, p.u0, p.u1, p.y0, p.y0 + STORY)); }
  _doorCenter(d) { return this._center(d.house, this._wallBox(d.house, d.side, d.uc - 0.5, d.uc + 0.5, d.y0, d.y0 + DOOR_H)); }

  _debris(h, pos, color, n, size = 0.2) {
    const fx = this.game?.effects;
    if (!fx) return;
    _c.set(color);
    for (let i = 0; i < n; i++) fx.debris.emit(pos.x + (Math.random() - 0.5) * 2, pos.y + (Math.random() - 0.5) * 2, pos.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, _c, 0.9, size, 14);
  }

  // ---------- doors ----------

  setDoor(d, open) {
    if (d.broken || d.open === open) return;
    d.open = open;
    this._doorCollider(d, !open);
    this.game?.sound.play('door', this._doorCenter(d), { range: 40 });
  }

  // Closest door within reach of a position (for the interact prompt).
  nearestDoor(pos, reach = 1.9) {
    let best = null, bd = reach;
    for (const h of this.list) {
      if (Math.abs(h.x - pos.x) > 12 || Math.abs(h.z - pos.z) > 12) continue;
      for (const d of h.doors) {
        if (d.broken || d.panel.broken) continue;
        const c = this._doorCenter(d);
        if (Math.abs(c.y - (pos.y + 1.1)) > 1.6) continue;
        const dd = Math.hypot(c.x - pos.x, c.z - pos.z);
        if (dd < bd) { bd = dd; best = d; }
      }
    }
    return best;
  }

  // ---------- regions & routing (bots) ----------

  // House containing a world point (inside the walls), or null.
  houseAt(x, z) {
    for (const h of this.list) {
      const dx = x - h.x, dz = z - h.z;
      const lx = dx * h.cos - dz * h.sin, lz = dx * h.sin + dz * h.cos;
      if (Math.abs(lx) < h.W / 2 && Math.abs(lz) < h.D / 2) return { h, lx, lz };
    }
    return null;
  }

  _region(h, lx, lz, y) {
    if (Math.abs(lx) >= h.W / 2 || Math.abs(lz) >= h.D / 2) return 'out';
    if (y - h.y > h.top - 0.5) return 'roof';
    const s = h.stairs;
    if (s && lx > s.x0 - 0.1 && lx < s.x1 + 0.05 && lz > s.z0 - 0.05 && lz < s.z1 + 0.1 && y - h.y < STORY - 0.15) return 'stair';
    if (h.stories === 2 && y - h.y > STORY - 1.0) return 'up';
    return lz > h.pz ? 'A' : 'B';
  }

  // Next waypoint {x, z} on the way from `from` to (tx, tz, ty) through doors and stairs,
  // or null when the straight line is fine (same room, or neither end is in a house).
  route(from, tx, tz, ty = null) {
    const a = this.houseAt(from.x, from.z), b = this.houseAt(tx, tz);
    if (!a && !b) return this._aroundAny(from, tx, tz);
    const h = (a && b && a.h !== b.h) ? a.h : (a || b).h;
    const loc = (x, z) => { const dx = x - h.x, dz = z - h.z; return [dx * h.cos - dz * h.sin, dx * h.sin + dz * h.cos]; };
    const [flx, flz] = loc(from.x, from.z);
    const [tlx, tlz] = loc(tx, tz);
    const rFrom = this._region(h, flx, flz, from.y);
    const rTo = b && b.h === h ? this._region(h, tlx, tlz, ty ?? h.y) : 'out';
    // up on the roof (landed there): slide off the nearest eave and drop down
    if (rFrom === 'roof') { const [x, z] = this.w(h, Math.sign(flx || 1) * (h.W / 2 + 2.5), flz); return { x, z }; }
    if (rFrom === rTo) return null;
    // BFS over portals
    const prev = new Map([[rFrom, null]]);
    const q = [rFrom];
    while (q.length) {
      const r = q.shift();
      if (r === rTo) break;
      for (const p of h.portals) {
        for (const [ra, pa, rb, pb] of [[p[0], p[1], p[2], p[3]], [p[2], p[3], p[0], p[1]]]) {
          if (ra !== r || prev.has(rb)) continue;
          prev.set(rb, { from: r, near: pa, far: pb });
          q.push(rb);
        }
      }
    }
    if (!prev.has(rTo)) return null;
    let step = prev.get(rTo);
    while (step && step.from !== rFrom) step = prev.get(step.from);
    if (!step) return null;
    // walk to our side of the portal, then through to the far side
    const near = step.near, far = step.far;
    // once we're at (or already past) our side of the portal and lined up with it, go through
    const dn = Math.hypot(flx - near[0], flz - near[1]);
    const vx = far[0] - near[0], vz = far[1] - near[1], vl = Math.hypot(vx, vz) || 1;
    const along = ((flx - near[0]) * vx + (flz - near[1]) * vz) / (vl * vl);
    const side = Math.abs((flx - near[0]) * vz - (flz - near[1]) * vx) / vl;
    const pt = dn < 1.0 || (along > 0 && along < 1.1 && side < 0.9) ? far : near;
    // outside and the door is round the other side: walk around the corners
    if (rFrom === 'out' && pt === near) {
      const c = this._around(h, flx, flz, pt[0], pt[1]);
      if (c) { const [x, z] = this.w(h, c[0], c[1]); return { x, z }; }
    }
    const [x, z] = this.w(h, pt[0], pt[1]);
    return { x, z };
  }

  // Does the local segment p->q cross the house (grown by m)? Liang-Barsky clip.
  static _cross(h, px, pz, qx, qz, m, front = 0) {
    const side = front ? 0.6 : 0; // a fenced yard is a little wider than the house
    const x0 = -h.W / 2 - side - m, x1 = h.W / 2 + side + m, z0 = -h.D / 2 - m, z1 = h.D / 2 + front + m;
    let t0 = 0, t1 = 1;
    const dx = qx - px, dz = qz - pz;
    for (const [p, q] of [[-dx, px - x0], [dx, x1 - px], [-dz, pz - z0], [dz, z1 - pz]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t0 < t1;
  }

  // Corner waypoint (local) to get from p to q without cutting through the house (and its
  // fenced front yard, whose gate lines up with the front door), or null.
  _around(h, px, pz, qx, qz) {
    if (h.fence) {
      const hd = h.D / 2;
      const inYard = (x, z) => Math.abs(x) < h.W / 2 + 0.9 && z > hd - 0.1 && z < hd + YARD + 0.4;
      const gate = h.gate;
      const a = inYard(px, pz), b = inYard(qx, qz);
      if (a !== b && Math.hypot(px - gate[0], pz - gate[1]) > 0.7) {
        if (a) return gate;
        return this._aroundBox(h, px, pz, gate[0], gate[1]) || gate;
      }
      if (a && b) return null;
    }
    return this._aroundBox(h, px, pz, qx, qz);
  }

  _aroundBox(h, px, pz, qx, qz) {
    const front = h.fence ? YARD + 0.3 : 0;
    if (!Houses._cross(h, px, pz, qx, qz, 0.3, front)) return null;
    // standing right against the house (just out of a door): only the house itself blocks
    const m0 = Houses._cross(h, px, pz, px, pz, 0.3, front) ? 0 : 0.3;
    const cx = h.W / 2 + 2.1, czB = h.D / 2 + 2.1, czF = h.D / 2 + (h.fence ? YARD + 1.3 : 2.1);
    let best = null, bd = Infinity;
    for (const [x, z] of [[-cx, -czB], [cx, -czB], [cx, czF], [-cx, czF]]) {
      if (Math.hypot(px - x, pz - z) < 0.8) continue;
      if (Houses._cross(h, px, pz, x, z, m0, front)) continue;
      const d = Math.hypot(px - x, pz - z) + Math.hypot(x - qx, z - qz) + (Houses._cross(h, x, z, qx, qz, 0.3, front) ? 8 : 0);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    return best;
  }

  // A picket fence encloses the front yard: route through its gate (in front of the door).
  setFence(h) {
    h.fence = true;
    h.gate = [h.K.frontDoor, h.D / 2 + YARD + 1.3];
    h.portals[0][1] = h.gate;
  }

  // Both ends outside any house: steer around a house that sits in the way nearby.
  _aroundAny(from, tx, tz) {
    for (const h of this.list) {
      const dx = h.x - from.x, dz = h.z - from.z;
      if (dx * dx + dz * dz > 22 * 22) continue;
      const lf = [(from.x - h.x) * h.cos - (from.z - h.z) * h.sin, (from.x - h.x) * h.sin + (from.z - h.z) * h.cos];
      const lt = [(tx - h.x) * h.cos - (tz - h.z) * h.sin, (tx - h.x) * h.sin + (tz - h.z) * h.cos];
      const c = this._around(h, lf[0], lf[1], lt[0], lt[1]);
      if (c) { const [x, z] = this.w(h, c[0], c[1]); return { x, z }; }
    }
    return null;
  }

  // ---------- per-frame ----------

  update(dt, actors, camPos) {
    // door animation
    for (const d of this.doors) {
      const want = d.open ? 1 : 0;
      if (d.angle === want) continue;
      d.angle += Math.sign(want - d.angle) * Math.min(Math.abs(want - d.angle), dt * 4);
      d.pivot.rotation.y = d.baseRot + d.openDelta * d.angle;
    }
    // bots open doors they walk up to (a few times a second)
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.2;
      for (const a of actors) {
        if (a.isPlayer || !a.alive || a.state !== 'ground') continue;
        const hit = this.houseAt(a.pos.x, a.pos.z);
        const near = hit || this._nearHouse(a.pos);
        if (!near) continue;
        const d = this.nearestDoor(a.pos, 1.6);
        if (d && !d.open) this.setDoor(d, true);
      }
      // hide far-away doors and house interiors
      if (camPos) for (const h of this.list) {
        const far = (h.x - camPos.x) ** 2 + (h.z - camPos.z) ** 2 > 140 * 140;
        h.mesh.visible = !far;
        for (const d of h.doors) d.pivot.visible = !far && !d.broken;
      }
    }
  }

  _nearHouse(pos) {
    for (const h of this.list) if (Math.abs(h.x - pos.x) < h.D / 2 + 2.5 && Math.abs(h.z - pos.z) < h.D / 2 + 2.5) return h;
    return null;
  }

  // New match: every wall, window and door back in place, doors shut.
  reset() {
    for (const h of this.list) {
      if (h.collapsed) {
        h.collapsed = false;
        for (const c of h.upperCols || []) this.colliders.add(c);
        h.upperCols = null;
        this.kit.set(h.handles, true);
        if (h.mesh) h.mesh.visible = true;
      }
      for (const p of h.panels) {
        if (p.broken) { p.broken = false; this._panelColliders(p); this.kit.set(p.handles, true); }
        p.hp = p.maxHp;
      }
      for (const gl of h.glass) {
        if (gl.broken) { gl.broken = false; this._glassCollider(gl); this.kit.set(gl.handles, true); }
      }
      for (const d of h.doors) {
        d.hp = DOOR_HP;
        d.broken = false;
        d.open = false; d.angle = 0;
        d.pivot.visible = true;
        d.pivot.rotation.y = d.baseRot;
        this._doorCollider(d, true);
      }
    }
  }
}
