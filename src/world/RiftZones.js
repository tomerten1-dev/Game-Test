import * as THREE from 'three';
import { TOWNS } from './Terrain.js';

// Rift Zones: a couple of towns each match get a rule of their own, marked by a shimmering dome
// on the island and a ring on the map. Inside: low gravity, no building, a speed boost or free ammo.
export const RIFT_TYPES = {
  lowgrav: { name: 'Low Gravity', color: '#7fd8ff' },
  nobuild: { name: 'No Building', color: '#ff7a59' },
  speed: { name: 'Speed Zone', color: '#7dff8a' },
  ammo: { name: 'Endless Ammo', color: '#ffd23f' },
};

export class RiftZones {
  constructor(game) {
    this.game = game;
    this.zones = [];
  }

  reset() {
    for (const z of this.zones) this.game.scene.remove(z.mesh);
    this.zones = [];
  }

  spawn() {
    this.reset();
    if (this.game.mode === 'arena') return;
    const towns = [...TOWNS].sort(() => Math.random() - 0.5).slice(0, 2);
    const kinds = Object.keys(RIFT_TYPES).sort(() => Math.random() - 0.5);
    towns.forEach((t, i) => {
      const kind = kinds[i];
      if (kind === 'nobuild' && this.game.zeroBuild) return;
      const r = t.r * 0.8, def = RIFT_TYPES[kind];
      const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      mesh.position.set(t.x, this.game.world.heightAt(t.x, t.z) - 4, t.z);
      mesh.renderOrder = 3;
      this.game.scene.add(mesh);
      this.zones.push({ kind, x: t.x, z: t.z, r, mesh, town: t.name, def });
    });
  }

  // The rift zone kind at a position (or null).
  at(p) {
    for (const z of this.zones) if ((p.x - z.x) ** 2 + (p.z - z.z) ** 2 < z.r * z.r) return z.kind;
    return null;
  }

  update(dt) {
    const g = this.game;
    if (!this.zones.length) return;
    const t = g.time;
    for (const z of this.zones) z.mesh.material.opacity = 0.06 + 0.03 * Math.sin(t * 1.7 + z.x);
    for (const a of g.actors) {
      if (!a.alive || a.state === 'bus') continue;
      const k = this.at(a.pos);
      if (k !== a._rift) {
        a._rift = k;
        if (a.isPlayer && k) g.hud?.toast?.(`Rift Zone · ${RIFT_TYPES[k].name}`);
        if (k === 'nobuild' && a.buildMode) a.setBuildMode?.(null);
      }
      if (k === 'lowgrav') a.lowGravT = Math.max(a.lowGravT || 0, 0.3);
      else if (k === 'speed') a.speedT = Math.max(a.speedT || 0, 0.3);
      else if (k === 'ammo' && a.weapon?.isGun && a.weapon.def.ammoType !== 'none') a.weapon.ammo = Math.max(a.weapon.ammo, a.weapon.mag - 1);
    }
  }

  mapIcons() {
    return this.zones.map((z) => ({ x: z.x, z: z.z, color: z.def.color, shape: 'dot', label: `Rift Zone: ${z.def.name}`, ring: z.r }));
  }
}
