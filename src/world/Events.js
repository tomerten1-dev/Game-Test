import * as THREE from 'three';
import { TOWNS, WORLD_HALF } from './Terrain.js';
import { Weapon } from '../weapons/Weapon.js';
import { RARITIES, WEAPONS, rollWeaponType, EXOTIC, EXOTICS, MOD_COST } from '../weapons/WeaponDefs.js';
import { Character } from '../player/Character.js';
import { makeWeaponMesh, itemGeometry } from '../weapons/WeaponModels.js';
import { mulberry32 } from '../core/noise.js';
import { Loot } from './Loot.js';
import { CONSUMABLES } from '../weapons/Items.js';

const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _fc = new THREE.Color();
const DROP_TIMES = [90, 220, 350, 460]; // seconds after the bus leaves
const FALL_SPEED = 5.5;
const VEND_PRICES = [0, 0, 150, 300, 500]; // gold, by rarity (rare+)
// upgrade bench: cost to go from rarity i to i + 1
const UPGRADE_COST = { 0: ['gold', 100], 1: ['gold', 200], 2: ['gold', 300], 3: ['gold', 400] }; // gold bars per step
const VEND_MATS = ['wood', 'stone', 'metal'];
// foraged food (Fortnite): what eating each one does
const FORAGE = {
  apple: { health: 5, text: 'Eat Apple · +5 health', note: '+5 Health', color: '#5dff8a' },
  mushroom: { shield: 5, text: 'Eat Mushroom · +5 shield', note: '+5 Shield', color: '#58c8ff' },
  banana: { health: 5, text: 'Eat Banana · +5 health', note: '+5 Health', color: '#ffd84a' },
  pepper: { health: 10, speed: 10, text: 'Eat Pepper · +10 health, speed boost', note: '+10 Health · Speed', color: '#ff5a3d' },
  slapberry: { health: 5, slap: 12, text: 'Eat Slap Berry · endless sprint for 12 s', note: 'Slap! Endless sprint', color: '#8f7bff' },
};

function labelTexture(lines, colors) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(10,18,40,0.82)';
  ctx.beginPath(); ctx.roundRect(4, 4, 248, 88, 14); ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = '800 30px "Barlow Condensed", sans-serif';
  ctx.fillStyle = colors[0];
  ctx.fillText(lines[0], 128, 42, 236); // squeeze long names to fit
  ctx.font = '700 26px "Barlow Condensed", sans-serif';
  ctx.fillStyle = colors[1];
  ctx.fillText(lines[1], 128, 78, 236);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Supply drops, jump pads, placeable launch pads and vending machines.
