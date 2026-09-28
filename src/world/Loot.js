import * as THREE from 'three';
import { part, merge, mat } from './geomUtils.js';
import { TOWNS, MAP_SCALE, GROW, VAULT_TOWN } from './Terrain.js';
import { Weapon } from '../weapons/Weapon.js';
import { RARITIES, rollRarity, rollWeaponType } from '../weapons/WeaponDefs.js';
import { itemGeometry } from '../weapons/WeaponModels.js';
import { makeWeaponMesh, makeAmmoBoxMesh, makeAmmoPickupMesh, makeThrowableMesh } from '../weapons/WeaponModels.js';
import { mulberry32 } from '../core/noise.js';
import { makeConsumableMesh, makeMedallionMesh, makeGoldMesh, makeCrownMesh } from './ItemMeshes.js';
import { AMMO, MATS, CONSUMABLES, Consumable, MEDALLIONS } from '../weapons/Items.js';

// Loadout roles smart bots try to fill: one close-range gun, one rifle, one long-range, one explosive.
const ROLE = { shotgun: 'close', pump: 'close', smg: 'close', ar: 'mid', burst: 'mid', sniper: 'long', rocket: 'boom', pistol: 'side' };

const GOLD = '#ffc233', GOLD_DARK = '#c17d11', TRIM = '#6b3f16';

function chestGeometries() {
  const base = merge([
    part(new THREE.BoxGeometry(1.1, 0.55, 0.7), GOLD, mat(0, 0.275, 0)),
    part(new THREE.BoxGeometry(1.14, 0.1, 0.74), TRIM, mat(0, 0.05, 0)),
    part(new THREE.BoxGeometry(1.14, 0.08, 0.74), GOLD_DARK, mat(0, 0.52, 0)),
    part(new THREE.BoxGeometry(0.1, 0.56, 0.74), TRIM, mat(-0.45, 0.28, 0)),
    part(new THREE.BoxGeometry(0.1, 0.56, 0.74), TRIM, mat(0.45, 0.28, 0)),
  ]);
  // lid pivots on its back edge (z = -0.35)
  const lidShape = new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12, 1, false, 0, Math.PI);
  const lid = merge([
    part(lidShape, GOLD, mat(0, 0, 0.35, 0, 0, Math.PI / 2)),
    part(new THREE.BoxGeometry(0.1, 0.36, 0.72), TRIM, mat(-0.45, 0.17, 0.35)),
    part(new THREE.BoxGeometry(0.1, 0.36, 0.72), TRIM, mat(0.45, 0.17, 0.35)),
    part(new THREE.BoxGeometry(0.18, 0.22, 0.08), '#fff3b0', mat(0, -0.02, 0.72)),
  ]);
  return { base, lid };
}

function itemGeometries() {
  const shield = merge([
    part(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 10), '#43b4ff', mat(0, 0.17, 0)),
    part(new THREE.SphereGeometry(0.2, 12, 8), '#6fd0ff', mat(0, 0.32, 0)),
    part(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8), '#e9f7ff', mat(0, 0.54, 0)),
    part(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), '#8a5a2b', mat(0, 0.63, 0)),
  ]);
  const med = merge([
    part(new THREE.BoxGeometry(0.6, 0.36, 0.44), '#f5f7fb', mat(0, 0.18, 0)),
    part(new THREE.BoxGeometry(0.34, 0.1, 0.46), '#ff3b4e', mat(0, 0.2, 0)),
    part(new THREE.BoxGeometry(0.1, 0.34, 0.46), '#ff3b4e', mat(0, 0.2, 0)),
    part(new THREE.BoxGeometry(0.2, 0.06, 0.06), '#c9ced8', mat(0, 0.39, 0)),
  ]);
  const wood = merge([
    part(new THREE.BoxGeometry(0.8, 0.14, 0.24), '#b07a45', mat(0, 0.07, -0.13, 0, 0.05, 0)),
    part(new THREE.BoxGeometry(0.8, 0.14, 0.24), '#c68b52', mat(0, 0.07, 0.13, 0, -0.05, 0)),
    part(new THREE.BoxGeometry(0.8, 0.14, 0.24), '#a36c3a', mat(0, 0.21, 0, 0, 0.3, 0)),
  ]);
  const small = merge([
    part(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 10), '#7fd9ff', mat(0, 0.11, 0)),
    part(new THREE.SphereGeometry(0.13, 10, 8), '#a5e6ff', mat(0, 0.22, 0)),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), '#e9f7ff', mat(0, 0.37, 0)),
  ]);
  const bandage = merge([
    part(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 14), '#f4f1ea', mat(0, 0.16, 0, 0, 0, Math.PI / 2)),
    part(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 14), '#ff5a5f', mat(0, 0.16, 0, 0, 0, Math.PI / 2)),
  ]);
  const ammo = merge([
    part(new THREE.BoxGeometry(0.5, 0.28, 0.3), '#3b4a2e', mat(0, 0.14, 0)),
    part(new THREE.BoxGeometry(0.52, 0.06, 0.32), '#ffffff', mat(0, 0.2, 0)),
  ]);
  const stone = merge([
    part(new THREE.DodecahedronGeometry(0.2, 0), '#a5a9b0', mat(-0.12, 0.15, 0)),
    part(new THREE.DodecahedronGeometry(0.16, 0), '#8f949c', mat(0.14, 0.12, 0.06)),
    part(new THREE.DodecahedronGeometry(0.13, 0), '#b8bcc3', mat(0.02, 0.3, -0.05)),
  ]);
  const metal = merge([
    part(new THREE.BoxGeometry(0.6, 0.12, 0.18), '#9fb3c8', mat(0, 0.06, -0.1)),
    part(new THREE.BoxGeometry(0.6, 0.12, 0.18), '#8aa0b7', mat(0, 0.06, 0.1)),
    part(new THREE.BoxGeometry(0.6, 0.12, 0.18), '#b4c6d8', mat(0, 0.18, 0)),
  ]);
  const medmist = merge([
    part(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 12), '#7dffb2', mat(0, 0.17, 0)),
    part(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), '#2b7a55', mat(0, 0.1, 0)),
    part(new THREE.BoxGeometry(0.08, 0.1, 0.12), '#e9f7ff', mat(0, 0.39, 0.03)),
  ]);
  const slurp = merge([
    part(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 12), '#b86bff', mat(0, 0.15, 0)),
    part(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), '#6fd0ff', mat(0, 0.18, 0)),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), '#ffffff', mat(0.06, 0.38, 0, 0, 0, -0.3)),
  ]);
  const chug = merge([
    part(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 14), '#39d0ff', mat(0, 0.25, 0)),
    part(new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#39d0ff', mat(0, 0.5, 0)),
    part(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 10), '#e7eef7', mat(0, 0.74, 0)),
    part(new THREE.TorusGeometry(0.12, 0.035, 6, 12), '#e7eef7', mat(0.26, 0.4, 0, 0, 0, Math.PI / 2)),
  ]);
  const keg = merge([
    part(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 14), '#2f6fd6', mat(0, 0.25, 0)),
    part(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 14), '#c9d6e8', mat(0, 0.08, 0)),
    part(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 14), '#c9d6e8', mat(0, 0.42, 0)),
    part(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), '#6fd0ff', mat(0, 0.53, 0)),
  ]);
  const campfire = merge([
    part(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 7), '#6b4226', mat(0, 0.08, 0, Math.PI / 2, 0, 0.5)),
    part(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 7), '#7a4c2c', mat(0, 0.14, 0, Math.PI / 2, 0, -0.5)),
    part(new THREE.ConeGeometry(0.12, 0.26, 7), '#ff9a3c', mat(0, 0.3, 0)),
  ]);
  return { shield, med, wood, small, bandage, ammo, stone, metal, medmist, slurp, chug, keg, campfire };
}

