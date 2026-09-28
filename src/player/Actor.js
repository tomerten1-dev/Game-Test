import * as THREE from 'three';
import { biomeAt } from '../world/Terrain.js';
import { makeCrownMesh } from '../world/ItemMeshes.js';
import { attachHat, attachBackBling, makeHarvestTool, headAnchor } from './Gear.js';
import { Character } from './Character.js';
import { makeGlider } from './Glider.js';
import { damp, dampAngle } from '../core/noise.js';
import { makeWeaponMesh, makePickaxeMesh, makeThrowableMesh } from '../weapons/WeaponModels.js';
import { makeConsumableMesh } from '../world/ItemMeshes.js';
import { Pickaxe, Consumable, CONSUMABLES, MAT_CAP, AMMO } from '../weapons/Items.js';

const _surf = []; // scratch list for surface()

export const RUN_SPEED = 6.4;
export const SPRINT_SPEED = RUN_SPEED * 1.3; // Fortnite Chapter 5: sprint is 1.3x the run speed (was 1.4x)
export const TAC_SPRINT_SPEED = SPRINT_SPEED * 1.18; // tactical sprint (uses stamina)
const STAMINA_DRAIN = 22, STAMINA_REGEN = 26;
const CROUCH_SPEED = 3.4;
const SLIDE_TIME = 1.1; // flat-ground slide; slopes keep it going
// Fortnite fall damage by height: none below ~12.5 m (a bit over 3 walls), 11 at 3⅓ walls,
// 49 at 5 walls and 100 at 6 walls (23 m). We land with speed v, so height = v² / 2g.
const FALL_CURVE = [[12.5, 0], [12.8, 11], [19.2, 49], [23.04, 100], [40, 250]];
const FALL_SAFE = Math.sqrt(2 * 24 * 12.5); // landing speed (m/s) before fall damage
function fallDamageFor(speed, g = 24) {
  const h = (speed * speed) / (2 * g);
  if (h <= FALL_CURVE[0][0]) return 0;
  for (let i = 1; i < FALL_CURVE.length; i++) {
    const [h0, d0] = FALL_CURVE[i - 1], [h1, d1] = FALL_CURVE[i];
    if (h <= h1) return Math.round(d0 + ((h - h0) / (h1 - h0)) * (d1 - d0));
  }
  return 250;
}
const JUMP_VEL = 8.2;
const GLIDE_HEIGHT = 60; // the glider opens on its own this high above the ground
const REDEPLOY_HEIGHT = 14;
const OVERSHIELD = 50; // Zero Build mode

// Shared body for the player and bots: state machine, physics, animation, health.
const _tc = new THREE.Color();
const _sph = new THREE.Sphere(new THREE.Vector3(), 2.2);
const _sc = new THREE.Color();
const _mq = [];

// Cosmetic weapon wrap: recolour the gun body (keeps the rarity stripe). Wrapped materials are cached.
const WRAPPED = new Map();
export function applyWrap(mesh, wrap) {
  if (!wrap || !mesh) return mesh;
  mesh.traverse((o) => {
    if (!o.isMesh || o.material.emissiveIntensity > 0.8) return;
    const key = o.material.uuid + wrap.color;
    if (WRAPPED.has(key)) { o.material = WRAPPED.get(key); return; }
    const m = o.material.clone();
    WRAPPED.set(key, m);
    m.color.lerp(new THREE.Color(wrap.color), 0.75);
    if (m.vertexColors) m.color.set(wrap.color);
    m.emissive = new THREE.Color(wrap.emissive);
    m.emissiveIntensity = 0.35;
    m.metalness = 0.5;
    m.roughness = 0.3;
    o.material = m;
  });
  return mesh;
}

const _useCol = new THREE.Color();
export class Actor {
  constructor(game, { name, color, isPlayer = false, type = 'Knight', glider = null, tint, outfit = null }) {
    this.game = game;
    this.name = name;
    this.isPlayer = isPlayer;
    this.color = new THREE.Color(color);
    this.character = new Character(game.assets, color, type, tint ?? (isPlayer ? 0.35 : 0.3), outfit);
    this.root = this.character.root;
    this.glider = glider ? makeGlider(glider[0], glider[1]) : makeGlider(color);
    this.root.add(this.glider);
    game.scene.add(this.root);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = 0.42;
    this.height = 1.92; // Fortnite players are 192 cm
    this.onGround = false;
    this.intent = { mx: 0, mz: 0, jump: false, deploy: false, sprint: false };
    this.aimYaw = 0;
    this.aimPitch = 0;
    this.bodyYaw = 0;
    this.state = 'ground';
    this.alive = true;
    this.health = 100;
    this.shield = 0;
    this.overshield = this.game.zeroBuild ? OVERSHIELD : 0;
    this.kills = 0;
    this.lastFireTime = -10;
    this.lastHurtTime = -10;
    this.flashT = 0;
    // slot 0 = pickaxe, slots 1-5 = guns or stackable consumables
    this.items = [new Pickaxe(), null, null, null, null, null];
    this.slot = 0;
    this.ammo = { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 };
    this.mats = { wood: 0, stone: 0, metal: 0 };
    this.gold = 0;               // gold bars (spent at vending machines and upgrade benches)
    this.medallions = new Set(); // boss medallions carried
    this.keycard = false; // vault keycard (its own slot)
    this.crowned = false;        // wearing the Victory Crown
    this.infiniteAmmo = !isPlayer; // bots don't track reserve ammo
    this.crouched = false;
    this.crouchAmt = 0;
    this.sprinting = false;
    this.slideT = 0;
    this.slideDir = new THREE.Vector3();
    this.useT = 0; // consumable channel time left
    this.buildMode = null; // piece type while in build mode
    this.buildMat = 'wood';
    this.swingT = 0;
    this._stepDist = 0;
    this.stamina = 100;
    this.staminaIdle = 0;
    this.mantleT = 0;
    this.mantleFrom = new THREE.Vector3();
    this.mantleTo = new THREE.Vector3();
    this.distToCam = 0;
    this._animAcc = 0;
  }

  get held() { return this.items[this.slot]; }
  get weapon() { const h = this.items[this.slot]; return h && h.isGun ? h : null; }
  get weapons() { return this.items.filter((i) => i && i.isGun); }
  get matTotal() { return this.mats.wood + this.mats.stone + this.mats.metal; }
  get wood() { return this.mats.wood; }
  set wood(v) { this.mats.wood = Math.max(0, Math.min(MAT_CAP, v)); }

  // What we're standing on, for footstep sounds: a build / house (its material), water, or the ground.
  surface() {
    const w = this.game.world, p = this.pos;
    if (this.inWater) return 'water';
    const th = w.terrain.heightAt(p.x, p.z);
    if (p.y - th > 0.25) {
      for (const c of w.colliders.query(p.x - 0.4, p.x + 0.4, p.z - 0.4, p.z + 0.4, _surf)) {
        if (Math.abs(c.y1 - p.y) > 0.35 && c.kind !== 'ramp' && c.kind !== 'cone') continue;
        const m = c.structure?.mat || c.mat;
        _surf.length = 0;
        return m === 'metal' ? 'metal' : m === 'stone' ? 'stone' : 'wood';
      }
      _surf.length = 0;
    }
    if (th < 2.4) return 'sand';
    const b = biomeAt(p.x, p.z);
    return b.snow > 0.5 ? 'snow' : b.desert > 0.5 ? 'sand' : 'grass';
  }

  ammoFor(type) { return this.infiniteAmmo || type === 'none' ? Infinity : this.ammo[type] || 0; }

  // Move rounds from the reserve into the magazine when a reload completes.
  finishReload(w, max = Infinity) {
    const need = Math.min(max, w.mag - w.ammo);
    const free = this.infiniteAmmo || w.def.ammoType === 'none'; // bows never run out of arrows
    const take = free ? need : Math.min(need, this.ammo[w.def.ammoType] || 0);
    w.ammo += take;
    if (!free) this.ammo[w.def.ammoType] -= take;
  }

