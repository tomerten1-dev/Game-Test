import * as THREE from 'three';
import { Simplex2D, smoothstep, lerp, clamp } from '../core/noise.js';
import { SHADOW } from './Bake.js';

// Smooth fbm island. Heights live in a grid; heightAt() is bilinear so gameplay
// and the rendered mesh always agree.

// Everything island-sized scales with MAP_SCALE. At 3.9 the island is ~2.3 km of land across
// (about 4-5 km²), the size of a Fortnite Battle Royale island.
export const MAP_SCALE = 3.9;
export const WORLD_HALF = 1560;  // grid covers [-1560, 1560]
export const CELL = 4;            // meters between samples
export const ISLAND_RADIUS = 300 * MAP_SCALE;
export const AREA_SCALE = (ISLAND_RADIUS / 170) ** 2; // vs. the original 20-player island
export const GROW = (MAP_SCALE / 1.3) ** 2; // land area vs. the previous (780 m) island, for fixed counts
export const WATER_LEVEL = 0;

// Named places. `kind` picks the builder in Towns.js (village by default).
const RAW_TOWNS = [
  { name: 'Candy Corners', x: -14, z: 30, r: 28 },
  { name: 'Breezy Bay', x: 172, z: 70, r: 26 },
  { name: 'Maple Hollow', x: -165, z: -62, r: 27 },
  { name: 'Pebble City', x: 30, z: -178, r: 27, kind: 'city' },
  { name: 'Sunset Springs', x: 160, z: -118, r: 24 },
  { name: 'Skyline Spires', x: -72, z: -84, r: 40, kind: 'spires' },
  { name: 'Rusty Works', x: 215, z: -12, r: 30, kind: 'factory' },
  { name: 'Lazy Lake', x: 62, z: 128, r: 36, kind: 'lake' },
  { name: 'Salty Pier', x: -20, z: 238, r: 24, kind: 'pier' },
  { name: 'Windy Farms', x: 110, z: -238, r: 28, kind: 'farm' },
  { name: 'Pine Hollow', x: -238, z: 70, r: 24 },
  // the big island has room for more named places, like Fortnite's ~20 POIs
  { name: 'Brick Plaza', x: 95, z: 40, r: 27, kind: 'city' },
  { name: 'Mossy Mills', x: 80, z: -60, r: 26 },
  { name: 'Hilltop Hamlet', x: -40, z: 120, r: 24 },
  { name: 'Frosty Flats', x: -60, z: -232, r: 26 },
  { name: 'Snowpeak Lodge', x: 40, z: -262, r: 24 },
  { name: 'Oak Ridge', x: -205, z: -150, r: 26 },
  { name: 'Harvest Fields', x: -258, z: -28, r: 28, kind: 'farm' },
  { name: 'Coral Cove', x: 228, z: 150, r: 25 },
  { name: 'Sandy Shores', x: 120, z: 228, r: 25 },
  { name: 'Dusty Dunes', x: -118, z: 250, r: 26 },
  { name: 'Cliffside', x: 250, z: -150, r: 24 },
];
export const TOWNS = RAW_TOWNS.map((t) => ({ ...t, x: Math.round(t.x * MAP_SCALE), z: Math.round(t.z * MAP_SCALE) }));
// dirt roads: every town links to its two nearest neighbours
export const ROADS = (() => {
  const out = [], seen = new Set();
  for (const a of TOWNS) {
    const near = TOWNS.filter((b) => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)).slice(0, 2);
    for (const b of near) {
      const key = [a.name, b.name].sort().join('|');
      if (!seen.has(key)) { seen.add(key); out.push([a, b]); }
    }
  }
  return out;
})();
export const MOUNTAIN = { x: -125 * MAP_SCALE, z: 150 * MAP_SCALE, r: 230, h: 88 };
// small islands off the coast (reach them by gliding, swimming or a launch)
export const ISLANDS = [
  { name: 'Gull Isle', x: 1320, z: 450, r: 34 },
  { name: 'Coral Cay', x: -450, z: -1335, r: 30 },
  { name: 'Lone Rock', x: -1365, z: -360, r: 28 },
];
// a tunnel cut through the mountain (floor heights are filled in when the terrain is generated)
export const TUNNELS = [{ name: 'Mountain Tunnel', ax: MOUNTAIN.x - 290, az: MOUNTAIN.z, bx: MOUNTAIN.x + 280, bz: MOUNTAIN.z, w: 6 }]; // runs along x (axis-aligned roof colliders)