let _beamTex;
function beamTexture() {
  if (_beamTex) return _beamTex;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  _beamTex = new THREE.CanvasTexture(cv);
  return _beamTex;
}

const _v = new THREE.Vector3();
function g_toastPickup(game, p, count = p.count) {
  if (p.type === 'weapon') { game.hud?.pickupNote?.(`+ ${p.weapon.name}`, RARITIES[p.weapon.rarity].color); return; }
  if (p.type === 'gold') { game.hud?.pickupNote?.(`+${p.amount} Gold`, '#ffd23f'); return; }
  if (p.type === 'medallion' || p.type === 'crown') return;
  if (p.type === 'consumable') { game.hud?.pickupNote?.(`+${count - (p.alive ? p.count : 0)} ${CONSUMABLES[p.ctype].name}`, CONSUMABLES[p.ctype].color); return; }
  game.hud?.pickupNote?.(`+${p.amount} ${p.type === 'ammo' ? AMMO[p.ammoType].name : MATS[p.matType].name}`, p.type === 'ammo' ? AMMO[p.ammoType].color : MATS[p.matType].color);
}

// weapon type -> preferred-slot class (Settings)
export const PREF_CLASS = { shotgun: 'shotgun', pump: 'shotgun', ar: 'rifle', burst: 'rifle', smg: 'smg', pistol: 'smg', sniper: 'sniper', rocket: 'explosive' };

