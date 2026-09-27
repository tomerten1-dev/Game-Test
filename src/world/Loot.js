import * as THREE from 'three';
import { part, merge, mat } from './geomUtils.js';
import { TOWNS } from './Terrain.js';
import { Weapon } from '../weapons/Weapon.js';
import { RARITIES, rollRarity, rollWeaponType } from '../weapons/WeaponDefs.js';
import { itemGeometry } from '../weapons/WeaponModels.js';
import { makeWeaponMesh } from '../weapons/WeaponModels.js';
import { mulberry32 } from '../core/noise.js';
import { AMMO, MATS, CONSUMABLES } from '../weapons/Items.js';

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
  return { shield, med, wood, small, bandage, ammo, stone, metal };
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
function g_toastPickup(game, p) {
  game.hud?.pickupNote?.(`+${p.amount} ${p.type === 'ammo' ? AMMO[p.ammoType].name : MATS[p.matType].name}`, p.type === 'ammo' ? AMMO[p.ammoType].color : MATS[p.matType].color);
}

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
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 25 + r() * 130;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.world.heightAt(x, z) > 2.5 && this.world.terrain.normalAt(x, z).y > 0.85) spots.push({ x, z, rot: r() * 6 });
    }
    for (const s of spots) {
      const y = this.world.groundAt(s.x, s.z, 200, 0.6);
      if (y < 1) continue;
      const group = new THREE.Group();
      const rare = r() < 0.12; // rare chests: purple, better loot
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
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: rare ? '#c77dff' : '#ffd76a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
      glow.material.color.multiplyScalar(1.6);
      glow.scale.set(2.6, 2.6, 1);
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
    const info = this.game.models?.get('kk/crate_A_big');
    const mat = new THREE.MeshStandardMaterial({ color: '#5f7d43', roughness: 0.7 });
    const trim = new THREE.MeshStandardMaterial({ color: '#e9e2c8', roughness: 0.6 });
    const spots = [];
    for (const h of this.world.towns.houses) spots.push({ x: h.x + (r() < 0.5 ? -1 : 1) * ((h.maxX - h.minX) / 2 + 1.6), z: h.z + (r() - 0.5) * 3 });
    for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 20 + r() * 140; spots.push({ x: Math.cos(a) * d, z: Math.sin(a) * d }); }
    for (const sp of spots) {
      const y = this.world.groundAt(sp.x, sp.z, 200, 0.5);
      if (y < 1.5) continue;
      if (chestSpots.some((c) => Math.hypot(c.x - sp.x, c.z - sp.z) < 3)) continue;
      const g = new THREE.Group();
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
    if (b.opened) return;
    b.opened = true;
    b.group.visible = false;
    this.game.sound.play('ammo', actor.isPlayer ? null : _v.set(b.x, b.y, b.z));
    const types = new Set();
    const w = actor.weapon;
    if (w) types.add(w.def.ammoType);
    const all = Object.keys(AMMO).filter((t) => t !== 'heavy');
    while (types.size < 2) types.add(all[Math.floor(Math.random() * all.length)]);
    [...types].forEach((t, i) => {
      const a = b.group.rotation.y + (i - 0.5) * 0.9;
      this.spawnPickup({ type: 'ammo', ammoType: t, amount: AMMO[t].box }, _v.set(b.x, b.y + 0.6, b.z), new THREE.Vector3(Math.sin(a) * 2, 4.5, Math.cos(a) * 2));
    });
  }

  kkRareMat(src) {
    if (!this._kkRare) {
      const m = src.clone();
      m.color.set('#b784ff');
      m.emissive = new THREE.Color('#5a1fa8');
      m.emissiveIntensity = 0.55;
      m.roughness = 0.3;
      m.metalness = 0.4;
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
    const type = r < 0.3 ? 'bandage' : r < 0.48 ? 'smallshield' : r < 0.68 ? 'bigshield' : r < 0.82 ? 'medkit' : r < 0.96 ? 'grenade' : 'launchpad';
    return { type: 'consumable', ctype: type, count: CONSUMABLES[type].stack };
  }

  static ammoFor(weapon) {
    const t = weapon.def.ammoType;
    return { type: 'ammo', ammoType: t, amount: AMMO[t].box };
  }

  spawnFloorLoot() {
    // weapons (with ammo), heals and ammo lying around town plazas
    for (const t of TOWNS) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * t.r * 0.35;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        const y = this.world.groundAt(x, z, 200) + 0.2;
        const roll = Math.random();
        if (roll < 0.55) {
          const w = new Weapon(rollWeaponType('floor'), rollRarity(Math.random, 0));
          this.spawnPickup({ type: 'weapon', weapon: w }, _v.set(x, y, z));
          this.spawnPickup(Loot.ammoFor(w), _v.set(x + 0.9, y, z + 0.4));
        } else if (roll < 0.8) this.spawnPickup(Loot.randomConsumable(), _v.set(x, y, z));
        else this.spawnPickup({ type: 'mat', matType: ['wood', 'stone', 'metal'][Math.floor(Math.random() * 3)], amount: 30 }, _v.set(x, y, z));
      }
    }
  }

  spawnPickup(item, pos, vel = null) {
    const p = { ...item, pos: pos.clone(), vel: vel ? vel.clone() : new THREE.Vector3(), alive: true, age: 0, settled: !vel, spin: Math.random() * 6 };
    const g = new THREE.Group();
    let mesh, color;
    if (item.type === 'weapon') {
      mesh = makeWeaponMesh(item.weapon.type, item.weapon.rarity);
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
      mesh = new THREE.Mesh(this.itemGeo.ammo, this.itemMat);
      mesh.position.y = 0.3;
      color = AMMO[item.ammoType].color;
    } else {
      const geo = { bandage: this.itemGeo.bandage, medkit: this.itemGeo.med, smallshield: this.itemGeo.small, bigshield: this.itemGeo.shield, grenade: itemGeometry('grenade'), launchpad: itemGeometry('launchpad') }[item.ctype];
      mesh = new THREE.Mesh(geo, this.itemMat);
      mesh.position.y = 0.3;
      color = CONSUMABLES[item.ctype].color;
      if (item.ctype === 'launchpad') mesh.scale.setScalar(0.55);
    }
    mesh.castShadow = true;
    g.add(mesh);
    // rarity light beam + base ring
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, 3.2, 10, 1, true), new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.material.color.multiplyScalar(1.6);
    beam.position.y = 1.6;
    g.add(beam);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.material.color.multiplyScalar(1.8);
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
    if (p.type === 'consumable') return `${CONSUMABLES[p.ctype].name} x${p.count}`;
    if (p.type === 'ammo') return `${AMMO[p.ammoType].name} x${p.amount}`;
    return `${MATS[p.matType].name} x${p.amount}`;
  }

  openChest(c, actor) {
    if (c.opened) return;
    c.opened = true;
    c.glow.visible = false;
    this.game.sound.play('chest', actor.isPlayer ? null : _v.set(c.x, c.y, c.z));
    const out = [];
    const w = new Weapon(rollWeaponType(c.rare ? 'rare' : 'chest'), rollRarity(Math.random, c.rare ? 2.2 : 1));
    out.push({ type: 'weapon', weapon: w });
    out.push(Loot.ammoFor(w));
    if (c.rare) {
      const w2 = new Weapon(rollWeaponType('chest'), rollRarity(Math.random, 1.5));
      out.push({ type: 'weapon', weapon: w2 }, Loot.ammoFor(w2));
      out.push({ type: 'consumable', ctype: 'grenade', count: 3 });
    }
    out.push(Loot.randomConsumable());
    out.push({ type: 'mat', matType: ['wood', 'wood', 'stone', 'metal'][Math.floor(Math.random() * 4)], amount: 30 });
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
    if (!p.alive) return null;
    const g = this.game;
    if (p.type === 'weapon') {
      const free = actor.items.findIndex((it, i) => i > 0 && !it);
      if (free > 0) actor.giveWeapon(p.weapon, free);
      else {
        let slot;
        if (actor.isPlayer) slot = actor.slot > 0 ? actor.slot : 1;
        else {
          // bots replace their weakest gun
          slot = 1;
          let worst = Infinity;
          actor.items.forEach((it, i) => { if (i > 0 && it?.isGun && it.score < worst) { worst = it.score; slot = i; } });
        }
        const old = actor.giveWeapon(p.weapon, slot);
        if (old) this.dropItem(old, actor);
      }
      if (actor.isPlayer) g.sound.play('pickup');
    } else if (p.type === 'consumable') {
      const left = actor.addConsumable(p.ctype, p.count);
      if (left === p.count) return 'Inventory full';
      if (actor.isPlayer) g.sound.play('pickup');
      if (left > 0) { p.count = left; return null; }
    } else if (p.type === 'ammo') {
      actor.addAmmo(p.ammoType, p.amount);
      if (actor.isPlayer) g.sound.play('ammo');
    } else if (p.type === 'mat') {
      actor.addMat(p.matType, p.amount);
      if (actor.isPlayer) g.sound.play('pickup');
    }
    this._removePickup(p);
    return null;
  }

  // Throw an item (gun or consumable stack) out of an actor's inventory.
  dropItem(item, actor) {
    const vel = new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    const pos = _v.copy(actor.pos).setY(actor.pos.y + 0.8);
    if (item.isGun) this.spawnPickup({ type: 'weapon', weapon: item }, pos, vel);
    else if (item.isConsumable) this.spawnPickup({ type: 'consumable', ctype: item.type, count: item.count }, pos, vel);
  }

  // Auto-pickup of ammo and materials when walking over them.
  autoPickup(actor) {
    if (!actor.alive || actor.state !== 'ground') return;
    for (const p of this.pickups) {
      if (!p.alive || !p.settled || (p.type !== 'ammo' && p.type !== 'mat')) continue;
      if (!actor.isPlayer && p.type === 'ammo') continue;
      const dx = p.pos.x - actor.pos.x, dz = p.pos.z - actor.pos.z;
      if (dx * dx + dz * dz < 2.6 && Math.abs(p.pos.y - actor.pos.y) < 2) {
        this.collect(p, actor);
        if (actor.isPlayer) g_toastPickup(this.game, p);
      }
    }
  }

  dropInventory(actor) {
    const items = [];
    actor.items.forEach((it, i) => {
      if (i === 0 || !it) return;
      if (it.isGun) { it.ammo = Math.max(it.ammo, Math.ceil(it.def.mag / 2)); items.push({ type: 'weapon', weapon: it }); if (actor.infiniteAmmo) items.push(Loot.ammoFor(it)); }
      else if (it.isConsumable) items.push({ type: 'consumable', ctype: it.type, count: it.count });
    });
    if (!actor.infiniteAmmo) for (const [t, n] of Object.entries(actor.ammo)) if (n > 0) items.push({ type: 'ammo', ammoType: t, amount: n });
    for (const [t, n] of Object.entries(actor.mats)) if (n > 0) items.push({ type: 'mat', matType: t, amount: n });
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

  nearestChest(pos, maxD, storm) {
    let best = null, bd = maxD;
    for (const c of this.chests) {
      if (c.opened) continue;
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
      const d = p.pos.distanceTo(actor.pos);
      if (d > maxD) continue;
      let s = 0;
      if (p.type === 'weapon') {
        if (guns.some((w) => w.type === p.weapon.type && w.rarity >= p.weapon.rarity)) s = 0;
        else s = p.weapon.score > worst * 1.1 ? 2 : 0;
      } else if (p.type === 'consumable') {
        // carry heals for later if there's room (stack or free slot)
        const d2 = CONSUMABLES[p.ctype];
        const room = hasFree || actor.items.some((it) => it?.isConsumable && it.type === p.ctype && it.count < d2.max);
        const carried = actor.items.reduce((n, it) => n + (it?.isConsumable ? 1 : 0), 0);
        s = !room ? 0 : (d2.heal ? (actor.health < 70 ? 1.8 : 0.9) : d2.shield ? 1.2 : d2.throw ? 0.8 : 0) - carried * 0.25;
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
      if (!p.alive || p.type === 'ammo' || p.type === 'mat') continue;
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