  addAmmo(type, n) { this.ammo[type] = Math.min(AMMO[type]?.max ?? 999, (this.ammo[type] || 0) + n); }
  addMat(type, n) { this.mats[type] = Math.min(MAT_CAP, this.mats[type] + n); }

  // Stack onto existing consumables first, then a free slot. Returns how many didn't fit.
  addConsumable(type, count) {
    const def = CONSUMABLES[type];
    for (const it of this.items) {
      if (!count) break;
      if (it && it.isConsumable && it.type === type && it.count < def.max) {
        const add = Math.min(count, def.max - it.count);
        it.count += add;
        count -= add;
      }
    }
    if (count > 0) {
      // consumables fill from the right (weapons fill from the left), unless auto sort is off
      const right = !this.isPlayer || this.game.meta?.profile?.d?.settings?.autoSort !== false;
      const free = right ? this.items.findLastIndex((it, i) => i > 0 && !it) : this.items.findIndex((it, i) => i > 0 && !it);
      if (free > 0) { this.items[free] = new Consumable(type, Math.min(count, def.max)); count -= Math.min(count, def.max); if (free === this.slot) this._equip(); }
    }
    return count;
  }

  // Consumables: channel for def.time seconds, then apply and use one from the stack.
  startUse() {
    const h = this.held;
    if (!h || !h.isConsumable || this.useT > 0 || !h.usableBy(this)) return false;
    this.useT = h.def.time;
    this.useItem = h;
    // you can hear other players heal: a gulp for drinks, a rip for bandages and medkits
    const drink = h.def.shield || h.def.overTime || h.def.fizz;
    this.game.sound?.play(drink ? 'gulp' : 'rip', this.isPlayer ? null : this.pos, { range: 28 });
    return true;
  }

  // Returns the finished item when a use completes.
  tickUse(dt) {
    if (this.useT <= 0) return null;
    const it = this.useItem;
    if (!it || this.held !== it) { this.useT = 0; return null; }
    this.useT -= dt;
    if (this.useT > 0) return null;
    this.useT = 0;
    it.apply(this);
    this.consumeHeld();
    return it;
  }

  // Use up one of the held stack; switch away when it runs out.
  consumeHeld() {
    const it = this.held;
    if (!it || !it.isConsumable) return;
    if (--it.count <= 0) {
      this.items[this.slot] = null;
      const next = this.items.findIndex((x, i) => i > 0 && x);
      if (!this.switchSlot(next > 0 ? next : 0)) this._equip();
    }
  }

  // Throw a grenade from the held stack toward dir.
  throwHeld(dir) {
    const it = this.held;
    if (!it?.def?.throw || (this.throwCd || 0) > this.game.time) return false;
    this.throwCd = this.game.time + 0.7;
    const from = this.chest(new THREE.Vector3()).addScaledVector(dir, 0.6);
    from.y += 0.4;
    this.game.projectiles.throwGrenade(this, from, dir, it.def.throw);
    this.swingT = 0.4;
    this.consumeHeld();
    return true;
  }

  // Slot of a consumable of the given kind ('heal' / 'shield') that helps right now, best first.
  findConsumable(kind) {
    let best = -1, bestV = 0;
    this.items.forEach((it, i) => {
      if (!it || !it.isConsumable || !it.usableBy(this)) return;
      const d = it.def;
      if (d.throw || !d.time) return; // thrown heals (Chug Splash) aren't drunk
      if (kind === 'heal' && !d.heal) return;
      if (kind === 'shield' && !d.shield) return;
      const v = d.heal ? Math.min(d.heal, d.cap - this.health) : Math.min(d.shield, d.cap - this.shield);
      if (v > bestV) { bestV = v; best = i; }
    });
    return best;
  }

  // Find a ledge in front we can climb onto (0.9-2.6 m above the feet, clear on top).
  _tryMantle(dx, dz) {
    const w = this.game.world;
    const reach = this.radius + 0.55;
    const px = this.pos.x + dx * reach, pz = this.pos.z + dz * reach;
    const top = w.groundAt(px, pz, this.pos.y + 2.2, 0.25);
    const rise = top - this.pos.y;
    const min = this.onGround ? 0.85 : -0.2;
    // in the air you can catch a ledge up to arm's reach above your head (and hang off it)
    if (rise < min || rise > (this.onGround ? 2.6 : 3.2)) return false;
    // something must actually block us at knee height, and there must be headroom on top
    const list = w.colliders.query(px - 0.4, px + 0.4, pz - 0.4, pz + 0.4, _mq);
    let blocked = w.heightAt(px, pz) > this.pos.y + 0.8;
    for (const c of list) {
      if (c.kind === 'ramp' || c.kind === 'cone') continue;
      if (c.y1 > top + 0.05 && c.y0 < top + 1.8) return false;
      if (c.y1 > this.pos.y + (this.onGround ? 0.5 : 0.1)) blocked = true;
    }
    if (!blocked) return false;
    // a ledge high above us mid-air: grab it, hang a moment, then pull up
    this.mantleHang = !this.onGround && rise > 1.7 ? 0.3 : 0;
    this.mantleDur = this.mantleHang ? 0.75 : 0.34;
    this.mantleT = this.mantleDur;
    this.mantleFrom.set(px - dx * (reach - 0.1), top - 1.9, pz - dz * (reach - 0.1));
    if (!this.mantleHang) this.mantleFrom.copy(this.pos);
    this.mantleTo.set(px + dx * 0.25, top + 0.02, pz + dz * 0.25);
    this.vel.set(0, 0, 0);
    this.crouched = false;
    this.character.setPose(this.mantleHang ? 'Spellcast_Raise' : 'Jump_Start', null, 0.05, this.mantleHang ? 1 : 1.8);
    this.game.sound?.play('jump', this.isPlayer ? null : this.pos);
    return true;
  }

  // Kick off a wall you're touching mid-air (twice before you land).
  _tryWallJump(it) {
    if ((this.wallJumps || 0) >= 2 || this.game.time - (this.lastWallJump || -9) < 0.3) return false;
    const w = this.game.world, r = this.radius + 0.4, y = this.pos.y + 1.0;
    let best = null, bd = r;
    for (const c of w.colliders.query(this.pos.x - r - 1, this.pos.x + r + 1, this.pos.z - r - 1, this.pos.z + r + 1, _mq)) {
      if (c.kind === 'ramp' || c.kind === 'cone' || c.y1 < y || c.y0 > y) continue;
      let nx, nz, d;
      if (c.kind === 'circle') { nx = this.pos.x - c.x; nz = this.pos.z - c.z; d = Math.hypot(nx, nz) - c.r; }
      else {
        const cx = Math.max(c.minX, Math.min(this.pos.x, c.maxX)), cz = Math.max(c.minZ, Math.min(this.pos.z, c.maxZ));
        nx = this.pos.x - cx; nz = this.pos.z - cz; d = Math.hypot(nx, nz);
      }
      if (d < bd && d > 1e-4) { bd = d; const l = Math.hypot(nx, nz); best = [nx / l, nz / l]; }
    }
    if (!best) return false;
    this.wallJumps = (this.wallJumps || 0) + 1;
    this.lastWallJump = this.game.time;
    const mlen = Math.hypot(it.mx, it.mz);
    // Wall Scramble: jumping into a wall in front of you takes a big stride up it (you mantle the
    // top automatically if you reach it); a wall beside you is a Wall Kick instead
    if (mlen > 0.3 && (-(it.mx * best[0] + it.mz * best[1]) / mlen) > 0.6 && (this.scrambles || 0) < 2) {
      this.scrambles = (this.scrambles || 0) + 1;
      this.vel.set(-best[0] * 1.2, JUMP_VEL * 1.2, -best[1] * 1.2);
      this.flungT = 0.3;
      this.character.setPose(this.character.q ? 'ClimbUp_1m' : 'Jump_Start', null, 0.05, 1.6);
      this.game.sound?.play('jump', this.isPlayer ? null : this.pos);
      if (this.distToCam < 40) this.game.effects.dust(this.pos, 4, 0.6);
      return true;
    }
    const along = mlen > 0.2 ? 3.5 : 0;
    this.vel.set(best[0] * 7 + (mlen > 0.2 ? (it.mx / mlen) * along : 0), JUMP_VEL * 0.95, best[1] * 7 + (mlen > 0.2 ? (it.mz / mlen) * along : 0));
    this.flungT = 0.35; // keep the push-off momentum for a moment
    this.character.setPose('Jump_Start', null, 0.05, 1.8);
    this.game.sound?.play('jump', this.isPlayer ? null : this.pos);
    if (this.distToCam < 40) this.game.effects.dust(this.pos, 5, 0.8);
    return true;
  }

