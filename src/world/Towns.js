import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { part, merge, mat } from './geomUtils.js';
import { TOWNS } from './Terrain.js';

// KayKit Medieval buildings (CC0). Uniform world scale keeps proportions consistent.
const KK_SCALE = 9.5;
const HOMES = ['home_A_blue', 'home_A_red', 'home_A_yellow', 'home_A_green', 'home_B_blue', 'home_B_red', 'home_B_yellow', 'home_B_green'].map((n) => `kk/${n}`);
const SPECIALS = ['tavern_red', 'tavern_blue', 'blacksmith_yellow', 'blacksmith_green', 'market_red', 'market_yellow', 'church_blue', 'church_red', 'tower_A_green', 'tower_A_red', 'lumbermill_red'].map((n) => `kk/${n}`);
const WINDMILLS = ['kk/windmill_yellow', 'kk/windmill_green'];
const FLAGS = ['kk/flag_blue', 'kk/flag_red', 'kk/flag_yellow', 'kk/flag_green'];

export class Towns {
  constructor(scene, terrain, colliders, models) {
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    this.models = models;
    this.rand = mulberry32(2024);
    this.houses = [];
    this.chestSpots = [];
    this.props = new Map();
    this.lanterns = [];
    const parts = [];
    const crates = [];
    for (const town of TOWNS) this._town(town, parts, crates);
    this._scatterCrates(crates);
    this._landmark(parts);

    // stone foundations (hide gaps on slopes)
    const geo = merge(parts);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'foundations';
    scene.add(mesh);

    for (const c of crates) this._place(c.type, c.x, c.y, c.z, c.rot, c.scale);
    for (const [type, pl] of this.props) if (pl.length) scene.add(models.instanced(type, pl));
    if (this.lanterns.length) {
      const lg = new THREE.BoxGeometry(0.42, 0.5, 0.42);
      const lm = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffc766', emissiveIntensity: 1.6, roughness: 0.4 });
      const li = new THREE.InstancedMesh(lg, lm, this.lanterns.length);
      this.lanterns.forEach((l, i) => li.setMatrixAt(i, mat(l.x, l.y, l.z, 0, 0, 0, l.small ? 0.7 : 1, l.small ? 0.35 : 1, l.small ? 0.7 : 1)));
      li.castShadow = true;
      scene.add(li);
    }

  }

  _place(type, x, y, z, rot = 0, scale = 1) {
    if (!this.props.has(type)) this.props.set(type, []);
    this.props.get(type).push({ x, y, z, rot, scale });
  }

  // Place a prop on the ground scaled to a target height (m), with an optional round collider.
  _prop(type, x, z, height, rot = 0, colR = 0) {
    const info = this.models.get(type);
    if (!info) return;
    const y = this.terrain.heightAt(x, z);
    if (y < 1) return;
    for (const h of this.houses) if (x > h.minX - 0.4 && x < h.maxX + 0.4 && z > h.minZ - 0.4 && z < h.maxZ + 0.4) return;
    const s = height / info.size.y;
    this._place(type, x, y - 0.02, z, rot, s);
    if (colR) this.colliders.add({ kind: 'circle', x, z, r: colR, y0: y - 1, y1: y + height, crate: true });
  }

