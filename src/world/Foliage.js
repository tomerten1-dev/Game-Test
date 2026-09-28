import * as THREE from 'three';
import { StreamedInstancedMesh } from './Streamed.js';
import { Destructibles } from './Destructible.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addWind, WIND } from '../effects/Shaders.js';
import { mulberry32, smoothstep } from '../core/noise.js';
import { jitter, gradientY } from './geomUtils.js';
import { TOWNS, WORLD_HALF, ISLAND_RADIUS, PALETTE, AREA_SCALE, BIOMES, biomeAt, TUNNELS } from './Terrain.js';
import { quality } from '../core/device.js';
import { ISLAND_MAP, mapAt, fromMap } from './IslandMap.js';
import { Nature } from './Nature.js';
import { VARIANT, VARIANTS, tint } from './Variant.js';
// Fortnite's island is open fields and towns with forests in patches: far fewer trees and rocks than
// the dense woods we had (was ~18k trees / 7.5k rocks)
const TREE_DENSITY = 0.4, ROCK_DENSITY = 0.4;
// dense woods the map's forest layer misses (its trees are drawn very dark): Wailing Woods and the
// woods east of Lonely Lodge - [map x, map y, radius] in 1024 px map coordinates
const WOODS = [[822, 292, 78], [905, 440, 48]].map(([x, y, r]) => { const [wx, wz] = fromMap(x, y); return { x: wx, z: wz, r: r * 2.62 }; });
const woodsAt = (x, z) => { let f = 0; for (const w of WOODS) f = Math.max(f, 1 - Math.hypot(x - w.x, z - w.z) / w.r); return Math.min(1, f * 3); };

const TREE_GREENS = tint(VARIANT.treeGreens, ['#4caf50', '#5fc25a', '#3f9e4c', '#78cc5c', '#56b84e'].map((c) => new THREE.Color(c)));
const AUTUMN = tint(VARIANT.autumn, ['#f39a34', '#e9722c', '#f4b83f', '#d9582b'].map((c) => new THREE.Color(c)));
const PINE_GREENS = tint(VARIANT.pineGreens, ['#2f7d52', '#3a915e', '#2b6f49', '#44a066'].map((c) => new THREE.Color(c)));
// biome tree colours on the default island
const SNOW_TREES = tint(VARIANTS.winter.treeGreens), SNOW_PINES = tint(VARIANTS.winter.pineGreens), DESERT_TREES = tint(VARIANTS.desert.treeGreens);

function roundCanopyGeo(rand) {
  const parts = [];
  const blobs = [[0, 0, 0, 1.25], [0.75, -0.25, 0.3, 0.85], [-0.65, -0.2, -0.35, 0.9], [0.1, 0.55, -0.1, 0.85]];
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 2);
    g.deleteAttribute('uv');
    g.translate(x, y, z);
    parts.push(g);
  }
  let geo = mergeGeometries(parts);
  geo = jitter(geo, 0.16, rand);
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  return gradientY(geo, new THREE.Color(0.55, 0.6, 0.55), new THREE.Color(1.15, 1.15, 1.05));
}

function pineCanopyGeo() {
  const parts = [];
  const tiers = [[1.7, 1.9, 0], [1.3, 1.7, 1.15], [0.9, 1.5, 2.2]];
  for (const [r, h, y] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 7, 1);
    g.deleteAttribute('uv');
    g.translate(0, y + h / 2, 0);
    parts.push(g.toNonIndexed());
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  return gradientY(geo, new THREE.Color(0.55, 0.6, 0.55), new THREE.Color(1.1, 1.15, 1.05));
}

