import * as THREE from 'three';

// Enterable houses: painted plank walls with doors and glass windows, one or two stories
// (stairs + open upper floor), a shingled gable roof, and furnished rooms with loot.
// Walls are split into panels that break (bullets, axe, explosions) and give materials; windows
// shatter; doors open with interact (bots open them as they walk up). Everything resets per match.
//
// Houses are built in local space (x across the front, +z out of the front door, y up from the
// ground-floor top) and placed with a 90-degree rotation so every collider stays axis-aligned.

const T = 0.25;          // wall thickness
const STORY = 3.6;       // floor-to-floor height (walls run the full story, the slab sits inside)
const SLAB = 0.2;
const DOOR_W = 1.2, DOOR_H = 2.3;
const WIN_W = 1.25, WIN_Y0 = 1.0, WIN_Y1 = 2.25;
const OVERHANG = 0.5;
const PANEL_HP = 220, DOOR_HP = 120;

const PALETTES = {
  blue: { ext: '#8ab0e0', roof: '#3f5f93', shutter: '#2c5a95', inA: '#f6d7a4', inB: '#d8e6b8' },
  red: { ext: '#e59c80', roof: '#8d3b35', shutter: '#9b3a2e', inA: '#f7d6a6', inB: '#ecc9c4' },
  yellow: { ext: '#f0d383', roof: '#a4553a', shutter: '#3f7a5a', inA: '#e9e2b0', inB: '#f5cfa8' },
  green: { ext: '#a0cd95', roof: '#4c6e3f', shutter: '#6b4428', inA: '#f4d9ac', inB: '#d6dcb8' },
};
const TRIM = '#f5f2ea', FOUND = '#9a9790', FLOOR_A = '#b98552', FLOOR_B = '#a8764a', CEIL = '#f8e3bf';
const DOOR = '#8a5630', DOOR_DARK = '#6d4224', STAIR = '#9c6b40', KNOB = '#e8c35a';

const _c = new THREE.Color();
const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

