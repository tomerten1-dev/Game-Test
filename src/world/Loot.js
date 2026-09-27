import * as THREE from 'three';
import { part, merge, mat } from './geomUtils.js';
import { TOWNS } from './Terrain.js';
import { Weapon } from '../weapons/Weapon.js';
import { LOOT_WEAPONS, RARITIES, rollRarity } from '../weapons/WeaponDefs.js';
import { makeWeaponMesh } from '../weapons/WeaponModels.js';
import { mulberry32 } from '../core/noise.js';

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
  return { shield, med, wood };
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

export class Loot {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.chests = [];
    this.pickups = [];
    const cg = chestGeometries();
    this.chestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55, emissive: '#6b4200', emissiveIntensity: 0.35 });
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
      const base = new THREE.Mesh(cg.base, this.chestMat);
      const lidPivot = new THREE.Object3D();
      lidPivot.position.set(0, 0.55, -0.35);
      const lid = new THREE.Mesh(cg.lid, this.chestMat);
      lid.position.set(0, 0, 0);
      lidPivot.add(lid);
      base.castShadow = lid.castShadow = true;
      group.add(base, lidPivot);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ffd76a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
      glow.scale.set(2.6, 2.6, 1);
      glow.position.y = 0.5;
      group.add(glow);
      group.position.set(s.x, y, s.z);
      group.rotation.y = s.rot;
      this.scene.add(group);
      this.chests.push({ x: s.x, z: s.z, y, group, lidPivot, glow, opened: false, openT: 0 });
    }
    this.spawnFloorLoot();
  }

  reset() {
    for (const p of this.pickups) this._removePickup(p);
    this.pickups = [];
    for (const c of this.chests) {
      c.opened = false;
      c.openT = 0;
      c.lidPivot.rotation.x = 0;
      c.glow.visible = true;
    }
    this.spawnFloorLoot();
  }

  spawnFloorLoot() {
    // weapons & wood lying around town plazas
    for (const t of TOWNS) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * t.r * 0.35;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        const type = Math.random() < 0.75 ? 'weapon' : 'wood';
        const item = type === 'weapon'
          ? { type, weapon: new Weapon(LOOT_WEAPONS[Math.floor(Math.random() * LOOT_WEAPONS.length)], rollRarity(Math.random, 0)) }
          : { type, amount: 30 };
        this.spawnPickup(item, _v.set(x, this.world.groundAt(x, z, 200) + 0.2, z));
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
    } else {
      mesh = new THREE.Mesh(item.type === 'shield' ? this.itemGeo.shield : item.type === 'medkit' ? this.itemGeo.med : this.itemGeo.wood, this.itemMat);
      mesh.position.y = 0.3;
      color = item.type === 'shield' ? '#4fb8ff' : item.type === 'medkit' ? '#ffffff' : '#c68b52';
    }
    mesh.castShadow = true;
    g.add(mesh);
    // rarity light beam + base ring
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, 3.2, 10, 1, true), new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.6;
    g.add(beam);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
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
    if (p.type === 'shield') return 'Shield Potion';
    if (p.type === 'medkit') return 'Medkit';
    return `Wood x${p.amount}`;
  }

  openChest(c, actor) {
    if (c.opened) return;
    c.opened = true;
    c.glow.visible = false;
    this.game.sound.play('chest', actor.isPlayer ? null : _v.set(c.x, c.y, c.z));
    const out = [];
    out.push({ type: 'weapon', weapon: new Weapon(LOOT_WEAPONS[Math.floor(Math.random() * 3)], rollRarity(Math.random, 1)) });
    out.push(Math.random() < 0.55 ? { type: 'shield' } : { type: 'medkit' });
    out.push({ type: 'wood', amount: 30 });
    if (Math.random() < 0.25) out.push({ type: 'shield' });
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
      const free = actor.weapons.findIndex((w) => !w);
      if (free >= 0) actor.giveWeapon(p.weapon, free);
      else {
        const slot = actor.isPlayer ? actor.slot : actor.weapons.reduce((m, w, i) => (w.score < actor.weapons[m].score ? i : m), 0);
        const old = actor.giveWeapon(p.weapon, slot);
        if (old) this.spawnPickup({ type: 'weapon', weapon: old }, _v.copy(actor.pos).setY(actor.pos.y + 0.8), new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2));
      }
      if (actor.isPlayer) g.sound.play('pickup');
    } else if (p.type === 'shield') {
      if (actor.shield >= 100) return 'Shield is full';
      actor.shield = Math.min(100, actor.shield + 50);
      if (actor.isPlayer) g.sound.play('shield');
    } else if (p.type === 'medkit') {
      if (actor.health >= 100) return 'Health is full';
      actor.health = 100;
      if (actor.isPlayer) g.sound.play('heal');
    } else if (p.type === 'wood') {
      actor.wood = Math.min(500, actor.wood + p.amount);
      if (actor.isPlayer) g.sound.play('pickup');
    }
    this._removePickup(p);
    return null;
  }

  dropInventory(actor) {
    const items = [];
    for (const w of actor.weapons) if (w) items.push({ type: 'weapon', weapon: w });
    if (actor.wood > 0) items.push({ type: 'wood', amount: actor.wood });
    if (Math.random() < 0.5) items.push({ type: 'shield' });
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2;
      if (it.weapon) it.weapon.ammo = it.weapon.def.mag;
      this.spawnPickup(it, _v.copy(actor.pos).setY(actor.pos.y + 1), new THREE.Vector3(Math.cos(a) * 2.2, 4.5, Math.sin(a) * 2.2));
    });
    actor.weapons = [null, null, null];
    actor.wood = 0;
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
    const worst = actor.weapons.some((w) => !w) ? 0 : Math.min(...actor.weapons.map((w) => w.score));
    for (const p of this.pickups) {
      if (!p.alive || !p.settled) continue;
      const d = p.pos.distanceTo(actor.pos);
      if (d > maxD) continue;
      let s = 0;
      if (p.type === 'weapon') {
        if (actor.weapons.some((w) => w && w.type === p.weapon.type && w.rarity >= p.weapon.rarity)) s = 0;
        else s = p.weapon.score > worst * 1.1 ? 2 : 0;
      } else if (p.type === 'shield') s = actor.shield <= 50 ? 1.5 : 0;
      else if (p.type === 'medkit') s = actor.health < 70 ? 1.8 : 0;
      else if (p.type === 'wood') s = actor.wood < 60 ? 0.6 : 0;
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
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd && Math.abs(p.pos.y - pos.y) < 2.5) { bd = d; best = { kind: 'pickup', pickup: p }; }
    }
    return best;
  }

  update(dt, t) {
    for (const c of this.chests) {
      if (c.opened && c.openT < 1) {
        c.openT = Math.min(1, c.openT + dt * 3);
        const k = 1 - Math.pow(1 - c.openT, 3);
        c.lidPivot.rotation.x = -1.9 * k;
      } else if (!c.opened) {
        c.glow.material.opacity = 0.5 + Math.sin(t * 3 + c.x) * 0.2;
        c.lidPivot.rotation.x = Math.max(-0.08, Math.sin(t * 5 + c.z) * 0.05) * (Math.sin(t * 1.3 + c.x) > 0.7 ? 1 : 0);
      }
    }
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.age += dt;
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
