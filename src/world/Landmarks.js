import * as THREE from 'three';
import { TOWNS, ISLANDS, TUNNELS, MOUNTAIN, MAP_SCALE } from './Terrain.js';
import { mulberry32 } from '../core/noise.js';

// Named spots between the towns: small landmarks (a camp, a windmill, a water tower…), the offshore
// islands and the roof of the mountain tunnel. Each landmark gets a chest spot and a map label.
const SMALL = [
  { name: 'Camp Cod', more: ['Camp Trout', 'Camp Perch'], props: [['kk/tent', 2.6, 0, 0], ['kk/tent', 2.4, 4.5, 2], ['kk/barrel', 1.1, -2.5, 2], ['kk/sack', 0.8, 2, -2.5]] },
  { name: 'Old Windmill', more: ['Twin Mills', 'Creaky Mill'], props: [['kk/windmill_green', 10, 0, 0], ['kk/wheelbarrow', 1.1, 5, 3], ['kk/sack', 0.8, 4, -3]] },
  { name: 'Water Tower', more: ['Rusty Tank', 'High Tank'], props: [['kk/city_watertower', 11, 0, 0], ['kk/crate_A_big', 1.3, 5, 1], ['kk/crate_A_big', 1.3, 5.5, 2.6]] },
  { name: 'Lumber Camp', more: ['Sawdust Yard', 'Timber Post'], props: [['kk/resource_lumber', 1.4, 0, 0], ['kk/resource_lumber', 1.4, 3, 2], ['kk/tent', 2.5, -4, 3], ['kk/weaponrack', 1.6, 2, -3]] },
  { name: 'Flag Hill', more: ['Banner Knoll', 'Pennant Point'], props: [['kk/flag_red', 4, 0, 0], ['kk/flag_blue', 4, 3.5, 1], ['kk/barrel', 1.1, -2, -2]] },
  { name: 'Lookout Ruin', more: ['Watch Ruin', 'Broken Keep'], props: [['kk/tower_A_red', 9, 0, 0], ['kk/crate_A_big', 1.3, 4, 3]] },
];

export class Landmarks {
  constructor(scene, terrain, colliders, towns, models) {
    this.scene = scene; this.terrain = terrain; this.colliders = colliders; this.towns = towns; this.models = models;
    this.list = [];
    towns.landmarks ||= [];
    this._tunnels();
    this._islands();
    this._small();
  }

  _prop(name, height, x, z, rot) {
    const info = this.models?.get(name);
    if (!info) return;
    const s = height / info.size.y;
    const y = this.terrain.heightAt(x, z);
    const o = this.models.instance(name);
    o.scale.setScalar(s);
    o.position.set(x, y - 0.05, z);
    o.rotation.y = rot;
    o.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
    this.scene.add(o);
    const r = Math.max(info.size.x, info.size.z) * s * 0.42;
    this.colliders.add({ kind: 'circle', x, z, r, y0: y - 0.5, y1: y + height, crate: true, mat: 'wood' });
  }

  _clear(x, z, pad) {
    const h = this.terrain.heightAt(x, z);
    if (h < 3 || h > 30 || this.terrain.normalAt(x, z).y < 0.9) return false;
    for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return false;
    if (Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < MOUNTAIN.r) return false;
    for (const h2 of this.towns.houses) if (x > h2.minX - pad && x < h2.maxX + pad && z > h2.minZ - pad && z < h2.maxZ + pad) return false;
    return !this.list.some((l) => Math.hypot(l.x - x, l.z - z) < 70);
  }

  _small() {
    const r = mulberry32(7331);
    // each kind of landmark shows up three times across the big island, each with its own name
    const jobs = [];
    for (let pass = 0; pass < 3; pass++) for (const L of SMALL) jobs.push({ ...L, name: pass ? L.more[pass - 1] : L.name });
    for (const L of jobs) {
      for (let i = 0; i < 400; i++) {
        const a = r() * Math.PI * 2, d = (60 + r() * 250) * MAP_SCALE;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!this._clear(x, z, 45)) continue;
        const rot = r() * Math.PI * 2, c = Math.cos(rot), s = Math.sin(rot);
        for (const [name, h, px, pz] of L.props) this._prop(name, h, x + px * c + pz * s, z - px * s + pz * c, rot + r() * 0.6);
        this.towns.chestSpots.push({ x: x + 3 * s, z: z + 3 * c, rot });
        this.towns.landmarks.push({ name: L.name, x, z });
        this.list.push({ name: L.name, x, z });
        break;
      }
    }
  }

  _islands() {
    for (const is of ISLANDS) {
      this.towns.landmarks.push({ name: is.name, x: is.x, z: is.z });
      this.towns.chestSpots.push({ x: is.x + 2, z: is.z - 1, rot: 0 }, { x: is.x - 4, z: is.z + 3, rot: 1.5 });
      this._prop('kk/barrel', 1.1, is.x + 5, is.z + 4, 0.3);
      this._prop('kk/flag_yellow', 4, is.x - 1, is.z - 5, 0);
    }
  }

  // Stone roof over the mountain cut so it reads (and plays) as a tunnel, with lanterns inside.
  _tunnels() {
    const rock = new THREE.MeshStandardMaterial({ color: '#8f8b86', roughness: 0.95, flatShading: true });
    const beam = new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.9 });
    const lamp = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 2 });
    for (const t of TUNNELS) {
      const L = t.bx - t.ax, step = 4;
      let inside = false, first = null;
      for (let x = t.ax; x <= t.bx; x += step) {
        const u = (x - t.ax) / L, floor = t.ay + (t.by - t.ay) * u;
        const above = this.terrain.rawHeight(x, t.az) - floor;
        if (above < 7.5) { inside = false; continue; }
        if (!inside) { inside = true; if (!first) first = x; }
        const y0 = floor + 5.2, W = t.w * 2 + 3;
        // the rock above the tunnel: fills the cut back up to the old mountain surface
        let top = Infinity;
        for (const sx of [x, x + step]) for (const sz of [-W / 2, 0, W / 2]) top = Math.min(top, this.terrain.rawHeight(sx, t.az + sz));
        top = Math.max(y0 + 1.2, top - 0.2);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(step + 0.05, top - y0, W), rock);
        cap.position.set(x + step / 2, (y0 + top) / 2, t.az);
        cap.castShadow = cap.receiveShadow = true;
        this.scene.add(cap);
        this.colliders.add({ kind: 'box', minX: x, maxX: x + step, minZ: t.az - W / 2, maxZ: t.az + W / 2, y0, y1: top, rock: true, mat: 'stone' });
        // timber frames and a lantern every few metres
        if (Math.round((x - t.ax) / step) % 3 === 0) {
          for (const sz of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), beam);
            post.position.set(x + step / 2, floor + 2.6, t.az + sz * (t.w - 1.2));
            this.scene.add(post);
          }
          const cross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, t.w * 2 - 2), beam);
          cross.position.set(x + step / 2, y0 - 0.2, t.az);
          this.scene.add(cross);
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.25), lamp);
          l.position.set(x + step / 2, y0 - 0.6, t.az);
          this.scene.add(l);
        }
      }
      if (first !== null) this.towns.landmarks.push({ name: t.name, x: (t.ax + t.bx) / 2, z: t.az });
    }
  }
}