// Tiny vertex-colored geometry builder (one draw call per house).
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; }

  // Quad a-b-c-d (any winding) facing along n.
  quad(a, b, c, d, n, col) {
    _e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_e1, _e2);
    const flip = _n.x * n[0] + _n.y * n[1] + _n.z * n[2] < 0;
    const tri = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    _c.set(col);
    for (const v of tri) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(_c.r, _c.g, _c.b); }
  }

  tri(a, b, c, n, col) {
    _e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_e1, _e2);
    const tri = _n.x * n[0] + _n.y * n[1] + _n.z * n[2] < 0 ? [a, c, b] : [a, b, c];
    _c.set(col);
    for (const v of tri) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(_c.r, _c.g, _c.b); }
  }

  // Axis-aligned box. style(face) -> null (skip), a color, or { c, c2, step, axis } to paint stripes
  // (siding, floor planks) alternating c / c2 every `step` metres along `axis` ('x' | 'y' | 'z').
  box(x0, x1, y0, y1, z0, z1, style) {
    const faces = {
      px: { n: [1, 0, 0], at: (u, v) => [x1, u, v], u: [y0, y1], v: [z0, z1], ax: ['y', 'z'] },
      nx: { n: [-1, 0, 0], at: (u, v) => [x0, u, v], u: [y0, y1], v: [z0, z1], ax: ['y', 'z'] },
      py: { n: [0, 1, 0], at: (u, v) => [u, y1, v], u: [x0, x1], v: [z0, z1], ax: ['x', 'z'] },
      ny: { n: [0, -1, 0], at: (u, v) => [u, y0, v], u: [x0, x1], v: [z0, z1], ax: ['x', 'z'] },
      pz: { n: [0, 0, 1], at: (u, v) => [u, v, z1], u: [x0, x1], v: [y0, y1], ax: ['x', 'y'] },
      nz: { n: [0, 0, -1], at: (u, v) => [u, v, z0], u: [x0, x1], v: [y0, y1], ax: ['x', 'y'] },
    };
    for (const k in faces) {
      const s = typeof style === 'function' ? style(k) : style;
      if (!s) continue;
      const f = faces[k];
      const [u0, u1] = f.u, [v0, v1] = f.v;
      if (typeof s === 'string' || !s.step) { this.quad(f.at(u0, v0), f.at(u1, v0), f.at(u1, v1), f.at(u0, v1), f.n, s.c || s); continue; }
      // stripes along one of the face's two axes, aligned to world-local multiples of step
      const alongU = f.ax[0] === s.axis;
      const [a0, a1] = alongU ? [u0, u1] : [v0, v1];
      let a = a0;
      while (a < a1 - 1e-4) {
        const band = Math.floor(a / s.step + 1e-4);
        const b = Math.min(a1, (band + 1) * s.step);
        const col = band % 2 ? s.c2 : s.c;
        if (alongU) this.quad(f.at(a, v0), f.at(b, v0), f.at(b, v1), f.at(a, v1), f.n, col);
        else this.quad(f.at(u0, a), f.at(u1, a), f.at(u1, b), f.at(u0, b), f.n, col);
        a = b;
      }
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

const shade = (hex, k) => '#' + _c.set(hex).multiplyScalar(k).getHexString();

export class Houses {
  // placeProp(type, x, y, z, height, rot, colR) puts a (breakable) KayKit prop at a world position.
  constructor(scene, colliders, rand, placeProp) {
    this.scene = scene;
    this.colliders = colliders;
    this.rand = rand;
    this.placeProp = placeProp;
    this.list = [];
    this.doors = [];
    this.lootSpots = [];   // { x, y, z } floor loot inside houses
    this.chestSpots = [];  // { x, y, z, rot }
    // a touch of warm self-light so rooms in the roof's shadow don't go cold and grey
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, emissive: '#4a3520', emissiveIntensity: 0.6, envMapIntensity: 0.35 });
    this.glassMat = new THREE.MeshStandardMaterial({ color: '#cdeeff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    this._t = 0;
  }

  // ---------- building ----------

  // Footprint size for a house kind (before rotation).
  static size(kind) { return kind === 'two' ? { W: 12, D: 9 } : { W: 10, D: 8 }; }

  add({ x, z, y, rot, color = 'blue', kind = 'one' }) {
    const { W, D } = Houses.size(kind);
    const r = this.rand;
    const pal = PALETTES[color] || PALETTES.blue;
    const stories = kind === 'two' ? 2 : 1;
    const h = {
      x, z, y, rot, W, D, stories, pal, kind,
      cos: Math.cos(rot), sin: Math.sin(rot),
      panels: [], glass: [], doors: [], deco: [], cols: [], portals: [],
      top: stories * STORY, // roof base (ceiling top)
    };
    h.px = kind === 'two' ? 2 : W / 2 - W / 3; // partition x (ground floor)
    h.ridge = D * 0.34;
    // group holds the static mesh, glass and doors in local space
    h.group = new THREE.Group();
    h.group.position.set(x, y, z);
    h.group.rotation.y = rot;
    this.scene.add(h.group);

    this._layout(h, r);
    this._staticColliders(h);
    this._furnish(h, r);
    this.rebuild(h);
    this.list.push(h);
    return h;
  }

  // local (lx, lz) -> world [x, z]
  w(h, lx, lz) { return [h.x + lx * h.cos + lz * h.sin, h.z - lx * h.sin + lz * h.cos]; }

  // local axis-aligned box -> world collider box
  wbox(h, x0, x1, y0, y1, z0, z1, extra = {}) {
    const a = this.w(h, x0, z0), b = this.w(h, x1, z1);
    return { kind: 'box', minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]), y0: h.y + y0, y1: h.y + y1, ...extra };
  }

  // local ramp rising toward local direction (dx, dz) -> world ramp collider
  wramp(h, x0, x1, y0, y1, z0, z1, dx, dz) {
    const c = this.wbox(h, x0, x1, y0, y1, z0, z1);
    const wx = dx * h.cos + dz * h.sin, wz = -dx * h.sin + dz * h.cos;
    return { ...c, kind: 'ramp', dirX: Math.round(wx), dirZ: Math.round(wz), house: true, mat: 'wood' };
  }

  _layout(h, r) {
    const { W, D, stories } = h;
    const hw = W / 2, hd = D / 2;
    const thirds = [-hw, -hw + W / 3, -hw + (2 * W) / 3, hw];
    const sideSplit = [-hd + T, 0, hd - T];
    for (let s = 0; s < stories; s++) {
      const y0 = s * STORY;
      // front (+z) and back (-z): three panels across; ground front middle is the front door
      for (let i = 0; i < 3; i++) {
        const u0 = thirds[i], u1 = thirds[i + 1];
        const front = s === 0 && i === 1 ? 'door' : (i === 1 || r() < 0.55) ? 'window' : 'solid';
        const back = s === 0 && stories === 2 && i === 2 ? 'door' : r() < 0.5 ? 'window' : 'solid';
        this._panel(h, { side: 'front', u0, u1, y0, type: front, room: s ? 'up' : u1 <= h.px + 0.01 ? 'A' : 'B' });
        this._panel(h, { side: 'back', u0, u1, y0, type: s === 0 && stories === 2 && i === 0 ? 'solid' : back, room: s ? 'up' : u1 <= h.px + 0.01 ? 'A' : 'B' });
      }
      // sides: two panels each
      for (let i = 0; i < 2; i++) {
        const u0 = sideSplit[i], u1 = sideSplit[i + 1];
        this._panel(h, { side: 'left', u0, u1, y0, type: r() < 0.6 ? 'window' : 'solid', room: s ? 'up' : 'A' });
        this._panel(h, { side: 'right', u0, u1, y0, type: r() < 0.6 ? 'window' : 'solid', room: s ? 'up' : 'B' });
      }
    }
    // ground-floor partition with an interior door
    h.partDoorZ = stories === 2 ? 1.2 : 0.9;
    this._panel(h, { side: 'part', u0: -hd + T, u1: hd - T, y0: 0, type: 'door', uc: h.partDoorZ, room: 'A' });

    // portals between regions (for bot routing): [regionA, pointA, regionB, pointB]
    h.portals.push(['out', [0, hd + 1.3], 'A', [0, hd - 1.4]]);
    h.portals.push(['A', [h.px - 1.1, h.partDoorZ], 'B', [h.px + 1.1, h.partDoorZ]]);
    if (stories === 2) {
      h.portals.push(['out', [hw - W / 6, -hd - 1.3], 'B', [hw - W / 6, -hd + 1.4]]);
      // stairs along the back wall of room A, climbing toward +x
      const sx0 = -hw + T + 0.05, sx1 = sx0 + 4.7, sz0 = -hd + T, sz1 = sz0 + 1.3;
      h.stairs = { x0: sx0, x1: sx1, z0: sz0, z1: sz1 };
      const zc = (sz0 + sz1) / 2;
      h.portals.push(['A', [sx0 + 0.5, sz1 + 1.0], 'stair', [sx0 + 0.5, zc]]);
      h.portals.push(['stair', [sx1 - 0.3, zc], 'up', [sx1 + 1.0, zc]]);
    }
  }

  // One wall panel with its rects (local boxes), opening, glass and door.
  _panel(h, { side, u0, u1, y0, type, room, uc = (u0 + u1) / 2 }) {
    const H = STORY;
    const rects = [];
    const ow = type === 'door' ? DOOR_W : WIN_W;
    if (type === 'solid') rects.push([u0, u1, 0, H]);
    else {
      rects.push([u0, uc - ow / 2, 0, H], [uc + ow / 2, u1, 0, H]);
      if (type === 'window') rects.push([uc - ow / 2, uc + ow / 2, 0, WIN_Y0], [uc - ow / 2, uc + ow / 2, WIN_Y1, H]);
      else rects.push([uc - ow / 2, uc + ow / 2, DOOR_H, H]);
    }
    const p = { house: h, side, u0, u1, y0, type, uc, room, rects, hp: PANEL_HP, maxHp: PANEL_HP, broken: false, cols: [], mat: 'wood' };
    p.damage = (amount) => this.damagePanel(p, amount);
    if (type === 'window') {
      const g = { house: h, panel: p, hp: 1, broken: false, mat: 'glass' };
      g.box = this._wallBox(h, side, uc - ow / 2, uc + ow / 2, y0 + WIN_Y0, y0 + WIN_Y1, 0.03);
      g.damage = () => this.breakGlass(g);
      p.glass = g;
      h.glass.push(g);
    }
    if (type === 'door') {
      const d = { house: h, panel: p, side, uc, y0, hp: DOOR_HP, maxHp: DOOR_HP, open: false, angle: 0, broken: false, mat: 'wood' };
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
      case 'front': { const [z0, z1] = thick === T ? [hd - T, hd] : mid(hd - T / 2); return [a0, a1, v0, v1, z0, z1]; }
      case 'back': { const [z0, z1] = thick === T ? [-hd, -hd + T] : mid(-hd + T / 2); return [a0, a1, v0, v1, z0, z1]; }
      case 'left': { const [x0, x1] = thick === T ? [-hw, -hw + T] : mid(-hw + T / 2); return [x0, x1, v0, v1, a0, a1]; }
      case 'right': { const [x0, x1] = thick === T ? [hw - T, hw] : mid(hw - T / 2); return [x0, x1, v0, v1, a0, a1]; }
      default: { const [x0, x1] = mid(h.px); return [x0, x1, v0, v1, a0, a1]; }
    }
  }

  // Which face of a wall box points outside (for siding) — null for the partition.
  static outFace(side) { return { front: 'pz', back: 'nz', left: 'nx', right: 'px' }[side] || null; }

  _staticColliders(h) {
    const { W, D } = h;
    const hw = W / 2, hd = D / 2;
    const add = (c) => { c.house = true; c.mat ||= 'wood'; this.colliders.add(c); h.cols.push(c); return c; };
    // ground floor / foundation
    add(this.wbox(h, -hw, hw, -3, 0, -hd, hd, { mat: 'stone' }));
    // upper floor with the stair hole
    if (h.stories === 2) {
      const s = h.stairs, yb = STORY - SLAB, yt = STORY;
      add(this.wbox(h, -hw + T, hw - T, yb, yt, s.z1 + 0.05, hd - T));
      add(this.wbox(h, s.x1, hw - T, yb, yt, -hd + T, s.z1 + 0.05));
      add(this.wramp(h, s.x0, s.x1, 0, STORY, s.z0, s.z1, 1, 0));
      // closet under the high half of the stairs (so nobody walks under them)
      const xb = s.x0 + (s.x1 - s.x0) * (1 / STORY);
      add(this.wbox(h, xb, s.x1, 0, 0.95, s.z0, s.z1));
      // railing around the stair hole upstairs
      add(this.wbox(h, s.x0, s.x1 - 0.2, STORY, STORY + 1.0, s.z1, s.z1 + 0.08));
    }
    // ceiling under the roof
    add(this.wbox(h, -hw, hw, h.top - SLAB, h.top, -hd, hd));
    // roof: two slopes meeting at the ridge (walkable from outside)
    const ey = h.top - 0.3, ry = h.top + h.ridge;
    add(this.wramp(h, -hw - OVERHANG, hw + OVERHANG, ey, ry, 0, hd + OVERHANG, 0, -1));
    add(this.wramp(h, -hw - OVERHANG, hw + OVERHANG, ey, ry, -hd - OVERHANG, 0, 0, 1));
    // chimney
    h.chimney = [hw * 0.45, hw * 0.45 + 0.8, -hd * 0.35, -hd * 0.35 + 0.8];
    const [cx0, cx1, cz0, cz1] = h.chimney;
    add(this.wbox(h, cx0, cx1, h.top, h.top + h.ridge + 0.9, cz0, cz1, { mat: 'stone' }));
    // panels
    for (const p of h.panels) this._panelColliders(p);
    for (const g of h.glass) { g.col = { ...this.wbox(h, ...this._glassWorld(g)), house: true, mat: 'glass', part: g }; this.colliders.add(g.col); }
    for (const d of h.doors) this._doorCollider(d, true);
    // front step
    add(this.wbox(h, -1.1, 1.1, -3, -0.12, hd, hd + 0.9, { mat: 'stone' }));
    if (h.stories === 2) add(this.wbox(h, hw - W / 6 - 0.9, hw - W / 6 + 0.9, -3, -0.12, -hd - 0.9, -hd, { mat: 'stone' }));
  }

  _glassWorld(g) { const b = g.box; return [b[0], b[1], b[2], b[3], b[4], b[5]]; }

  _panelColliders(p) {
    const h = p.house;
    for (const [a0, a1, v0, v1] of p.rects) {
      const b = this._wallBox(h, p.side, a0, a1, p.y0 + v0, p.y0 + v1);
      const c = { ...this.wbox(h, ...b), house: true, mat: 'wood', part: p };
      this.colliders.add(c);
      p.cols.push(c);
    }
  }

  // The door leaf's collider (only while closed).
  _doorCollider(d, on) {
    if (d.col) { this.colliders.remove(d.col); d.col = null; }
    if (!on || d.broken) return;
    const b = this._wallBox(d.house, d.side, d.uc - DOOR_W / 2, d.uc + DOOR_W / 2, d.y0, d.y0 + DOOR_H, 0.1);
    d.col = { ...this.wbox(d.house, ...b), house: true, mat: 'wood', part: d };
    this.colliders.add(d.col);
  }

  // ---------- furniture & loot ----------

  _furnish(h, r) {
    const { W, D } = h;
    const hw = W / 2, hd = D / 2;
    const deco = h.deco; // [x0,x1,y0,y1,z0,z1, style] boxes added to the static mesh
    const solid = (x0, x1, y0, y1, z0, z1, style) => {
      deco.push([x0, x1, y0, y1, z0, z1, style]);
      const c = this.wbox(h, x0, x1, y0, y1, z0, z1, { crate: true, mat: 'wood' });
      this.colliders.add(c); h.cols.push(c);
    };
    const put = (type, lx, ly, lz, height, lrot, colR) => {
      const [x, z] = this.w(h, lx, lz);
      this.placeProp(type, x, h.y + ly, z, height, h.rot + lrot, colR);
    };
    const spot = (lx, ly, lz, list, extra = {}) => { const [x, z] = this.w(h, lx, lz); list.push({ x, y: h.y + ly, z, ...extra }); };
    const rug = (x0, x1, z0, z1, c1, c2, y = 0) => {
      deco.push([x0, x1, y + 0.005, y + 0.02, z0, z1, (f) => (f === 'py' ? { c: c1, c2, step: 0.45, axis: 'x' } : null)]);
      deco.push([x0 + 0.15, x1 - 0.15, y + 0.02, y + 0.03, z0 + 0.15, z1 - 0.15, (f) => (f === 'py' ? c2 : null)]);
    };
    const bed = (x0, z0, alongZ, y = 0) => {
      const L = 2.1, Wd = 1.4, [x1, z1] = alongZ ? [x0 + Wd, z0 + L] : [x0 + L, z0 + Wd];
      solid(x0, x1, y, y + 0.45, z0, z1, '#7b5230');
      deco.push([x0 + 0.05, x1 - 0.05, y + 0.45, y + 0.62, z0 + 0.05, z1 - 0.05, '#f3f1ea']);
      const blanket = ['#4f7fc9', '#c95b5b', '#5aa06b', '#d6a13c'][Math.floor(r() * 4)];
      if (alongZ) {
        deco.push([x0 + 0.04, x1 - 0.04, y + 0.5, y + 0.66, z0 + 0.7, z1 - 0.04, blanket]);
        deco.push([x0 + 0.2, x1 - 0.2, y + 0.62, y + 0.76, z0 + 0.12, z0 + 0.5, '#ffffff']);
        deco.push([x0, x1, y, y + 1.0, z0 - 0.08, z0, '#6a4428']);
      } else {
        deco.push([x0 + 0.7, x1 - 0.04, y + 0.5, y + 0.66, z0 + 0.04, z1 - 0.04, blanket]);
        deco.push([x0 + 0.12, x0 + 0.5, y + 0.62, y + 0.76, z0 + 0.2, z1 - 0.2, '#ffffff']);
        deco.push([x0 - 0.08, x0, y, y + 1.0, z0, z1, '#6a4428']);
      }
    };
    const shelf = (x0, x1, z0, z1, y = 0) => {
      solid(x0, x1, y, y + 1.9, z0, z1, '#8a5a34');
      const books = ['#c94f4f', '#4f7fc9', '#5aa06b', '#e0b84a', '#8e5fc0'];
      for (const sy of [0.45, 1.05, 1.6]) {
        const along = x1 - x0 > z1 - z0;
        for (let k = 0; k < 6; k++) {
          const t0 = k / 6 + 0.01, t1 = (k + 0.8) / 6;
          const col = books[Math.floor(r() * books.length)], hh = 0.25 + r() * 0.12;
          if (along) deco.push([x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, y + sy, y + sy + hh, z0 - 0.02, z1 + 0.02, col]);
          else deco.push([x0 - 0.02, x1 + 0.02, y + sy, y + sy + hh, z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1, col]);
        }
      }
    };
    const ix0 = -hw + T, ix1 = hw - T, iz0 = -hd + T, iz1 = hd - T;
    const px = h.px;

    // --- room A: living room ---
    rug(-hw + 1.4, px - 1.6, -0.2, hd - 2.0, '#b4574a', '#c96d5e');
    put('kk/furn_couch_pillows', ix0 + 0.55, 0, 0.6, 0.95, Math.PI / 2, 0.8);
    put('kk/furn_table_small', ix0 + 1.9, 0, 0.6, 0.55, 0, 0.45);
    put('kk/furn_lamp_standing', ix0 + 0.4, 0, iz1 - 0.45, 1.9, 0, 0.25);
    put('kk/furn_armchair', px - 0.9, 0, -1.6, 0.95, Math.PI / 2 + 0.4, 0.55);
    if (h.stories === 2) {
      shelf(ix0, ix0 + 0.4, 1.6, 2.9);
      spot(px - 1.2, 0.02, -0.8, this.lootSpots);
      spot(-1.6, 0.02, h.stairs.z1 + 0.7, this.chestSpots, { rot: h.rot });
    } else {
      shelf(ix0 + 1.2, ix0 + 2.8, iz0, iz0 + 0.4);
      spot(ix0 + 0.8, 0.02, iz0 + 0.8, this.chestSpots, { rot: h.rot + Math.PI / 2 });
      spot(-0.8, 0.02, -0.6, this.lootSpots);
    }

    // --- room B: kitchen (two stories) or bedroom ---
    if (h.stories === 2) {
      // counter along the right wall with a sink, and a fridge
      solid(ix1 - 0.65, ix1, 0, 0.95, iz0 + 0.1, iz0 + 3.2, (f) => (f === 'py' ? '#e9e4da' : '#f2eee6'));
      deco.push([ix1 - 0.6, ix1 - 0.1, 0.95, 0.98, iz0 + 1.4, iz0 + 2.0, '#9aa5b1']);
      for (let k = 0; k < 4; k++) deco.push([ix1 - 0.67, ix1 - 0.65, 0.2, 0.85, iz0 + 0.2 + k * 0.75, iz0 + 0.85 + k * 0.75, '#dcd5c8']);
      solid(ix1 - 0.8, ix1, 0, 2.0, iz0 + 3.35, iz0 + 4.1, '#f7f7f4');
      deco.push([ix1 - 0.82, ix1 - 0.8, 1.2, 1.7, iz0 + 3.45, iz0 + 3.5, '#9aa5b1']);
      put('kk/furn_table_medium', px + 1.8, 0, hd - 1.5, 0.8, 0, 0.7);
      put('kk/furn_chair_A_wood', px + 1.0, 0, hd - 1.5, 0.95, Math.PI / 2, 0.3);
      put('kk/furn_chair_B_wood', px + 2.6, 0, hd - 1.5, 0.95, -Math.PI / 2, 0.3);
      spot(px + 1.5, 0.02, -0.4, this.lootSpots);

      // --- upstairs: bedroom + study ---
      const y = STORY;
      bed(ix1 - 1.5, iz0 + 0.05, true, y);
      bed(1.2, iz0 + 0.05, true, y);
      rug(-2.2, 1.0, 0.6, iz1 - 0.6, '#3f6fb0', '#5584c4', y);
      shelf(ix0, ix0 + 0.4, 0.8, 2.4, y);
      put('kk/furn_armchair', -3.6, y, iz1 - 0.9, 0.95, Math.PI, 0.55);
      put('kk/furn_lamp_standing', ix1 - 0.4, y, iz1 - 0.4, 1.9, 0, 0.25);
      solid(ix1 - 0.6, ix1, y, y + 2.1, 1.4, 2.8, '#7b5230'); // wardrobe
      deco.push([ix1 - 0.62, ix1 - 0.6, y + 0.1, y + 2.0, 2.08, 2.12, '#5a3a20']);
      spot(0, y + 0.02, iz1 - 1.0, this.lootSpots);
      if (r() < 0.5) spot(-2.5, y + 0.02, 0.2, this.chestSpots, { rot: h.rot + Math.PI });
    } else {
      bed(ix1 - 1.5, iz0 + 0.05, true);
      solid(px + 0.2, px + 0.7, 0, 0.6, iz0 + 0.1, iz0 + 0.6, '#7b5230'); // nightstand
      put('kk/furn_lamp_standing', ix1 - 0.4, 0, iz1 - 0.4, 1.9, 0, 0.25);
      rug(px + 0.5, ix1 - 0.3, 1.0, iz1 - 0.5, '#5aa06b', '#6cb57d');
      spot(px + 1.4, 0.02, 1.8, this.lootSpots);
    }
  }

  // ---------- visuals ----------

  rebuild(h) {
    const g = new Geo();
    const { W, D, pal } = h;
    const hw = W / 2, hd = D / 2;
    const siding = { c: pal.ext, c2: shade(pal.ext, 0.9), step: 0.4, axis: 'y' };
    const trimStyle = TRIM;
    // foundation band
    g.box(-hw - 0.08, hw + 0.08, -1.6, 0.02, -hd - 0.08, hd + 0.08, (f) => (f === 'ny' ? null : f === 'py' ? null : FOUND));
    // floors (planks on top, ceiling paint below)
    const planks = { c: FLOOR_A, c2: FLOOR_B, step: 0.32, axis: 'x' };
    g.box(-hw + T, hw - T, -0.02, 0.0, -hd + T, hd - T, (f) => (f === 'py' ? planks : null));
    if (h.stories === 2) {
      const s = h.stairs, yb = STORY - SLAB;
      const floorStyle = (f) => (f === 'py' ? planks : f === 'ny' ? CEIL : TRIM);
      g.box(-hw + T, hw - T, yb, STORY, s.z1 + 0.05, hd - T, floorStyle);
      g.box(s.x1, hw - T, yb, STORY, -hd + T, s.z1 + 0.05, floorStyle);
      // stairs: steps + side stringer
      const n = 13, run = (s.x1 - s.x0) / n, rise = STORY / n;
      for (let k = 0; k < n; k++) g.box(s.x0 + k * run, s.x0 + (k + 1) * run + 0.02, 0, (k + 1) * rise, s.z0, s.z1, (f) => (f === 'py' ? STAIR : f === 'ny' ? null : shade(STAIR, 0.8)));
      // railing upstairs
      g.box(s.x0, s.x1 - 0.2, STORY + 0.95, STORY + 1.05, s.z1, s.z1 + 0.08, TRIM);
      for (let x = s.x0 + 0.1; x < s.x1 - 0.2; x += 0.45) g.box(x, x + 0.05, STORY, STORY + 0.95, s.z1 + 0.015, s.z1 + 0.065, TRIM);
    }
    // ceiling of the top story
    g.box(-hw + T, hw - T, h.top - SLAB, h.top, -hd + T, hd - T, (f) => (f === 'ny' ? CEIL : null));

    // walls
    for (const p of h.panels) {
      if (p.broken) continue;
      const out = Houses.outFace(p.side);
      const inCol = p.side === 'part' ? pal.inA : p.room === 'B' ? pal.inB : pal.inA;
      const inColB = pal.inB;
      for (const [a0, a1, v0, v1] of p.rects) {
        const b = this._wallBox(h, p.side, a0, a1, p.y0 + v0, p.y0 + v1);
        g.box(...b, (f) => {
          if (f === 'py' || f === 'ny') return v1 >= STORY - 0.01 && f === 'py' ? null : TRIM;
          if (p.side === 'part') return f === 'px' ? inColB : f === 'nx' ? inCol : TRIM;
          if (f === out) return siding;
          const inner = { front: 'nz', back: 'pz', left: 'px', right: 'nx' }[p.side];
          return f === inner ? inCol : TRIM;
        });
      }
      // frames around openings (both faces), shutters outside
      if (p.type !== 'solid') {
        const ow = p.type === 'door' ? DOOR_W : WIN_W, v0 = p.type === 'door' ? 0 : WIN_Y0, v1 = p.type === 'door' ? DOOR_H : WIN_Y1;
        const fr = 0.1, pr = 0.05;
        {
          const bands = [
            [p.uc - ow / 2 - fr, p.uc - ow / 2, v0, v1 + fr],
            [p.uc + ow / 2, p.uc + ow / 2 + fr, v0, v1 + fr],
            [p.uc - ow / 2 - fr, p.uc + ow / 2 + fr, v1, v1 + fr],
          ];
          if (p.type === 'window') bands.push([p.uc - ow / 2 - fr, p.uc + ow / 2 + fr, v0 - fr, v0]);
          for (const [a0, a1, b0, b1] of bands) {
            const bx = this._wallBox(h, p.side, a0, a1, p.y0 + b0, p.y0 + b1, T + pr * 2);
            g.box(...bx, trimStyle);
          }
        }
        if (p.type === 'window' && p.side !== 'part') {
          // shutters on the outside face
          for (const s of [-1, 1]) {
            const a0 = s < 0 ? p.uc - ow / 2 - 0.62 : p.uc + ow / 2 + 0.12, a1 = a0 + 0.5;
            const bx = this._wallBox(h, p.side, a0, a1, p.y0 + WIN_Y0, p.y0 + WIN_Y1, T + 0.12);
            // keep only the outer half: shift so it sits on the outside
            g.box(...this._outerSkin(h, p.side, bx), { c: pal.shutter, c2: shade(pal.shutter, 0.85), step: 0.18, axis: 'y' });
          }
          // flower box under ground-floor windows
          if (p.y0 === 0) {
            const bx = this._outerSkin(h, p.side, this._wallBox(h, p.side, p.uc - 0.7, p.uc + 0.7, WIN_Y0 - 0.35, WIN_Y0 - 0.05, T + 0.5));
            g.box(...bx, '#8a5a34');
            const fl = this._outerSkin(h, p.side, this._wallBox(h, p.side, p.uc - 0.6, p.uc + 0.6, WIN_Y0 - 0.05, WIN_Y0 + 0.12, T + 0.4));
            g.box(...fl, { c: '#e0566f', c2: '#f2c14e', step: 0.2, axis: p.side === 'left' || p.side === 'right' ? 'z' : 'x' });
          }
        }
      }
    }
    // corner posts and the band between stories
    for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) g.box(cx - 0.14, cx + 0.14, -0.1, h.top, cz - 0.14, cz + 0.14, TRIM);
    if (h.stories === 2) {
      g.box(-hw - 0.05, hw + 0.05, STORY - 0.15, STORY + 0.05, hd - 0.02, hd + 0.05, TRIM);
      g.box(-hw - 0.05, hw + 0.05, STORY - 0.15, STORY + 0.05, -hd - 0.05, -hd + 0.02, TRIM);
      g.box(-hw - 0.05, -hw + 0.02, STORY - 0.15, STORY + 0.05, -hd, hd, TRIM);
      g.box(hw - 0.02, hw + 0.05, STORY - 0.15, STORY + 0.05, -hd, hd, TRIM);
    }
    // front step(s)
    g.box(-1.1, 1.1, -0.45, -0.12, hd, hd + 0.9, (f) => (f === 'ny' ? null : FOUND));
    if (h.stories === 2) g.box(hw - W / 6 - 0.9, hw - W / 6 + 0.9, -0.45, -0.12, -hd - 0.9, -hd, (f) => (f === 'ny' ? null : FOUND));

    // roof
    this._roof(g, h);
    // furniture
    for (const [x0, x1, y0, y1, z0, z1, st] of h.deco) g.box(x0, x1, y0, y1, z0, z1, st);

    if (h.mesh) { h.group.remove(h.mesh); h.mesh.geometry.dispose(); }
    h.mesh = new THREE.Mesh(g.geometry(), this.mat);
    h.mesh.castShadow = true;
    h.mesh.receiveShadow = true;
    h.group.add(h.mesh);
    this._rebuildGlass(h);
    this._rebuildDoors(h);
  }

  // Shift a thickened wall box so it only sticks out on the outside of the wall.
  _outerSkin(h, side, b) {
    const hw = h.W / 2, hd = h.D / 2;
    const [x0, x1, y0, y1, z0, z1] = b;
    const t = side === 'front' || side === 'back' ? (z1 - z0) : (x1 - x0);
    const skin = (t - T) / 2;
    switch (side) {
      case 'front': return [x0, x1, y0, y1, hd, hd + skin];
      case 'back': return [x0, x1, y0, y1, -hd - skin, -hd];
      case 'left': return [-hw - skin, -hw, y0, y1, z0, z1];
      case 'right': return [hw, hw + skin, y0, y1, z0, z1];
      default: return b;
    }
  }

  _roof(g, h) {
    const hw = h.W / 2 + OVERHANG, hd = h.D / 2 + OVERHANG;
    const ey = h.top - 0.3, ry = h.top + h.ridge;
    const roof = h.pal.roof, roof2 = shade(h.pal.roof, 0.82), under = shade(h.pal.roof, 0.55);
    const rows = 8;
    for (const s of [1, -1]) {
      // shingle rows from the eave up to the ridge, each with a small lip
      for (let k = 0; k < rows; k++) {
        const t0 = k / rows, t1 = (k + 1) / rows;
        const z0 = s * hd * (1 - t0), z1 = s * hd * (1 - t1);
        const y0 = ey + (ry - ey) * t0, y1 = ey + (ry - ey) * t1;
        const n = [0, hd, s * (ry - ey)];
        const l = Math.hypot(n[1], n[2]); n[1] /= l; n[2] /= l;
        const col = k % 2 ? roof : roof2;
        g.quad([-hw, y0 + 0.08, z0], [hw, y0 + 0.08, z0], [hw, y1 + 0.08, z1], [-hw, y1 + 0.08, z1], n, col);
        g.quad([-hw, y0 - 0.02, z0], [hw, y0 - 0.02, z0], [hw, y0 + 0.08, z0], [-hw, y0 + 0.08, z0], [0, 0, s], shade(col, 0.7));
      }
      // underside
      const nd = [0, -hd, -s * (ry - ey)]; const l = Math.hypot(nd[1], nd[2]); nd[1] /= l; nd[2] /= l;
      g.quad([-hw, ey - 0.02, s * hd], [hw, ey - 0.02, s * hd], [hw, ry - 0.02, 0], [-hw, ry - 0.02, 0], nd, under);
      // gable-end edge of the roof slab
      for (const e of [-1, 1]) g.quad([e * hw, ey - 0.02, s * hd], [e * hw, ey + 0.08, s * hd], [e * hw, ry + 0.08, 0], [e * hw, ry - 0.02, 0], [e, 0, 0], under);
    }
    // ridge cap
    g.box(-hw, hw, ry, ry + 0.14, -0.14, 0.14, shade(roof, 0.7));
    // gable triangles on both ends
    const gw = h.W / 2, gd = h.D / 2;
    for (const e of [-1, 1]) {
      const x = e * gw;
      g.tri([x, h.top, -gd], [x, h.top, gd], [x, h.top + h.ridge - 0.03, 0], [e, 0, 0], h.pal.ext);
      // small round attic window
      g.box(x - (e > 0 ? 0 : 0.03), x + (e > 0 ? 0.03 : 0), h.top + 0.5, h.top + 1.1, -0.35, 0.35, '#2c3a4d');
      g.box(x - (e > 0 ? 0 : 0.05), x + (e > 0 ? 0.05 : 0), h.top + 0.45, h.top + 1.15, -0.42, -0.35, TRIM);
      g.box(x - (e > 0 ? 0 : 0.05), x + (e > 0 ? 0.05 : 0), h.top + 0.45, h.top + 1.15, 0.35, 0.42, TRIM);
    }
    // chimney
    const [cx0, cx1, cz0, cz1] = h.chimney;
    g.box(cx0, cx1, h.top, h.top + h.ridge + 0.9, cz0, cz1, { c: '#b0654a', c2: '#9c5a42', step: 0.3, axis: 'y' });
    g.box(cx0 - 0.08, cx1 + 0.08, h.top + h.ridge + 0.9, h.top + h.ridge + 1.05, cz0 - 0.08, cz1 + 0.08, '#6b6b6b');
  }

  _rebuildGlass(h) {
    const g = new Geo();
    for (const gl of h.glass) {
      if (gl.broken || gl.panel.broken) continue;
      g.box(...gl.box, (f) => (f === 'py' || f === 'ny' ? null : '#ffffff'));
    }
    if (h.glassMesh) { h.group.remove(h.glassMesh); h.glassMesh.geometry.dispose(); h.glassMesh = null; }
    if (!g.p.length) return;
    h.glassMesh = new THREE.Mesh(g.geometry(), this.glassMat);
    h.glassMesh.renderOrder = 2;
    h.group.add(h.glassMesh);
  }

  _rebuildDoors(h) {
    for (const d of h.doors) {
      if (d.pivot) { h.group.remove(d.pivot); d.pivot.traverse((o) => o.geometry?.dispose()); d.pivot = null; }
      if (d.broken || d.panel.broken) continue;
      const g = new Geo();
      const wd = DOOR_W - 0.04, th = 0.07;
      // leaf built along +x from the hinge, centred on z = 0
      g.box(0, wd, 0.02, DOOR_H - 0.02, -th / 2, th / 2, DOOR);
      for (const zs of [1, -1]) {
        for (const [y0, y1] of [[0.25, 1.05], [1.3, 2.05]]) g.box(0.15, wd - 0.15, y0, y1, zs > 0 ? th / 2 : -th / 2 - 0.02, zs > 0 ? th / 2 + 0.02 : -th / 2, DOOR_DARK);
        g.box(wd - 0.18, wd - 0.1, 1.0, 1.1, zs > 0 ? th / 2 : -th / 2 - 0.06, zs > 0 ? th / 2 + 0.06 : -th / 2, KNOB);
      }
      const mesh = new THREE.Mesh(g.geometry(), this.mat);
      mesh.castShadow = true;
      const pivot = new THREE.Group();
      pivot.add(mesh);
      // hinge at the left end of the opening (in wall-u terms); wall direction decides the frame
      const u = d.uc - DOOR_W / 2 + 0.02;
      const hw = h.W / 2, hd = h.D / 2;
      if (d.side === 'front') { pivot.position.set(u, d.y0, hd - T / 2); pivot.rotation.y = 0; }
      else if (d.side === 'back') { pivot.position.set(u, d.y0, -hd + T / 2); pivot.rotation.y = 0; }
      else { pivot.position.set(d.side === 'part' ? h.px : d.side === 'left' ? -hw + T / 2 : hw - T / 2, d.y0, u); pivot.rotation.y = -Math.PI / 2; }
      d.baseRot = pivot.rotation.y;
      // front doors swing inward (-z), back doors inward (+z), the partition door into room B (+x)
      d.openDelta = d.side === 'back' ? -Math.PI / 2 : Math.PI / 2;
      pivot.rotation.y = d.baseRot + d.openDelta * d.angle;
      d.pivot = pivot;
      h.group.add(pivot);
    }
  }

  // ---------- damage ----------

  damagePanel(p, amount) {
    if (p.broken) return;
    p.hp -= amount;
    if (p.hp > 0) return;
    p.broken = true;
    for (const c of p.cols) this.colliders.remove(c);
    p.cols = [];
    if (p.glass && !p.glass.broken) { p.glass.broken = true; if (p.glass.col) this.colliders.remove(p.glass.col); }
    if (p.door && !p.door.broken) { p.door.broken = true; this._doorCollider(p.door, false); }
    this._debris(p.house, this._panelCenter(p), '#c9a06a', 30);
    this.game?.sound.play('break', this._panelCenter(p));
    this.rebuild(p.house);
  }

  breakGlass(gl) {
    if (gl.broken) return;
    gl.broken = true;
    if (gl.col) this.colliders.remove(gl.col);
    gl.col = null;
    const b = gl.box;
    const [x, z] = this.w(gl.house, (b[0] + b[1]) / 2, (b[4] + b[5]) / 2);
    const pos = new THREE.Vector3(x, gl.house.y + (b[2] + b[3]) / 2, z);
    this._debris(gl.house, pos, '#d9f3ff', 22, 0.12);
    this.game?.sound.play('glass', pos);
    this._rebuildGlass(gl.house);
  }

  damageDoor(d, amount) {
    if (d.broken) return;
    d.hp -= amount;
    if (d.hp > 0) return;
    d.broken = true;
    this._doorCollider(d, false);
    this._debris(d.house, this._doorCenter(d), DOOR, 24);
    this.game?.sound.play('break', this._doorCenter(d));
    this._rebuildDoors(d.house);
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
    if (s && lx > s.x0 - 0.1 && lx < s.x1 && lz > s.z0 - 0.1 && lz < s.z1 + 0.05 && y - h.y < STORY - 0.3) return 'stair';
    if (h.stories === 2 && y - h.y > STORY - 1.0) return 'up';
    return lx < h.px ? 'A' : 'B';
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
    // up on the roof (landed there): walk off the nearest eave and drop down
    if (rFrom === 'roof') { const [x, z] = this.w(h, flx, Math.sign(flz || 1) * (h.D / 2 + 2.5)); return { x, z }; }
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
          if (!this._portalOpen(h, p)) continue;
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
  static _cross(h, px, pz, qx, qz, m) {
    const x0 = -h.W / 2 - m, x1 = h.W / 2 + m, z0 = -h.D / 2 - m, z1 = h.D / 2 + m;
    let t0 = 0, t1 = 1;
    const dx = qx - px, dz = qz - pz;
    for (const [p, q] of [[-dx, px - x0], [dx, x1 - px], [-dz, pz - z0], [dz, z1 - pz]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t0 < t1;
  }

  // Corner waypoint (local) to get from p to q without cutting through the house, or null.
  _around(h, px, pz, qx, qz) {
    if (!Houses._cross(h, px, pz, qx, qz, 0.3)) return null;
    const m = 1.4, cx = h.W / 2 + m, cz = h.D / 2 + m;
    let best = null, bd = Infinity;
    for (const [x, z] of [[-cx, -cz], [cx, -cz], [cx, cz], [-cx, cz]]) {
      if (Math.hypot(px - x, pz - z) < 0.8) continue;
      if (Houses._cross(h, px, pz, x, z, 0.3)) continue;
      const d = Math.hypot(px - x, pz - z) + Math.hypot(x - qx, z - qz) + (Houses._cross(h, x, z, qx, qz, 0.3) ? 8 : 0);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    return best;
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

  // Doors can be opened by bots, so only a broken-away wall or a door counts; always open.
  _portalOpen() { return true; }

  // ---------- per-frame ----------

  update(dt, actors, camPos) {
    // door animation
    for (const d of this.doors) {
      const want = d.open ? 1 : 0;
      if (d.angle === want || !d.pivot) { d.angle = want; continue; }
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
      // hide far-away doors and glass
      if (camPos) for (const h of this.list) {
        const far = (h.x - camPos.x) ** 2 + (h.z - camPos.z) ** 2 > 140 * 140;
        if (h.glassMesh) h.glassMesh.visible = !far;
        for (const d of h.doors) if (d.pivot) d.pivot.visible = !far;
      }
    }
  }

  _nearHouse(pos) {
    for (const h of this.list) if (Math.abs(h.x - pos.x) < h.W / 2 + 2.5 && Math.abs(h.z - pos.z) < h.W / 2 + 2.5) return h;
    return null;
  }

  // New match: every wall, window and door back in place, doors shut.
  reset() {
    for (const h of this.list) {
      let dirty = false;
      for (const p of h.panels) {
        if (p.broken) { p.broken = false; this._panelColliders(p); dirty = true; }
        p.hp = p.maxHp;
      }
      for (const gl of h.glass) {
        if (gl.broken) { gl.broken = false; gl.col = { ...this.wbox(h, ...this._glassWorld(gl)), house: true, mat: 'glass', part: gl }; this.colliders.add(gl.col); dirty = true; }
      }
      for (const d of h.doors) {
        d.hp = DOOR_HP;
        if (d.broken) { d.broken = false; dirty = true; }
        d.open = false; d.angle = 0;
        this._doorCollider(d, true);
      }
      if (dirty) this.rebuild(h);
      else for (const d of h.doors) if (d.pivot) d.pivot.rotation.y = d.baseRot;
    }
  }
}
