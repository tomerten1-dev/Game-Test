import * as THREE from 'three';
import { Colliders, rayBox, rayCylinder, raySphere } from './Colliders.js';
import { WORLD_HALF, CELL } from './Terrain.js';

// Shared uniforms: baked shadows fade out near the player where real shadow maps exist.
export const SHADOW = { uFocus: { value: new THREE.Vector3() }, uRange: { value: 60 } };

/**
 * Bake soft sun shadows + ambient occlusion into per-vertex values of the terrain grid.
 * Occluders: gameplay colliders (houses, crates, rocks, trunks) + canopy spheres.
 */
export function bakeLighting(terrain, colliders, spheres, sunDir) {
  const idx = new Colliders();
  const seen = new Set();
  for (const arr of colliders.cells.values()) for (const c of arr) {
    if (seen.has(c) || c.dynamic) continue;
    seen.add(c);
    idx.add({ ...c, _cells: undefined });
  }
  for (const s of spheres) idx.add({ kind: 'sphere', x: s.x, y: s.y, z: s.z, r: s.r, minX: s.x - s.r, maxX: s.x + s.r, minZ: s.z - s.r, maxZ: s.z + s.r });

  const n = terrain.n;
  const H = terrain.heights;
  const shade = new Float32Array(n * n);
  const ao = new Float32Array(n * n);
  const hl = Math.hypot(sunDir.x, sunDir.z);
  const dx = sunDir.x / hl, dz = sunDir.z / hl, slope = sunDir.y / hl;
  const list = [], near = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const h = H[k];
      if (h < -2) continue;
      const ox = -WORLD_HALF + i * CELL, oz = -WORLD_HALF + j * CELL, oy = h + 0.3;
      let s = 0;
      idx.queryRay(ox, oz, dx, dz, 45, list);
      for (const c of list) {
        let t = -1;
        if (c.kind === 'box') t = rayBox(ox, oy, oz, sunDir.x, sunDir.y, sunDir.z, c, 60);
        else if (c.kind === 'circle') t = rayCylinder(ox, oy, oz, sunDir.x, sunDir.y, sunDir.z, c, 60);
        else if (c.kind === 'sphere') t = raySphere(ox, oy, oz, sunDir.x, sunDir.y, sunDir.z, c.x, c.y, c.z, c.r, 60);
        if (t >= 0) { s = 1; break; }
      }
      if (!s) {
        for (let t = 3; t < 170; t += 3) {
          const y = oy + t * slope;
          if (y > 62) break;
          if (terrain.heightAt(ox + dx * t, oz + dz * t) > y) { s = 1; break; }
        }
      }
      shade[k] = s;
      // ambient occlusion: darken near walls, under canopies and around rocks
      let a = 0;
      idx.query(ox - 4, ox + 4, oz - 4, oz + 4, near);
      for (const c of near) {
        if (c.kind === 'box') {
          if (oy > c.y1 || oy < c.y0 - 1) continue;
          const cx = Math.max(c.minX, Math.min(ox, c.maxX)), cz = Math.max(c.minZ, Math.min(oz, c.maxZ));
          const d = Math.hypot(ox - cx, oz - cz);
          a = Math.max(a, (1 - Math.min(1, d / 2.6)) * 0.42);
        } else if (c.kind === 'sphere') {
          const d = Math.hypot(ox - c.x, oz - c.z);
          a = Math.max(a, (1 - Math.min(1, d / (c.r * 1.15))) * 0.3);
        } else if (c.kind === 'circle' && !c.tree) {
          const d = Math.hypot(ox - c.x, oz - c.z) - c.r;
          a = Math.max(a, (1 - Math.min(1, Math.max(0, d) / 1.8)) * 0.38);
        }
      }
      ao[k] = a;
    }
  }
  // soften the 2 m grid with two box-blur passes
  const tmp = new Float32Array(n * n);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      let sum = 0;
      for (let b = -1; b <= 1; b++) for (let a2 = -1; a2 <= 1; a2++) sum += shade[(j + b) * n + i + a2];
      tmp[j * n + i] = sum / 9;
    }
    shade.set(tmp);
  }
  return { shade, ao };
}

export function bakeTexture(n, shade, ao) {
  const data = new Uint16Array(n * n * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < n * n; k++) {
    data[k * 4] = toHalf(shade[k]);
    data[k * 4 + 1] = toHalf(ao[k]);
    data[k * 4 + 2] = 0;
    data[k * 4 + 3] = toHalf(1);
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