// Biomes on the default (summer) island: snowy north, grassland in the middle, desert south.
// Variant.js switches them off for the all-winter / all-desert islands.
export const BIOMES = { on: true };
export function biomeAt(x, z) {
  if (!BIOMES.on) return { snow: 0, desert: 0 };
  const R = ISLAND_RADIUS;
  return { snow: 1 - smoothstep(-0.66 * R, -0.46 * R, z), desert: smoothstep(0.46 * R, 0.66 * R, z) };
}
const SNOW_GROUND = [new THREE.Color('#eef4fb'), new THREE.Color('#dbe7f3')];
const DESERT_GROUND = [new THREE.Color('#e3c58a'), new THREE.Color('#d6b274')];

const C = (hex) => new THREE.Color(hex);
export const PALETTE = {
  deep: C('#2f8f9d'),
  shallow: C('#8fd3c1'),
  wetSand: C('#e0c98f'),
  sand: C('#f2dfa6'),
  grassA: C('#5dbb46'),
  grassB: C('#a3d65c'),
  dirt: C('#d8bf8a'),
  rock: C('#8f8b86'),
  rockDark: C('#6c6966'),
  snow: C('#f4f7fb'),
};

export class Terrain {
  constructor(seed = 1337) {
    this.noise = new Simplex2D(seed);
    this.n = Math.round((WORLD_HALF * 2) / CELL) + 1;
    this.heights = new Float32Array(this.n * this.n);
    this.grass = new Float32Array(this.n * this.n); // 0..1 grass density
    this.variation = new Float32Array(this.n * this.n); // 0..1 color variation
    this.path = new Float32Array(this.n * this.n); // 0..1 dirt path
    this._generate();
  }