  // Vault over something low and thin (up to ~1.3 m) when there's ground on the far side.
  _tryHurdle(dx, dz) {
    if ((this.hurdleCd || 0) > this.game.time) return false;
    const w = this.game.world;
    // probe a few spots just ahead (thin fences only show up close in)
    let top = -Infinity;
    for (const k of [0.15, 0.35, 0.6, 0.85]) top = Math.max(top, w.groundAt(this.pos.x + dx * (this.radius + k), this.pos.z + dz * (this.radius + k), this.pos.y + 1.5, 0.2));
    const rise = top - this.pos.y;
    if (rise < 0.35 || rise > 1.35) return false;
    // landing spot a little further on: roughly level with us and clear
    const lx = this.pos.x + dx * 2.2, lz = this.pos.z + dz * 2.2;
    const land = w.groundAt(lx, lz, this.pos.y + 0.6, 0.3);
    if (Math.abs(land - this.pos.y) > 0.9) return false;
    for (const c of w.colliders.query(lx - 0.35, lx + 0.35, lz - 0.35, lz + 0.35, _mq)) {
      if (c.kind === 'ramp' || c.kind === 'cone') continue;
      const over = c.kind === 'circle' ? Math.hypot(lx - c.x, lz - c.z) < c.r + 0.35
        : lx > c.minX - 0.35 && lx < c.maxX + 0.35 && lz > c.minZ - 0.35 && lz < c.maxZ + 0.35;
      if (over && c.y1 > land + 0.4 && c.y0 < land + 1.8) return false;
    }
    const sp = Math.max(7.5, Math.hypot(this.vel.x, this.vel.z));
    this.vel.set(dx * sp, 6.2 + rise * 1.5, dz * sp);
    this.onGround = false;
    this.pos.y += 0.05;
    this.hurdleCd = this.game.time + 0.5;
    this.rollT = 0;
    this.character.setPose('Jump_Start', null, 0.05, 1.8);
    this.game.sound?.play('jump', this.isPlayer ? null : this.pos);
    return true;
  }

  _updateMantle(dt) {
    this.mantleT -= dt;
    const dur = this.mantleDur || 0.34, hang = this.mantleHang || 0;
    const el = dur - Math.max(0, this.mantleT);
    if (el < hang) { this.pos.copy(this.mantleFrom); this.vel.set(0, 0, 0); return; } // hanging off the ledge
    if (hang && !this._pulling) { this._pulling = true; this.character.setPose('Jump_Start', null, 0.06, 1.6); }
    const k = Math.min(1, (el - hang) / (dur - hang));
    // up first, then over, eased so it reads as a push-up rather than a slide
    const e = (x) => x * x * (3 - 2 * x);
    const up = e(Math.min(1, k * 1.5)), over = e(Math.max(0, (k - 0.3) / 0.7));
    this.pos.set(
      this.mantleFrom.x + (this.mantleTo.x - this.mantleFrom.x) * over,
      this.mantleFrom.y + (this.mantleTo.y - this.mantleFrom.y) * up,
      this.mantleFrom.z + (this.mantleTo.z - this.mantleFrom.z) * over,
    );
    if (this.mantleT <= 0) {
      this.pos.copy(this.mantleTo); this.onGround = true; this.vel.set(0, 0, 0);
      this._pulling = false; this.mantleHang = 0;
      this.character.setPose('Jump_Land', null, 0.08, 1.8);
    }
  }

  // Wingsuit launch (uses one charge; 20 s cooldown between launches).
  startWingsuit() {
    if (this.state !== 'ground' || this.swimming) return false;
    if ((this.wingCd || 0) > this.game.time) { if (this.isPlayer) this.game.hud?.toast?.(`Wingsuit ready in ${Math.ceil(this.wingCd - this.game.time)} s`); return false; }
    this.wingCd = this.game.time + 20;
    this.setBuildMode?.(null);
    this.useT = 0;
    this.vel.set(this.vel.x * 0.5, 24, this.vel.z * 0.5);
    this.onGround = false;
    this.wingBoost = 0.9;
    this.setState('wing');
    this.game.sound?.play('launch', this.isPlayer ? null : this.pos);
    if (this.distToCam < 40) this.game.effects.dust(this.pos, 10, 1.6);
    return true;
  }

  // Rift-to-Go: warp up into the sky and skydive / glide from there.
  riftUp() {
    if (this.state !== 'ground') return;
    this.setBuildMode?.(null);
    this.useT = 0;
    this.game.effects.shieldBreak?.(this.chest(new THREE.Vector3()));
    this.pos.y = Math.max(this.pos.y + 55, this.game.world.heightAt(this.pos.x, this.pos.z) + 60);
    this.vel.set(0, 0, 0);
    this.onGround = false;
    this.noFallT = 10;
    this.setState('skydive');
  }

  // Grappler: fly in a straight line to a point.
  startGrapple(to) {
    if (this.state !== 'ground') return false;
    this.grapple = { to: to.clone(), t: 1.8 };
    this.onGround = false;
    this.crouched = false;
    this.slideT = 0;
    return true;
  }