export class Foliage {
  constructor(scene, terrain, colliders, models, heightTex) {
    this.heightTex = heightTex;
    this.models = models;
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    this.rand = mulberry32(4242);
    this.occluders = [];
    this.occupied = new Set();
    this.nature = models ? new Nature(scene, models, quality) : null;
    if (this.nature && !this.nature.ready) this.nature = null;
    this.roundTrees = [];
    this.pineTrees = [];
    // trees and rocks can be cut down / broken (HP, falling stand-ins, regrow next match)
    this.destr = new Destructibles(scene, colliders);
    this.destr.onLodChange = (reset) => { this._lodT = 0; if (reset) { this._shown = new Set(); this._pShown = new Set(); } };
    if (this.nature) this.nature.destr = this.destr;
    this._trees();
    this._rocks();
    if (models) { this._palms(); this._spires(); if (VARIANT.cacti || BIOMES.on) this._cacti(); }
    if (this.nature) {
      this.nature.occluders = this.occluders;
      this.nature.scatterUndergrowth(
        (a, b, c) => { const pt = this._candidate(a, b, c); return pt && { x: pt.x, y: pt.h, z: pt.z }; },
        (x, z, cell) => this._free(x, z, cell), this.rand,
        quality.trees > 300 ? { bushes: Math.round(170 * AREA_SCALE), clovers: Math.round(360 * AREA_SCALE) } : { bushes: Math.round(60 * AREA_SCALE), clovers: Math.round(100 * AREA_SCALE) },
      );
      this.featureTrees = this.nature.scatterFeatureTrees(
        (a, b, c, x, z) => { const pt = x === undefined ? this._candidate(a, b, c) : this._candidateAt(x, z, a, b, c); return pt && { x: pt.x, y: pt.h, z: pt.z }; },
        (x, z, cell) => this._free(x, z, cell), this.rand, this.colliders, TREE_GREENS,
      );
    } else this._bushes();
    this._grass();
  }

  _free(x, z, cell = 3) {
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (this.occupied.has(k)) return false;
    this.occupied.add(k);
    return true;
  }

  _inTown(x, z, pad = 6) {
    for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return true;
    return false;
  }

  _candidateAt(x, z, minH, maxH, minNy) {
    const h = this.terrain.heightAt(x, z);
    if (h < minH || h > maxH || this.terrain.normalAt(x, z).y < minNy || this._inTown(x, z, 2)) return null;
    return { x, z, h };
  }

  _candidate(minH, maxH, minNy) {
    const r = this.rand;
    for (let tries = 0; tries < 60; tries++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (ISLAND_RADIUS + 10);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (this.terrain.normalAt(x, z).y < minNy) continue;
      if (this._inTown(x, z)) continue;
      if (TUNNELS.some((t) => x > t.ax - 4 && x < t.bx + 4 && Math.abs(z - t.az) < t.w + 3)) continue; // keep the tunnel clear
      return { x, z, h };
    }
    return null;
  }