export class Events {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.supplies = [];
    this.pads = [];      // jump pads (world) + launch pads (placed)
    this.zones = [];     // placed shield kegs / campfires
    this.vending = [];
    this.benches = [];   // upgrade benches (materials -> weapon rarity)
    this.hides = [];     // haystacks / dumpsters you can hide in
    this.dropIdx = 0;
    this.padMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5 });
    this._createJumpPads();
    this._createVending();
    this._createBenches();
    this.modBenches = [];
    this._createModBenches();
    this.dealers = [];
    this._createDealers();
    this._createHides();
    this._createForage();
    this.llamas = [];
    this._placeLlamas();
  }

  // ---------- helpers ----------
  _clearSpot(x, z, r, minNy = 0.9) {
    const w = this.world;
    if (w.heightAt(x, z) < 2 || w.terrain.normalAt(x, z).y < minNy) return false;
    const list = w.colliders.query(x - r, x + r, z - r, z + r, []);
    return list.length === 0;
  }

  // ---------- jump pads ----------
  _createJumpPads() {
    const r = mulberry32(4242);
    const topMat = new THREE.MeshStandardMaterial({ color: '#39e0ff', emissive: '#19b8ff', emissiveIntensity: 0.9, roughness: 0.3 });
    const baseMat = new THREE.MeshStandardMaterial({ color: '#2c3140', roughness: 0.6, metalness: 0.3 });
    const baseGeo = new THREE.CylinderGeometry(1.15, 1.3, 0.3, 20);
    const topGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 20);
    const arrowGeo = new THREE.ConeGeometry(0.35, 0.5, 3);
    let n = 0;
    for (let i = 0; i < 600 && n < 24; i++) {
      const a = r() * Math.PI * 2, d = 30 + r() * 250;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!this._clearSpot(x, z, 3) || this.pads.some((p) => Math.hypot(p.x - x, p.z - z) < 40)) continue;
      const y = this.world.heightAt(x, z);
      const g = new THREE.Group();
      const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = 0.12; base.castShadow = base.receiveShadow = true;
      const top = new THREE.Mesh(topGeo, topMat); top.position.y = 0.3;
      const arrow = new THREE.Mesh(arrowGeo, topMat); arrow.position.y = 1.2;
      g.add(base, top, arrow);
      g.position.set(x, y, z);
      this.scene.add(g);
      this.pads.push({ kind: 'jump', x, z, y, group: g, arrow, cd: 0 });
      n++;
    }
  }

  placeLaunchPad(actor) {
    const f = [Math.sin(actor.aimYaw), Math.cos(actor.aimYaw)];
    const x = actor.pos.x + f[0] * 2.4, z = actor.pos.z + f[1] * 2.4;
    const y = this.world.groundAt(x, z, actor.pos.y + 1, 0.6);
    if (Math.abs(y - actor.pos.y) > 1.5) return false;
    const m = new THREE.Mesh(itemGeometry('launchpad'), this.padMat);
    m.scale.setScalar(2.2);
    m.castShadow = true;
    m.position.set(x, y, z);
    this.scene.add(m);
    this.pads.push({ kind: 'launch', x, z, y, group: m, cd: 0.25, owner: actor });
    this.game.sound.play('build', actor.isPlayer ? null : actor.pos);
    return true;
  }

  // Placeable items: launch pad, shield keg, campfire.
  // Bouncer (placed) and Crash Pad (thrown) pads: bounce whoever lands on them, no fall damage.
  addBouncePad(x, y, z, kind, owner = null) {
    const g = new THREE.Group();
    if (kind === 'tire') {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.3, 10, 22), new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.9 }));
      tire.rotation.x = Math.PI / 2; tire.position.y = 0.3; g.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#9aa7b8', roughness: 0.4, metalness: 0.6 }));
      hub.position.y = 0.3; g.add(hub);
    } else if (kind === 'crash') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.32, 8, 20), new THREE.MeshStandardMaterial({ color: '#ff7ab8', roughness: 0.5 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 20), new THREE.MeshStandardMaterial({ color: '#ffd1e6', roughness: 0.6 }));
      top.position.y = 0.35; g.add(top);
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.25, 18), new THREE.MeshStandardMaterial({ color: '#2b3a55', roughness: 0.5, metalness: 0.4 }));
      base.position.y = 0.12; g.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 18), new THREE.MeshStandardMaterial({ color: '#5fe4ff', emissive: '#2fa8ff', emissiveIntensity: 0.6, roughness: 0.3 }));
      top.position.y = 0.3; g.add(top);
    }
    g.traverse((o) => { o.castShadow = true; });
    g.position.set(x, y, z);
    this.scene.add(g);
    this.pads.push({ kind: kind === 'crash' ? 'crash' : 'bounce', high: kind === 'tire', x, z, y, group: g, cd: 0.2, owner, life: kind === 'crash' ? 20 : Infinity });
  }

  // Landing here doesn't hurt (bouncers, crash pads).
  softLanding(pos) {
    return this.pads.some((p) => (p.kind === 'bounce' || p.kind === 'crash') && Math.hypot(pos.x - p.x, pos.z - p.z) < 1.4 && Math.abs(pos.y - p.y) < 1.2);
  }

  placeItem(actor, kind) {
    if (kind === 'launchpad') return this.placeLaunchPad(actor);
    if (kind === 'bouncer') {
      const f = [Math.sin(actor.aimYaw), Math.cos(actor.aimYaw)];
      const x = actor.pos.x + f[0] * 2.2, z = actor.pos.z + f[1] * 2.2;
      const y = this.world.groundAt(x, z, actor.pos.y + 1, 0.6);
      if (Math.abs(y - actor.pos.y) > 1.5) return false;
      this.addBouncePad(x, y, z, 'bounce', actor);
      this.game.sound.play('build', actor.isPlayer ? null : actor.pos);
      return true;
    }
    const f = [Math.sin(actor.aimYaw), Math.cos(actor.aimYaw)];
    const x = actor.pos.x + f[0] * 1.8, z = actor.pos.z + f[1] * 1.8;
    const y = this.world.groundAt(x, z, actor.pos.y + 1, 0.4);
    if (Math.abs(y - actor.pos.y) > 1.5) return false;
    const group = new THREE.Group();
    const M = (geo, color, extra = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra })); m.castShadow = true; group.add(m); return m; };
    if (kind === 'keg') {
      M(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 16), '#2f6fd6', { metalness: 0.4 }).position.y = 0.45;
      for (const h of [0.15, 0.75]) M(new THREE.TorusGeometry(0.43, 0.04, 6, 20), '#c9d6e8', { metalness: 0.6 }).position.y = h;
      group.children.at(-1).rotation.x = group.children.at(-2).rotation.x = Math.PI / 2;
      M(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12), '#6fd0ff', { emissive: '#3d8dff', emissiveIntensity: 1.5 }).position.y = 0.96;
    } else {
      for (let i = 0; i < 4; i++) {
        const log = M(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 7), '#6b4226');
        log.rotation.set(Math.PI / 2 - 0.35, (i * Math.PI) / 2, 0, 'YXZ');
        log.position.set(Math.sin((i * Math.PI) / 2) * 0.18, 0.2, Math.cos((i * Math.PI) / 2) * 0.18);
      }
      M(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 14), '#7d7d7d').position.y = 0.04;
    }
    group.position.set(x, y, z);
    this.scene.add(group);
    const def = kind === 'keg' ? { t: 20, r: 5.5, rate: 6, stat: 'shield' } : { t: 25, r: 5, rate: 2, stat: 'health' };
    this.zones.push({ kind, x, y, z, group, owner: actor, ...def, acc: 0 });
    this.game.sound.play('build', actor.isPlayer ? null : actor.pos);
    return true;
  }

  // Keg / campfire: top up everyone standing close, then fade away.
  _updateZones(dt) {
    const g = this.game, fx = g.effects;
    for (const z of [...this.zones]) {
      z.t -= dt;
      if (z.t <= 0) { this.scene.remove(z.group); this.zones.splice(this.zones.indexOf(z), 1); continue; }
      z.acc += z.rate * dt;
      const n = Math.floor(z.acc);
      z.acc -= n;
      for (const a of g.actors) {
        if (!a.alive || a.state !== 'ground' || !n) continue;
        if ((a.pos.x - z.x) ** 2 + (a.pos.z - z.z) ** 2 > z.r * z.r || Math.abs(a.pos.y - z.y) > 3) continue;
        if (z.stat === 'health') a.health = Math.min(100, a.health + n);
        else a.shield = Math.min(100, a.shield + n);
      }
      if (Math.random() < dt * (z.kind === 'campfire' ? 30 : 10)) {
        const c = z.kind === 'campfire' ? _fc.setHSL(0.05 + Math.random() * 0.05, 1, 0.25) : _fc.set('#5fb8ff');
        fx.sparks.emit(z.x + (Math.random() - 0.5) * 0.5, z.y + (z.kind === 'campfire' ? 0.25 : 1.0), z.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.4, 1.6 + Math.random(), (Math.random() - 0.5) * 0.4, c, 0.6, z.kind === 'campfire' ? 0.5 : 0.25, -1);
      }
    }
  }

  // Launch pads throw you high and open your glider; jump pads just bounce.
  _updatePads(dt) {
    const g = this.game;
    for (let i = this.pads.length - 1; i >= 0; i--) if (this.pads[i].dead) { this.scene.remove(this.pads[i].group); this.pads.splice(i, 1); }
    for (const p of this.pads) {
      p.cd = Math.max(0, p.cd - dt);
      if (p.life !== undefined && p.life !== Infinity && (p.life -= dt) <= 0) { p.dead = true; continue; }
      if (p.arrow) p.arrow.position.y = 1.2 + Math.sin(g.time * 3 + p.x) * 0.15;
      if (p.cd > 0) continue;
      const r = p.kind === 'launch' ? 1.5 : 1.15;
      for (const a of g.actors) {
        if (!a.alive || a.state !== 'ground') continue;
        if (Math.abs(a.pos.x - p.x) > r || Math.abs(a.pos.z - p.z) > r || Math.abs(a.pos.y - p.y) > 0.8) continue;
        if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) > r) continue;
        if (a.isPlayer) g.meta?.track('pad');
        if (p.kind === 'launch') a.launch(40);
        else if (p.kind === 'bounce' || p.kind === 'crash') { a.vel.y = p.kind === 'crash' ? 16 : p.high ? 27 : 24; a.onGround = false; a.noFallT = 8; a.crouched = false; p.cd = 0.3; }
        else { a.vel.y = 21; a.onGround = false; a.noFallT = 4; a.crouched = false; }
        g.sound.play(p.kind === 'launch' ? 'launch' : 'jumppad', a.isPlayer ? null : a.pos, { range: 60 });
        for (let i = 0; i < 16; i++) {
          _c.set(p.kind === 'launch' ? '#ffcf3f' : '#5fe4ff');
          g.effects.sparks.emit(p.x, p.y + 0.4, p.z, (Math.random() - 0.5) * 4, 4 + Math.random() * 6, (Math.random() - 0.5) * 4, _c, 0.5, 0.18, 6);
        }
      }
    }
  }

  // ---------- vending machines ----------
  _createVending() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#e9eef5', roughness: 0.4, metalness: 0.2 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#2f6bff', roughness: 0.4, emissive: '#2f6bff', emissiveIntensity: 0.35 });
    const screenMat = new THREE.MeshStandardMaterial({ color: '#0d1630', emissive: '#4fd1ff', emissiveIntensity: 0.55, roughness: 0.2 });
    const towns = [...TOWNS].filter((t) => t.kind !== 'lake').sort((a, b) => a.name.localeCompare(b.name)).slice(0, 7);
    for (const t of towns) {
      let spot = null;
      for (let i = 0; i < 160 && !spot; i++) {
        const a = i * 2.39, d = t.r * (0.12 + (i % 11) * 0.07);
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (this._clearSpot(x, z, 1.6, 0.82)) spot = { x, z };
      }
      if (!spot) continue;
      const y = this.world.heightAt(spot.x, spot.z);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 1.1), bodyMat); body.position.y = 1.25;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.2), trimMat); top.position.y = 2.6;
      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 0.05), screenMat); screen.position.set(0, 1.55, 0.56);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.06), trimMat); slot.position.set(0, 0.45, 0.56);
      for (const m of [body, top, screen, slot]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
      const rot = Math.atan2(t.x - spot.x, t.z - spot.z);
      g.rotation.y = rot;
      g.position.set(spot.x, y, spot.z);
      const show = new THREE.Group(); show.position.set(0, 1.6, 0.9); g.add(show);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      label.scale.set(2.4, 0.9, 1); label.position.set(0, 3.4, 0); g.add(label);
      this.scene.add(g);
      this.world.colliders.add({ kind: 'box', minX: spot.x - 0.85, maxX: spot.x + 0.85, minZ: spot.z - 0.85, maxZ: spot.z + 0.85, y0: y - 0.5, y1: y + 2.7 });
      const v = { x: spot.x, z: spot.z, y, rot, group: g, show, label, offers: [], i: 0, t: 0 };
      this._rollOffers(v);
      this._showOffer(v);
      this.vending.push(v);
    }
  }

  // ---------- upgrade benches ----------
  _createBenches() {
    const wood = new THREE.MeshStandardMaterial({ color: '#9a6a3f', roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#5a3b22', roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: '#8a96a3', roughness: 0.35, metalness: 0.6 });
    const glow = new THREE.MeshStandardMaterial({ color: '#ffb52b', emissive: '#ffb52b', emissiveIntensity: 1.2 });
    const towns = [...TOWNS].sort((a, b) => b.name.localeCompare(a.name)).slice(0, 7);
    for (const t of towns) {
      let spot = null;
      for (let i = 0; i < 160 && !spot; i++) {
        const a = i * 2.39 + 1.3, d = t.r * (0.2 + (i % 9) * 0.08);
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (this._clearSpot(x, z, 1.8, 0.85) && !this.vending.some((v) => Math.hypot(v.x - x, v.z - z) < 8)) spot = { x, z };
      }
      if (!spot) continue;
      const y = this.world.heightAt(spot.x, spot.z);
      const g = new THREE.Group();
      const add = (geo, m, x, yy, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, yy, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
      add(new THREE.BoxGeometry(2.2, 0.16, 1.0), wood, 0, 0.95, 0);
      for (const [lx, lz] of [[-0.95, -0.38], [0.95, -0.38], [-0.95, 0.38], [0.95, 0.38]]) add(new THREE.BoxGeometry(0.14, 0.9, 0.14), dark, lx, 0.45, lz);
      add(new THREE.BoxGeometry(2.0, 0.08, 0.8), dark, 0, 0.3, 0);
      add(new THREE.BoxGeometry(0.34, 0.22, 0.3), steel, -0.6, 1.14, 0); // vise
      add(new THREE.BoxGeometry(0.5, 0.2, 0.28), steel, 0.5, 1.13, 0.05); // anvil
      add(new THREE.BoxGeometry(0.3, 0.1, 0.2), steel, 0.5, 1.28, 0.05);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), glow, 0.05, 1.05, -0.3);
      const rot = Math.atan2(t.x - spot.x, t.z - spot.z);
      g.rotation.y = rot;
      g.position.set(spot.x, y, spot.z);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(['UPGRADE BENCH', 'Gold → rarity'], ['#ffb52b', '#ffffff']), transparent: true, depthWrite: false }));
      label.scale.set(2.6, 0.95, 1); label.position.set(0, 2.4, 0); g.add(label);
      this.scene.add(g);
      this.world.colliders.add({ kind: 'box', minX: spot.x - 1.1, maxX: spot.x + 1.1, minZ: spot.z - 1.1, maxZ: spot.z + 1.1, y0: y - 0.5, y1: y + 1.05, crate: true });
      this.benches.push({ x: spot.x, z: spot.z, y, rot, group: g });
    }
  }

  // ---------- mod benches (next to the upgrade benches) ----------
  _createModBenches() {
    const top = new THREE.MeshStandardMaterial({ color: '#3a4250', roughness: 0.6, metalness: 0.4 });
    const leg = new THREE.MeshStandardMaterial({ color: '#23272f', roughness: 0.6, metalness: 0.5 });
    const glow = new THREE.MeshStandardMaterial({ color: '#4fc3ff', emissive: '#4fc3ff', emissiveIntensity: 1.3 });
    for (const b of this.benches) {
      let spot = null;
      for (let i = 0; i < 120 && !spot; i++) {
        const a = b.rot + Math.PI / 2 + (i % 2 ? Math.PI : 0) + Math.floor(i / 2) % 12 * 0.5, d = 5 + Math.floor(i / 24) * 1.4;
        const x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d;
        if (this._clearSpot(x, z, 1.2, 0.8)) spot = { x, z };
      }
      if (!spot) continue;
      const y = this.world.heightAt(spot.x, spot.z);
      const g = new THREE.Group();
      const add = (geo, m, x, yy, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, yy, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
      add(new THREE.BoxGeometry(2.0, 0.12, 0.9), top, 0, 0.95, 0);
      for (const [lx, lz] of [[-0.88, -0.35], [0.88, -0.35], [-0.88, 0.35], [0.88, 0.35]]) add(new THREE.BoxGeometry(0.1, 0.9, 0.1), leg, lx, 0.45, lz);
      add(new THREE.BoxGeometry(2.0, 1.1, 0.08), leg, 0, 1.55, -0.42); // pegboard
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.28, 0.14, 0.05), [glow, top, glow, top][i], -0.66 + i * 0.44, 1.6, -0.36);
      const gun = makeWeaponMesh('ar', 2, { optic: 'holo', under: 'vertical', barrel: 'suppressor' });
      gun.rotation.set(0, Math.PI / 2, 0); gun.scale.setScalar(1.3); gun.position.set(0, 1.05, 0.05); g.add(gun);
      const rot = b.rot;
      g.rotation.y = rot;
      g.position.set(spot.x, y, spot.z);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(['MOD BENCH', `${MOD_COST} gold per mod`], ['#4fc3ff', '#ffffff']), transparent: true, depthWrite: false }));
      label.scale.set(2.6, 0.95, 1); label.position.set(0, 2.55, 0); g.add(label);
      this.scene.add(g);
      this.world.colliders.add({ kind: 'box', minX: spot.x - 1.0, maxX: spot.x + 1.0, minZ: spot.z - 1.0, maxZ: spot.z + 1.0, y0: y - 0.5, y1: y + 1.05, crate: true });
      this.modBenches.push({ x: spot.x, z: spot.z, y, rot, group: g });
    }
  }

  // ---------- exotic dealers: characters who sell one exotic weapon each for gold ----------
  _createDealers() {
    if (!this.game.assets) return;
    const towns = [...TOWNS].sort((a, b) => a.name.localeCompare(b.name));
    const chars = ['Female_Ranger', 'Male_Peasant', 'Female_Peasant', 'Male_Ranger'];
    for (const t of towns) {
      const k = this.dealers.length;
      if (k >= EXOTICS.length) break;
      let spot = null;
      for (let i = 0; i < 240 && !spot; i++) {
        const a = i * 2.39 + 0.4, d = t.r * (0.12 + (i % 12) * 0.07);
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (this._clearSpot(x, z, 1.0, 0.8) && !this.benches.some((b) => Math.hypot(b.x - x, b.z - z) < 6) && !this.vending.some((v) => Math.hypot(v.x - x, v.z - z) < 6)) spot = { x, z };
      }
      if (!spot) continue;
      const type = EXOTICS[k];
      const def = WEAPONS[type];
      const y = this.world.heightAt(spot.x, spot.z);
      const ch = new Character(this.game.assets, '#4ff4ff', chars[k % chars.length], 0.2);
      ch.root.position.set(spot.x, y, spot.z);
      ch.root.rotation.y = Math.atan2(t.x - spot.x, t.z - spot.z);
      ch.setPose('Idle', null, 0);
      const gun = makeWeaponMesh(type, EXOTIC);
      ch.setWeapon(gun);
      this.scene.add(ch.root);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture([def.name.toUpperCase(), `${def.price} gold · Exotic`], ['#4ff4ff', '#ffffff']), transparent: true, depthWrite: false }));
      label.scale.set(2.8, 1.0, 1); label.position.set(spot.x, y + 2.9, spot.z);
      this.scene.add(label);
      this.world.colliders.add({ kind: 'circle', x: spot.x, z: spot.z, r: 0.45, y0: y, y1: y + 1.9, npc: true });
      this.dealers.push({ x: spot.x, z: spot.z, y, type, price: def.price, ch, label, town: t.name, sold: 0 });
    }
  }

  buyExotic(d, actor) {
    if (this.game.warmup > 0) return 'Dealers open when the match starts';
    if (actor.gold < d.price) return `Need ${d.price} gold (you have ${actor.gold})`;
    actor.gold -= d.price;
    const w = new Weapon(d.type, EXOTIC);
    const at = _v.set(d.x + Math.sin(d.ch.root.rotation.y) * 1.2, d.y + 0.9, d.z + Math.cos(d.ch.root.rotation.y) * 1.2);
    this.game.loot.spawnPickup({ type: 'weapon', weapon: w }, at, new THREE.Vector3(0, 3, 0));
    this.game.loot.spawnPickup(Loot.ammoFor(w), at, new THREE.Vector3(1, 3.5, 0));
    this.game.sound.play('buy');
    d.ch.setPose('Interact', null, 0.1);
    d.poseT = 1.2;
    d.sold++;
    return null;
  }

  // ---------- hiding spots ----------
  _createHides() {
    const hay = new THREE.MeshStandardMaterial({ color: '#e3c16f', roughness: 0.95 });
    const band = new THREE.MeshStandardMaterial({ color: '#9a7a3a', roughness: 0.9 });
    const dInfo = this.game.models?.get('kk/city_dumpster');
    for (const t of TOWNS) {
      const urban = t.kind === 'city' || t.kind === 'spires' || t.kind === 'factory';
      if (urban && !dInfo) continue;
      for (let n = 0; n < 3; n++) {
        let spot = null;
        for (let i = 0; i < 120 && !spot; i++) {
          const a = i * 2.39 + n * 2.1 + 0.7, d = t.r * (0.35 + (i % 9) * 0.1);
          const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
          if (this._clearSpot(x, z, 1.6, 0.85) && !this.hides.some((h) => Math.hypot(h.x - x, h.z - z) < 10)) spot = { x, z };
        }
        if (!spot) continue;
        const y = this.world.heightAt(spot.x, spot.z);
        let group;
        if (urban) {
          group = this.game.models.instance('kk/city_dumpster');
          group.scale.setScalar(1.5 / dInfo.size.y);
        } else {
          group = new THREE.Group();
          const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.6, 18), hay);
          bale.rotation.z = Math.PI / 2; bale.position.y = 0.95;
          for (const bx of [-0.45, 0.45]) {
            const r = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.04, 6, 24), band);
            r.rotation.y = Math.PI / 2; r.position.set(bx, 0.95, 0);
            group.add(r);
          }
          bale.castShadow = bale.receiveShadow = true;
          group.add(bale);
        }
        group.rotation.y = Math.random() * Math.PI;
        group.position.set(spot.x, y, spot.z);
        this.scene.add(group);
        const col = { kind: 'circle', x: spot.x, z: spot.z, r: 0.9, y0: y - 0.5, y1: y + 1.6, crate: true };
        this.world.colliders.add(col);
        this.hides.push({ kind: urban ? 'dumpster' : 'hay', x: spot.x, z: spot.z, y, group, col, occupant: null });
      }
    }
  }

  // ---------- loot llamas: a few rare piñata-like stashes hidden away from the towns ----------
  _llamaMesh() {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: '#c77dff', roughness: 0.55 });
    const stripe = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.5 });
    const light = new THREE.MeshStandardMaterial({ color: '#7ee8fa', roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a1f3d', roughness: 0.4 });
    const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
    add(new THREE.BoxGeometry(0.7, 0.62, 1.3), body, 0, 1.05, 0);
    for (const z of [-0.35, 0, 0.35]) add(new THREE.BoxGeometry(0.72, 0.64, 0.1), z === 0 ? light : stripe, 0, 1.05, z);
    for (const [x, z] of [[-0.24, -0.48], [0.24, -0.48], [-0.24, 0.48], [0.24, 0.48]]) add(new THREE.BoxGeometry(0.18, 0.8, 0.18), body, x, 0.4, z);
    add(new THREE.BoxGeometry(0.34, 0.9, 0.34), body, 0, 1.65, 0.55);
    add(new THREE.BoxGeometry(0.4, 0.36, 0.56), body, 0, 2.15, 0.66);
    add(new THREE.BoxGeometry(0.22, 0.2, 0.12), light, 0, 2.08, 0.97);
    for (const x of [-0.12, 0.12]) {
      add(new THREE.BoxGeometry(0.09, 0.28, 0.09), stripe, x, 2.44, 0.55);
      add(new THREE.BoxGeometry(0.07, 0.09, 0.03), dark, x * 1.4, 2.22, 0.95);
    }
    add(new THREE.BoxGeometry(0.2, 0.2, 0.34), stripe, 0, 1.18, -0.78, -0.6); // tail
    return g;
  }

  _placeLlamas() {
    for (const l of this.llamas) { this.scene.remove(l.group); this.world.colliders.remove(l.col); }
    this.llamas = [];
    for (let tries = 0; tries < 400 && this.llamas.length < 3; tries++) {
      const x = (Math.random() - 0.5) * WORLD_HALF * 1.7, z = (Math.random() - 0.5) * WORLD_HALF * 1.7;
      if (TOWNS.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 25)) continue;
      if (this.llamas.some((l) => Math.hypot(l.x - x, l.z - z) < 150) || !this._clearSpot(x, z, 2, 0.85)) continue;
      const y = this.world.heightAt(x, z);
      const group = this._llamaMesh();
      group.position.set(x, y, z);
      group.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(group);
      const col = { kind: 'circle', x, z, r: 0.7, y0: y - 0.5, y1: y + 2.3, crate: true };
      this.world.colliders.add(col);
      this.llamas.push({ x, y, z, group, col, opened: false });
    }
  }

  openLlama(l, actor) {
    if (l.opened) return;
    l.opened = true;
    const items = [];
    for (const m of ['wood', 'stone', 'metal']) items.push({ type: 'mat', matType: m, amount: 200 });
    items.push({ type: 'gold', amount: 150 });
    for (const [a, n] of [['light', 60], ['medium', 60], ['heavy', 12], ['shells', 15]]) items.push({ type: 'ammo', ammoType: a, amount: n });
    const heal = ['chug', 'slurp', 'bigshield', 'medkit'][Math.floor(Math.random() * 4)];
    items.push({ type: 'consumable', ctype: heal, count: CONSUMABLES[heal].stack });
    const util = ['grenade', 'impulse', 'launchpad', 'shockwave'][Math.floor(Math.random() * 4)];
    items.push({ type: 'consumable', ctype: util, count: CONSUMABLES[util].stack });
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2;
      this.game.loot.spawnPickup(it, _v.set(l.x, l.y + 1.4, l.z), new THREE.Vector3(Math.cos(a) * 2.8, 5.5, Math.sin(a) * 2.8));
    });
    this.scene.remove(l.group);
    this.world.colliders.remove(l.col);
    this.game.effects.confetti?.(_v.set(l.x, l.y - 4, l.z));
    this.game.sound.play('chest', actor.isPlayer ? null : _v.set(l.x, l.y, l.z));
    if (actor.isPlayer) this.game.hud?.banner?.('Loot Llama!', 1.5);
  }

  // ---------- foraged food: apples under trees (+5 health), mushrooms in the woods (+5 shield) ----------
  _createForage() {
    const rnd = mulberry32(4711);
    const trees = this.world.colliders.query(-WORLD_HALF, WORLD_HALF, -WORLD_HALF, WORLD_HALF, []).filter((c) => c.tree && c.kind === 'circle');
    this.forage = [];
    const spots = [];
    for (const c of trees) {
      if (rnd() > 0.16) continue;
      const k = rnd();
      const kind = k < 0.42 ? 'apple' : k < 0.64 ? 'mushroom' : k < 0.76 ? 'banana' : k < 0.88 ? 'pepper' : 'slapberry';
      const n = kind === 'apple' ? 1 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, d = c.r + (kind === 'apple' ? 0.5 + rnd() * 1.2 : 0.9 + rnd() * 1.8);
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = this.world.heightAt(x, z);
        if (y < 1.5 || spots.some((s) => Math.abs(s.x - x) < 0.5 && Math.abs(s.z - z) < 0.5)) continue;
        spots.push({ kind, x, y, z, rot: rnd() * 6.28, s: 0.85 + rnd() * 0.3, eaten: false });
      }
    }
    const of = (k) => spots.filter((s) => s.kind === k);
    const mk = (geo, color, count, extra = {}) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...extra }), Math.max(1, count));
      m.castShadow = true; m.count = count;
      this.scene.add(m);
      return m;
    };
    const appleGeo = new THREE.SphereGeometry(0.13, 12, 10); appleGeo.scale(1, 0.9, 1);
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.07, 5);
    const capGeo = new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); capGeo.scale(1, 0.7, 1);
    const stalkGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.16, 8);
    const bananaGeo = new THREE.TorusGeometry(0.16, 0.045, 6, 12, Math.PI * 0.8); bananaGeo.rotateX(Math.PI / 2);
    const pepperGeo = new THREE.ConeGeometry(0.07, 0.24, 8); pepperGeo.rotateX(Math.PI);
    const berryGeo = new THREE.DodecahedronGeometry(0.1, 1);
    const leafGeo = new THREE.BoxGeometry(0.3, 0.02, 0.18);
    this.forageMeshes = {
      apple: [[mk(appleGeo, '#d8262e', of('apple').length), 0.12], [mk(stemGeo, '#5b3a1e', of('apple').length), 0.26]],
      mushroom: [[mk(capGeo, '#3f8dff', of('mushroom').length, { emissive: '#1d4dff', emissiveIntensity: 0.35 }), 0.2], [mk(stalkGeo, '#f1ead8', of('mushroom').length), 0.11]],
      banana: [[mk(bananaGeo, '#ffd84a', of('banana').length), 0.08]],
      pepper: [[mk(pepperGeo, '#e8321f', of('pepper').length), 0.12], [mk(stemGeo, '#3e8a2e', of('pepper').length), 0.26]],
      slapberry: [[mk(berryGeo, '#5b3dff', of('slapberry').length, { emissive: '#3a1dff', emissiveIntensity: 0.4 }), 0.12], [mk(leafGeo, '#3e8a2e', of('slapberry').length), 0.05]],
    };
    const place = (list, kind) => list.forEach((s, i) => { s.i = i; this.forage.push(s); this._setForage(s, kind, true); });
    for (const k of Object.keys(this.forageMeshes)) place(of(k), k);
  }

  _setForage(s, kind, visible) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    for (const [mesh, dy] of this.forageMeshes[kind]) {
      const sc = visible ? s.s : 0;
      m4.compose(new THREE.Vector3(s.x, s.y + dy * s.s, s.z), q, new THREE.Vector3(sc, sc, sc));
      mesh.setMatrixAt(s.i, m4);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  eat(s, actor) {
    if (s.eaten) return null;
    const f = FORAGE[s.kind];
    if (f.health && !f.speed && !f.slap && actor.health >= 100) return 'Already at full health';
    if (f.shield && actor.shield >= 100) return 'Shield is full';
    if (f.health) actor.health = Math.min(100, actor.health + f.health);
    if (f.shield) actor.shield = Math.min(100, actor.shield + f.shield);
    if (f.speed) actor.speedT = Math.min(30, (actor.speedT || 0) + f.speed); // peppers stack
    if (f.slap) actor.slapT = f.slap;
    s.eaten = true;
    this._setForage(s, s.kind, false);
    this.game.sound.play('pickup', actor.isPlayer ? null : actor.pos);
    if (actor.isPlayer) this.game.hud?.pickupNote?.(f.note, f.color);
    return null;
  }

  // Jump into a hiding spot: invisible to bots, can't move or shoot; jump / interact to leave.
  hide(spot, actor) {
    if (spot.occupant || actor.state !== 'ground') return spot.occupant ? 'Someone is already in there' : null;
    spot.occupant = actor;
    actor.hiddenIn = spot;
    actor.setBuildMode?.(null);
    actor.useT = 0;
    actor.vel.set(0, 0, 0);
    actor.pos.set(spot.x, spot.y + 0.2, spot.z);
    this._rustle(spot);
    return null;
  }

  unhide(actor) {
    const spot = actor.hiddenIn;
    if (!spot) return;
    spot.occupant = null;
    actor.hiddenIn = null;
    const a = actor.aimYaw;
    actor.pos.set(spot.x + Math.sin(a) * 1.6, spot.y + 1.8, spot.z + Math.cos(a) * 1.6);
    actor.vel.set(Math.sin(a) * 3, 6, Math.cos(a) * 3);
    actor.onGround = false;
    actor.root.visible = true;
    this._rustle(spot);
  }

  _rustle(spot) {
    const c = spot.kind === 'hay' ? _fc.set('#e3c16f') : _fc.set('#3f6b4a');
    for (let i = 0; i < 18; i++) this.game.effects.debris.emit(spot.x + (Math.random() - 0.5), spot.y + 1.4, spot.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, c, 0.8, 0.15, 12);
    this.game.sound.play('harvest_wood', spot.occupant?.isPlayer ? null : new THREE.Vector3(spot.x, spot.y, spot.z), { range: 30 });
  }

  // Cost to take a gun from its rarity to the next one (Legendary is the top; Mythics can't be upgraded).
  static upgradeCost(w) {
    return w?.isGun && w.rarity < 4 ? UPGRADE_COST[w.rarity] : null;
  }

  upgrade(bench, actor) {
    if (this.game.warmup > 0) return 'Benches open when the match starts';
    const w = actor.held;
    const cost = Events.upgradeCost(w);
    if (!w?.isGun) return 'Hold the weapon you want to upgrade';
    if (!cost) return w.rarity >= 5 ? `${RARITIES[w.rarity].name} weapons can't be upgraded` : 'Already Legendary';
    const [, n] = cost;
    if (actor.gold < n) return `Need ${n} gold (you have ${actor.gold})`;
    actor.gold -= n;
    const nw = new Weapon(w.type, w.rarity + 1);
    nw.mods = { ...w.mods };
    nw.ammo = Math.max(w.ammo, Math.min(nw.mag, w.ammo));
    actor.items[actor.slot] = nw;
    actor._equip();
    const at = _v.set(bench.x, bench.y + 1.3, bench.z);
    this.game.effects.shieldBreak?.(at);
    this.game.sound.play('buy', actor.isPlayer ? null : actor.pos);
    return null;
  }

  nearestBench(pos, maxD) {
    let best = null, bd = maxD;
    for (const b of this.benches) { const d = Math.hypot(b.x - pos.x, b.z - pos.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  _rollOffers(v) {
    v.offers = [0, 1, 2].map((k) => {
      const rarity = 2 + k;
      let type = rollWeaponType('chest');
      if (type === 'pistol') type = 'ar';
      return { type, rarity, mat: VEND_MATS[k], price: VEND_PRICES[rarity] };
    });
  }

  _showOffer(v) {
    const o = v.offers[v.i];
    v.show.clear();
    const m = makeWeaponMesh(o.type, o.rarity);
    m.scale.setScalar(1.6);
    v.show.add(m);
    v.label.material.map?.dispose();
    v.label.material.map = labelTexture([`${RARITIES[o.rarity].name} ${WEAPONS[o.type].name}`, `${o.price} gold`], [RARITIES[o.rarity].color, '#ffffff']);
    v.label.material.needsUpdate = true;
  }

  buy(v, actor) {
    if (this.game.warmup > 0) return 'Vending opens when the match starts';
    const o = v.offers[v.i];
    if (actor.gold < o.price) return `Need ${o.price} gold (you have ${actor.gold})`;
    actor.gold -= o.price;
    const w = new Weapon(o.type, o.rarity);
    const f = [Math.sin(v.rot), Math.cos(v.rot)];
    const at = _v.set(v.x + f[0] * 1.3, v.y + 0.8, v.z + f[1] * 1.3);
    this.game.loot.spawnPickup({ type: 'weapon', weapon: w }, at, new THREE.Vector3(f[0] * 2, 3, f[1] * 2));
    this.game.loot.spawnPickup(Loot.ammoFor(w), at, new THREE.Vector3(f[0] * 2.5, 3.5, f[1] * 1.5));
    this.game.sound.play('buy');
    if (actor.isPlayer) this.game.meta?.track('vend');
    return null;
  }

  // ---------- supply drops ----------
  _spawnSupply(at = null) {
    const g = this.game, storm = g.storm;
    const c = storm.safeCenter(), r = storm.safeRadius();
    let x = at ? at.x : c.x, z = at ? at.z : c.y;
    for (let i = 0; i < (at ? 0 : 40); i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.7;
      const tx = c.x + Math.cos(a) * d, tz = c.y + Math.sin(a) * d;
      if (this.world.heightAt(tx, tz) > 2.5 && this.world.terrain.normalAt(tx, tz).y > 0.85) { x = tx; z = tz; break; }
    }
    const ground = this.world.groundAt(x, z, 300, 0.8);
    const grp = new THREE.Group();
    const crateMat = new THREE.MeshStandardMaterial({ color: '#2f6bff', roughness: 0.45, metalness: 0.2, emissive: '#1b3fb0', emissiveIntensity: 0.3 });
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#9fdcff', emissiveIntensity: 0.4 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.6), crateMat); crate.position.y = 0.65;
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.18, 1.64), bandMat); band1.position.y = 0.95;
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.34, 1.64), bandMat); band2.position.y = 0.65;
    for (const m of [crate, band1, band2]) { m.castShadow = true; grp.add(m); }
    const balloon = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), new THREE.MeshStandardMaterial({ color: '#58a6ff', roughness: 0.35, emissive: '#2f6bff', emissiveIntensity: 0.25 }));
    ball.scale.y = 1.2; ball.position.y = 6.2; ball.castShadow = true;
    const pts = [];
    for (const [sx, sz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) pts.push(new THREE.Vector3(sx, 1.3, sz), new THREE.Vector3(0, 4.4, 0));
    const strings = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e6eef8' }));
    balloon.add(ball, strings);
    grp.add(balloon);
    grp.position.set(x, ground + 110, z);
    this.scene.add(grp);
    const s = { x, z, ground, y: ground + 110, group: grp, balloon, landed: false, opened: false, smokeT: 0 };
    this.supplies.push(s);
    if (!at) { g.hud.banner('Supply drop incoming!', 3); g.sound.play('supply'); }
    return s;
  }

  openSupply(s, actor) {
    if (!s.landed || s.opened) return;
    if (actor.isPlayer) this.game.meta?.track('supply');
    s.opened = true;
    const loot = this.game.loot;
    const items = [];
    const w = new Weapon(rollWeaponType('rare'), Math.random() < 0.4 ? 4 : 3).withRandomMods();
    items.push({ type: 'weapon', weapon: w }, Loot.ammoFor(w), Loot.ammoFor(w));
    items.push({ type: 'consumable', ctype: Math.random() < 0.5 ? 'bigshield' : 'medkit', count: 1 });
    const extra = ['grenade', 'grenade', 'smoke', 'impulse', 'fire', 'launchpad'][Math.floor(Math.random() * 6)];
    items.push({ type: 'consumable', ctype: extra, count: CONSUMABLES[extra].stack });
    items.push({ type: 'mat', matType: 'metal', amount: 60 });
    items.push({ type: 'gold', amount: 100 });
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2;
      loot.spawnPickup(it, _v.set(s.x, s.ground + 1, s.z), new THREE.Vector3(Math.cos(a) * 2.6, 5, Math.sin(a) * 2.6));
    });
    this.scene.remove(s.group);
    this.game.sound.play('chest', actor.isPlayer ? null : _v.set(s.x, s.ground, s.z));
  }

  _updateSupplies(dt) {
    const g = this.game;
    for (const s of this.supplies) {
      if (s.opened) continue;
      if (!s.landed) {
        s.y -= FALL_SPEED * dt;
        s.group.rotation.y += dt * 0.3;
        if (s.y <= s.ground) {
          s.y = s.ground;
          s.landed = true;
          g.effects.dust(_v.set(s.x, s.ground, s.z), 14, 2);
        }
        s.group.position.y = s.y;
      } else if (s.balloon.parent) {
        // balloon floats away once the crate is down
        s.balloon.position.y += dt * 6;
        if (s.balloon.position.y > 60) s.group.remove(s.balloon);
      }
      // blue smoke trail marks the spot
      s.smokeT -= dt;
      if (s.smokeT <= 0 && s.landed) {
        s.smokeT = 0.06;
        _c.set('#6fb5ff');
        g.effects.debris.emit(s.x + 0.9, s.ground + 1.2, s.z, (Math.random() - 0.5) * 0.6, 3 + Math.random() * 2, (Math.random() - 0.5) * 0.6, _c, 2.4, 0.8, -0.8, 0.5);
      }
    }
  }

  // Closest thing to use: landed supply drop or vending machine.
  nearestInteractable(pos, reach = 2.8) {
    let best = null, bd = reach;
    for (const s of this.supplies) {
      if (!s.landed || s.opened) continue;
      const d = Math.hypot(s.x - pos.x, s.z - pos.z);
      if (d < bd && Math.abs(s.ground - pos.y) < 2.5) { bd = d; best = { kind: 'supply', supply: s, text: 'Open Supply Drop' }; }
    }
    for (const v of this.vending) {
      const d = Math.hypot(v.x - pos.x, v.z - pos.z);
      if (d < bd + 0.6 && Math.abs(v.y - pos.y) < 2.5) {
        const o = v.offers[v.i];
        bd = d;
        best = { kind: 'vending', vending: v, text: `Buy ${RARITIES[o.rarity].name} ${WEAPONS[o.type].name} · ${o.price} gold`, rarity: o.rarity };
      }
    }
    for (const h of this.hides) {
      if (h.occupant) continue;
      const d = Math.hypot(h.x - pos.x, h.z - pos.z);
      if (d < bd + 0.8 && Math.abs(h.y - pos.y) < 2.5) { bd = d; best = { kind: 'hide', hide: h, text: `Hide in ${h.kind === 'hay' ? 'Haystack' : 'Dumpster'}` }; }
    }
    for (const l of this.llamas) {
      if (l.opened) continue;
      const d = Math.hypot(l.x - pos.x, l.z - pos.z);
      if (d < bd + 0.6 && Math.abs(l.y - pos.y) < 2.5) { bd = d; best = { kind: 'llama', llama: l, text: 'Open Loot Llama', rarity: 4 }; }
    }
    for (const f of this.forage || []) {
      if (f.eaten || Math.abs(f.x - pos.x) > bd || Math.abs(f.z - pos.z) > bd) continue;
      const d = Math.hypot(f.x - pos.x, f.z - pos.z);
      if (d < Math.min(bd, 1.7) && Math.abs(f.y - pos.y) < 2) { bd = d; best = { kind: 'forage', forage: f, text: FORAGE[f.kind].text }; }
    }
    for (const b of this.modBenches || []) {
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d < bd + 0.8 && Math.abs(b.y - pos.y) < 2.5) { bd = d; best = { kind: 'modbench', bench: b, text: 'Use Mod Bench', rarity: 2 }; }
    }
    for (const dl of this.dealers || []) {
      const d = Math.hypot(dl.x - pos.x, dl.z - pos.z);
      if (d < bd + 1 && Math.abs(dl.y - pos.y) < 2.5) { bd = d; best = { kind: 'dealer', dealer: dl, text: `Buy ${WEAPONS[dl.type].name} · ${dl.price} gold`, rarity: EXOTIC }; }
    }
    for (const b of this.benches) {
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d < bd + 0.8 && Math.abs(b.y - pos.y) < 2.5) {
        const w = this.game.player?.held, cost = Events.upgradeCost(w);
        bd = d;
        best = {
          kind: 'bench', bench: b, rarity: w?.isGun ? Math.min(4, w.rarity + (cost ? 1 : 0)) : 4,
          text: !w?.isGun ? 'Upgrade Bench · hold a weapon' : !cost ? `${w.name} · can't upgrade further`
            : `Upgrade to ${RARITIES[w.rarity + 1].name} ${WEAPONS[w.type].name} · ${cost[1]} gold`,
        };
      }
    }
    return best;
  }

  nearestSupply(pos, maxD) {
    let best = null, bd = maxD;
    for (const s of this.supplies) {
      if (s.opened) continue;
      const d = Math.hypot(s.x - pos.x, s.z - pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Icons for the minimap / big map.
  mapIcons() {
    const out = [];
    for (const s of this.supplies) if (!s.opened) out.push({ x: s.x, z: s.z, color: '#58a6ff', shape: 'square', label: 'Supply drop' });
    for (const v of this.vending) out.push({ x: v.x, z: v.z, color: '#4fd1ff', shape: 'vending', label: 'Vending machine' });
    for (const b of this.benches) out.push({ x: b.x, z: b.z, color: '#ffb52b', shape: 'vending', label: 'Upgrade bench' });
    for (const b of this.modBenches || []) out.push({ x: b.x, z: b.z, color: '#4fc3ff', shape: 'vending', label: 'Mod bench' });
    for (const d of this.dealers || []) out.push({ x: d.x, z: d.z, color: '#4ff4ff', shape: 'dot', label: `Exotic: ${WEAPONS[d.type].name}` });
    // Shadow Tracker hits: the target shows up for a few seconds
    const now = this.game.time;
    for (const a of this.game.actors) if (a.alive && !a.isPlayer && a.markedUntil > now && a.markedBy === this.game.player) out.push({ x: a.pos.x, z: a.pos.z, color: '#ff3b6b', shape: 'medal', label: 'Tracked' });
    for (const p of this.pads) if (p.kind === 'jump') out.push({ x: p.x, z: p.z, color: '#39e0ff', shape: 'dot', label: 'Jump pad' });
    const boss = this.game.boss;
    for (const b of boss?.bosses || []) if (b.alive) out.push({ x: b.pos.x, z: b.pos.z, color: b.bossCfg.color, shape: 'square', label: 'Boss' });
    // medallion carriers are revealed to everyone
    for (const a of this.game.actors) if (a.alive && !a.npc && !a.isPlayer && a.medallions?.size) out.push({ x: a.pos.x, z: a.pos.z, color: '#ffd23f', shape: 'medal', label: 'Medallion carrier' });
    const v = boss?.vault;
    if (v && !v.opened) out.push({ x: v.x, z: v.z, color: '#ffe94d', shape: 'vending', label: 'Vault' });
    return out;
  }

  reset() {
    for (const s of this.supplies) this.scene.remove(s.group);
    this.supplies = [];
    for (const p of this.pads.filter((q) => q.kind !== 'jump')) this.scene.remove(p.group);
    this.pads = this.pads.filter((q) => q.kind === 'jump');
    for (const v of this.vending) { this._rollOffers(v); v.i = 0; this._showOffer(v); }
    this.dropIdx = 0;
    for (const z of this.zones) this.scene.remove(z.group);
    this.zones = [];
    for (const h of this.hides) if (h.occupant) this.unhide(h.occupant);
    this._placeLlamas();
    for (const f of this.forage || []) if (f.eaten) { f.eaten = false; this._setForage(f, f.kind, true); }
  }

  update(dt, matchTime) {
    if (this.game.state === 'playing' && this.dropIdx < DROP_TIMES.length && matchTime > DROP_TIMES[this.dropIdx] && this.game.storm.stage !== 'done') {
      this.dropIdx++;
      this._spawnSupply();
    }
    this._updateSupplies(dt);
    this._updatePads(dt);
    this._updateZones(dt);
    const cam = this.game.camera.position;
    for (const d of this.dealers || []) {
      if (Math.abs(d.x - cam.x) + Math.abs(d.z - cam.z) > 90) continue; // only animate nearby dealers
      if (d.poseT > 0 && (d.poseT -= dt) <= 0) d.ch.setPose('Idle', null, 0.3);
      d.ch.update(dt, 0, false, 0);
    }
    for (const v of this.vending) {
      v.t += dt;
      v.show.rotation.y += dt * 1.2;
      if (v.t > 5) { v.t = 0; v.i = (v.i + 1) % v.offers.length; this._showOffer(v); }
    }
  }
}