  rawHeight(x, z) {
    const nz = this.noise;
    const d = Math.hypot(x, z);
    const coast = ISLAND_RADIUS + nz.fbm(x * 0.0017 + 11.3, z * 0.0017 - 4.1, 3) * 110;
    const mask = 1 - smoothstep(0.86, 1.02, d / coast);
    const hills = (nz.fbm(x * 0.0042, z * 0.0042, 4) * 0.5 + 0.5) * 16 + (nz.fbm(x * 0.011 + 3, z * 0.011, 3) * 0.5 + 0.5) * 4;
    const detail = nz.fbm(x * 0.05, z * 0.05, 3) * 1.1;
    const md = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) / MOUNTAIN.r;
    let mt = 0;
    if (md < 1) {
      const fall = 1 - smoothstep(0, 1, md);
      mt = Math.pow(fall, 1.2) * MOUNTAIN.h * (0.78 + 0.34 * nz.ridged(x * 0.006, z * 0.006, 3)) + nz.fbm(x * 0.06, z * 0.06, 2) * 1.2 * fall;
    }
    let h = lerp(-7.5, 3.2 + hills + detail + mt, mask);
    for (const is of ISLANDS) {
      const d = Math.hypot(x - is.x, z - is.z) / is.r;
      if (d >= 1.25) continue;
      const m = 1 - smoothstep(0.55, 1.2, d);
      h = Math.max(h, lerp(-7.5, 3.4 + (1 - d) * 5 + detail, m));
    }
    return h;
  }

  _generate() {
    const n = this.n;
    const h = this.heights;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
        h[j * n + i] = this.rawHeight(x, z);
      }
    }
    // flatten towns
    for (const t of TOWNS) {
      t.y = Math.max(3.2, this.rawHeight(t.x, t.z));
      // average the area so the plateau sits naturally
      let sum = 0, cnt = 0;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        sum += this.rawHeight(t.x + Math.cos(ang) * t.r * 0.6, t.z + Math.sin(ang) * t.r * 0.6); cnt++;
      }
      t.y = Math.max(3.2, (t.y + sum / cnt) / 2);
      if (t.kind === 'lake') t.y = 3.4;
      const [i0, i1, j0, j1] = this._box(t.x, t.z, t.r * 1.6);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
          const d = Math.hypot(x - t.x, z - t.z);
          if (d > t.r * 1.6) continue;
          const w = 1 - smoothstep(t.r * 0.85, t.r * 1.55, d);
          h[j * n + i] = lerp(h[j * n + i], t.y, w);
          // lake basin: shallow water in the middle of the town ring
          if (t.kind === 'lake') h[j * n + i] = lerp(h[j * n + i], -1.1, 1 - smoothstep(t.r * 0.32, t.r * 0.56, d));
        }
      }
    }
    // tunnels: a flat-floored cut through the mountain (roofed over in Landmarks.js)
    for (const t of TUNNELS) {
      t.ay = Math.max(3.2, this.rawHeight(t.ax, t.az)); t.by = Math.max(3.2, this.rawHeight(t.bx, t.bz));
      const dx = t.bx - t.ax, dz = t.bz - t.az, L = Math.hypot(dx, dz);
      const [i0, i1] = this._box((t.ax + t.bx) / 2, t.az, L / 2 + 10);
      const [, , j0, j1] = this._box(t.ax, t.az, t.w + 10);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
          const u = ((x - t.ax) * dx + (z - t.az) * dz) / (L * L);
          if (u < -0.02 || u > 1.02) continue;
          const side = Math.abs(((x - t.ax) * -dz + (z - t.az) * dx) / L);
          if (side > t.w) continue;
          const floor = lerp(t.ay, t.by, clamp(u, 0, 1));
          const k = j * n + i;
          if (h[k] > floor) h[k] = lerp(h[k], floor, 1 - smoothstep(t.w - 2.5, t.w, side));
        }
      }
    }
    // biome masks
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
        const y = h[k];
        if (y < -3) { this.variation[k] = 0.5; this.grass[k] = 0; continue; } // sea floor
        const ny = this._gridNormalY(i, j);
        const variation = clamp(this.noise.fbm(x * 0.03 + 50, z * 0.03 - 20, 3) * 0.8 + 0.5, 0, 1);
        this.variation[k] = variation;
        let g = smoothstep(2.0, 3.0, y) * smoothstep(0.72, 0.86, ny) * (1 - smoothstep(26, 32, y));
        for (const t of TOWNS) {
          if (t.kind === 'lake' || Math.abs(x - t.x) > t.r || Math.abs(z - t.z) > t.r) continue;
          g *= smoothstep(t.r * 0.72, t.r * 0.95, Math.hypot(x - t.x, z - t.z));
        }
        // dirt paths from the central town to the others (wobbly)
        let pth = 0;
        for (let ti = 0; ti < ROADS.length; ti++) {
          const [hub, t] = ROADS[ti];
          const ax = hub.x, az = hub.z, bx = t.x - ax, bz = t.z - az;
          const L = Math.hypot(bx, bz);
          const u = ((x - ax) * bx + (z - az) * bz) / (L * L);
          if (u < 0 || u > 1) continue;
          const side = ((x - ax) * -bz + (z - az) * bx) / L;
          if (Math.abs(side) > 30) continue;
          const wob = this.noise.noise(u * 4 + ti * 7, ti) * 9 * Math.sin(u * Math.PI);
          const dd = Math.abs(side - wob);
          pth = Math.max(pth, 1 - smoothstep(1.1, 2.3, dd));
        }
        this.path[k] = pth * smoothstep(1.5, 2.5, y);
        g *= 1 - this.path[k];
        // patchy meadows
        g *= clamp(0.55 + this.noise.fbm(x * 0.045 - 7, z * 0.045 + 3, 2) * 1.1, 0, 1);
        const bio = biomeAt(x, z);
        g *= (1 - 0.8 * bio.snow) * (1 - 0.7 * bio.desert); // little grass in the snow and the desert
        this.grass[k] = g;
      }
    }
  }

  // grid index range covering a square of half-size `r` around (x, z)
  _box(x, z, r) {
    const n = this.n, c = (v) => Math.max(0, Math.min(n - 1, v));
    return [c(Math.floor((x - r + WORLD_HALF) / CELL)), c(Math.ceil((x + r + WORLD_HALF) / CELL)), c(Math.floor((z - r + WORLD_HALF) / CELL)), c(Math.ceil((z + r + WORLD_HALF) / CELL))];
  }

  _h(i, j) {
    const n = this.n;
    i = i < 0 ? 0 : i >= n ? n - 1 : i;
    j = j < 0 ? 0 : j >= n ? n - 1 : j;
    return this.heights[j * n + i];
  }

  _gridNormalY(i, j) {
    const dx = this._h(i + 1, j) - this._h(i - 1, j);
    const dz = this._h(i, j + 1) - this._h(i, j - 1);
    const nx = -dx, ny = 2 * CELL, nz = -dz;
    return ny / Math.hypot(nx, ny, nz);
  }

  heightAt(x, z) {
    const fx = (x + WORLD_HALF) / CELL, fz = (z + WORLD_HALF) / CELL;
    const n = this.n;
    if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) return -7.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const h = this.heights;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 1.0;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }

  sampleGrid(arr, x, z) {
    const n = this.n;
    const i = clamp(Math.round((x + WORLD_HALF) / CELL), 0, n - 1);
    const j = clamp(Math.round((z + WORLD_HALF) / CELL), 0, n - 1);
    return arr[j * n + i];
  }

  isLand(x, z, minH = 1.5) { return this.heightAt(x, z) > minH; }

  colorAt(i, j, out) {
    const n = this.n, k = j * n + i;
    const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
    const y = this.heights[k];
    const ny = this._gridNormalY(i, j);
    const P = PALETTE;
    out.copy(P.grassA).lerp(P.grassB, this.variation[k]);
    const bio = biomeAt(x, z);
    if (bio.snow > 0) out.lerp(_tmp.copy(SNOW_GROUND[0]).lerp(SNOW_GROUND[1], this.variation[k]), bio.snow);
    if (bio.desert > 0) out.lerp(_tmp.copy(DESERT_GROUND[0]).lerp(DESERT_GROUND[1], this.variation[k]), bio.desert);
    // dry / dirt patches where there is little grass
    const g = this.grass[k];
    out.lerp(P.dirt, (1 - smoothstep(0.15, 0.6, g)) * 0.35 * smoothstep(2.5, 3.5, y));
    // towns: warm dirt plaza
    for (const t of TOWNS) {
      if (Math.abs(x - t.x) > t.r || Math.abs(z - t.z) > t.r) continue;
      const d = Math.hypot(x - t.x, z - t.z);
      out.lerp(P.dirt, (1 - smoothstep(t.r * 0.55, t.r * 0.9, d)) * 0.85);
    }
    out.lerp(_tmp2.set('#c79f63'), this.path[k] * 0.85);
    // rock on steep slopes / high ground
    const rockW = Math.max((1 - smoothstep(0.66, 0.8, ny)) * smoothstep(3, 6, y), smoothstep(24, 33, y));
    const rockC = _tmp.copy(P.rock).lerp(P.rockDark, clamp(this.variation[k] * 1.3 - 0.2, 0, 1));
    // layered cliff strata
    const strata = 0.5 + 0.5 * Math.sin(y * 0.9 + this.variation[k] * 2.0);
    rockC.lerp(_tmp2.set('#b5a48f'), strata * 0.35);
    out.lerp(rockC, rockW);
    out.lerp(P.snow, smoothstep(44, 50, y));
    // beach
    out.lerp(P.sand, 1 - smoothstep(1.3, 2.6, y));
    out.lerp(P.wetSand, 1 - smoothstep(-0.2, 0.7, y));
    out.lerp(P.shallow, 1 - smoothstep(-2.0, -0.4, y));
    out.lerp(P.deep, 1 - smoothstep(-6.5, -2.5, y));
    return out;
  }

  buildMesh() {
    const n = this.n;
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const c = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        pos[k * 3] = -WORLD_HALF + i * CELL;
        pos[k * 3 + 1] = this.heights[k];
        pos[k * 3 + 2] = -WORLD_HALF + j * CELL;
        const dx = this._h(i + 1, j) - this._h(i - 1, j);
        const dz = this._h(i, j + 1) - this._h(i, j - 1);
        const l = Math.hypot(dx, 2 * CELL, dz);
        nor[k * 3] = -dx / l; nor[k * 3 + 1] = (2 * CELL) / l; nor[k * 3 + 2] = -dz / l;
        this.colorAt(i, j, c);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }
    // town mask as a vertex attribute (1 = paved plaza)
    const town = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
      let w = 0;
      for (const t of TOWNS) if (Math.abs(x - t.x) < t.r * 0.6 && Math.abs(z - t.z) < t.r * 0.6) w = Math.max(w, 1 - smoothstep(t.r * 0.32, t.r * 0.6, Math.hypot(x - t.x, z - t.z)));
      town[j * n + i] = w;
    }
    this._full = { pos, nor, col, town, shade: new Float32Array(n * n) };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, SHADOW);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTown;\nattribute float aShade;\nvarying vec3 vWPos;\nvarying float vTown;\nvarying float vShade;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvTown = aTown;\nvShade = aShade;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos;
          varying float vTown;
          varying float vShade;
          uniform vec3 uFocus;
          uniform float uRange;
          float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float tNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 wp = vWPos.xz;
          float dn = tNoise(wp * 0.35) * 0.6 + tNoise(wp * 1.3) * 0.4;
          diffuseColor.rgb *= 0.9 + dn * 0.2;
          // baked distant shadows (real shadow maps take over near the player)
          float bakeFade = smoothstep(uRange * 0.55, uRange * 0.92, length(vWPos.xz - uFocus.xz));
          diffuseColor.rgb *= 1.0 - vShade * 0.55 * bakeFade;
          // paved plaza: offset stone tiles with dark grout
          if (vTown > 0.01) {
            vec2 tp = wp * vec2(0.9, 1.3);
            tp.x += step(1.0, mod(floor(tp.y), 2.0)) * 0.5;
            vec2 f = fract(tp);
            float grout = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
            float tileVar = tHash(floor(tp)) * 0.12;
            vec3 stone = vec3(0.56, 0.49, 0.41) * (0.88 + tileVar) * mix(0.62, 1.0, grout);
            diffuseColor.rgb = mix(diffuseColor.rgb, stone, vTown * smoothstep(0.1, 0.5, vTown));
          }`);
    };
    // The island is ~3 km across, so the ground is split into chunks: the camera only draws the
    // ones in view, and chunks that are all deep sea (under the water plane) are skipped.
    const group = new THREE.Group();
    group.name = 'terrain';
    this.chunks = [];
    const CH = 96;
    for (let j0 = 0; j0 < n - 1; j0 += CH) {
      for (let i0 = 0; i0 < n - 1; i0 += CH) {
        const i1 = Math.min(n - 1, i0 + CH), j1 = Math.min(n - 1, j0 + CH);
        let top = -Infinity;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) top = Math.max(top, this.heights[j * n + i]);
        if (top < -6.8) continue;
        const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
        const cg = new THREE.BufferGeometry();
        const cpos = new Float32Array(w * hgt * 3), cnor = new Float32Array(w * hgt * 3);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * n + i, q = (j - j0) * w + (i - i0);
          for (let a = 0; a < 3; a++) { cpos[q * 3 + a] = pos[k * 3 + a]; cnor[q * 3 + a] = nor[k * 3 + a]; }
        }
        const cidx = new Uint16Array((w - 1) * (hgt - 1) * 6);
        let p = 0;
        for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) {
          const a = j * w + i, b = a + 1, cc = a + w, d = cc + 1;
          cidx[p++] = a; cidx[p++] = cc; cidx[p++] = b;
          cidx[p++] = b; cidx[p++] = cc; cidx[p++] = d;
        }
        cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
        cg.setAttribute('normal', new THREE.BufferAttribute(cnor, 3));
        cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(w * hgt * 3), 3));
        cg.setAttribute('aTown', new THREE.BufferAttribute(new Float32Array(w * hgt), 1));
        cg.setAttribute('aShade', new THREE.BufferAttribute(new Float32Array(w * hgt), 1));
        cg.setIndex(new THREE.BufferAttribute(cidx, 1));
        cg.computeBoundingSphere();
        cg.computeBoundingBox();
        const mesh = new THREE.Mesh(cg, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.name = 'terrain';
        group.add(mesh);
        this.chunks.push({ geo: cg, i0, j0, w, h: hgt });
      }
    }
    this._fillChunks();
    this.mesh = group;
    return group;
  }

  // copy the per-vertex colour / plaza / baked-shadow values into the chunk geometries
  _fillChunks() {
    const n = this.n, F = this._full;
    for (const c of this.chunks) {
      const col = c.geo.attributes.color.array, town = c.geo.attributes.aTown.array, sh = c.geo.attributes.aShade.array;
      for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) {
        const k = (c.j0 + j) * n + (c.i0 + i), q = j * c.w + i;
        col[q * 3] = F.col[k * 3]; col[q * 3 + 1] = F.col[k * 3 + 1]; col[q * 3 + 2] = F.col[k * 3 + 2];
        town[q] = F.town[k]; sh[q] = F.shade[k];
      }
      c.geo.attributes.color.needsUpdate = c.geo.attributes.aTown.needsUpdate = c.geo.attributes.aShade.needsUpdate = true;
    }
  }

  applyBake(shade, ao) {
    const F = this._full;
    F.shade.set(shade);
    for (let k = 0; k < shade.length; k++) {
      const f = 1 - ao[k];
      F.col[k * 3] *= f; F.col[k * 3 + 1] *= f; F.col[k * 3 + 2] *= f;
    }
    this._fillChunks();
    this._full = null; // the chunks hold their own copies
  }

  // RGBA half-float texture: R = height, G = grass density, B = color variation.
  buildDataTexture() {
    const n = this.n;
    const data = new Uint16Array(n * n * 4);
    const toHalf = THREE.DataUtils.toHalfFloat;
    for (let k = 0; k < n * n; k++) {
      data[k * 4] = toHalf(this.heights[k]);
      data[k * 4 + 1] = toHalf(this.grass[k]);
      data[k * 4 + 2] = toHalf(this.variation[k]);
      data[k * 4 + 3] = toHalf(1);
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // Top-down colored image for the minimap.
  // Drawn once at grid resolution, then scaled up (smoothly) to the size asked for; cached per size.
  buildMinimapCanvas(out = 256) {
    this._mapCache ||= new Map();
    if (this._mapCache.has(out)) return this._mapCache.get(out);
    const base = this._mapBase ||= this._drawMapBase(Math.min(out, this.n));
    const big = document.createElement('canvas');
    big.width = big.height = out;
    const bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(base, 0, 0, out, out);
    this._mapCache.set(out, big);
    return big;
  }

  _drawMapBase(size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const c = new THREE.Color();
    const n = this.n;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const i = Math.round((px / (size - 1)) * (n - 1));
        const j = Math.round((py / (size - 1)) * (n - 1));
        const y = this.heights[j * n + i];
        if (y < WATER_LEVEL) {
          c.set('#3cb4e6').lerp(PALETTE.deep, smoothstep(-1, -7, y) * 0.6);
        } else {
          this.colorAt(i, j, c);
          // fake hill shading
          const sh = this._h(i + 1, j) - this._h(i - 1, j + 1);
          c.multiplyScalar(clamp(1 - sh * 0.08, 0.7, 1.25));
        }
        const o = (py * size + px) * 4;
        img.data[o] = Math.min(255, Math.round(Math.pow(c.r, 1 / 2.2) * 255));
        img.data[o + 1] = Math.min(255, Math.round(Math.pow(c.g, 1 / 2.2) * 255));
        img.data[o + 2] = Math.min(255, Math.round(Math.pow(c.b, 1 / 2.2) * 255));
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

const _tmp = new THREE.Color();
const _tmp2 = new THREE.Color();