  _updateGrapple(dt) {
    const g = this.grapple;
    g.t -= dt;
    const dx = g.to.x - this.pos.x, dy = g.to.y - this.pos.y - 0.4, dz = g.to.z - this.pos.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1.4 || g.t <= 0) {
      this.grapple = null;
      this.vel.multiplyScalar(0.35);
      this.vel.y = Math.max(this.vel.y, 6);
      this.noFallT = 3;
      return;
    }
    this.vel.set((dx / len) * 32, (dy / len) * 32, (dz / len) * 32);
    this.game.world.moveBody(this, dt, 0);
    // blocked by something on the way: let go
    if (Math.hypot(this.vel.x, this.vel.y, this.vel.z) < 4 && g.t < 1.6) g.t = 0;
  }

  // Launch pad: fly up and redeploy the glider.
  launch(vy = 40) {
    if (this.state !== 'ground') return;
    this.setBuildMode?.(null);
    this.useT = 0;
    this.crouched = false;
    this.vel.y = vy;
    this.onGround = false;
    this.launching = true;
    this.dropTarget?.set(this.pos.x + Math.sin(this.aimYaw) * 45, 0, this.pos.z + Math.cos(this.aimYaw) * 45);
    this.setState('skydive');
    this.pos.y += 0.3;
  }

  // Sliding into someone kicks them off their feet: knockback + a little damage.
  _slideKick() {
    for (const a of this.game.actors) {
      if (a === this || !a.alive || a.state !== 'ground' || a.hiddenIn) continue;
      const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, dy = a.pos.y - this.pos.y;
      const d = Math.hypot(dx, dz);
      if (d > 1.4 || Math.abs(dy) > 1.2 || (dx * this.slideDir.x + dz * this.slideDir.z) / (d || 1) < 0.3) continue;
      this.slideKicked = true;
      const kx = this.slideDir.x * 0.8 + (dx / (d || 1)) * 0.4, kz = this.slideDir.z * 0.8 + (dz / (d || 1)) * 0.4, kl = Math.hypot(kx, kz) || 1;
      a.vel.set((kx / kl) * 11, 5.5, (kz / kl) * 11);
      a.onGround = false;
      a.flungT = 0.6;
      a.slideT = 0;
      a.character?.setPose('Hit_A', null, 0.05, 1.4);
      const dealt = a.takeDamage(15, this, false);
      this.character.setPose('Unarmed_Melee_Attack_Kick', null, 0.05, 1.6);
      this.game.sound?.play('kick', a.pos, { range: 50 });
      if (this.isPlayer) {
        this.game.effects.damageNumber(a.chest(new THREE.Vector3()), dealt, false, false, a);
        this.game.hud?.hitMarker(false, !a.alive);
        this.game.rig.shake = Math.min(1, this.game.rig.shake + 0.35);
      }
      if (a.isPlayer) this.game.rig.shake = Math.min(1.2, this.game.rig.shake + 0.7);
      if (this.distToCam < 50) this.game.effects.dust(a.pos, 8, 1.4);
      // the kicker slows down on impact
      this.slideT = Math.min(this.slideT, 0.15);
      return;
    }
  }

  startSlide() {
    if (this.slideT > 0 || !this.onGround) return;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs < 4.2) return;
    this.slideT = SLIDE_TIME;
    this.powerSlide = !!this.held?.def?.sliders && (this.sliderHeat || 0) < 4.5;
    if (this.powerSlide) this.game.sound?.play('launch', this.isPlayer ? null : this.pos, { vol: 0.4 });
    this.slideKicked = false;
    this.slideDir.set(this.vel.x / hs, 0, this.vel.z / hs);
    this.crouched = true;
    this.game.sound?.play('slide', this.isPlayer ? null : this.pos);
    if (this.distToCam < 40) this.game.effects.dust(this.pos, 6, 1.2);
  }

  // Eye/chest height helpers
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.15, this.pos.z); }

  spawnGround(x, z) {
    this.pos.set(x, this.game.world.heightAt(x, z) + 0.1, z);
    this.vel.set(0, 0, 0);
    this.setState('ground');
  }

  setState(s) {
    this.state = s;
    this.glider.visible = s === 'glide';
    if (s === 'glide') this.glideStart = this.game.time;
    this.root.visible = s !== 'bus';
    this.character.model.rotation.x = 0;
    this.character.armPose = s === 'skydive' ? 'spread' : s === 'glide' ? 'glide' : null; // Fortnite-style sky poses
    if (s === 'dead') this.character.setPose('Death_A', null, 0.15);
    else if (s === 'skydive' || s === 'glide') this.character.setPose('Jump_Idle', null, 0.25);
  }

  jumpFromBus(busPos, busVel) {
    this.pos.copy(busPos);
    this.pos.y -= 2;
    this.vel.set(busVel.x * 0.5, -4, busVel.z * 0.5);
    this.setState('skydive');
  }

  // falling from high enough (a cliff, a tall build, a launch) to open the glider again
  canRedeploy() { return this.state === 'ground' && !this.onGround && !this.swimming && this.vel.y < (this.game.zeroBuild ? -1 : -4) && this.heightAboveGround() > (this.game.zeroBuild ? 7 : REDEPLOY_HEIGHT); }

  // Sparkles while using an item: blue at the mouth for drinks, green around the chest for heals.
  _useFx(dt, drink) {
    this._useFxT = (this._useFxT || 0) - dt;
    if (this._useFxT > 0) return;
    this._useFxT = 0.07;
    const fx = this.game.effects;
    const c = _useCol.set(drink ? (this.useItem.def.color || '#4aa8ff') : '#7dffb2');
    const y = this.pos.y + (drink ? 1.62 : 1.05), f = drink ? 0.18 : 0.05;
    const x = this.pos.x + Math.sin(this.bodyYaw) * f, z = this.pos.z + Math.cos(this.bodyYaw) * f;
    for (let i = 0; i < 2; i++) fx.sparks.emit(x + (Math.random() - 0.5) * 0.35, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6, c, 0.55, 0.1, 0);
  }

  heightAboveGround() { return this.pos.y - this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y); }

  // Cosmetics: a hat (from the skin) and a back bling.
  applyGear({ hat = null, backbling = null } = {}) {
    if (hat) this.hat = attachHat(this.character, hat);
    if (backbling) this.backBling = attachBackBling(this.character, backbling);
  }

  // Put the Victory Crown on (or take it off): a gold crown on the head bone.
  // count: crowned wins so far (Fortnite stacks it over the crown)
  setCrown(on, count = null) {
    this.crowned = on;
    if (on && count) this.crownCount = count;
    if (on && !this.crownMesh) {
      const c = makeCrownMesh();
      const ch = this.character;
      c.position.copy(headAnchor(ch, this.hat ? 0.12 : -0.08));
      ch.root.add(c);
      ch.root.updateMatrixWorld(true);
      if (ch.head) ch.head.attach(c);
      this.crownMesh = c;
    }
    if (this.crownMesh) this.crownMesh.visible = on;
    if (on && this.crownCount && this.crownMesh && this._crownLabelN !== this.crownCount) {
      this._crownLabelN = this.crownCount;
      if (this._crownLabel) this.crownMesh.remove(this._crownLabel);
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
      const x = cv.getContext('2d');
      x.font = '900 44px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.lineWidth = 6;
      x.strokeStyle = '#5a3a00'; x.strokeText(`×${this.crownCount}`, 64, 48);
      x.fillStyle = '#ffd23f'; x.fillText(`×${this.crownCount}`, 64, 48);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(0.5, 0.25, 1); spr.position.y = 0.45;
      this.crownMesh.add(spr);
      this._crownLabel = spr;
    }
  }

  // Medallion perks that tick: shield / health regeneration after a few seconds without damage.
  _tickMedallions(dt) {
    const m = this.medallions;
    if (!m.size || !this.alive) return;
    const calm = this.game.time - this.lastHurtTime > 3;
    if (m.has('shield') && calm && this.shield < 100) this.shield = Math.min(100, this.shield + 5 * dt);
    if (m.has('bloom') && calm && this.health < 100) this.health = Math.min(100, this.health + 4 * dt);
  }

  // Slurp-style regeneration: health first, then shield.
  _tickRegen(dt) {
    const r = this.regen;
    if (!r || !this.alive) return;
    r.acc += r.rate * dt;
    while (r.acc >= 1 && r.left > 0) {
      r.acc -= 1; r.left--;
      if (r.only) {
        // Med Kit / Shield Potion over time: just the one bar, up to the item's cap
        const k = r.only;
        if (this[k] >= r.cap) { r.left = 0; break; }
        this[k] = Math.min(r.cap, this[k] + 1);
      } else if (r.both) {
        // Slurp: health and shield together
        if (this.health >= 100 && this.shield >= 100) r.left = 0;
        this.health = Math.min(100, this.health + 1); this.shield = Math.min(100, this.shield + 1);
      } else if (this.health < 100) this.health = Math.min(100, this.health + 1); // health can be fractional: never past 100
      else if (this.shield < 100) this.shield = Math.min(100, this.shield + 1);
      else r.left = 0;
    }
    if (r.left <= 0) this.regen = null;
  }

  updateMovement(dt) {
    this._tickRegen(dt);
    this._tickMedallions(dt);
    if (this.game.zeroBuild && this.alive && this.overshield < OVERSHIELD && this.game.time - this.lastHurtTime > 6) this.overshield = Math.min(OVERSHIELD, this.overshield + 12 * dt);
    const world = this.game.world;
    const it = this.intent;
    if (this.noFallT > 0) this.noFallT -= dt;
    if (this.state === 'bus' || this.state === 'dead') {
      if (this.state === 'dead') {
        this.vel.x = this.vel.z = 0;
        world.moveBody(this, dt);
      }
      return;
    }
    if (this.state === 'ground' && this.mantleT > 0) { this._updateMantle(dt); return; }
    if (this.state === 'ground' && this.grapple) { this._updateGrapple(dt); return; }
    const trav = this.game.world.traversal;
    if (this.state === 'ground' && (this.zip || this.asc) && trav.ride(this, dt, it)) return;
    if (this.hiddenIn) { this.vel.set(0, 0, 0); this.sprinting = false; return; }
    if (this.splatT > 0) { this.splatT -= dt; this.vel.x = this.vel.z = 0; this.sprinting = false; world.moveBody(this, dt); return; }
    if (this.state === 'ground') {
      const mlen = Math.hypot(it.mx, it.mz);
      if (this.emote && (mlen > 0.2 || it.jump || this.slideT > 0)) this.emote = null;
      // sprint only when moving roughly forward and not busy
      const fwdDot = mlen > 0.1 ? (it.mx * Math.sin(this.aimYaw) + it.mz * Math.cos(this.aimYaw)) / mlen : 0;
      this.sprinting = !!it.sprint && !this.crouched && this.useT <= 0 && mlen > 0.3 && (fwdDot > 0.3 || !this.aiming) && !this.aiming;
      // tactical sprint burns stamina; it refills after a short breather
      this.tacSprint = this.sprinting && this.stamina > 0 && this.onGround;
      if (this.tacSprint) { if (!this.medallions.has('surge') && !(this.slapT > 0) && !this.game.overrides?.has('stamina')) this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * dt); this.staminaIdle = 0; }
      else if ((this.staminaIdle += dt) > 0.8) this.stamina = Math.min(100, this.stamina + STAMINA_REGEN * dt);
      let speed = this.sprinting ? (this.tacSprint ? TAC_SPRINT_SPEED : SPRINT_SPEED) * (this.game.overrides?.has('sonic') ? 1.2 : 1) : this.crouched ? CROUCH_SPEED : RUN_SPEED;
      if (this.useT > 0 && !this.useItem?.def.mobile) speed = Math.min(speed, 3.2);
      if (this.aiming && this.weapon && !this.swimming) speed *= this.weapon.def.scope ? 0.55 : 0.7; // ADS walks slower
      if (this.weapon?.def.heavy) speed *= 0.88; // the minigun is heavy
      if (this.speedT > 0) { this.speedT -= dt; speed *= 1.2; } // peppers, spicy food
      if (this.slapT > 0) this.slapT -= dt;
      if (this.swimming) {
        // swimming: steady strokes, a bit faster when "sprinting"; no crouch / slide
        speed = it.sprint ? 5.8 : 4.4;
        this.crouched = false; if (!this.powerSlide) this.slideT = 0; this.sprinting = false; this.tacSprint = false;
        if (!this._wasSwimming) { this.setBuildMode?.(null); if (this.distToCam < 40) this.game.effects.dust(this.pos, 8, 1.2); }
        this.stamina = Math.min(100, this.stamina + STAMINA_REGEN * 1.5 * dt); // swimming refills stamina
      } else if (this.inWater) speed *= 0.65;
      this._wasSwimming = this.swimming;
      // flung by a shockwave: keep the momentum instead of braking in the air
      if (this.flungT > 0) this.flungT -= dt;
      const k = this.onGround ? 14 : this.flungT > 0 ? 0.35 : 3;
      if (this.slideT > 0) {
        this.slideT -= dt;
        let sp = 3 + 9 * Math.max(0, this.slideT / SLIDE_TIME);
        // Seven Sliders: jet-powered slide while you keep sprinting, until the boots overheat
        if (this.powerSlide) {
          this.sliderHeat = (this.sliderHeat || 0) + dt;
          if (it.sprint && this.sliderHeat < 5 && this.held?.def?.sliders) { this.slideT = Math.max(this.slideT, 0.2); sp = 16; if (Math.hypot(it.mx, it.mz) > 0.3) { const l = Math.hypot(it.mx, it.mz); this.slideDir.x = damp(this.slideDir.x, it.mx / l, 3, dt); this.slideDir.z = damp(this.slideDir.z, it.mz / l, 3, dt); } if (this.distToCam < 40 && Math.random() < 0.5) this.game.effects.dust(this.pos, 1, 0.4); }
          else { if (this.sliderHeat >= 5 && this.isPlayer) this.game.hud?.toast?.('Seven Sliders overheated'); this.powerSlide = false; }
        }
        // sliding downhill keeps going (and speeds up) for as long as the slope lasts
        const drop = world.heightAt(this.pos.x, this.pos.z) - world.heightAt(this.pos.x + this.slideDir.x * 1.5, this.pos.z + this.slideDir.z * 1.5);
        if (drop > 0.2 && this.onGround && !this.swimming) { this.slideT = Math.max(this.slideT, 0.3); sp = Math.max(sp, Math.min(14, 9 + drop * 3)); }
        this.vel.x = this.slideDir.x * sp;
        this.vel.z = this.slideDir.z * sp;
        if (this.slideT <= 0 && !this.crouchHeld) this.crouched = false;
        if (!this.slideKicked && sp > 6) this._slideKick();
      } else {
        if (!this.powerSlide && this.sliderHeat > 0) this.sliderHeat = Math.max(0, this.sliderHeat - dt * (this.swimming || this.inWater ? 3 : 1));
        this.vel.x = damp(this.vel.x, it.mx * speed, k, dt);
        this.vel.z = damp(this.vel.z, it.mz * speed, k, dt);
      }
      // ladders: walk into one to climb
      if (trav.ladders.length && trav.climb(this, it, dt)) return;
      // mantle onto ledges: jumping into something waist-to-head high, or reaching one mid-air
      if (mlen > 0.3 && this.slideT <= 0 && ((it.jump && this.onGround) || (!this.onGround && this.vel.y < 4)) && this._tryMantle(it.mx / mlen, it.mz / mlen)) return;
      // mid-air jump press next to a wall: kick off it
      if (this.onGround) this.wallJumps = 0;
      else if (it.jumpPress && !this.swimming && !(it.redeploy && this.canRedeploy()) && this._tryWallJump(it)) return;
      if (it.jump && this.onGround) {
        this.crouched = false;
        this.crouchHeld = false;
        this.slideT = 0;
        this.vel.y = JUMP_VEL;
        this.onGround = false;
        const hsp = Math.hypot(this.vel.x, this.vel.z);
        if (this.swimming && hsp > 2) {
          // dolphin dive: leap forward out of the water
          this.vel.x *= 1.5; this.vel.z *= 1.5; this.vel.y = JUMP_VEL * 0.8; this.flungT = 0.5;
        } else if (this.sprinting && hsp > 6) {
          // Ledge Jump: sprinting off the very edge of a drop sends you further, with more hang time
          const ex = this.pos.x + (this.vel.x / hsp) * 1.6, ez = this.pos.z + (this.vel.z / hsp) * 1.6;
          if (this.pos.y - world.groundAt(ex, ez, this.pos.y, 0.3) > 2.5) {
            this.vel.x *= 1.35; this.vel.z *= 1.35; this.vel.y = JUMP_VEL * 1.12;
            this.flungT = 0.8; this.floatT = 0.7;
          }
        }
        this.character.setPose('Jump_Start', null, 0.08, 1.6);
        this.jumpT = 0;
        this.game.sound?.play('jump', this.pos);
      }
      if (it.redeploy && this.canRedeploy()) { this.setState('glide'); this.game.sound?.play('glider', this.isPlayer ? null : this.pos); return; }

      const wasGround = this.onGround;
      if (this.floatT > 0) this.floatT -= dt;
      // Flowberry Fizz: low gravity, and falls don't hurt while it lasts
      if (this.lowGravT > 0) { this.lowGravT -= dt; this.noFallT = Math.max(this.noFallT || 0, 0.6); }
      world.moveBody(this, dt, this.floatT > 0 && this.vel.y < 3 ? 0.55 : this.lowGravT > 0 ? 0.42 : 1);
      if (this.onGround) this.scrambles = 0;
      if (this.onGround && !wasGround && this.landSpeed > 7) {
        this.onHardLanding?.(this.landSpeed);
        // Roll Landing: hold or tap Jump just before landing to roll out of it, keep your speed and
        // get some stamina back (bots roll automatically on big drops)
        const wantRoll = this.isPlayer ? it.rollReady : this.landSpeed > 11;
        if (wantRoll && this.landSpeed > 9 && Math.hypot(this.vel.x, this.vel.z) > 2) {
          this.rollT = 0.5; this.character.setPose('Dodge_Forward', null, 0.06, 1.3);
          this.stamina = Math.min(100, this.stamina + 16);
        }
        if (this.landSpeed > FALL_SAFE && !(this.noFallT > 0) && !this.game.events?.softLanding?.(this.pos)) this.fallDamage(fallDamageFor(this.landSpeed));
      }
      // shoulder bash: sprint, slide or roll into a closed door to burst through it
      this._bashCheck(dt);
      // sprinting into something low (fence, crate, rail): hurdle over it
      if (this.sprinting && this.blocked && this.onGround && mlen > 0.3) this._tryHurdle(it.mx / mlen, it.mz / mlen);
      // footsteps
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (this.onGround && hs > 1.2 && this.slideT <= 0 && !this.swimming) {
        this._stepDist += hs * dt;
        const stepLen = this.crouched ? 1.1 : this.sprinting ? 2.4 : hs > 4 ? 1.9 : 1.3;
        if (this._stepDist > stepLen) {
          this._stepDist = 0;
          // crouch-walking is much quieter (and only heard up close)
          const v = this.crouched ? 0.35 : this.sprinting ? 1.1 : 0.8;
          if (this.isPlayer) this.game.sound?.play('step', null, { vol: this.crouched ? 0.08 : this.sprinting ? 0.35 : 0.22, surface: this.surface() });
          else if (this.distToCam < (this.crouched ? 15 : 45)) this.game.sound?.play('step', this.pos, { range: this.crouched ? 15 : 45, vol: v, surface: this.distToCam < 25 ? this.surface() : 'grass' });
        }
      }
      // dust puffs while running (only near the camera)
      if (this.onGround && this.distToCam < 35 && Math.hypot(this.vel.x, this.vel.z) > 4.5) {
        this._dustT = (this._dustT || 0) - dt;
        if (this._dustT <= 0) { this._dustT = 0.22; this.game.effects.dust(this.pos, 1, 0.6); }
      }
    } else if (this.state === 'skydive' && this.launching) {
      // launch pad arc: real gravity until the top, then the glider opens
      this.vel.x = damp(this.vel.x, it.mx * 10, 2, dt);
      this.vel.z = damp(this.vel.z, it.mz * 10, 2, dt);
      world.moveBody(this, dt, 1);
      if (this.vel.y < 2) { this.launching = false; this.setState('glide'); }
      if (this.onGround) { this.launching = false; this.land(); }
    } else if (this.state === 'skydive') {
      // skydiving from the high bus: steer ~24 m/s sideways (about 400 m from the bus line in all)
      const hs = 24;
      this.vel.x = damp(this.vel.x, it.mx * hs, 2.2, dt);
      this.vel.z = damp(this.vel.z, it.mz * hs, 2.2, dt);
      // look straight down to dive faster
      const down = Math.max(0, Math.min(1, -(this.aimPitch || 0) / 1.2));
      const dive = (Math.hypot(it.mx, it.mz) > 0.1 ? -21 : -26) - down * 18;
      this.vel.y = damp(this.vel.y, dive, 1.5, dt);
      world.moveBody(this, dt, 0);
      const hag = this.heightAboveGround();
      if (hag < GLIDE_HEIGHT || it.deploy) this.setState('glide');
      if (this.onGround) this.land();
    } else if (this.state === 'wing') {
      // Wingsuit: a short boost up, then fly where you look. Diving builds speed, pulling up trades
      // it for height; landing never hurts.
      if (this.wingBoost > 0) { this.wingBoost -= dt; world.moveBody(this, dt, 1); if (this.onGround) { this.land(); return; } if (this.wingBoost > 0) return; this.wingSpeed = 16; }
      const pch = Math.max(-1.3, Math.min(0.45, this.aimPitch || 0)), yaw = this.aimYaw;
      this.wingSpeed = Math.max(9, Math.min(48, (this.wingSpeed || 16) + (-Math.sin(pch) * 20 - 0.01 * this.wingSpeed * this.wingSpeed + 3) * dt));
      const cp = Math.cos(pch);
      this.vel.set(Math.sin(yaw) * cp * this.wingSpeed, Math.sin(pch) * this.wingSpeed - 2.5, Math.cos(yaw) * cp * this.wingSpeed);
      this.bodyYaw = yaw;
      world.moveBody(this, dt, 0);
      this.noFallT = 3;
      if (this.onGround) this.land();
      else if (it.jumpPress) { this.setState('glide'); }
    } else if (this.state === 'glide') {
      const hs = 14;
      this.vel.x = damp(this.vel.x, it.mx * hs, 2.5, dt);
      this.vel.z = damp(this.vel.z, it.mz * hs, 2.5, dt);
      this.vel.y = damp(this.vel.y, -6.5, 3, dt);
      world.moveBody(this, dt, 0);
      if (this.onGround) this.land();
      // Zero Build: cut the glider (jump) and free-fall; you can redeploy whenever you're high enough
      else if (this.game.zeroBuild && it.jumpPress && this.game.time - (this.glideStart || 0) > 0.4) { this.setState('ground'); this.onGround = false; this.character.setPose('Jump_Idle', null, 0.2); }
    }
  }

  fallDamage(dmg) {
    if (!this.alive || dmg <= 0) return;
    this.health -= dmg;
    this.lastHurtTime = this.game.time;
    this.flashT = 0.25;
    this.game.sound?.play('fall', this.isPlayer ? null : this.pos);
    if (this.isPlayer) { this.game.hud.hurt(); this.game.effects.damageNumber(this.chest(new THREE.Vector3()), dmg, false, false); }
    if (this.health <= 0) {
      // like Fortnite, a big enough fall eliminates you
      this.health = 0; this.deathCause = 'fall'; this.die(null);
    }
  }

  // Sprinting, sliding or rolling into a closed door bashes it open (once per sprint).
  _bashCheck(dt) {
    const moving = (this.sprinting && this.onGround) || this.slideT > 0 || this.rollT > 0;
    if (!moving) { this.bashed = false; return; }
    if (this.bashed || (this._bashT = (this._bashT || 0) - dt) > 0) return;
    this._bashT = 0.1;
    const H = this.game.homes;
    const d = H?.nearestDoor(this.pos, 1.5);
    if (!d || d.open || d.broken) return;
    const c = H._doorCenter(d), hs = Math.hypot(this.vel.x, this.vel.z) || 1;
    if (((c.x - this.pos.x) * this.vel.x + (c.z - this.pos.z) * this.vel.z) / (hs * (Math.hypot(c.x - this.pos.x, c.z - this.pos.z) || 1)) < 0.4) return;
    H.setDoor(d, true);
    this.bashed = true;
    this.game.sound?.play('break', this.isPlayer ? null : this.pos, { vol: 0.5 });
    if (this.isPlayer) this.game.rig.shake = Math.min(1, (this.game.rig.shake || 0) + 0.25);
    // anyone right behind the door gets shoved back (no damage)
    for (const a of this.game.actors) {
      if (a === this || !a.alive || a.state !== 'ground') continue;
      const dx = a.pos.x - c.x, dz = a.pos.z - c.z, dd = Math.hypot(dx, dz);
      if (dd < 1.6 && dd > 0.01) { a.vel.x += (dx / dd) * 7; a.vel.z += (dz / dd) * 7; a.vel.y = Math.max(a.vel.y, 3); a.flungT = 0.3; }
    }
  }

  onHardLanding(speed) {
    if (this.distToCam < 50) this.game.effects.dust(this.pos, Math.min(14, Math.round(speed * 0.8)), 1.8);
    if (this.isPlayer) this.game.rig.bob = Math.min(0.55, speed * 0.03);
  }

  land() {
    this.onHardLanding(12);
    this.setState('ground');
    this.vel.y = 0;
    this.character.setPose('Jump_Land', null, 0.1, 1.3);
    this.landT = 0.25;
    this.onLanded?.();
  }

  updateVisual(dt, camPos) {
    const ch = this.character;
    this.distToCam = camPos ? this.pos.distanceTo(camPos) : 0;
    this.root.position.copy(this.pos);
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const emoting = !!this.emote && this.state === 'ground' && this.alive && !this.victory;
    const armed = !!this.weapon && this.state === 'ground' && this.alive && !this.victory && !this.sprinting && this.slideT <= 0 && !emoting;
    const held = this.held;
    this.swingT = Math.max(0, this.swingT - dt);
    this.crouchAmt = damp(this.crouchAmt, this.crouched && this.state === 'ground' ? 1 : 0, 12, dt);
    const combat = armed && (this.game.time - this.lastFireTime < 1.5 || this.aiming);
    const w = this.weapon;
    const hand = w && w.type === 'pistol' ? '1H' : '2H';
    const firing = this.game.time - this.lastFireTime < 0.25;
    let upperArmed = !armed ? null : w.reloading ? `${hand}_Ranged_Reload` : firing ? `${hand}_Ranged_Shooting` : `${hand}_Ranged_Aiming`;
    // using a consumable: drink it (shields) or patch up (heals); the outfit characters have real
    // drinking / kneeling animations, the KayKit heroes use their one "use item" clip
    const useDef = this.useT > 0 ? this.useItem?.def : null;
    const drink = !!useDef && (!!useDef.shield || !!useDef.overTime || !!useDef.mobile);
    if (useDef) upperArmed = ch.q ? (drink ? 'Consume' : 'Fixing_Kneeling') : 'Use_Item';
    if (useDef && this.distToCam < 40) this._useFx(dt, drink);
    else if (held && held.isPickaxe && this.swingT > 0) upperArmed = '1H_Melee_Attack_Chop';
    if (this.state === 'ground') {
      let targetYaw = this.bodyYaw;
      if (combat) targetYaw = this.aimYaw;
      else if (hspeed > 0.6) targetYaw = Math.atan2(this.vel.x, this.vel.z);
      else if (armed) targetYaw = this.aimYaw;
      this.bodyYaw = dampAngle(this.bodyYaw, targetYaw, combat ? 25 : 12, dt);
      this.airT = this.onGround ? 0 : (this.airT || 0) + dt;
      if (this.victory) ch.setPose(this.victoryEmote || 'Cheer', null, 0.3);
      else if (emoting) ch.setPose(this.emote, null, 0.25);
      else if (!this.alive) { /* death pose set in setState */ }
      else if (this.rollT > 0) { this.rollT -= dt; ch.setPose('Dodge_Forward', null, 0.06, 1.3); }
      else if (this.airT > 0.12 && this.vel.y > -25) {
        ch.setPose('Jump_Idle', upperArmed, 0.15);
        this._wasAir = this.airT > 0.35;
      } else if (this.landT > 0) {
        this.landT -= dt;
      } else if (this.slideT > 0) {
        ch.setPose('Jump_Idle', null, 0.12);
      } else if (this.sprinting && hspeed > 3) {
        ch.setPose('Running_B', upperArmed, 0.15, Math.min(1.4, hspeed / SPRINT_SPEED * 1.15));
      } else if (hspeed > 0.5) {
        // direction of travel relative to where the body faces
        const fx = Math.sin(this.bodyYaw), fz = Math.cos(this.bodyYaw);
        const fwd = (this.vel.x * fx + this.vel.z * fz) / hspeed;
        const right = (this.vel.x * -fz + this.vel.z * fx) / hspeed;
        const rate = Math.min(1.5, Math.max(0.6, hspeed / RUN_SPEED));
        let lower;
        if (hspeed < 3 || this.crouched) lower = fwd > -0.5 ? 'Walking_A' : 'Walking_Backwards';
        else if (fwd > 0.55) lower = 'Running_A';
        else if (fwd < -0.55) lower = 'Walking_Backwards';
        else lower = right > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
        ch.setPose(lower, upperArmed, 0.18, lower === 'Walking_Backwards' ? rate * 1.4 : rate);
      } else {
        // standing still with bandages / a medkit: kneel down for it
        if (useDef && ch.q && !drink) ch.setPose('Fixing_Kneeling', null, 0.25);
        else ch.setPose(armed ? `${hand}_Ranged_Aiming` : 'Idle', upperArmed, 0.2);
      }
      if (this.onGround && this._wasAir) { this._wasAir = false; this.landT = 0.2; ch.setPose('Jump_Land', upperArmed, 0.08, 1.4); }
      // swimming: a forward-leaning stroke when moving, upright treading water when still
      if (this.swimming && this.alive && !emoting && !this.victory) {
        const moving = hspeed > 1;
        ch.setPose(moving ? 'Running_A' : 'Jump_Idle', null, 0.25, moving ? 0.75 : 0.6);
        ch.model.rotation.x = damp(ch.model.rotation.x, moving ? 1.05 : 0.15, 6, dt);
        ch.model.position.y = damp(ch.model.position.y, ch.footOffset + (moving ? 0.62 : 0.15) + Math.sin(this.game.time * 3 + this.pos.x) * 0.05, 6, dt);
        if (moving && this.distToCam < 35) {
          this._splashT = (this._splashT || 0) - dt;
          if (this._splashT <= 0) { this._splashT = 0.12; _sc.setRGB(0.85, 0.95, 1); this.game.effects.debris.emit(this.pos.x + (Math.random() - 0.5), 0.05, this.pos.z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2, _sc, 0.5, 0.18, 9, 0.8); }
        }
      } else ch.model.rotation.x = damp(ch.model.rotation.x, this.slideT > 0 ? -0.75 : 0, 10, dt);
    } else if (this.state === 'wing') {
      ch.setPose('Jump_Idle', null, 0.3);
      ch.model.rotation.x = damp(ch.model.rotation.x, 1.35 - Math.max(-0.6, Math.min(0.6, this.aimPitch || 0)) * 0.5, 5, dt);
      ch.model.position.y = damp(ch.model.position.y, 0.9, 4, dt);
    } else if (this.state === 'skydive') {
      if (hspeed > 1) this.bodyYaw = dampAngle(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z), 4, dt);
      ch.setPose('Jump_Idle', null, 0.3);
      ch.model.rotation.x = damp(ch.model.rotation.x, 1.25, 4, dt);
      ch.model.position.y = damp(ch.model.position.y, 0.9, 4, dt);
    } else if (this.state === 'glide') {
      if (hspeed > 1) this.bodyYaw = dampAngle(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z), 4, dt);
      ch.setPose('Jump_Idle', null, 0.3);
      ch.model.rotation.x = damp(ch.model.rotation.x, 0.2, 4, dt);
      ch.model.position.y = damp(ch.model.position.y, ch.footOffset, 4, dt);
      this.glider.rotation.z = Math.sin(this.game.time * 1.3) * 0.05;
    }
    if ((this.state === 'skydive' || this.state === 'glide' || this.state === 'wing') && this.trail && this.distToCam < 90) this._emitTrail();
    if (this.state === 'dead' && this.beamT > 0) {
      this.beamT -= dt;
      const k = Math.max(0, this.beamT / 1.1);
      const s = this.npc === 'boss' ? 1.3 : 1;
      this.root.scale.set(s * (0.3 + 0.7 * k), s * (1 + (1 - k) * 0.6), s * (0.3 + 0.7 * k));
      ch.flash((1 - k) * 1.5);
      if (this.beamT <= 0) { this.root.visible = false; this.root.scale.setScalar(s); ch.flash(0); this.hiddenCorpse = true; }
    }
    if ((this.state === 'ground' && !this.swimming) || this.state === 'dead') ch.model.position.y = damp(ch.model.position.y, ch.footOffset - this.crouchAmt * 0.3 - (this.slideT > 0 ? 0.25 : 0), 10, dt);
    this.root.rotation.y = this.bodyYaw;

    // Damage flash
    if (this.flashT > 0) { this.flashT -= dt; ch.flash(Math.max(0, this.flashT) * 2.5); if (this.flashT <= 0) ch.flash(0); }

    // LOD: off-screen / far characters are hidden and skip animation; the rest animate at a
    // rate that drops with distance (keeps 100 players affordable).
    const d = this.distToCam;
    if (this.hiddenIn) { this.root.visible = false; return; }
    if (!this.isPlayer && this.state !== 'bus') {
      _sph.center.set(this.pos.x, this.pos.y + 1, this.pos.z);
      const visible = !this.hiddenCorpse && d < 300 && (!this.game.frustum || this.game.frustum.intersectsSphere(_sph));
      this.root.visible = visible;
      if (!visible) { this._animAcc = Math.min(0.2, this._animAcc + dt); return; }
    }
    this._animAcc += dt;
    const every = d > 180 ? 0.16 : d > 100 ? 0.1 : d > 45 ? 0.05 : 0;
    if (this._animAcc >= every) {
      const pitch = this.state === 'ground' ? this.aimPitch : 0;
      ch.update(this._animAcc, pitch, armed, this.crouchAmt);
      this._animAcc = 0;
    }
  }

  // --- inventory ---
  giveWeapon(weapon, slot = -1) {
    if (slot < 0) slot = this.items.findIndex((it, i) => i > 0 && !it);
    if (slot < 1) slot = this.slot > 0 ? this.slot : 1;
    const old = this.items[slot];
    this.items[slot] = weapon;
    if (slot === this.slot) this._equip();
    return old;
  }

  switchSlot(i) {
    if (i < 0 || i > 5) return false;
    if (this.buildMode) { this.buildMode = null; if (i === this.slot) { this._equip(); return true; } }
    if (i === this.slot) return false;
    const prev = this.weapon;
    prev?.cancelReload();
    this.useT = 0;
    this.slot = i;
    // draw time; switching from a shotgun you just fired to another shotgun costs extra (no double pumping)
    const w = this.weapon;
    if (w) {
      const shotgun = (x) => x && (x.def.key === 'pump' || x.def.key === 'shotgun');
      const penalty = shotgun(w) && shotgun(prev) && this.game.time - prev.lastShot < 1 ? 0.6 : 0;
      w.drawT = Math.max(w.drawT, (w.def.draw || 0.3) * (w.mods?.under === 'angled' ? 0.6 : 1) + penalty);
    }
    this._equip();
    return true;
  }

  // Enter/leave build mode (hands are empty while building).
  setBuildMode(piece) {
    if (piece === this.buildMode) return;
    const was = this.buildMode;
    this.buildMode = piece;
    if (piece && !was) { this.weapon?.cancelReload(); this.useT = 0; }
    if (!!piece !== !!was) this._equip();
  }

  _equip() {
    const h = this.held;
    if (this.buildMode) this.character.setWeapon(null);
    else if (h && h.isGun) this.character.setWeapon(applyWrap(makeWeaponMesh(h.type, h.rarity, h.mods), this.wrap));
    else if (h && h.isPickaxe) this.character.setWeapon(makeHarvestTool(this.pickaxeSkin), true);
    else if (h?.def?.throw) this.character.setWeapon(makeThrowableMesh(h.type, 1.2));
    else if (h?.isConsumable && !h.def.key) {
      // heals / placeables: hold the actual item
      const m = makeConsumableMesh(h.type);
      if (m) { m.scale.multiplyScalar(0.55); m.userData.muzzle = new THREE.Vector3(); m.userData.foregrip = 0; }
      this.character.setWeapon(m);
    }
    else this.character.setWeapon(null);
  }

  muzzleWorld(out = new THREE.Vector3()) {
    const m = this.character.weaponMesh;
    if (!m) return this.chest(out);
    return m.localToWorld(out.copy(m.userData.muzzle));
  }

  // --- combat state ---
  takeDamage(amount, attacker, headshot = false) {
    if (!this.alive) return 0;
    // hired NPCs and the player who hired them can't hurt each other
    if (attacker && (attacker.hiredBy === this || this.hiredBy === attacker)) return 0;
    this._shieldWas = this.shield;
    let dmg = amount;
    // Zero Build overshield soaks damage first and regenerates on its own
    if (this.overshield > 0) {
      const o = Math.min(this.overshield, dmg);
      this.overshield -= o;
      dmg -= o;
    }
    if (this.shield > 0) {
      const s = Math.min(this.shield, dmg);
      this.shield -= s;
      dmg -= s;
    }
    this.health -= dmg;
    this.lastHurtTime = this.game.time;
    this.lastAttacker = attacker;
    if (attacker && attacker !== this && !this.npc) attacker.dmgDealt = (attacker.dmgDealt || 0) + amount;
    this.flashT = 0.25;
    if (attacker?.isPlayer && attacker !== this) {
      this.game.meta?.track('damage', amount);
      // you broke their shield: glassy crack + blue shards
      if (this._shieldWas > 0 && this.shield <= 0) {
        this.game.sound.play('shieldBreak');
        this.game.effects.shieldBreak?.(this.chest(new THREE.Vector3()));
      }
    }
    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker);
    }
    this.onDamaged?.(amount, attacker, headshot);
    return amount;
  }

  // Cosmetic contrail: particles streaming from both hands while skydiving / gliding.
  _emitTrail() {
    const fx = this.game.effects;
    const t = this.trail;
    const s = Math.sin(this.bodyYaw), c = Math.cos(this.bodyYaw);
    for (const side of [-1, 1]) {
      const x = this.pos.x + c * 0.55 * side, z = this.pos.z - s * 0.55 * side;
      if (t === 'rainbow') _tc.setHSL((this.game.time * 0.5 + side * 0.1) % 1, 1, 0.45);
      else _tc.set(t[Math.random() < 0.5 ? 0 : 1]);
      fx.sparks.emit(x, this.pos.y + 1.1, z, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, _tc, 0.9, 0.16, 0);
    }
  }

  // Warm-up respawn: back on your feet somewhere else with a fresh loadout slot.
  // Drop anything we were in the middle of (ziplines, ascenders, grapples, mantles, splats).
  _clearMoves() {
    this.zip = null; this.asc = null; this.grapple = null;
    this.mantleT = 0; this.splatT = 0; this.slideT = 0; this.autoRun = null;
  }

  revive(x, z) {
    this._clearMoves();
    this.alive = true;
    this.beamT = 0;
    if (this.hiddenCorpse) { this.hiddenCorpse = false; this.root.visible = true; }
    this.health = 100;
    this.shield = 0;
    this.overshield = this.game.zeroBuild ? OVERSHIELD : 0;
    this.killer = null;
    this.deathCause = null;
    this.useT = 0;
    this.emote = null;
    this.spawnGround(x, z);
    this.character.setPose('Idle', null, 0);
  }

  die(killer) {
    if (!this.alive) return;
    if (this.hiddenIn) this.game.events?.unhide(this);
    this._clearMoves();
    // 1-Up Token: the elimination counts, but you redeploy from the sky with everything you carried
    const g = this.game;
    const tok = g.warmup <= 0 && g.mode !== 'arena' && !this.npc ? (this.extraLife ? 99 : this.items.findIndex((it) => it?.def?.oneup)) : -1;
    if (tok > 0) {
      if (tok === 99) this.extraLife = false; // Extra Life override
      else { this.items[tok] = null; if (tok === this.slot) this.switchSlot(0); }
      if (killer && killer !== this) { killer.kills++; g.hud?.killFeed?.(killer, this); }
      this.health = 100; this.shield = 0; this.regen = null; this.useT = 0;
      this.setBuildMode?.(null);
      const c = g.storm.safeCenter(), r = Math.max(5, g.storm.safeRadius() * 0.6), a = Math.random() * Math.PI * 2;
      const x = c.x + Math.cos(a) * Math.random() * r, z = c.y + Math.sin(a) * Math.random() * r;
      this.jumpFromBus(new THREE.Vector3(x, g.world.heightAt(x, z) + 90, z), new THREE.Vector3());
      g.effects?.eliminate?.(this.pos, this.color);
      if (this.isPlayer) g.hud?.banner?.('1-Up! Back in the fight', 3);
      return;
    }
    this.alive = false;
    this.setState('dead');
    this.beamT = this.isPlayer ? 0 : 1.1; // bots dissolve upward shortly after going down
    this.killer = killer;
    this.game.onActorDied?.(this, killer);
  }

  destroy() {
    this.sidekick?.dispose();
    this.game.scene.remove(this.root);
    this.character.dispose();
  }
}
