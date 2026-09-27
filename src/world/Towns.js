import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { part, merge, mat } from './geomUtils.js';
import { TOWNS } from './Terrain.js';

const WALLS = ['#ffd6e0', '#bde0fe', '#caffbf', '#fdffb6', '#ffc8dd', '#ffd8a8', '#d7c8ff', '#b9fbc0', '#fff1c1', '#ffe0cc'];
const ROOFS = ['#e76f51', '#4f6bd8', '#d1495b', '#2a9d8f', '#8d6e63', '#ef8354', '#7b5ea7', '#3c9d5d'];
const HOUSE_TYPES = ['house1', 'house-3', 'house-4', 'house-5', 'house-7'];

export function makeCrateTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c98b4b';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#bf7f41' : '#d49656';
    ctx.fillRect(0, i * 32, 128, 32);
    ctx.fillStyle = 'rgba(90,50,20,0.5)';
    ctx.fillRect(0, i * 32, 128, 2);
  }
  ctx.strokeStyle = '#8a5429';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 114, 114);
  ctx.beginPath();
  ctx.moveTo(10, 10); ctx.lineTo(118, 118);
  ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Towns {
  constructor(scene, terrain, colliders, models) {
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    this.models = models;
    this.rand = mulberry32(2024);
    this.houses = [];
    this.chestSpots = [];
    this.housePlacements = new Map(HOUSE_TYPES.map((t) => [t, []]));
    this.barrels = [];
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

    for (const [type, pl] of this.housePlacements) if (pl.length) scene.add(models.instanced(type, pl));
    if (this.barrels.length) scene.add(models.instanced('barrel', this.barrels));
    if (this.lanterns.length) {
      const lg = new THREE.BoxGeometry(0.42, 0.5, 0.42);
      const lm = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffc766', emissiveIntensity: 1.6, roughness: 0.4 });
      const li = new THREE.InstancedMesh(lg, lm, this.lanterns.length);
      this.lanterns.forEach((l, i) => li.setMatrixAt(i, mat(l.x, l.y, l.z)));
      li.castShadow = true;
      scene.add(li);
    }

    const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    crateGeo.translate(0, 0.6, 0);
    const crateMesh = new THREE.InstancedMesh(crateGeo, new THREE.MeshStandardMaterial({ map: makeCrateTexture(), roughness: 0.85 }), crates.length);
    crates.forEach((c, i) => crateMesh.setMatrixAt(i, mat(c.x, c.y, c.z, 0, c.rot, 0)));
    crateMesh.castShadow = crateMesh.receiveShadow = true;
    crateMesh.computeBoundingSphere();
    scene.add(crateMesh);
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
    const info = this.models.get('tower');
    const s = 12 / info.size.y;
    const y = Math.min(this.terrain.heightAt(best.x - 4, best.z - 4), this.terrain.heightAt(best.x + 4, best.z + 4), best.h) - 0.3;
    this.scene.add(this.models.instanced('tower', [{ x: best.x, y, z: best.z, rot: r() * 6, scale: s }]));
    const hw = info.size.x * s * 0.28;
    this.colliders.add({ kind: 'box', minX: best.x - hw, maxX: best.x + hw, minZ: best.z - hw, maxZ: best.z + hw, y0: y - 2, y1: y + info.size.y * s, house: true });
    this.chestSpots.push({ x: best.x + hw + 2, z: best.z, rot: Math.PI / 2 });
    this.landmark = { x: best.x, z: best.z, name: 'Old Tower' };
  }

  _overlaps(box, pad) {
    for (const h of this.houses) {
      if (box.minX - pad < h.maxX && box.maxX + pad > h.minX && box.minZ - pad < h.maxZ && box.maxZ + pad > h.minZ) return true;
    }
    return false;
  }

  _town(town, parts, crates) {
    const r = this.rand;
    this._fountain(town, parts);
    const count = 6 + Math.floor(r() * 3);
    let placed = 0;
    for (let i = 0; i < count * 6 && placed < count; i++) {
      const a = (placed / count) * Math.PI * 2 + r() * 0.5 + i * 0.37;
      const dist = town.r * (0.5 + r() * 0.22);
      const x = town.x + Math.cos(a) * dist, z = town.z + Math.sin(a) * dist;
      // face the plaza, snapped to 90 degrees
      const face = Math.atan2(town.x - x, town.z - z);
      const rotIdx = ((Math.round(face / (Math.PI / 2)) % 4) + 4) % 4;
      const rot = rotIdx * (Math.PI / 2);
      const type = HOUSE_TYPES[Math.floor(r() * HOUSE_TYPES.length)];
      const info = this.models.get(type);
      const scale = (8.5 + r() * 2.5) / info.size.x;
      const w = info.size.x * scale, d = info.size.z * scale, h = info.size.y * scale;
      const sw = rotIdx % 2 ? d : w, sd = rotIdx % 2 ? w : d;
      const box = { minX: x - sw / 2, maxX: x + sw / 2, minZ: z - sd / 2, maxZ: z + sd / 2 };
      if (this._overlaps(box, 3)) continue;
      const y = this.terrain.heightAt(x, z);
      this._house(parts, type, scale, x, y, z, rot, w, d);
      if (r() < 0.55) this._fence(parts, x, y, z, rot, w, d);
      this._flowers(parts, x, y, z, rot, w, d);
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
    const rot = 0;
    for (let i = 0; i < n; i++) crates.push({ x, y: y + i * 1.2 - 0.02, z, rot });
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

  _barrel(x, z) {
    const y = this.terrain.heightAt(x, z);
    for (const h of this.houses) if (x > h.minX - 0.6 && x < h.maxX + 0.6 && z > h.minZ - 0.6 && z < h.maxZ + 0.6) return;
    const s = 1.35;
    this.barrels.push({ x, y: y + 0.38 * s - 0.02, z, rot: this.rand() * 6, rz: Math.PI / 2, scale: s });
    this.colliders.add({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 0.76 * s, crate: true });
  }

  _house(parts, type, scale, x, y, z, rot, w, d) {
    const r = this.rand;
    const wall = new THREE.Color(WALLS[Math.floor(r() * WALLS.length)]);
    const roof = new THREE.Color(ROOFS[Math.floor(r() * ROOFS.length)]);
    this.housePlacements.get(type).push({
      x, y: y - 0.05, z, rot, scale,
      colors: { main: wall, _defaultMat: wall, roof, border: new THREE.Color('#f4efe6') },
    });
    const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
    parts.push(part(new THREE.BoxGeometry(w + 0.5, 3, d + 0.5), '#b9ab98', base.clone().multiply(mat(0, -1.45, 0))));
    parts.push(part(new THREE.BoxGeometry(2.4, 0.2, 1.4), '#d6c7ad', base.clone().multiply(mat(0, 0.02, d / 2 + 0.7))));
  }
}