export class Loot {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.chests = [];
    this.pickups = [];
    const cg = chestGeometries();
    this.chestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55, emissive: '#8a5a00', emissiveIntensity: 0.55 });
    this.itemGeo = itemGeometries();
    this.itemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1, emissive: '#222222' });
    this.glowTex = game.effects.glowTex;

    // chest spots: next to houses, town centers, crate piles, plus random spots
    const spots = [...this.world.towns.chestSpots];
    const r = mulberry32(555);
    // like Fortnite, most chests are in named places: the town buildings get a spot each
    for (const h of this.world.towns.houses) {
      if (h.home) continue; // enterable homes already have indoor spots
      // big buildings (city blocks, towers, warehouses, barns) get a spot on each side
      const w = h.maxX - h.minX, d = h.maxZ - h.minZ, big = w * d > 120;
      for (const side of big ? [-1, 1] : [r() < 0.5 ? -1 : 1]) spots.push({ x: h.x + side * (w / 2 + 1.4), z: h.z + (r() - 0.5) * 2, rot: r() * 6 });
      if (big) spots.push({ x: h.x + (r() - 0.5) * 2, z: h.z + (r() < 0.5 ? -1 : 1) * (d / 2 + 1.4), rot: r() * 6 });
    }
    for (let i = 0; i < 5 * GROW; i++) {
      const a = r() * Math.PI * 2, d = (25 + r() * 250) * MAP_SCALE;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.world.heightAt(x, z) > 2.5 && this.world.terrain.normalAt(x, z).y > 0.85) spots.push({ x, z, rot: r() * 6 });
    }
    for (const s of spots) {
      if (r() > 0.6) continue; // Fortnite: each chest spot spawns 50-70% of the time
      const y = s.y ?? this.world.groundAt(s.x, s.z, 200, 0.6); // spots inside houses know their floor
      if (y < 1) continue;
      const group = new THREE.Group();
      const rare = r() < 0.07; // rare chests (Fortnite: a few per big named place): shinier gold, better rarity (same number of items)
      let lidPivot;
      const kk = this.game.models?.get('kk/chest_gold');
      if (kk) {
        // KayKit treasure chest, tinted gold; its lid node is already pivoted at the hinge
        const model = kk.scene.clone(true);
        const sc = 1.25 / kk.size.x;
        model.scale.setScalar(sc);
        model.traverse((o) => {
          if (o.isMesh) { o.material = rare ? this.kkRareMat(o.material) : this.kkChestMat(o.material); o.castShadow = true; }
          if (o.name.includes('lid')) lidPivot = o;
        });
        group.add(model);
        if (!lidPivot) lidPivot = new THREE.Object3D();
        lidPivot.userData.baseRot = lidPivot.rotation.x;
      } else {
        const base = new THREE.Mesh(cg.base, this.chestMat);
        lidPivot = new THREE.Object3D();
        lidPivot.position.set(0, 0.55, -0.35);
        const lid = new THREE.Mesh(cg.lid, this.chestMat);
        lidPivot.add(lid);
        base.castShadow = lid.castShadow = true;
        group.add(base, lidPivot);
        lidPivot.userData.baseRot = 0;
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: rare ? '#fff1a8' : '#ffd76a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
      glow.material.color.multiplyScalar(1.6);
      glow.scale.setScalar(rare ? 3.6 : 2.6);
      glow.position.y = 0.5;
      group.add(glow);
      group.position.set(s.x, y, s.z);
      group.rotation.y = s.rot;
      this.scene.add(group);
      this.chests.push({ x: s.x, z: s.z, y, group, lidPivot, glow, rare, opened: false, openT: 0 });
    }
    this._createAmmoBoxes(spots, r);
    this.spawnFloorLoot();
  }

  // Green ammo boxes (E to open): next to houses and around the island.
  _createAmmoBoxes(chestSpots, r) {
    this.ammoBoxes = [];
    const ammoInfo = this.game.models?.get('guns/ammobox');
    const info = this.game.models?.get('kk/crate_A_big');
    const mat = new THREE.MeshStandardMaterial({ color: '#5f7d43', roughness: 0.7 });
    const trim = new THREE.MeshStandardMaterial({ color: '#e9e2c8', roughness: 0.6 });
    const spots = [];
    for (const h of this.world.towns.houses) spots.push({ x: h.x + (r() < 0.5 ? -1 : 1) * ((h.maxX - h.minX) / 2 + 1.6), z: h.z + (r() - 0.5) * 3 });
    for (let i = 0; i < 45 * GROW; i++) { const a = r() * Math.PI * 2, d = (20 + r() * 260) * MAP_SCALE; spots.push({ x: Math.cos(a) * d, z: Math.sin(a) * d }); }
    for (const sp of spots) {
      if (r() > 0.55) continue;
      const y = this.world.groundAt(sp.x, sp.z, 200, 0.5);
      if (y < 1.5) continue;
      if (chestSpots.some((c) => Math.hypot(c.x - sp.x, c.z - sp.z) < 3)) continue;
      const g = new THREE.Group();
      if (ammoInfo) {
        // the Styloo ammo box, scaled up to a crate you can open
        const box = makeAmmoBoxMesh(0.95 / Math.max(ammoInfo.size.x, ammoInfo.size.z));
        g.add(box);
        g.position.set(sp.x, y, sp.z);
        g.rotation.y = r() * Math.PI;
        this.scene.add(g);
        this.ammoBoxes.push({ x: sp.x, z: sp.z, y, group: g, opened: false });
        continue;
      }
      const box = info ? new THREE.Mesh(info.parts[0].geometry, mat) : new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      if (info) box.scale.set(0.95 / info.size.x, 0.55 / info.size.y, 0.6 / info.size.z);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.1, 0.62), trim);
      band.position.y = 0.36;
      box.castShadow = band.castShadow = true;
      g.add(box, band);
      g.position.set(sp.x, y, sp.z);
      g.rotation.y = r() * Math.PI;
      this.scene.add(g);
      this.ammoBoxes.push({ x: sp.x, z: sp.z, y, group: g, opened: false });
    }
  }

  openAmmoBox(b, actor) {
    if (this.game.warmup > 0) return;
    if (b.opened) return;
    b.opened = true;
    b.group.visible = false;
    this.game.sound.play('ammo', actor.isPlayer ? null : _v.set(b.x, b.y, b.z));
    const types = new Set();
    const w = actor.weapon;
    if (w && AMMO[w.def.ammoType]) types.add(w.def.ammoType); // bows / blades use no ammo
    const all = Object.keys(AMMO).filter((t) => t !== 'heavy');
    while (types.size < 2) types.add(all[Math.floor(Math.random() * all.length)]);
    if (Math.random() < 0.4) this.spawnPickup({ type: 'gold', amount: 10 }, _v.set(b.x, b.y + 0.6, b.z), new THREE.Vector3(0, 4.5, 0));
    [...types].forEach((t, i) => {
      const a = b.group.rotation.y + (i - 0.5) * 0.9;
      this.spawnPickup({ type: 'ammo', ammoType: t, amount: AMMO[t].box }, _v.set(b.x, b.y + 0.6, b.z), new THREE.Vector3(Math.sin(a) * 2, 4.5, Math.cos(a) * 2));
    });
  }

  kkRareMat(src) {
    if (!this._kkRare) {
      const m = src.clone();
      m.color.set('#ffe680');
      m.emissive = new THREE.Color('#c07a00');
      m.emissiveIntensity = 0.95;
      m.roughness = 0.18;
      m.metalness = 0.85;
      this._kkRare = m;
    }
    return this._kkRare;
  }

  kkChestMat(src) {
    if (!this._kkMat) {
      const m = src.clone();
      m.color.set('#ffd257');
      m.emissive = new THREE.Color('#7a4b00');
      m.emissiveIntensity = 0.45;
      m.roughness = 0.35;
      m.metalness = 0.35;
      this._kkMat = m;
    }
    return this._kkMat;
  }

  reset() {
    for (const p of this.pickups) this._removePickup(p);
    this.pickups = [];
    for (const c of this.chests) {
      c.opened = false;
      c.openT = 0;
      c.lidPivot.rotation.x = c.lidPivot.userData.baseRot || 0;
      c.glow.visible = true;
    }
    for (const b of this.ammoBoxes) { b.opened = false; b.group.visible = true; }
    this.spawnFloorLoot();
  }

  static randomConsumable() {
    const r = Math.random();
    const table = [
      ['bandage', 20], ['smallshield', 15], ['bigshield', 13], ['medkit', 9], ['medmist', 6], ['slurp', 5], ['chug', 2], ['keg', 2], ['campfire', 3],
      ['grenade', 8], ['smoke', 3], ['impulse', 3], ['fire', 3], ['launchpad', 2], ['shockwave', 3], ['grappler', 2], ['rift', 1.5], ['trap', 4],
      ['bouncer', 2], ['crashpad', 2.5], ['wingsuit', 1.5], ['sliders', 1.5], ['gascan', 2.5],
      ['chugsplash', 4], ['flowberry', 2.5], ['spicytaco', 2.5], ['bubble', 2], ['portafort', 2], ['stormflip', 1.5], ['sos', 0.8], ['scanner', 1], ['oneup', 0.6], ['rod', 1.5], ['flopper', 1.5],
    ];
    let k = r * table.reduce((a, t) => a + t[1], 0), type = table[0][0];
    for (const [t, w] of table) { if ((k -= w) <= 0) { type = t; break; } }
    return { type: 'consumable', ctype: type, count: CONSUMABLES[type].stack };
  }

  static ammoFor(weapon) {
    const t = weapon.def.ammoType === 'none' ? 'medium' : weapon.def.ammoType;
    return { type: 'ammo', ammoType: t, amount: AMMO[t].box };
  }

  spawnFloorLoot() {
    // inside houses: one item on some of the floor spots
    for (const s of this.world.towns.homes?.lootSpots || []) {
      if (Math.random() > 0.8) continue; // indoor floor loot is common, like Fortnite
      const roll = Math.random();
      if (roll < 0.4) {
        const w = new Weapon(rollWeaponType('floor'), rollRarity(Math.random, this.game.lootLuck || 0)).withRandomMods();
        this.spawnPickup({ type: 'weapon', weapon: w }, _v.set(s.x, s.y + 0.2, s.z));
        this.spawnPickup(Loot.ammoFor(w), _v.set(s.x + 0.5, s.y + 0.2, s.z + 0.4));
      } else if (roll < 0.8) this.spawnPickup(Loot.randomConsumable(), _v.set(s.x, s.y + 0.2, s.z));
      else this.spawnPickup({ type: 'ammo', ammoType: ['light', 'medium', 'shells'][Math.floor(Math.random() * 3)], amount: 20 }, _v.set(s.x, s.y + 0.2, s.z));
    }
    // floor loot by the other town buildings (porches, sheds, shop fronts)
    for (const h of this.world.towns.houses) {
      if (h.home || Math.random() > 0.45) continue;
      const x = h.x + (Math.random() - 0.5) * (h.maxX - h.minX), z = h.z + (Math.random() < 0.5 ? -1 : 1) * ((h.maxZ - h.minZ) / 2 + 1.2);
      const y = this.world.groundAt(x, z, 200) + 0.2;
      if (Math.random() < 0.4) {
        const w = new Weapon(rollWeaponType('floor'), rollRarity(Math.random, this.game.lootLuck || 0)).withRandomMods();
        this.spawnPickup({ type: 'weapon', weapon: w }, _v.set(x, y, z));
        this.spawnPickup(Loot.ammoFor(w), _v.set(x + 0.7, y, z));
      } else this.spawnPickup(Loot.randomConsumable(), _v.set(x, y, z));
    }
    // weapons (with ammo), heals and ammo lying around town plazas
    for (const t of TOWNS) {
      for (let i = 0; i < Math.round(t.r / 6); i++) {
        const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * t.r * 0.45;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        const y = this.world.groundAt(x, z, 200) + 0.2;
        const roll = Math.random();
        if (roll < 0.38) {
          const w = new Weapon(rollWeaponType('floor'), rollRarity(Math.random, this.game.lootLuck || 0)).withRandomMods();
          this.spawnPickup({ type: 'weapon', weapon: w }, _v.set(x, y, z));
          this.spawnPickup(Loot.ammoFor(w), _v.set(x + 0.9, y, z + 0.4));
        } else if (roll < 0.8) this.spawnPickup(Loot.randomConsumable(), _v.set(x, y, z));
        else this.spawnPickup({ type: 'mat', matType: ['wood', 'stone', 'metal'][Math.floor(Math.random() * 3)], amount: 30 + 10 * Math.floor(Math.random() * 3) }, _v.set(x, y, z)); // material piles
      }
    }
    // fishing rods lie on the shore near most fishing spots
    for (const s of this.game?.gadgets?.spots || []) {
      if (Math.random() < 0.3) continue;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = s.x + Math.cos(a) * 11, z = s.z + Math.sin(a) * 11;
        if (this.world.heightAt(x, z) > 1.3) { this.spawnPickup({ type: 'consumable', ctype: 'rod', count: 1 }, _v.set(x, this.world.groundAt(x, z, 200) + 0.2, z)); break; }
      }
    }
  }

  spawnPickup(item, pos, vel = null) {
    const p = { ...item, pos: pos.clone(), vel: vel ? vel.clone() : new THREE.Vector3(), alive: true, age: 0, settled: !vel, spin: Math.random() * 6 };
    const g = new THREE.Group();
    let mesh, color;
    if (item.type === 'weapon') {
      mesh = makeWeaponMesh(item.weapon.type, item.weapon.rarity, item.weapon.mods);
      mesh.scale.setScalar(1.5);
      mesh.position.y = 0.55;
      color = RARITIES[item.weapon.rarity].color;
    } else if (item.type === 'mat' && item.matType === 'wood' && this.game.models?.get('kk/resource_lumber')) {
      const info = this.game.models.get('kk/resource_lumber');
      mesh = this.game.models.instance('kk/resource_lumber');
      mesh.scale.setScalar(0.9 / info.size.x);
      mesh.position.y = 0.3;
      color = MATS.wood.color;
    } else if (item.type === 'mat') {
      mesh = new THREE.Mesh(item.matType === 'stone' ? this.itemGeo.stone : item.matType === 'metal' ? this.itemGeo.metal : this.itemGeo.wood, this.itemMat);
      mesh.position.y = 0.3;
      color = MATS[item.matType].color;
    } else if (item.type === 'ammo') {
      mesh = makeAmmoPickupMesh(item.ammoType) || new THREE.Mesh(this.itemGeo.ammo, this.itemMat);
      mesh.position.y = 0.3;
      color = AMMO[item.ammoType].color;
    } else if (item.type === 'medallion') {
      mesh = makeMedallionMesh(MEDALLIONS[item.key].color);
      mesh.position.y = 0.75;
      color = MEDALLIONS[item.key].color;
    } else if (item.type === 'crown') {
      mesh = makeCrownMesh();
      mesh.scale.setScalar(2.2);
      mesh.position.y = 0.5;
      color = '#ffd23f';
    } else if (item.type === 'gold') {
      mesh = makeGoldMesh();
      mesh.scale.setScalar(1.3);
      mesh.position.y = 0.1;
      color = '#ffd23f';
    } else if (makeConsumableMesh(item.ctype)) {
      mesh = makeConsumableMesh(item.ctype);
      mesh.scale.multiplyScalar(1.25);
      mesh.position.y = 0.3;
      color = CONSUMABLES[item.ctype].color;
    } else {
      const geo = { bandage: this.itemGeo.bandage, medkit: this.itemGeo.med, smallshield: this.itemGeo.small, bigshield: this.itemGeo.shield, grenade: itemGeometry('grenade'), launchpad: itemGeometry('launchpad'), shockwave: itemGeometry('shockwave'), grappler: itemGeometry('grappler'), rift: itemGeometry('rift') }[item.ctype] || this.itemGeo[item.ctype] || this.itemGeo.small;
      mesh = new THREE.Mesh(geo, this.itemMat);
      mesh.position.y = 0.3;
      color = CONSUMABLES[item.ctype].color;
      if (item.ctype === 'launchpad') mesh.scale.setScalar(0.55);
    }
    mesh.castShadow = true;
    g.add(mesh);
    // rarity light beam + base ring
    // soft rarity light: thin and faint (it only has to catch your eye, not light up the area)
    // grey barely shows, gold stands out
    const rar = item.type === 'weapon' ? item.weapon.rarity : item.type === 'medallion' || item.type === 'crown' ? 5 : 1;
    const bh = 1.4 + rar * 0.35;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, bh, 10, 1, true), new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, opacity: 0.08 + rar * 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = bh / 2;
    g.add(beam);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.material.opacity = 0.3;
    ring.scale.set(1.4, 1.4, 1);
    ring.position.y = 0.35;
    g.add(ring);
    g.position.copy(p.pos);
    this.scene.add(g);
    p.group = g;
    p.mesh = mesh;
    p.beam = beam;
    this.pickups.push(p);
    return p;
  }

  _removePickup(p) {
    p.alive = false;
    this.scene.remove(p.group);
    p.beam.geometry.dispose();
    p.beam.material.dispose();
  }

  label(p) {
    if (p.type === 'weapon') return p.weapon.name;
    if (p.type === 'medallion') return MEDALLIONS[p.key].name;
    if (p.type === 'crown') return 'Victory Crown';
    if (p.type === 'gold') return `Gold x${p.amount}`;
    if (p.type === 'consumable') return `${CONSUMABLES[p.ctype].name} x${p.count}`;
    if (p.type === 'ammo') return `${AMMO[p.ammoType].name} x${p.amount}`;
    return `${MATS[p.matType].name} x${p.amount}`;
  }

  openChest(c, actor) {
    if (c.opened || this.game.warmup > 0) return;
    if (actor.isPlayer) this.game.meta?.track('chest');
    c.opened = true;
    c.glow.visible = false;
    this.game.sound.play('chest', actor.isPlayer ? null : _v.set(c.x, c.y, c.z));
    const out = [];
    // chests never give grey weapons
    const w = new Weapon(rollWeaponType(c.rare ? 'rare' : 'chest'), Math.max(1, rollRarity(Math.random, (c.rare ? 2.2 : 1) + (this.game.lootLuck || 0)))).withRandomMods();
    out.push({ type: 'weapon', weapon: w });
    out.push(Loot.ammoFor(w));
    // like Fortnite: a weapon + ammo + materials, and sometimes a heal / utility item
    if (c.rare || Math.random() < 0.6) out.push(Loot.randomConsumable());
    // Earth Sprite: sometimes an extra rare item
    if (actor.sprite?.bonusChest()) { const w3 = new Weapon(rollWeaponType('rare'), 3 + (Math.random() < 0.3 ? 1 : 0)).withRandomMods(); out.push({ type: 'weapon', weapon: w3 }, Loot.ammoFor(w3)); }
    if (actor.isPlayer) { this.game.addSpriteXp?.(5); actor.sidekick?.hop(1.4); }
    // Fortnite chests: 30 of each material
    for (const m of ['wood', 'stone', 'metal']) out.push({ type: 'mat', matType: m, amount: 30 });
    out.push({ type: 'gold', amount: c.rare ? 70 + Math.floor(Math.random() * 40) : 25 + Math.floor(Math.random() * 25) });
    const fwd = c.group.rotation.y;
    out.forEach((it, i) => {
      const a = fwd + (i - (out.length - 1) / 2) * 0.55;
      const vel = new THREE.Vector3(Math.sin(a) * 2.6, 5.5, Math.cos(a) * 2.6);
      this.spawnPickup(it, _v.set(c.x, c.y + 0.7, c.z), vel);
    });
    for (let i = 0; i < 24; i++) {
      this.game.effects.sparks.emit(c.x, c.y + 0.8, c.z, (Math.random() - 0.5) * 5, 2 + Math.random() * 5, (Math.random() - 0.5) * 5, new THREE.Color('#ffd76a'), 0.7, 0.14, 6);
    }
  }

  // Returns a message if the actor can't take it.
  collect(p, actor) {
    if (!p.alive || this.game.warmup > 0) return null;
    const g = this.game;
    if (p.type === 'weapon') {
      let free = actor.items.findIndex((it, i) => i > 0 && !it);
      // your preferred slot for this kind of gun, if it's empty
      const pref = actor.isPlayer ? g.meta?.profile?.d?.settings?.prefSlots?.[PREF_CLASS[p.weapon.type]] : 0;
      if (pref && !actor.items[pref]) free = pref;
      if (free > 0) actor.giveWeapon(p.weapon, free);
      else {
        let slot;
        if (actor.isPlayer) {
          // full: swap with whatever you're holding (the axe can't be swapped out)
          if (actor.slot <= 0) return 'Inventory full · select the slot to swap';
          slot = actor.slot;
        } else {
          // bots replace their weakest gun (smart bots: the weakest in the same role, else a doubled-up role)
          slot = 1;
          let worst = Infinity;
          const role = ROLE[p.weapon.type];
          const roles = {};
          actor.items.forEach((it) => { if (it?.isGun) roles[ROLE[it.type]] = (roles[ROLE[it.type]] || 0) + 1; });
          const cost = (it) => it.score * (!actor.smartLoot ? 1 : ROLE[it.type] === role ? 0.3 : roles[ROLE[it.type]] > 1 || ROLE[it.type] === 'side' ? 0.6 : 1.5);
          actor.items.forEach((it, i) => { if (i > 0 && it?.isGun && cost(it) < worst) { worst = cost(it); slot = i; } });
        }
        const old = actor.giveWeapon(p.weapon, slot);
        if (old) this.dropItem(old, actor);
      }
      if (actor.isPlayer) g.sound.play('pickup');
    } else if (p.type === 'consumable' && p.ctype === 'keycard') {
      // keycards live in their own slot beside the quick bar, not in the inventory
      if (actor.keycard) return 'You already have a keycard';
      actor.keycard = true;
      if (actor.isPlayer) { g.sound.play('supply'); g.hud?.toast?.(`Vault Keycard: open the vault at ${VAULT_TOWN}`); }
    } else if (p.type === 'consumable') {
      let left = actor.addConsumable(p.ctype, p.count);
      if (left === p.count && actor.isPlayer) {
        // no room: swap it with the held item, like a gun
        if (actor.slot <= 0) return 'Inventory full · select the slot to swap';
        const old = actor.items[actor.slot];
        if (old?.isGun || old?.isConsumable) this.dropItem(old, actor);
        const n = Math.min(p.count, CONSUMABLES[p.ctype].max);
        actor.items[actor.slot] = new Consumable(p.ctype, n);
        actor.useT = 0;
        actor._equip();
        left = p.count - n;
      } else if (left === p.count) return 'Inventory full';
      if (actor.isPlayer) g.sound.play('pickup');
      if (left > 0) { p.count = left; return null; }
    } else if (p.type === 'ammo') {
      actor.addAmmo(p.ammoType, p.amount);
      if (actor.isPlayer) g.sound.play('ammo');
    } else if (p.type === 'mat') {
      actor.addMat(p.matType, p.amount);
      if (actor.isPlayer) g.sound.play('pickup');
    } else if (p.type === 'gold') {
      actor.gold = Math.min(9999, actor.gold + p.amount);
      if (actor.isPlayer) g.sound.play('coin');
    } else if (p.type === 'crown') {
      actor.setCrown(true, actor.isPlayer ? Math.max(1, (g.meta?.profile?.d.stats.crownedWins || 0)) : p.count || 1);
      if (actor.isPlayer) { g.sound.play('supply'); g.hud?.banner('You picked up the Victory Crown! Win to keep it', 3); }
    } else if (p.type === 'medallion') {
      actor.medallions.add(p.key);
      const m = MEDALLIONS[p.key];
      if (actor.isPlayer) { g.sound.play('supply'); g.hud?.banner(`${m.name} · ${m.perk}`, 3); g.hud?.toast?.('Medallion carriers show up on everyone\'s map'); }
      else g.hud?.feedNote?.(`${actor.name} picked up ${m.name}`, m.color);
    }
    this._removePickup(p);
    return null;
  }

  // Throw an item (gun or consumable stack) out of an actor's inventory.
  dropItem(item, actor, count = item.count, forward = false) {
    const vel = forward
      ? new THREE.Vector3(Math.sin(actor.aimYaw) * 3.2, 3.2, Math.cos(actor.aimYaw) * 3.2)
      : new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    const pos = _v.copy(actor.pos).setY(actor.pos.y + 0.8);
    let p = null;
    if (item.isGun) p = this.spawnPickup({ type: 'weapon', weapon: item }, pos, vel);
    else if (item.isConsumable) p = this.spawnPickup({ type: 'consumable', ctype: item.type, count }, pos, vel);
    else if (item.type === 'mat' || item.type === 'ammo') p = this.spawnPickup(item, pos, vel);
    if (p) { p.droppedBy = actor; p.thrown = forward; } // don't walk straight back over it and re-collect
  }

  // Auto-pickup of ammo and materials when walking over them; for the player also weapons and
  // consumables that fit without swapping anything out (option in settings).
  autoPickup(actor) {
    if (!actor.alive || actor.state !== 'ground') return;
    const items = actor.isPlayer && this.game.meta?.profile?.d?.settings?.autoPickup !== false;
    for (const p of this.pickups) {
      if (!p.alive || !p.settled) continue;
      if (p.type !== 'ammo' && p.type !== 'mat' && p.type !== 'gold' && p.type !== 'medallion' && p.type !== 'crown' && !(items && this._fits(p, actor))) continue;
      if (p.type === 'crown' && actor.crowned) continue;
      if (!actor.isPlayer && p.type === 'ammo') continue;
      // your own drops: ammo/mats come back after a moment, items you threw away never auto-return
      if (p.droppedBy === actor && (p.thrown && p.age < 2.5 || p.type === 'weapon' || p.type === 'consumable')) continue;
      const dx = p.pos.x - actor.pos.x, dz = p.pos.z - actor.pos.z;
      if (dx * dx + dz * dz < 2.6 && Math.abs(p.pos.y - actor.pos.y) < 2) {
        const before = p.count;
        if (this.collect(p, actor)) continue;
        if (actor.isPlayer) g_toastPickup(this.game, p, before);
      }
    }
  }

  // Would this pickup go into the inventory without replacing anything?
  _fits(p, actor) {
    if (p.type === 'weapon') return actor.items.some((it, i) => i > 0 && !it);
    if (p.type !== 'consumable') return false;
    const max = CONSUMABLES[p.ctype].max;
    return actor.items.some((it, i) => i > 0 && (!it || (it.isConsumable && it.type === p.ctype && it.count < max)));
  }

  dropInventory(actor) {
    const items = [];
    actor.items.forEach((it, i) => {
      if (i === 0 || !it) return;
      if (it.isGun) { it.ammo = Math.max(it.ammo, Math.ceil(it.mag / 2)); items.push({ type: 'weapon', weapon: it }); if (actor.infiniteAmmo) items.push(Loot.ammoFor(it)); }
      else if (it.isConsumable) items.push({ type: 'consumable', ctype: it.type, count: it.count });
    });
    if (!actor.infiniteAmmo) for (const [t, n] of Object.entries(actor.ammo)) if (n > 0) items.push({ type: 'ammo', ammoType: t, amount: n });
    // eliminated players always drop at least 50 of each material (Fortnite)
    for (const [t, n] of Object.entries(actor.mats)) if (n > 0 || !actor.npc) items.push({ type: 'mat', matType: t, amount: actor.npc ? n : Math.max(50, n) });
    if (actor.gold > 0) items.push({ type: 'gold', amount: actor.gold });
    if (actor.keycard) { items.push({ type: 'consumable', ctype: 'keycard', count: 1 }); actor.keycard = false; }
    for (const k of actor.medallions || []) items.push({ type: 'medallion', key: k });
    if (actor.crowned) { items.push({ type: 'crown', count: actor.crownCount || 1 }); actor.setCrown(false); }
    actor.gold = 0; actor.medallions?.clear();
    if (!actor.isPlayer && Math.random() < 0.5) items.push(Loot.randomConsumable());
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2;
      this.spawnPickup(it, _v.copy(actor.pos).setY(actor.pos.y + 1), new THREE.Vector3(Math.cos(a) * 2.4, 4.5, Math.sin(a) * 2.4));
    });
    actor.items = [actor.items[0], null, null, null, null, null];
    actor.slot = 0;
    for (const t of Object.keys(actor.ammo)) actor.ammo[t] = 0;
    for (const t of Object.keys(actor.mats)) actor.mats[t] = 0;
    actor.character.setWeapon(null);
  }

  nearestChest(pos, maxD, storm, who = null) {
    let best = null, bd = maxD;
    const now = this.game.time;
    for (const c of this.chests) {
      if (c.opened) continue;
      // someone else already heading for it (and still alive): leave it to them
      if (who && c.claim && c.claim !== who && c.claim.alive && now < c.claimUntil) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd && (!storm || storm.isSafe(c.x, c.z))) { bd = d; best = c; }
    }
    return best;
  }

  bestPickupFor(actor, maxD) {
    let best = null, bestScore = 0;
    const guns = actor.weapons;
    const hasFree = actor.items.some((it, i) => i > 0 && !it);
    const worst = hasFree ? 0 : Math.min(...guns.map((w) => w.score));
    for (const p of this.pickups) {
      if (!p.alive || !p.settled) continue;
      if (p.claim && p.claim !== actor && p.claim.alive && this.game.time < p.claimUntil && p.type === 'weapon') continue;
      const d = p.pos.distanceTo(actor.pos);
      if (d > maxD) continue;
      let s = 0;
      if (p.type === 'weapon') {
        if (guns.some((w) => w.type === p.weapon.type && w.rarity >= p.weapon.rarity)) s = 0;
        else if (actor.smartLoot && guns.length) {
          // fill a missing role, or upgrade the gun in the same role
          const role = ROLE[p.weapon.type];
          const same = guns.filter((w) => ROLE[w.type] === role);
          if (!same.length) s = role === 'side' ? (hasFree ? 1 : 0) : 2.5;
          else s = p.weapon.score > Math.min(...same.map((w) => w.score)) * 1.1 ? 2 : 0;
        } else s = p.weapon.score > worst * 1.1 ? 2 : 0;
      } else if (p.type === 'consumable') {
        // carry heals for later if there's room (stack or free slot)
        const d2 = CONSUMABLES[p.ctype];
        const room = hasFree || actor.items.some((it) => it?.isConsumable && it.type === p.ctype && it.count < d2.max);
        const carried = actor.items.reduce((n, it) => n + (it?.isConsumable ? 1 : 0), 0);
        s = !room ? 0 : (d2.heal ? (actor.health < 70 ? 1.8 : 0.9) : d2.shield ? 1.2 : d2.throw || d2.rift ? 0.8 : 0) - carried * 0.25;
        if (guns.length === 0) s *= 0.5; // a gun first
      } else if (p.type === 'mat') s = actor.wood < 60 && p.matType === 'wood' ? 0.6 : 0;
      if (p.type === 'weapon' && guns.length === 0) s = 3;
      s -= d / 40;
      if (s > bestScore) { bestScore = s; best = p; }
    }
    return best;
  }

  // Nearest interactable within reach for the player prompt.
  nearestInteractable(pos, reach = 2.6) {
    let best = null, bd = reach;
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd && Math.abs(c.y - pos.y) < 2.5) { bd = d; best = { kind: 'chest', chest: c }; }
    }
    for (const b of this.ammoBoxes) {
      if (b.opened) continue;
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d < bd && Math.abs(b.y - pos.y) < 2.5) { bd = d; best = { kind: 'ammobox', box: b }; }
    }
    for (const p of this.pickups) {
      if (!p.alive || p.type === 'ammo' || p.type === 'mat' || p.type === 'gold' || p.type === 'crown' || p.type === 'medallion') continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd && Math.abs(p.pos.y - pos.y) < 2.5) { bd = d; best = { kind: 'pickup', pickup: p }; }
    }
    return best;
  }

  update(dt, t) {
    const cam = this.game.camera.position;
    for (const b of this.ammoBoxes) if (!b.opened) b.group.visible = (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 < 120 * 120;
    for (const c of this.chests) {
      const d2 = (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2;
      c.group.visible = d2 < 150 * 150;
      if (!c.group.visible && !(c.opened && c.openT < 1)) continue;
      if (c.opened && c.openT < 1) {
        c.openT = Math.min(1, c.openT + dt * 3);
        const k = 1 - Math.pow(1 - c.openT, 3);
        c.lidPivot.rotation.x = (c.lidPivot.userData.baseRot || 0) - 1.9 * k;
      } else if (!c.opened) {
        c.glow.material.opacity = 0.5 + Math.sin(t * 3 + c.x) * 0.2;
        c.lidPivot.rotation.x = (c.lidPivot.userData.baseRot || 0) + Math.min(0, -Math.abs(Math.sin(t * 5 + c.z)) * 0.08) * (Math.sin(t * 1.3 + c.x) > 0.7 ? 1 : 0);
      }
    }
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.age += dt;
      const far = (p.pos.x - cam.x) ** 2 + (p.pos.z - cam.z) ** 2 > 85 * 85;
      p.group.visible = !far;
      if (far && p.settled) continue;
      if (!p.settled) {
        p.vel.y -= 18 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const gy = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.5, 0.2);
        if (p.pos.y <= gy) {
          p.pos.y = gy;
          if (Math.abs(p.vel.y) > 2.5) { p.vel.y *= -0.35; p.vel.x *= 0.5; p.vel.z *= 0.5; }
          else { p.settled = true; p.vel.set(0, 0, 0); }
        }
      }
      p.group.position.copy(p.pos);
      p.mesh.rotation.y = p.spin + t * 1.2;
      p.mesh.position.y = (p.type === 'weapon' ? 0.55 : 0.3) + Math.sin(t * 2 + p.spin) * 0.08;
    }
    if (this.pickups.length > 60) this.pickups = this.pickups.filter((p) => p.alive);
  }
}