  // A castle tower on a hill as a landmark.
  _landmark(parts) {
    const r = this.rand;
    let best = null;
    for (let i = 0; i < 400; i++) {
      const a = r() * Math.PI * 2, d = 40 + r() * 100;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (h < 6 || h > 22 || this.terrain.normalAt(x, z).y < 0.93) continue;
      if (TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 25)) continue;
      if (Math.hypot(x + 62, z - 88) < 70) continue;
      if (!best || h > best.h) best = { x, z, h };
    }
    if (!best) return;
    const info = this.models.get('kk/castle_blue');
    const s = 8;
    const y = Math.min(this.terrain.heightAt(best.x - 7, best.z - 7), this.terrain.heightAt(best.x + 7, best.z + 7), this.terrain.heightAt(best.x - 7, best.z + 7), this.terrain.heightAt(best.x + 7, best.z - 7), best.h) - 0.4;
    const rot = Math.round((r() * 4)) * (Math.PI / 2);
    this._place('kk/castle_blue', best.x, y, best.z, rot, s);
    const hx = info.size.x * s * 0.4, hz = info.size.z * s * 0.4;
    const [bx, bz] = rot % Math.PI === 0 ? [hx, hz] : [hz, hx];
    this.colliders.add({ kind: 'box', minX: best.x - bx, maxX: best.x + bx, minZ: best.z - bz, maxZ: best.z + bz, y0: y - 2, y1: y + info.size.y * s * 0.8, house: true });
    this.houses.push({ minX: best.x - bx, maxX: best.x + bx, minZ: best.z - bz, maxZ: best.z + bz, x: best.x, z: best.z, y, h: info.size.y * s, rot });
    const fx = Math.sin(rot), fz = Math.cos(rot);
    this.chestSpots.push({ x: best.x + fx * (bz + 3), z: best.z + fz * (bz + 3), rot });
    this.chestSpots.push({ x: best.x - fx * (bz + 3), z: best.z - fz * (bz + 3), rot: rot + Math.PI });
    this.landmark = { x: best.x, z: best.z, name: 'Castle Hill' };
  }

  _overlaps(box, pad) {
    for (const h of this.houses) {
      if (box.minX - pad < h.maxX && box.maxX + pad > h.minX && box.minZ - pad < h.maxZ && box.maxZ + pad > h.minZ) return true;
    }
    return false;
  }

  _town(town, parts, crates) {
    if (town.city) return this._city(town, crates);
    const r = this.rand;
    this._fountain(town, parts);
    this._cafe(town);
    const count = 6 + Math.floor(r() * 3);
    let placed = 0;
    const specials = [...SPECIALS].sort(() => r() - 0.5).slice(0, 2);
    for (let i = 0; i < count * 6 && placed < count; i++) {
      const a = (placed / count) * Math.PI * 2 + r() * 0.5 + i * 0.37;
      const dist = town.r * (0.5 + r() * 0.22);
      const x = town.x + Math.cos(a) * dist, z = town.z + Math.sin(a) * dist;
      // face the plaza, snapped to 90 degrees
      const face = Math.atan2(town.x - x, town.z - z);
      const rotIdx = ((Math.round(face / (Math.PI / 2)) % 4) + 4) % 4;
      const rot = rotIdx * (Math.PI / 2);
      const type = placed < specials.length ? specials[placed] : HOMES[Math.floor(r() * HOMES.length)];
      const info = this.models.get(type);
      const scale = KK_SCALE;
      const w = info.size.x * scale * 0.86, d = info.size.z * scale * 0.86, h = info.size.y * scale;
      const sw = rotIdx % 2 ? d : w, sd = rotIdx % 2 ? w : d;
      const box = { minX: x - sw / 2, maxX: x + sw / 2, minZ: z - sd / 2, maxZ: z + sd / 2 };
      if (this._overlaps(box, 3)) continue;
      const y = this.terrain.heightAt(x, z);
      this._house(parts, type, scale, x, y, z, rot, w, d);
      if (r() < 0.4 && type.includes('home')) this._fence(parts, x, y, z, rot, w, d);
      if (type.includes('home')) this._flowers(parts, x, y, z, rot, w, d);
      if (type.includes('home') && r() < 0.45) this._porch(x, z, rot, w, d);
      const col = { kind: 'box', ...box, y0: y - 3, y1: y + h, house: true };
      this.colliders.add(col);
      this.houses.push({ ...box, x, z, y, h, rot });
      placed++;
      // chest spot next to the door side, crates at the corner
      const fx = Math.sin(rot), fz = Math.cos(rot);
      const sideX = Math.cos(rot), sideZ = -Math.sin(rot);
      this.chestSpots.push({ x: x + fx * (d / 2 + 1.6) + sideX * (w / 2 - 1.2), z: z + fz * (d / 2 + 1.6) + sideZ * (w / 2 - 1.2), rot });
      if (r() < 0.8) {
        const cx = x - fx * 0 + sideX * (w / 2 + 1.1), cz = z + sideZ * (w / 2 + 1.1);
        this._crateStack(crates, cx, cz, r() < 0.4 ? 2 : 1);
      } else {
        this._barrel(x - sideX * (w / 2 + 1), z - sideZ * (w / 2 + 1) + fz * 1.5);
      }
      if (r() < 0.6) this._barrel(x + sideX * (w / 2 + 1.2) + fx * 2.2, z + sideZ * (w / 2 + 1.2) + fz * 2.2);
      // small props by the door
      const px = x + fx * (d / 2 + 1.2) - sideX * (w / 2 - 0.8), pz = z + fz * (d / 2 + 1.2) - sideZ * (w / 2 - 0.8);
      const pick = r();
      if (pick < 0.3) this._prop('kk/sack', px, pz, 0.55, r() * 6, 0.4);
      else if (pick < 0.5) this._prop('kk/bucket_water', px, pz, 0.6, r() * 6, 0.3);
      else if (pick < 0.7) this._prop('kk/wheelbarrow', px, pz, 0.9, rot + Math.PI / 2, 0.6);
      else if (pick < 0.8) this._prop('kk/weaponrack', px, pz, 1.4, rot, 0.5);
    }
    // windmill on the outskirts
    {
      const a = r() * Math.PI * 2, wx = town.x + Math.cos(a) * town.r * 1.12, wz = town.z + Math.sin(a) * town.r * 1.12;
      const type = WINDMILLS[Math.floor(r() * WINDMILLS.length)];
      const info = this.models.get(type);
      const wy = this.terrain.heightAt(wx, wz);
      const box = { minX: wx - 3.5, maxX: wx + 3.5, minZ: wz - 3.5, maxZ: wz + 3.5 };
      if (wy > 2 && !this._overlaps(box, 2)) {
        this._place(type, wx, wy - 0.2, wz, Math.atan2(town.x - wx, town.z - wz), KK_SCALE * 1.05);
        this.colliders.add({ kind: 'circle', x: wx, z: wz, r: 3.2, y0: wy - 2, y1: wy + info.size.y * KK_SCALE, house: true });
        this.houses.push({ ...box, x: wx, z: wz, y: wy, h: 14, rot: 0 });
      }
    }
    // tents and flags around the plaza
    for (let i = 0; i < 2; i++) {
      const a = r() * Math.PI * 2, d2 = town.r * (0.28 + r() * 0.08);
      this._prop('kk/tent', town.x + Math.cos(a) * d2, town.z + Math.sin(a) * d2, 2.6, Math.atan2(town.x - (town.x + Math.cos(a)), town.z - (town.z + Math.sin(a))) + Math.PI, 1.4);
    }
    const flag = FLAGS[Math.floor(r() * FLAGS.length)];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 1.2;
      this._prop(flag, town.x + Math.cos(a) * town.r * 0.42, town.z + Math.sin(a) * town.r * 0.42, 4.2, a, 0.2);
    }
    // lamp posts around the plaza
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      this._lamp(parts, town.x + Math.cos(a) * town.r * 0.36, town.z + Math.sin(a) * town.r * 0.36);
    }
    // plaza crates as cover
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, dist = 5 + r() * town.r * 0.25;
      this._crateStack(crates, town.x + Math.cos(a) * dist, town.z + Math.sin(a) * dist, r() < 0.3 ? 2 : 1);
    }
    this.chestSpots.push({ x: town.x + 4.2, z: town.z + 1.5, rot: Math.PI / 2 });
  }

  _crateStack(crates, x, z, n) {
    const y = this.terrain.heightAt(x, z);
    if (y < 1) return;
    for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < 4.2) return;
    for (const h of this.houses) if (x > h.minX - 0.8 && x < h.maxX + 0.8 && z > h.minZ - 0.8 && z < h.maxZ + 0.8) return;
    const rot = Math.round(this.rand() * 4) * (Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const type = 'kk/crate_A_big';
      const sz = this.models.get(type).size;
      crates.push({ type, x, y: y + i * 1.2 - 0.02, z, rot, scale: 1.2 / sz.y });
    }
    this.colliders.add({ kind: 'box', minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, y0: y - 1, y1: y + n * 1.2, crate: true });
  }

  _scatterCrates(crates) {
    const r = this.rand;
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, d = 20 + r() * 130;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (h < 2.5 || h > 25 || this.terrain.normalAt(x, z).y < 0.9) continue;
      this._crateStack(crates, x, z, 1);
      this._crateStack(crates, x + 1.25, z, r() < 0.5 ? 2 : 1);
      this.chestSpots.push({ x: x + 0.6, z: z + 2, rot: r() * 6 });
    }
  }

  _fountain(t, parts) {
    const y = this.terrain.heightAt(t.x, t.z);
    const M = (px, py, pz, rx = 0) => mat(t.x + px, y + py, t.z + pz, rx);
    parts.push(part(new THREE.CylinderGeometry(2.7, 2.9, 0.75, 20), '#d8d0c2', M(0, 0.37, 0)));
    parts.push(part(new THREE.CylinderGeometry(2.35, 2.35, 0.1, 20), '#5ec8e6', M(0, 0.68, 0)));
    parts.push(part(new THREE.CylinderGeometry(0.35, 0.45, 1.9, 10), '#cfc6b6', M(0, 1.3, 0)));
    parts.push(part(new THREE.CylinderGeometry(0.95, 0.5, 0.35, 14), '#d8d0c2', M(0, 2.3, 0)));
    parts.push(part(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 14), '#7fdcf2', M(0, 2.46, 0)));
    this.colliders.add({ kind: 'circle', x: t.x, z: t.z, r: 2.8, y0: y - 1, y1: y + 0.75, crate: true });
    this.colliders.add({ kind: 'circle', x: t.x, z: t.z, r: 0.5, y0: y - 1, y1: y + 2.5, crate: true });
    this.fountains = this.fountains || [];
    this.fountains.push({ x: t.x, y: y + 2.5, z: t.z });
  }

  _lamp(parts, x, z) {
    const y = this.terrain.heightAt(x, z);
    parts.push(part(new THREE.CylinderGeometry(0.09, 0.13, 3.4, 8), '#3a4150', mat(x, y + 1.7, z)));
    parts.push(part(new THREE.CylinderGeometry(0.25, 0.3, 0.25, 8), '#3a4150', mat(x, y + 0.12, z)));
    parts.push(part(new THREE.ConeGeometry(0.38, 0.3, 4), '#3a4150', mat(x, y + 3.85, z, 0, Math.PI / 4, 0)));
    this.lanterns.push({ x, y: y + 3.5, z });
    this.colliders.add({ kind: 'circle', x, z, r: 0.18, y0: y - 1, y1: y + 3.6, crate: true });
  }

  // White picket fence around the front yard, with a gate gap at the door path.
  _fence(parts, x, y, z, rot, w, d) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    const toWorld = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
    const yardD = 3.2, hw = w / 2 + 0.6;
    const segs = [
      [[-hw, d / 2], [-hw, d / 2 + yardD]],
      [[hw, d / 2], [hw, d / 2 + yardD]],
      [[-hw, d / 2 + yardD], [-1.3, d / 2 + yardD]],
      [[1.3, d / 2 + yardD], [hw, d / 2 + yardD]],
    ];
    const white = '#f7f4ee';
    for (const [[ax, az], [bx, bz]] of segs) {
      const a = toWorld(ax, az), b = toWorld(bx, bz);
      const len = a.distanceTo(b);
      const ang = Math.atan2(b.x - a.x, b.z - a.z);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      const gy = this.terrain.heightAt(cx, cz);
      if (gy < 1) continue;
      parts.push(part(new THREE.BoxGeometry(0.06, 0.08, len), white, mat(cx, gy + 0.75, cz, 0, ang, 0)));
      parts.push(part(new THREE.BoxGeometry(0.06, 0.08, len), white, mat(cx, gy + 0.35, cz, 0, ang, 0)));
      const n = Math.max(2, Math.round(len / 0.45));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
        const py = this.terrain.heightAt(px, pz);
        parts.push(part(new THREE.BoxGeometry(0.1, 1.0, 0.1), white, mat(px, py + 0.45, pz, 0, ang, 0)));
        parts.push(part(new THREE.ConeGeometry(0.075, 0.14, 4), white, mat(px, py + 1.02, pz, 0, ang + Math.PI / 4, 0)));
      }
      const hx = Math.abs(b.x - a.x) / 2 + 0.06, hz = Math.abs(b.z - a.z) / 2 + 0.06;
      this.colliders.add({ kind: 'box', minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, y0: gy - 1, y1: gy + 1.0, crate: true });
    }
  }

  _flowers(parts, x, y, z, rot, w, d) {
    const r = this.rand;
    const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
    const colors = ['#ff6b9a', '#ffd23f', '#ffffff', '#b47cff', '#ff8c42'];
    for (const side of [-1, 1]) {
      const lx = side * (w / 4 + 0.6), lz = d / 2 + 0.55;
      parts.push(part(new THREE.BoxGeometry(2.2, 0.3, 0.7), '#7a5230', base.clone().multiply(mat(lx, 0.12, lz))));
      parts.push(part(new THREE.BoxGeometry(2.0, 0.12, 0.55), '#4c8f3a', base.clone().multiply(mat(lx, 0.3, lz))));
      for (let i = 0; i < 6; i++) {
        const c = colors[Math.floor(r() * colors.length)];
        parts.push(part(new THREE.IcosahedronGeometry(0.13, 0), c, base.clone().multiply(mat(lx - 0.85 + i * 0.34, 0.45 + r() * 0.08, lz + (r() - 0.5) * 0.25))));
      }
    }
  }

  // Modern downtown built from KayKit City Builder Bits (12 m road/building tiles).
  _city(t, crates) {
    const r = this.rand;
    const T = 12, S = T / 2; // 2-unit tiles -> 12 m
    const y = t.y;
    const road = (dx, dz, type, rot) => this._place(`kk/city_road_${type}`, t.x + dx, y - 0.22, t.z + dz, rot, S);
    road(0, 0, 'junction', 0);
    road(T, 0, 'straight', 0); road(-T, 0, 'straight', 0);
    road(0, T, 'straight', Math.PI / 2); road(0, -T, 'straight', Math.PI / 2);
    // buildings in the four corner blocks + four along the road ends, facing the nearest road
    const blocks = [[T, T], [-T, T], [T, -T], [-T, -T], [2 * T, T * 0.0], [-2 * T, 0], [0, 2 * T], [0, -2 * T]];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].sort(() => r() - 0.5);
    blocks.forEach(([dx, dz], i) => {
      const bx = t.x + dx, bz = t.z + dz;
      const gy = Math.min(this.terrain.heightAt(bx - 5, bz - 5), this.terrain.heightAt(bx + 5, bz + 5), this.terrain.heightAt(bx - 5, bz + 5), this.terrain.heightAt(bx + 5, bz - 5));
      if (gy < 2) return;
      const type = `kk/city_building_${letters[i]}`;
      const info = this.models.get(type);
      // face toward the road (the axis with the smaller offset)
      const rot = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : (dz > 0 ? Math.PI : 0);
      this._place(type, bx, gy - 0.45, bz, rot, S);
      const hw = T * 0.4;
      const box = { minX: bx - hw, maxX: bx + hw, minZ: bz - hw, maxZ: bz + hw };
      this.colliders.add({ kind: 'box', ...box, y0: gy - 3, y1: gy + info.size.y * S, house: true });
      this.houses.push({ ...box, x: bx, z: bz, y: gy, h: info.size.y * S, rot });
      const fx = Math.sin(rot), fz = Math.cos(rot);
      this.chestSpots.push({ x: bx + fx * (hw + 1.4) + fz * 3, z: bz + fz * (hw + 1.4) - fx * 3, rot });
      // sidewalk props
      const sx = bx + fx * (hw + 0.8), sz = bz + fz * (hw + 0.8);
      const side = r() < 0.5 ? -3.5 : 3.5;
      if (r() < 0.6) this._prop('kk/city_bench', sx + fz * side, sz - fx * side, 0.6, rot, 0.6);
      if (r() < 0.5) this._prop('kk/city_firehydrant', sx - fz * side, sz + fx * side, 0.8, rot, 0.3);
      if (r() < 0.5) this._prop('kk/city_trash_A', sx - fz * side * 0.4, sz + fx * side * 0.4, 1.0, rot, 0.4);
    });
    // street lights along the roads
    for (const [dx, dz, rot] of [[T * 0.9, 4.2, 0], [-T * 0.9, -4.2, Math.PI], [4.2, -T * 0.9, -Math.PI / 2], [-4.2, T * 0.9, Math.PI / 2]]) {
      this._prop('kk/city_streetlight', t.x + dx, t.z + dz, 5.5, rot, 0.2);
      this.lanterns.push({ x: t.x + dx - Math.sin(rot) * 1.0, y: this.terrain.heightAt(t.x + dx, t.z + dz) + 5.2, z: t.z + dz - Math.cos(rot) * 1.0, small: true });
    }
    // parked cars (cover!)
    const cars = ['taxi', 'sedan', 'hatchback', 'police', 'stationwagon'];
    const spots = [[T * 0.7, 3.4, Math.PI / 2], [-T * 0.8, -3.4, -Math.PI / 2], [3.4, -T * 0.75, Math.PI], [-3.4, T * 0.7, 0], [T * 1.35, -3.4, Math.PI / 2]];
    for (const [dx, dz, rot] of spots) {
      const type = `kk/city_car_${cars[Math.floor(r() * cars.length)]}`;
      const info = this.models.get(type);
      const sc = 4.6 / info.size.z;
      const cx = t.x + dx, cz = t.z + dz, gy = this.terrain.heightAt(cx, cz);
      this._place(type, cx, gy + 0.05, cz, rot + (r() < 0.5 ? 0 : Math.PI), sc);
      const along = Math.abs(Math.sin(rot)) > 0.5;
      const hx = along ? 2.4 : 1.1, hz = along ? 1.1 : 2.4;
      this.colliders.add({ kind: 'box', minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, y0: gy - 1, y1: gy + info.size.y * sc * 0.9, crate: true });
    }
    // dumpsters and a water tower on the outskirts
    for (let i = 0; i < 2; i++) {
      const a = r() * Math.PI * 2;
      this._prop('kk/city_dumpster', t.x + Math.cos(a) * T * 1.5, t.z + Math.sin(a) * T * 1.5, 1.6, a, 1.3);
    }
    const wa = r() * Math.PI * 2;
    this._prop('kk/city_watertower', t.x + Math.cos(wa) * T * 2.4, t.z + Math.sin(wa) * T * 2.4, 13, 0, 2.2);
    for (let i = 0; i < 3; i++) {
      const a = r() * Math.PI * 2, d = T * (0.3 + r() * 0.25);
      this._crateStack(crates, t.x + Math.cos(a) * d + 4, t.z + Math.sin(a) * d + 4, 1);
    }
    this.chestSpots.push({ x: t.x + 4.5, z: t.z + 4.5, rot: 0 });
  }

  // Outdoor café (KayKit Furniture Bits) near the plaza.
  _cafe(t) {
    const r = this.rand;
    const a0 = r() * Math.PI * 2;
    for (let k = 0; k < 2; k++) {
      const a = a0 + k * 0.5, d = t.r * 0.24;
      const cx = t.x + Math.cos(a) * d, cz = t.z + Math.sin(a) * d;
      this._prop('kk/furn_table_small', cx, cz, 0.85, r() * 6, 0.5);
      const chair = r() < 0.5 ? 'kk/furn_chair_A_wood' : 'kk/furn_chair_B_wood';
      for (let c = 0; c < 4; c++) {
        const ca = (c / 4) * Math.PI * 2 + a;
        this._prop(chair, cx + Math.cos(ca) * 0.95, cz + Math.sin(ca) * 0.95, 1.0, Math.atan2(-Math.cos(ca), -Math.sin(ca)), 0);
      }
    }
  }

  // Porch furniture in front of homes.
  _porch(x, z, rot, w, d) {
    const r = this.rand;
    const fx = Math.sin(rot), fz = Math.cos(rot), sx = Math.cos(rot), sz = -Math.sin(rot);
    const px = x + fx * (d / 2 + 1.1) + sx * (w / 4), pz = z + fz * (d / 2 + 1.1) + sz * (w / 4);
    const pick = r();
    if (pick < 0.35) this._prop('kk/furn_couch_pillows', px, pz, 0.95, rot, 0.9);
    else if (pick < 0.7) this._prop('kk/furn_armchair', px, pz, 0.95, rot + (r() - 0.5) * 0.6, 0.6);
    else this._prop('kk/furn_lamp_standing', px, pz, 1.9, rot, 0.25);
    const cx = x + fx * (d / 2 + 0.8) - sx * (w / 2 - 0.5), cz = z + fz * (d / 2 + 0.8) - sz * (w / 2 - 0.5);
    this._prop(r() < 0.5 ? 'kk/furn_cactus_medium_A' : 'kk/furn_cactus_small_A', cx, cz, 0.9, r() * 6, 0.3);
  }

  _barrel(x, z) {
    const y = this.terrain.heightAt(x, z);
    for (const h of this.houses) if (x > h.minX - 0.6 && x < h.maxX + 0.6 && z > h.minZ - 0.6 && z < h.maxZ + 0.6) return;
    const info = this.models.get('kk/barrel');
    const s = 1.1 / info.size.y;
    this._place('kk/barrel', x, y - 0.02, z, this.rand() * 6, s);
    this.colliders.add({ kind: 'circle', x, z, r: info.size.x * s * 0.5, y0: y - 1, y1: y + 1.1, crate: true });
  }

  _house(parts, type, scale, x, y, z, rot) {
    this._place(type, x, y - 0.1, z, rot, scale);
  }

}
