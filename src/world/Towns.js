import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { part, merge, mat } from './geomUtils.js';
import { TOWNS } from './Terrain.js';

const WALLS = ['#ffd6e0', '#bde0fe', '#caffbf', '#fdffb6', '#ffc8dd', '#ffd8a8', '#c8b6ff', '#b9fbc0', '#fff1c1'];
const ROOFS = ['#e76f51', '#5c6bc0', '#d1495b', '#2a9d8f', '#8d6e63', '#ef8354', '#6d597a'];

function prismGeo(w, h, d) {
  // triangular prism: ridge along X, triangle in YZ
  const hw = w / 2, hd = d / 2;
  const v = [
    // front gable (z+) -> actually gables at x ends
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

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
  constructor(scene, terrain, colliders) {
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    this.rand = mulberry32(2024);
    this.houses = [];
    this.chestSpots = [];
    const parts = [];
    const crates = [];
    for (const town of TOWNS) this._town(town, parts, crates);
    this._scatterCrates(crates);

    const geo = merge(parts);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, flatShading: true });
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'houses';
    scene.add(mesh);

    const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    crateGeo.translate(0, 0.6, 0);
    const crateMesh = new THREE.InstancedMesh(crateGeo, new THREE.MeshStandardMaterial({ map: makeCrateTexture(), roughness: 0.85 }), crates.length);
    crates.forEach((c, i) => crateMesh.setMatrixAt(i, mat(c.x, c.y, c.z, 0, c.rot, 0)));
    crateMesh.castShadow = crateMesh.receiveShadow = true;
    crateMesh.computeBoundingSphere();
    scene.add(crateMesh);
  }

  _overlaps(box, pad) {
    for (const h of this.houses) {
      if (box.minX - pad < h.maxX && box.maxX + pad > h.minX && box.minZ - pad < h.maxZ && box.maxZ + pad > h.minZ) return true;
    }
    return false;
  }

  _town(town, parts, crates) {
    const r = this.rand;
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
      const w = 7 + r() * 3, d = 6 + r() * 2.5, h = 3.6 + r() * 1.0;
      const sw = rotIdx % 2 ? d : w, sd = rotIdx % 2 ? w : d;
      const box = { minX: x - sw / 2, maxX: x + sw / 2, minZ: z - sd / 2, maxZ: z + sd / 2 };
      if (this._overlaps(box, 3)) continue;
      const y = this.terrain.heightAt(x, z);
      this._house(parts, x, y, z, rot, w, d, h);
      const col = { kind: 'box', ...box, y0: y - 3, y1: y + h + 2.6, house: true };
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
      }
    }
    // plaza crates as cover
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, dist = r() * town.r * 0.3;
      this._crateStack(crates, town.x + Math.cos(a) * dist, town.z + Math.sin(a) * dist, r() < 0.3 ? 2 : 1);
    }
    this.chestSpots.push({ x: town.x, z: town.z, rot: r() * 6 });
  }

  _crateStack(crates, x, z, n) {
    const y = this.terrain.heightAt(x, z);
    if (y < 1) return;
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

  _house(parts, x, y, z, rot, w, d, h) {
    const r = this.rand;
    const wall = new THREE.Color(WALLS[Math.floor(r() * WALLS.length)]);
    const roof = new THREE.Color(ROOFS[Math.floor(r() * ROOFS.length)]);
    const trim = new THREE.Color('#fffaf0');
    const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
    const add = (geo, color, local) => parts.push(part(geo, color, base.clone().multiply(local)));

    add(new THREE.BoxGeometry(w + 0.4, 2.6, d + 0.4), '#b9ab98', mat(0, -1.1, 0));
    add(new THREE.BoxGeometry(w, h, d), wall, mat(0, h / 2, 0));
    // corner trims
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.3, h, 0.3), trim, mat(sx * w / 2, h / 2, sz * d / 2));
    add(new THREE.BoxGeometry(w + 0.1, 0.25, d + 0.1), trim, mat(0, h - 0.12, 0));
    // roof: gables + two slabs, ridge along X
    const rh = 2.2 + r() * 0.6;
    add(prismGeo(w, rh, d), wall, mat(0, h, 0));
    const halfD = d / 2 + 0.55;
    const slope = Math.atan2(rh, d / 2);
    const slabLen = Math.hypot(halfD, rh * (halfD / (d / 2)));
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(w + 0.9, 0.28, slabLen), roof, mat(0, h + rh - (rh * halfD) / d + 0.14, s * (halfD / 2), s * slope, 0, 0));
    }
    // chimney
    const cx = (r() - 0.5) * w * 0.5;
    add(new THREE.BoxGeometry(0.8, 2.4, 0.8), '#c96f53', mat(cx, h + rh * 0.55 + 0.7, -d / 4));
    add(new THREE.BoxGeometry(1.0, 0.25, 1.0), '#8c4a37', mat(cx, h + rh * 0.55 + 1.95, -d / 4));
    // door on +z face
    add(new THREE.BoxGeometry(1.3, 2.3, 0.14), '#7a4a2b', mat(0, 1.15, d / 2 + 0.05));
    add(new THREE.BoxGeometry(1.6, 0.2, 0.2), trim, mat(0, 2.35, d / 2 + 0.06));
    add(new THREE.BoxGeometry(2.2, 0.18, 1.2), '#d6c7ad', mat(0, 0.02, d / 2 + 0.6));
    // windows
    const glass = new THREE.Color('#9fd8f5');
    const win = (lx, lz, ry) => {
      add(new THREE.BoxGeometry(1.25, 1.15, 0.12), trim, mat(lx, h * 0.55, lz, 0, ry, 0));
      add(new THREE.BoxGeometry(1.0, 0.9, 0.16), glass, mat(lx, h * 0.55, lz, 0, ry, 0));
    };
    win(-w / 2 + 1.5, d / 2 + 0.02, 0);
    win(w / 2 - 1.5, d / 2 + 0.02, 0);
    win(-w / 4, -d / 2 - 0.02, 0);
    win(w / 4, -d / 2 - 0.02, 0);
    win(w / 2 + 0.02, 0, Math.PI / 2);
    win(-w / 2 - 0.02, 0, Math.PI / 2);
  }
}