  _trees() {
    const r = this.rand;
    const count = Math.round(quality.trees * AREA_SCALE * (VARIANT.trees ?? 1) * TREE_DENSITY);
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.8 });
    const pineMat = canopyMat.clone();
    addWind(canopyMat, { amount: 0.05, pivot: -1.3, speed: 1.3 });
    addWind(pineMat, { amount: 0.035, pivot: 0.0, speed: 1.1 });
    const trunks = new StreamedInstancedMesh(trunkGeo, trunkMat, count);
    const rounds = new StreamedInstancedMesh(roundCanopyGeo(r), canopyMat, count);
    const pines = new StreamedInstancedMesh(pineCanopyGeo(), pineMat, count);
    let nT = 0, nR = 0, nP = 0, nK = 0;
    const pendingPines = [];
    const kkPines = { 'kk/tree_single_A': [], 'kk/tree_single_B': [] };
    const useKK = !!this.models?.get('kk/tree_single_A');
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const forest = this.terrain.noise;
    for (let i = 0; i < count * 8 && nT + nK < count; i++) {
      const c = this._candidate(2.6, 34, 0.8);
      if (!c) continue;
      if (ISLAND_MAP.ready) {
        // forests where the island map has them (dense woods, tree lines), very few trees elsewhere
        if (r() > 0.025 + 0.975 * Math.max(mapAt('forest', c.x, c.z), woodsAt(c.x, c.z))) continue;
      } else {
        // cluster trees into forests
        const f = forest.fbm(c.x * 0.018 + 100, c.z * 0.018, 3);
        if (f < -0.15 && r() > 0.15) continue;
      }
      if (!this._free(c.x, c.z, 4)) continue;
      const bio = biomeAt(c.x, c.z);
      if (bio.desert > 0.5 && r() < 0.75) continue; // few trees in the desert
      const pine = bio.snow > 0.5 ? r() < 0.85 : c.h > 16 ? r() < 0.8 : r() < 0.3;
      const sc = (pine ? 1.0 : 0.9) + r() * 0.7;
      const trunkH = (pine ? 1.4 : 2.1) * sc;
      const yaw = r() * Math.PI * 2;
      if (pine && useKK) {
        const type = r() < 0.5 ? 'kk/tree_single_A' : 'kk/tree_single_B';
        const info = this.models.get(type);
        const H = 7 + sc * 3.5;
        const ks = H / info.size.y;
        const shade = (0.85 + r() * 0.25) * (VARIANT.pineShade || 1);
        this.pineTrees.push({ x: c.x, y: c.h, z: c.z, yaw, height: H * 1.05, variant: Math.floor(r() * 16), type, idx: kkPines[type].length,
          color: ((pg) => pg[Math.floor(r() * pg.length)])(bio.snow > 0.5 ? SNOW_PINES : PINE_GREENS).clone().multiplyScalar(shade * 1.25),
          mat: new THREE.Matrix4().compose(new THREE.Vector3(c.x, c.h - 0.2, c.z), new THREE.Quaternion().setFromAxisAngle(up, yaw), new THREE.Vector3(ks, ks, ks)) });
        kkPines[type].push({ x: c.x, y: c.h - 0.2, z: c.z, rot: yaw, scale: ks, colors: { hexagons_medieval: new THREE.Color(shade, shade * (0.95 + r() * 0.1), shade) } });
        const hcol = { kind: 'circle', x: c.x, z: c.z, r: 0.45, y0: c.h - 2, y1: c.h + H, tree: true };
        this.colliders.add(hcol);
        pendingPines.push({ col: hcol, type, idx: kkPines[type].length - 1, rec: this.pineTrees[this.pineTrees.length - 1], hp: Math.round(200 + H * 15) });
        this.occluders.push({ x: c.x, y: c.h + H * 0.45, z: c.z, r: info.size.x * ks * 0.42 });
        nK++;
        continue;
      }
      q.setFromAxisAngle(up, yaw);
      m.compose(p.set(c.x, c.h - 0.3, c.z), q, s.set(sc, trunkH + 0.3, sc));
      trunks.setMatrixAt(nT, m);
      trunks.setColorAt(nT, col.set('#7b5335').multiplyScalar(0.85 + r() * 0.3));
      nT++;
      if (pine) {
        m.compose(p.set(c.x, c.h + trunkH * 0.75, c.z), q, s.set(sc, sc * (1 + r() * 0.3), sc));
        pines.setMatrixAt(nP, m);
        const pg = bio.snow > 0.5 ? SNOW_PINES : PINE_GREENS;
        pines.setColorAt(nP, col.copy(pg[Math.floor(r() * pg.length)]));
        this.occluders.push({ x: c.x, y: c.h + trunkH * 0.75 + 1.4 * sc, z: c.z, r: 1.45 * sc });
        nP++;
      } else {
        const cs = sc * (1.1 + r() * 0.3);
        m.compose(p.set(c.x, c.h + trunkH + cs * 0.7, c.z), q, s.set(cs * 1.3, cs * 1.15, cs * 1.3));
        rounds.setMatrixAt(nR, m);
        this.roundTrees.push({ x: c.x, y: c.h, z: c.z, yaw, height: 6.2 + sc * 2.4, variant: nR, color: null, trunkIdx: nT - 1, canopyIdx: nR, trunkMat: null, canopyMat: m.clone() });
        this.occluders.push({ x: c.x, y: c.h + trunkH + cs * 0.75, z: c.z, r: cs * 1.55 });
        const autumn = r() < 0.13;
        const greens = bio.snow > 0.5 ? SNOW_TREES : bio.desert > 0.5 ? DESERT_TREES : TREE_GREENS;
        const base = autumn && bio.snow < 0.5 ? AUTUMN[Math.floor(r() * AUTUMN.length)] : greens[Math.floor(r() * greens.length)];
        rounds.setColorAt(nR, col.copy(base).multiplyScalar(0.9 + r() * 0.2));
        this.roundTrees[this.roundTrees.length - 1].color = col.clone();
        nR++;
      }
      const hcol = { kind: 'circle', x: c.x, z: c.z, r: 0.38 * sc, y0: c.h - 2, y1: c.h + trunkH + 4 * sc, tree: true };
      this.colliders.add(hcol);
      const hp = Math.round(180 + sc * 90);
      if (pine) this.destr.register(hcol, [{ im: trunks, idx: nT - 1 }, { im: pines, idx: nP - 1 }], { kind: 'tree', hp });
      else {
        const rec = this.roundTrees[this.roundTrees.length - 1], ri = this.roundTrees.length - 1;
        this.destr.register(hcol, [{ im: trunks, idx: nT - 1 }, { im: rounds, idx: nR - 1 }], {
          kind: 'tree', hp,
          lod: this.nature ? { rec, shown: () => !!this._shown?.has(ri), detail: () => this.nature.detailParts(rec) } : null,
        });
      }
    }
    this.trunkIM = trunks;
    this.roundIM = rounds;
    for (const t of this.roundTrees) { const mm = new THREE.Matrix4(); trunks.getMatrixAt(t.trunkIdx, mm); t.trunkMat = mm; }
    for (const [im, n] of [[trunks, nT], [rounds, nR], [pines, nP]]) {
      im.count = n;
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
    this.treeCount = nT;
    if (useKK) {
      const mat = (part) => { const mm = part.material.clone(); mm.roughness = 0.8; addWind(mm, { amount: 0.04, pivot: 0.15, speed: 1.1 }); return mm; };
      this.kkPineGroups = {};
      for (const [type, list] of Object.entries(kkPines)) if (list.length) this.scene.add(this.kkPineGroups[type] = this.models.instanced(type, list, { material: mat }));
      for (const p of pendingPines) {
        const ri = this.pineTrees.indexOf(p.rec);
        this.destr.register(p.col, this.kkPineGroups[p.type].children.map((im) => ({ im, idx: p.idx })), {
          kind: 'tree', hp: p.hp,
          lod: this.nature?.pineDetail.length ? { rec: p.rec, shown: () => !!this._pShown?.has(ri), detail: () => this.nature.detailParts(p.rec, this.nature.pineDetail) } : null,
        });
      }
    }
  }

  _rocks() {
    if (this.models?.get('kk/rock_single_A')) return this._kkRocks();
    const r = this.rand;
    const count = Math.round(150 * AREA_SCALE * ROCK_DENSITY);
    let geo = new THREE.DodecahedronGeometry(1, 1);
    geo.deleteAttribute('uv');
    geo = jitter(geo, 0.35, r);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
    const im = new StreamedInstancedMesh(geo, mat, count, 420); // rocks
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count * 6 && n < count; i++) {
      const mountainBias = r() < 0.4;
      const c = mountainBias ? this._candidate(12, 48, 0.4) : this._candidate(0.5, 30, 0.6);
      if (!c) continue;
      if (!this._free(c.x, c.z, 5)) continue;
      const big = r() < 0.25;
      const base = big ? 1.8 + r() * 1.6 : 0.5 + r() * 0.9;
      s.set(base * (0.8 + r() * 0.5), base * (0.55 + r() * 0.4), base * (0.8 + r() * 0.5));
      q.setFromEuler(e.set(r() * 0.4, r() * Math.PI * 2, r() * 0.4));
      m.compose(p.set(c.x, c.h - s.y * 0.2, c.z), q, s);
      im.setMatrixAt(n, m);
      const g = 0.75 + r() * 0.35;
      im.setColorAt(n, col.set(PALETTE.rock).multiplyScalar(g).lerp(new THREE.Color('#a39e93'), r() * 0.3));
      const hcol = { kind: 'circle', x: c.x, z: c.z, r: Math.max(s.x, s.z) * 0.85, y0: c.h - 3, y1: c.h + s.y * 0.8, rock: true };
      this.colliders.add(hcol);
      this.destr.register(hcol, [{ im, idx: n }], { kind: 'rock', hp: Math.round(250 + base * 150) });
      n++;
    }
    im.count = n;
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.scene.add(im);
  }

  // KayKit boulders: mostly on the mountain, some scattered and on beaches.
  _kkRocks() {
    const r = this.rand;
    const types = ['kk/rock_single_A', 'kk/rock_single_B', 'kk/rock_single_C', 'kk/rock_single_D', 'kk/rock_single_E'];
    const pl = Object.fromEntries(types.map((t) => [t, []]));
    const pending = [];
    let n = 0;
    for (let i = 0; i < 1200 * AREA_SCALE && n < 160 * AREA_SCALE * ROCK_DENSITY; i++) {
      const mountainBias = r() < 0.4;
      const c = mountainBias ? this._candidate(12, 48, 0.4) : this._candidate(0.5, 30, 0.6);
      if (!c) continue;
      if (!this._free(c.x, c.z, 5)) continue;
      const type = types[Math.floor(r() * types.length)];
      const info = this.models.get(type);
      const W = r() < 0.25 ? 3.5 + r() * 3 : 1.2 + r() * 1.8;
      const s = W / info.size.x;
      const H = info.size.y * s;
      const g = 0.85 + r() * 0.25;
      pl[type].push({ x: c.x, y: c.h - 0.15, z: c.z, rot: r() * Math.PI * 2, scale: s, colors: { hexagons_medieval: new THREE.Color(g, g, g * 1.02) } });
      const hcol = { kind: 'circle', x: c.x, z: c.z, r: W * 0.42, y0: c.h - 3, y1: c.h + H, rock: true };
      this.colliders.add(hcol);
      pending.push({ col: hcol, type, idx: pl[type].length - 1, hp: Math.round(200 + W * 110) });
      n++;
    }
    const groups = {};
    for (const [type, list] of Object.entries(pl)) if (list.length) this.scene.add(groups[type] = this.models.instanced(type, list));
    for (const p of pending) this.destr.register(p.col, groups[p.type].children.map((im) => ({ im, idx: p.idx })), { kind: 'rock', hp: p.hp });
  }

  // Kenney palms along the beaches.
  // Desert island: saguaro cacti (procedural, instanced) with colliders.
  _cacti() {
    const r = this.rand;
    const green = '#5f9a4a';
    const parts = [
      new THREE.CylinderGeometry(0.34, 0.4, 1, 10).translate(0, 0.5, 0),
      new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1, 0),
      // arms
      new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8).rotateZ(Math.PI / 2).translate(0.45, 0.45, 0),
      new THREE.CylinderGeometry(0.22, 0.22, 0.42, 8).translate(0.68, 0.64, 0),
      new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.68, 0.85, 0),
      new THREE.CylinderGeometry(0.2, 0.2, 0.44, 8).rotateZ(Math.PI / 2).translate(-0.42, 0.62, 0),
      new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8).translate(-0.62, 0.78, 0),
      new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(-0.62, 0.95, 0),
    ].map((g) => { g.deleteAttribute('uv'); return g; });
    const geo = mergeGeometries(parts);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.8, flatShading: true });
    const max = Math.round(110 * AREA_SCALE);
    const im = new StreamedInstancedMesh(geo, mat, max, 320); // cacti
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < 3000 && n < max; i++) {
      const c = this._candidate(2.4, 26, 0.85);
      if (!c || !this._free(c.x, c.z, 4)) continue;
      if (!VARIANT.cacti && biomeAt(c.x, c.z).desert < 0.6) continue; // on the default island: desert biome only
      const H = 2.6 + r() * 3.2;
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      m.compose(p.set(c.x, c.h - 0.1, c.z), q, sc.set(H * 0.55, H, H * 0.55));
      im.setMatrixAt(n, m);
      im.setColorAt(n, col.set(green).multiplyScalar(0.85 + r() * 0.3));
      const hcol = { kind: 'circle', x: c.x, z: c.z, r: 0.3 * H * 0.55 + 0.1, y0: c.h - 1, y1: c.h + H, tree: true };
      this.colliders.add(hcol);
      im.setMatrixAt(n, m);
      this.destr.register(hcol, [{ im, idx: n }], { kind: 'tree', hp: Math.round(80 + H * 25) });
      n++;
    }
    im.count = n;
    im.castShadow = im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    this.scene.add(im);
  }

  _palms() {
    const r = this.rand;
    const pl = { 'palm-long': [], 'palm-short': [] };
    const pending = [];
    for (let i = 0; i < 900 * AREA_SCALE && pl['palm-long'].length + pl['palm-short'].length < 46 * AREA_SCALE; i++) {
      const a = r() * Math.PI * 2, d = ISLAND_RADIUS * 0.72 + r() * ISLAND_RADIUS * 0.45;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (h < 0.9 || h > 3.2 || this._inTown(x, z, 2)) continue;
      if (!this._free(x, z, 5)) continue;
      const type = r() < 0.5 ? 'palm-long' : 'palm-short';
      const s = (7 + r() * 4) / this.models.get(type).size.y;
      pl[type].push({ x, y: h - 0.2, z, rot: r() * Math.PI * 2, scale: s });
      const hcol = { kind: 'circle', x, z, r: 0.35, y0: h - 2, y1: h + 8, tree: true };
      this.colliders.add(hcol);
      pending.push({ col: hcol, type, idx: pl[type].length - 1 });
      this.occluders.push({ x, y: h + (7 + 2) * 0.8, z, r: 2.6 });
    }
    const palmMat = (p) => { const m = p.material.clone(); m.roughness = 0.8; addWind(m, { amount: 0.035, pivot: 0.5, speed: 1.2 }); return m; };
    const groups = {};
    for (const [type, list] of Object.entries(pl)) if (list.length) this.scene.add(groups[type] = this.models.instanced(type, list, { material: palmMat }));
    for (const p of pending) this.destr.register(p.col, groups[p.type].children.map((im) => ({ im, idx: p.idx })), { kind: 'tree', hp: 220 });
  }

  // Tall Kenney rock spires on the mountain and a few on the coast.
  _spires() {
    const r = this.rand;
    const pl = { 'formation-large-stone': [], 'formation-stone': [] };
    const grey = ['#b8bcc2', '#a7aab0', '#c9ccd1', '#9ea3aa'];
    let n = 0;
    for (let i = 0; i < 1500 * AREA_SCALE && n < 34 * AREA_SCALE * ROCK_DENSITY; i++) {
      const onMountain = r() < 0.6;
      const c = onMountain ? this._candidate(10, 44, 0.5) : this._candidate(0.8, 14, 0.55);
      if (!c) continue;
      if (!onMountain && Math.hypot(c.x, c.z) < 125) continue;
      if (!this._free(c.x, c.z, 8)) continue;
      const type = r() < 0.5 ? 'formation-large-stone' : 'formation-stone';
      const info = this.models.get(type);
      const s = (4 + r() * 6) / info.size.x;
      pl[type].push({ x: c.x, y: c.h - 0.8, z: c.z, rot: r() * Math.PI * 2, scale: s, colors: { stone: new THREE.Color(grey[Math.floor(r() * grey.length)]) } });
      this.colliders.add({ kind: 'circle', x: c.x, z: c.z, r: info.size.x * s * 0.36, y0: c.h - 3, y1: c.h + info.size.y * s * 0.9, stone: true });
      n++;
    }
    for (const [type, list] of Object.entries(pl)) {
      if (list.length) this.scene.add(this.models.instanced(type, list, { material: (p) => new THREE.MeshStandardMaterial({ color: p.material.color, roughness: 0.92, flatShading: true }) }));
    }
  }

  _bushes() {
    const r = this.rand;
    const count = Math.round(260 * AREA_SCALE);
    let geo = new THREE.IcosahedronGeometry(1, 1);
    geo.deleteAttribute('uv');
    geo = jitter(geo, 0.25, r);
    gradientY(geo, new THREE.Color(0.5, 0.55, 0.5), new THREE.Color(1.15, 1.2, 1.05));
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.9 });
    addWind(mat, { amount: 0.06, pivot: -0.6, speed: 1.6 });
    const im = new StreamedInstancedMesh(geo, mat, count, 260); // bushes
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count * 5 && n < count; i++) {
      const c = this._candidate(2.4, 28, 0.8);
      if (!c) continue;
      if (!this._free(c.x, c.z, 2)) continue;
      const sc = 0.6 + r() * 0.7;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m.compose(p.set(c.x, c.h + sc * 0.25, c.z), q, s.set(sc * 1.2, sc * 0.8, sc * 1.2));
      im.setMatrixAt(n, m);
      const flower = r() < 0.12;
      this.occluders.push({ x: c.x, y: c.h + sc * 0.3, z: c.z, r: sc * 0.9 });
      im.setColorAt(n, flower ? col.set(['#ff8fb1', '#ffd166', '#c792ea'][Math.floor(r() * 3)]) : col.copy(TREE_GREENS[Math.floor(r() * TREE_GREENS.length)]).multiplyScalar(0.95));
      n++;
    }
    im.count = n;
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.scene.add(im);
  }

  _grass() {
    const r = mulberry32(777);
    const count = quality.grassCount;
    const radius = quality.grassRadius;
    const size = radius * 2;
    // one tuft = 5 blades (triangles)
    const blades = 5;
    const pos = [], tip = [], nor = [];
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + r() * 0.8;
      const d = r() * 0.18;
      const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
      const w = 0.055 + r() * 0.035;
      const h = 0.3 + r() * 0.28;
      const lean = 0.12 + r() * 0.12;
      const px = Math.cos(a + Math.PI / 2) * w, pz = Math.sin(a + Math.PI / 2) * w;
      pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean);
      tip.push(0, 0, 1);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      off[i * 4] = r() * size;
      off[i * 4 + 1] = r() * size;
      off[i * 4 + 2] = r() * Math.PI * 2;
      off[i * 4 + 3] = 0.75 + r() * 0.7;
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 4));
    geo.instanceCount = count;

    const uniforms = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2() },
      uSize: { value: size },
      uRadius: { value: radius },
      uHalf: { value: WORLD_HALF },
      uHeightTex: { value: this.heightTex || this.terrain.buildDataTexture() },
      uGrassA: { value: VARIANT.grass ? new THREE.Color(VARIANT.grass[0]) : PALETTE.grassA.clone() },
      uGrassB: { value: VARIANT.grass ? new THREE.Color(VARIANT.grass[1]) : PALETTE.grassB.clone() },
      uBakeTex: { value: null },
    };
    this.grassUniforms = uniforms;
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aOffset;
          attribute float aTip;
          uniform float uTime, uSize, uRadius, uHalf;
          uniform vec2 uCenter;
          uniform sampler2D uHeightTex;
          uniform sampler2D uBakeTex;
          varying float vTip;
          varying float vVar;
          varying float vAO;
          varying vec3 vFlower;`)
        .replace('#include <begin_vertex>', `
          vec2 base = uCenter + mod(aOffset.xy - uCenter + uSize * 0.5, uSize) - uSize * 0.5;
          vec2 tuv = (base + uHalf) / (uHalf * 2.0);
          vec4 hd = texture2D(uHeightTex, tuv);
          float dist = length(base - uCenter);
          float fade = 1.0 - smoothstep(uRadius * 0.65, uRadius, dist);
          float sc = aOffset.w * smoothstep(0.25, 0.6, hd.g) * fade;
          float cr = cos(aOffset.z), sr = sin(aOffset.z);
          vec3 p = vec3(position.x * cr - position.z * sr, position.y, position.x * sr + position.z * cr) * sc;
          float w = sin(uTime * 1.7 + base.x * 0.13 + base.y * 0.09) * 0.6 + sin(uTime * 3.3 + base.x * 0.5 + base.y * 0.3) * 0.25;
          p.x += w * aTip * 0.2 * sc;
          p.z += w * aTip * 0.1 * sc;
          vec3 transformed = vec3(base.x, hd.r - 0.04, base.y) + p;
          vTip = aTip;
          vVar = hd.b;
          vAO = texture2D(uBakeTex, tuv).g;
          float fh = fract(sin(dot(aOffset.xy, vec2(12.9898, 78.233))) * 43758.5453);
          vFlower = vec3(0.0);
          if (fh < 0.045) {
            float fc = fract(fh * 97.0);
            vFlower = fc < 0.33 ? vec3(1.0, 0.35, 0.6) : fc < 0.66 ? vec3(1.0, 0.85, 0.2) : vec3(1.0, 1.0, 1.0);
          }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uGrassA, uGrassB;
          varying float vTip;
          varying float vVar;
          varying float vAO;
          varying vec3 vFlower;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 gcol = mix(uGrassA, uGrassB, vVar);
          diffuseColor.rgb = mix(gcol * 0.6, gcol * 1.25 + vec3(0.03, 0.04, 0.0), vTip) * (1.0 - vAO);
          if (vFlower.r + vFlower.g > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vFlower, smoothstep(0.6, 0.85, vTip));`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.name = 'grass';
    this.scene.add(mesh);
    this.grassMesh = mesh;
  }

  setBakeTexture(tex) { if (this.grassUniforms) this.grassUniforms.uBakeTex.value = tex; }

  setGrassDensity(k) {
    if (this.grassMesh) this.grassMesh.geometry.instanceCount = Math.max(200, Math.round(quality.grassCount * k * (VARIANT.grassDensity ?? 1)));
  }

  // Swap round trees near the camera for the detailed Quaternius trees.
  _updateTreeLOD(cam) {
    const shown = this.nature.updateLOD(this.roundTrees, cam);
    const zero = this._zero || (this._zero = new THREE.Matrix4().makeScale(0, 0, 0));
    const prev = this._shown || new Set();
    for (const i of prev) if (!shown.has(i) && !this.roundTrees[i].removed) { const t = this.roundTrees[i]; this.trunkIM.setMatrixAt(t.trunkIdx, t.trunkMat); this.roundIM.setMatrixAt(t.canopyIdx, t.canopyMat); }
    for (const i of shown) if (!prev.has(i)) { const t = this.roundTrees[i]; this.trunkIM.setMatrixAt(t.trunkIdx, zero); this.roundIM.setMatrixAt(t.canopyIdx, zero); }
    this.trunkIM.instanceMatrix.needsUpdate = true;
    this.roundIM.instanceMatrix.needsUpdate = true;
    this._shown = shown;
    // KayKit pines near the camera become the detailed Stylized Trees pines
    if (!this.kkPineGroups || !this.nature.pineDetail.length) return;
    const pShown = this.nature.updateLOD(this.pineTrees, cam, this.nature.pineDetail);
    const pPrev = this._pShown || new Set();
    const set = (t, mat) => { for (const im of this.kkPineGroups[t.type].children) { im.setMatrixAt(t.idx, mat); im.instanceMatrix.needsUpdate = true; } };
    for (const i of pPrev) if (!pShown.has(i) && !this.pineTrees[i].removed) set(this.pineTrees[i], this.pineTrees[i].mat);
    for (const i of pShown) if (!pPrev.has(i)) set(this.pineTrees[i], zero);
    this._pShown = pShown;
  }

  update(dt, t, focus, cam) {
    WIND.uTime.value = t;
    if (this.nature && cam) {
      this._lodT = (this._lodT || 0) - dt;
      if (this._lodT <= 0) { this._lodT = 0.3; this._updateTreeLOD(cam); }
    }
    if (!this.grassUniforms) return;
    this.grassUniforms.uTime.value = t;
    this.grassUniforms.uCenter.value.set(focus.x, focus.z);
  }
}
