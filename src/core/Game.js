import * as THREE from 'three';
import { World } from '../world/World.js';
import { TOWNS } from '../world/Terrain.js';
import { CharacterAssets, Q_TYPES } from '../player/Character.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Input, keyLabel } from './Input.js';
import { Models } from './Models.js';
import { Post } from './Post.js';
import { Quality } from './Quality.js';
import { setWeaponModels } from '../weapons/WeaponModels.js';
import { quality } from './device.js';
import { Sound } from './Audio.js';
import { Effects } from '../effects/Effects.js';
import { Combat } from '../weapons/Combat.js';
import { Bot } from '../bots/Bot.js';
import { BOT_NAMES, botColors } from '../bots/names.js';
import { Storm } from '../world/Storm.js';
import { Bus } from '../world/Bus.js';
import { Loot } from '../world/Loot.js';
import { Building, PIECES, BUILD_MATS, COST } from '../world/Building.js';
import { HUD } from '../ui/HUD.js';
import { Ambient } from '../effects/Ambient.js';
import { Menus } from '../ui/Menus.js';
import { TouchControls } from '../ui/TouchControls.js';
import { MapScreen } from '../ui/MapScreen.js';
import { Inventory } from '../ui/Inventory.js';
import { Pings } from '../ui/Pings.js';
import { StormFX } from '../effects/StormFX.js';
import { Projectiles } from '../weapons/Projectiles.js';
import { Events } from '../world/Events.js';
import { Traps } from '../world/Traps.js';
import { applyMood, DayCycle } from '../world/TimeOfDay.js';
import { Meta } from '../meta/Meta.js';
import { LobbyStage } from '../ui/LobbyStage.js';
import { applySettings, setting } from '../ui/Settings.js';
import { Pickaxe, Consumable, CONSUMABLES } from '../weapons/Items.js';
import { Weapon } from '../weapons/Weapon.js';
import { COSMETICS } from '../meta/Cosmetics.js';
import { arenaDivision } from '../meta/Progression.js';
import { HAT_IDS, BACK_IDS, TOOL_IDS } from '../player/Gear.js';
import { EMOTE_FX } from '../meta/Cosmetics.js';
import { VARIANT, VARIANT_KEY } from '../world/Variant.js';
import { Snowfall } from '../effects/Weather.js';
import { WeatherSystem } from '../effects/WeatherFX.js';
import { BossEvent } from '../world/Boss.js';
import { Fire } from '../world/Fire.js';
import { Gadgets } from '../world/Gadgets.js';
import { Overrides, OVERRIDES } from '../world/Overrides.js';
import { RiftZones } from '../world/RiftZones.js';
import { SPRITES, SpriteCompanion, spriteLevel } from '../player/Sprites.js';
import { ModBench } from '../ui/ModBench.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';

const WARMUP_TIME = 20;
import { isTouch } from './device.js';

// seconds of holding interact to search containers
const HOLD_TIME = { chest: 0.45, ammobox: 0.3, supply: 1.0, llama: 0.8, vault: 1.0, forecast: 1.0 };

export class Game {
  constructor(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    // r186 folded PCFSoftShadowMap into PCFShadowMap (soft edges via shadow.radius).
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1400);
    this.timer = new THREE.Timer();
    this.time = 0;
    this.actors = [];
    this.bots = [];
    this.state = 'loading';
    this.paused = false;
    window.addEventListener('resize', () => this.onResize());
  }

  async init(progress = () => {}) {
    progress(0.05, 'Loading heroes…');
    this.assets = await CharacterAssets.load((k) => progress(0.05 + k * 0.15));
    progress(0.2, 'Loading the island…');
    this.models = new Models();
    await this.models.load(undefined, (k) => progress(0.2 + k * 0.2));
    setWeaponModels(this.models);
    progress(0.45, 'Shaping the island…');
    await nextFrame();
    this.world = new World(this.scene, this.renderer, this.models);
    progress(0.8, 'Growing trees…');
    await nextFrame();
    this.meta = new Meta(this);
    this.input = new Input(this.renderer.domElement);
    this.sound = new Sound();
    this.sound.listener = this.camera.position;
    const ui = document.getElementById('ui');
    this.effects = new Effects(this.scene, this.camera, ui);
    this.combat = new Combat(this);
    this.hud = new HUD(ui, this);
    this.storm = new Storm(this.scene, this.world.terrain);
    this.bus = new Bus(this.scene);
    this.loot = new Loot(this);
    this.building = new Building(this);
    this.projectiles = new Projectiles(this);
    this.fire = new Fire(this);
    this.gadgets = new Gadgets(this);
    this.overrides = new Overrides(this);
    this.rifts = new RiftZones(this);
    this.events = new Events(this);
    this.traps = new Traps(this);
    this.homes = this.world.towns.homes;
    this.homes.game = this;
    this.world.destructibles.game = this;
    this.boss = new BossEvent(this);
    this.dayCycle = new DayCycle(this);
    this.weather = new WeatherSystem(this);
    this.ambient = new Ambient(this);
    this._firstMatch = true;
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.quality = new Quality(this);
    this.quality.apply();
    this.rig = new CameraRig(this.camera, this.world);
    this.focus = new THREE.Vector3();
    this.frustum = new THREE.Frustum();
    this.pings = new Pings(this, ui);
    this.map = new MapScreen(ui, this);
    this.inv = new Inventory(ui, this);
    this.modBench = new ModBench(ui, this);
    this.stormFX = new StormFX(this.scene);
    this.mood = applyMood(this, 'day'); // variant sky for the lobby too
    this.snow = VARIANT.weather === 'snow' ? new Snowfall(this.scene) : null;
    this.sound.onPositional = (name, pos, v) => this.hud.soundViz(name, pos, v);
    this.stage = new LobbyStage(this);
    this.warmup = 0;
    this.respawns = [];
    this.menus = new Menus(ui, this);
    applySettings(this);
    const q = this.meta.profile.d.settings.quality;
    if (q && q !== this.quality.setting) this.quality.set(q);
    if (isTouch) {
      document.body.classList.add('touch');
      this.touch = new TouchControls(ui, this.input, this);
    }
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    this.state = 'menu';
    this.stage.show(true);
    this.menus.showMenu(true);
    this.sound.music('lobby');
    progress(1, 'Ready!');
  }

  // Menu "Play" / end screen "Play Again": new match without reloading the page.
  // It's you against bots, so there's no matchmaking or warm-up: straight onto the Storm Bus.
  play(mode = 'solo') {
    this.mode = mode;
    this.zeroBuild = mode === 'zb';
    this.map.show(false);
    this.menus.showMenu(false);
    this.menus.hideEnd();
    this.menus.showPause(false);
    this.paused = false;
    if (this.state !== 'menu') this.toLobby(true);
    this._enterMatch();
  }

  cancelMatchmaking() {
    clearInterval(this._mmTimer);
    this.menus.showMatchmaking(false);
    this.state = 'menu';
    this.menus.showMenu(true);
  }

  _enterMatch() {
    this.menus.showMatchmaking(false);
    this.stage.show(false);
    this.sound.music(null);
    this.hud.reset();
    this.startMatch();
    this.state = 'playing';
    this.touch?.show(true);
    if (!isTouch) this.input.requestLock();
  }

  // Back to the lobby from the results screen (or when starting a new match from it).
  toLobby(silent = false) {
    this.sound.busEngine(false);
    this.dayCycle.stop();
    this.weather.stop();
    this.mood = applyMood(this, 'day');
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.bots = [];
    this.player = null;
    this.spectating = null;
    this.warmup = 0;
    this.respawns = [];
    this.effects.clear();
    this.building.reset();
    this.projectiles.reset();
    this.fire.reset();
    this.gadgets.reset();
    this.overrides.reset();
    this.pings.reset();
    this.storm.reset();
    this.hud.show(false);
    this.hud.showSpectate(null);
    this.hud.scope?.(false);
    this.menus.hideEnd();
    this.menus.showPause(false);
    this.map.show(false);
    this.touch?.show(false);
    this.paused = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.state = 'menu';
    this.stage.show(true);
    if (!silent) { this.menus.showMenu(true); this.sound.music('lobby'); }
  }

  leaveMatch() {
    if (this.state !== 'playing') return;
    if (this.warmup > 0) { this.toLobby(); return; }
    this.menus.showPause(false);
    this.paused = false;
    const p = this.player;
    const place = p.alive ? this.aliveCount : this.deathInfo?.place ?? this.aliveCount;
    if (p.alive) { p.deathCause = 'left'; this.deathInfo = { place, killer: null, time: this.time }; }
    this.endMatch(false, place, this.deathInfo?.killer ?? null, 200);
  }

  resume() {
    this.menus.showPause(false);
    this.paused = false;
    if (!isTouch) this.input.requestLock();
  }

  // Full-screen map: frees the mouse without pausing (the match keeps going).
  toggleMap(v = !this.map.open) {
    if (this.state !== 'playing' && v) return;
    this.map.show(v);
    this.input.reset();
    if (!isTouch) {
      if (v && document.pointerLockElement) { this._mapUnlock = true; document.exitPointerLock(); }
      else if (!v && this.state === 'playing') this.input.requestLock();
    }
  }

  // Inventory screen (Tab): frees the mouse while open; the match keeps running.
  toggleInventory(v = !this.inv.open) {
    if (v && (this.state !== 'playing' || !this.player?.alive || this.map.open)) return;
    if (this.inv.open === v) return;
    this.inv.show(v);
    this.input.reset();
    if (!isTouch) {
      if (v && document.pointerLockElement) { this._mapUnlock = true; document.exitPointerLock(); }
      else if (!v && this.state === 'playing') this.input.requestLock();
    }
  }

  // The equipped sprite levels up from chests and eliminations (kept in your profile).
  addSpriteXp(n) {
    const p = this.player, sp = p?.sprite;
    if (!sp || this.warmup > 0) return;
    const d = this.meta.profile.d;
    d.spriteXp ||= {};
    const before = spriteLevel(d.spriteXp[sp.kind]);
    d.spriteXp[sp.kind] = (d.spriteXp[sp.kind] || 0) + n;
    const after = spriteLevel(d.spriteXp[sp.kind]);
    if (after > before) { p.spriteLevel = after; this.hud.banner?.(`${SPRITES[sp.kind].name} reached level ${after}!`, 3); }
    this.meta.profile.save();
  }

  // Override console: pick one of three rule changes for the whole lobby (keys 1-3 or click).
  openOverridePick(c) {
    let el = document.getElementById('ovr-pick');
    if (!el) { el = document.createElement('div'); el.id = 'ovr-pick'; document.getElementById('ui')?.appendChild(el) || document.body.appendChild(el); }
    el.innerHTML = `<div class="ovr-panel"><div class="inv-title">MATCH OVERRIDE</div><small>Pick a rule for everyone, for the rest of the match</small><div class="ovr-opts">${c.opts.map((k, i) => `<button data-k="${k}"><kbd>${i + 1}</kbd><b>${OVERRIDES[k].name}</b><span>${OVERRIDES[k].desc}</span></button>`).join('')}</div></div>`;
    el.classList.remove('hidden');
    this._ovrPick = c;
    if (!isTouch && document.pointerLockElement) { this._mapUnlock = true; document.exitPointerLock(); }
    el.onpointerdown = (e) => e.stopPropagation();
    el.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { e.stopPropagation(); this.pickOverride(b.dataset.k); } };
  }

  // Talking to a friendly NPC: trade, bounty or hire (keys 1-3 or click).
  openNpcDialog(n) {
    const [ctype, count, price] = n.sells;
    const opts = [['buy', `Buy ${CONSUMABLES[ctype].name}${count > 1 ? ` ×${count}` : ''}`, `${price} gold`], ['bounty', 'Take a bounty', 'Eliminate a marked player · 300 gold'], ['hire', 'Hire', '200 gold · fights beside you']];
    let el = document.getElementById('ovr-pick');
    if (!el) { el = document.createElement('div'); el.id = 'ovr-pick'; document.getElementById('ui')?.appendChild(el) || document.body.appendChild(el); }
    el.innerHTML = `<div class="ovr-panel npc"><div class="inv-title">${n.name.toUpperCase()}</div><small>You have ${this.player.gold} gold</small><div class="ovr-opts">${opts.map(([k, a, b], i) => `<button data-k="${k}"><kbd>${i + 1}</kbd><b>${a}</b><span>${b}</span></button>`).join('')}</div></div>`;
    el.classList.remove('hidden');
    this._ovrPick = { npc: n, opts: opts.map((o) => o[0]), x: n.x, y: n.y, z: n.z };
    if (!isTouch && document.pointerLockElement) { this._mapUnlock = true; document.exitPointerLock(); }
    el.onpointerdown = (e) => e.stopPropagation();
    el.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { e.stopPropagation(); this.pickOverride(b.dataset.k); } };
  }

  // A hired NPC: a bot on your side that follows you and fights whoever comes close.
  hireNpc(n, owner) {
    const b = new Bot(this, n.name, n.color, 0.8, n.char);
    b.npc = 'hired';
    b.hiredBy = owner;
    b.health = 150; b.maxHealth = 150;
    b.items[1] = new Weapon('ar', 3);
    b.items[2] = new Weapon('pump', 2);
    b.infiniteAmmo = true;
    b.leash = { x: owner.pos.x, z: owner.pos.z, r: 10 };
    b.spawnGround(n.x, n.z);
    b.landTime = -999;
    b.switchSlot(1);
    this.actors.push(b); this.bots.push(b);
  }

  pickOverride(k) {
    const c = this._ovrPick;
    document.getElementById('ovr-pick')?.classList.add('hidden');
    this._ovrPick = null;
    if (c?.npc) { if (k) { const msg = this.events.npcService(c.npc, k, this.player); if (msg) this.hud.toast?.(msg); } }
    else if (c && !c.claimed) this.overrides.apply(c, k, this.player);
    this.input.reset();
    if (!isTouch && this.state === 'playing') this.input.requestLock();
  }

  // Mod bench screen: frees the mouse like the inventory; closes when you walk away.
  toggleModBench(v = !this.modBench.open) {
    if (v && (this.state !== 'playing' || !this.player?.alive || this.map.open || this.inv.open)) return;
    if (this.modBench.open === v) return;
    this.modBench.show(v);
    this._modAt = v ? this.player.pos.clone() : null;
    this.input.reset();
    if (!isTouch) {
      if (v && document.pointerLockElement) { this._mapUnlock = true; document.exitPointerLock(); }
      else if (!v && this.state === 'playing') this.input.requestLock();
    }
  }

  // --- inventory actions (player) ---
  dropFromSlot(slot, count = Infinity) {
    const p = this.player, it = p?.items[slot];
    if (!it || slot <= 0 || !p.alive || p.state === 'bus') return false;
    if (p.useT > 0) p.useT = 0;
    const n = it.isConsumable ? Math.min(it.count, count) : 1;
    this.loot.dropItem(it, p, n, true);
    if (it.isConsumable && (it.count -= n) > 0) return true;
    p.items[slot] = null;
    if (p.slot === slot) { const next = p.items.findIndex((x, i) => i > 0 && x); if (!p.switchSlot(next > 0 ? next : 0)) p._equip(); }
    this.sound.play('pickup');
    return true;
  }

  splitSlot(slot) {
    const p = this.player, it = p?.items[slot];
    const free = p.items.findIndex((x, i) => i > 0 && !x);
    if (!it?.isConsumable || it.count < 2 || free < 0) return false;
    const half = Math.floor(it.count / 2);
    it.count -= half;
    p.items[free] = new it.constructor(it.type, half);
    return true;
  }

  swapSlots(a, b) {
    const p = this.player;
    if (!p || a === b || a <= 0 || b <= 0 || a > 5 || b > 5) return false;
    [p.items[a], p.items[b]] = [p.items[b], p.items[a]];
    if (p.slot === a || p.slot === b) p._equip();
    return true;
  }

  dropMat(type, n) {
    const p = this.player, have = p?.mats[type] || 0;
    if (!have || !p.alive || p.state === 'bus') return;
    const k = Math.min(have, n);
    p.mats[type] -= k;
    this.loot.dropItem({ type: 'mat', matType: type, amount: k }, p, 1, true);
  }

  dropAmmo(type, n) {
    const p = this.player, have = p?.ammo[type] || 0;
    if (!have || !p.alive || p.state === 'bus') return;
    const k = Math.min(have, n);
    p.ammo[type] -= k;
    this.loot.dropItem({ type: 'ammo', ammoType: type, amount: k }, p, 1, true);
  }

  onPointerLockChange() {
    if (isTouch) return;
    if (this._mapUnlock) { this._mapUnlock = false; return; }
    if (this.map?.open || this.inv?.open) return;
    if (this.input.locked) {
      this.paused = false;
      this.menus.showPause(false);
    } else if (this.state === 'playing' && this.player?.alive) {
      this.paused = true;
      this.input.reset();
      this.menus.showPause(true);
    }
  }

  endMatch(victory, place, killer, delay = victory ? 2600 : 2200) {
    if (this.state !== 'playing') return;
    this.state = 'ending';
    this.spectating = null;
    this.hud.showSpectate(null);
    if (this.map.open) this.toggleMap(false);
    const p = this.player;
    setTimeout(() => {
      this.state = 'ended';
      this.touch?.show(false);
      if (document.pointerLockElement) document.exitPointerLock();
      const alive = Math.max(0, (this.deathInfo?.time ?? this.time) - this.matchStart);
      const rewards = this.meta.finishMatch({ place, timeAlive: alive, crowned: !!this.player?.crowned, mode: this.mode });
      this.menus.showEnd({ victory, place, killer: killer?.name, cause: p.deathCause, kills: p.kills, time: alive, rewards });
      this.sound.music(victory ? 'victory' : 'defeat');
    }, delay);
  }

  startMatch() {
    this.cinematic = null;
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.effects.clear();
    this.time = 0;
    this.stormTick = 0;
    this.matchStart = 0;
    this.storm.reset();
    this.stormScale = this.mode === 'quick' ? 1.6 : 1;
    this.building.reset();
    this.pings.reset();
    this.projectiles.reset();
    this.fire.reset();
    this.gadgets.reset();
    this.overrides.reset();
    this.events.reset();
    this.homes.reset();
    this.world.destructibles.reset();
    this.traps.reset();
    this.mood = applyMood(this, 'day');
    this.dayCycle.stop();
    this.weather.stop();
    this.spectating = null;
    this.deathInfo = null;
    this.respawns = [];
    this.hud.showSpectate(null);
    if (!this._firstMatch) this.loot.reset();
    this._firstMatch = false;

    this.player = new Player(this);
    this.actors.push(this.player);
    const n = this.mode === 'quick' ? 29 : 99;
    const colors = botColors(n);
    this.bots = [];
    for (let i = 0; i < n; i++) {
      // arena bots get sharper as you climb the divisions
      const boost = this.mode === 'arena' ? 0.15 + arenaDivision(this.meta.profile.d.arena?.points || 0).skill : 0;
      const b = new Bot(this, BOT_NAMES[i], colors[i], Math.min(1, Math.random() * (1 - boost * 0.5) + boost), Q_TYPES[i % Q_TYPES.length]);
      // bots show off random gear too
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      if (Math.random() < 0.35) b.pickaxeSkin = pick(TOOL_IDS);
      b.applyGear({ hat: Math.random() < 0.12 ? pick(HAT_IDS) : null, backbling: Math.random() < 0.45 ? pick(BACK_IDS) : null });
      if (Math.random() < 0.3) { b.spriteLevel = 1 + Math.floor(Math.random() * 3); b.sprite = new SpriteCompanion(b, pick(Object.keys(SPRITES))); }
      this.bots.push(b);
      this.actors.push(b);
    }
    this.hud.show(true);
    this.input.enabled = true;
    this.warmup = 0;
    this.beginBus();
  }

  _warmupSpot() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = 20 + Math.sqrt(Math.random()) * 250;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.world.heightAt(x, z) > 2.5 && this.world.terrain.normalAt(x, z).y > 0.8 && !this.world.colliders.query(x - 4, x + 4, z - 4, z + 4, []).length) return [x, z];
    }
    return [0, 0];
  }

  _warmupSpawn(a) {
    const [x, z] = this._warmupSpot();
    if (a.alive) a.spawnGround(x, z); else a.revive(x, z);
    a.items = [new Pickaxe(), new Weapon('ar', 0), new Weapon('shotgun', 0), null, null, null];
    a.ammo.medium = 120; a.ammo.shells = 20;
    a.mats.wood = 100;
    a.slot = -1;
    a.switchSlot(1);
    if (!a.isPlayer) { a.target = null; a.mode = 'idle'; a.landTime = this.time - 200; }
  }

  // Warm-up over: wipe inventories and put everyone on the bus.
  beginBus() {
    this.sound.busEngine(false);
    this.warmup = 0;
    this.respawns = [];
    this.building.reset();
    this.projectiles.reset();
    this.fire.reset();
    this.gadgets.reset();
    this.overrides.reset();
    this.effects.clear();
    this.hud.reset();
    this.time = 0;
    this.stormTick = 0;
    this.storm.reset();
    this.events.reset();
    this.homes.reset();
    this.world.destructibles.reset();
    this.traps.reset();
    // how this match starts: the usual bus, you driving the bus through rings, or Storm Surfing
    const rs = Math.random();
    this.startMode = (typeof window !== 'undefined' && window.__startMode) || (rs < 0.2 ? 'surf' : rs < 0.4 ? 'drive' : 'bus');
    this.bus.launch(this.startMode);
    for (const a of this.actors) {
      if (!a.alive) a.revive(0, 0);
      a.items = [new Pickaxe(), null, null, null, null, null];
      a.slot = -1;
      a.switchSlot(0);
      a.setBuildMode?.(null);
      for (const k of Object.keys(a.ammo)) a.ammo[k] = 0;
      for (const k of Object.keys(a.mats)) a.mats[k] = 0;
      a.gold = 0; a.medallions?.clear(); a.setCrown?.(false);
      a.health = 100; a.shield = 0; a.kills = 0; a.emote = null; a.crouched = false; a.dmgDealt = 0;
      a.scanPhase = -1; a.extraLife = false; a.speedT = 0; a.slapT = 0; a.lowGravT = 0; a.markedUntil = 0;
      // Zero Build start kit: a pistol, small shields and one extra item
      if (this.zeroBuild && !a.npc) {
        a.items[1] = new Weapon('pistol', 0);
        a.ammo.light = 48;
        a.items[5] = new Consumable('smallshield', 2);
        a.items[4] = new Consumable(['crashpad', 'bouncer', 'chugsplash', 'grenade'][Math.floor(Math.random() * 4)], 1);
      }
      a.vel.set(0, 0, 0);
      a.setState('bus');
      a.pos.copy(this.bus.pos);
      a.surfLat = a.isPlayer ? 0 : (Math.random() - 0.5) * 170;
      a.resetAI?.();
    }
    for (const b of this.bots) this._planDrop(b);
    // the Victory Crown: you keep it from your last win, and one bot starts wearing one
    if (this.meta.profile.d.crowned) this.player.setCrown(true);
    const cb = this.bots.filter((b) => !b.npc)[Math.floor(Math.random() * this.bots.filter((b) => !b.npc).length)];
    cb?.setCrown(true);
    this.boss.reset();
    this.boss.spawn();
    this.rifts.spawn();
    this.bounty = null;
    const wx = this.weather.roll({ snow: VARIANT.weather === 'snow', desert: VARIANT_KEY === 'desert' });
    this.dayCycle.start(this.weather.night);
    if (wx) setTimeout(() => this.state === 'playing' && this.hud.banner(wx, 3), 6500);
    this.rig.yaw = Math.atan2(-this.bus.vel.x, -this.bus.vel.z) + 0.6;
    this.rig.pitch = -0.25;
    this.meta.startMatch();
    this._thanked = false;
    this._firstBlood = false;
    this._botThanks = 0;
    if (this.startMode === 'surf') this.hud.banner(isTouch ? 'Storm Surfing! Steer along the wave · tap JUMP as it launches for a boost' : 'Storm Surfing! A / D to move along the wave · SPACE as it launches for a boost', 7);
    else if (this.startMode === 'drive') this.hud.banner(isTouch ? "You're driving the Battle Bus! Steer through the rings" : "You're driving the Battle Bus! A / D to steer through the rings · SPACE to jump", 7);
    else this.hud.banner(isTouch ? 'Tap JUMP to drop from the Storm Bus' : 'Press SPACE to jump from the Storm Bus', 6);
    this.sound.play('bus');
    this.sound.sting();
    this.sound.music('bus');
  }

  // Bots pick a landing spot (often a town) and a moment to jump.
  _planDrop(b) {
    const w = this.world;
    const towns = TOWNS;
    let x = 0, z = 0;
    for (let i = 0; i < 30; i++) {
      if (Math.random() < 0.5) {
        const t = towns[Math.floor(Math.random() * towns.length)];
        x = t.x + (Math.random() - 0.5) * t.r * 1.2; z = t.z + (Math.random() - 0.5) * t.r * 1.2;
      } else {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 260;
        x = Math.cos(a) * d; z = Math.sin(a) * d;
      }
      if (w.heightAt(x, z) > 2.2) break;
    }
    b.dropTarget.set(x, 0, z);
    // jump when the bus passes closest to the target (+ noise)
    const s = this.bus.start, e = this.bus.end;
    const dx = e.x - s.x, dz = e.z - s.z;
    const k = ((x - s.x) * dx + (z - s.z) * dz) / (dx * dx + dz * dz);
    b.jumpAt = Math.min(0.92, Math.max(0.12, k - 0.08 + (Math.random() - 0.5) * 0.12));
  }

  // Driving the bus through a ring: XP for you and a supply drop under the ring.
  _busRing(r) {
    this.sound.play('pickup');
    this.hud.accolade?.('Battle Bus Ring', 50);
    this.meta.track('ring');
    this.events._spawnSupply({ x: r.pos.x, z: r.pos.z });
  }

  start() {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    if (this.state === 'menu' || this.state === 'matchmaking') this.updateMenu(dt);
    else if (!this.paused) {
      this.update(dt);
      if (this.state === 'playing') this.quality.monitor(dt);
    }
    this.post.render(dt);
  }

  // Slow cinematic orbit behind the start screen.
  // Lobby: camera on the floating stage with your hero.
  updateMenu(dt) {
    this.time += dt;
    this.stage.frameCamera(this.camera, dt);
    this.stage.update(dt);
    this.snow?.update(dt, this.camera);
    this.rig.fov = this.camera.fov;
    this.focus.copy(this.stage.group.position);
    this.world.update(dt, this.time, this.focus, this.camera);
    this.loot.update(dt, this.time);
    this.ambient.update(dt, this.time);
    this.effects.update(dt);
  }

  update(dt) {
    if (this.cinematic) dt *= this.cinematic.t < 2.2 ? 0.35 : 0.8;
    this.time += dt;
    if (this.input.pressed('mute')) this.hud.toast(this.sound.toggleMute() ? 'Sound off' : 'Sound on');
    const p = this.player;
    if (this.input.pressed('map')) { this.toggleInventory(false); this.toggleMap(); }
    else if (this.map.open && this.input.pressed('pause')) this.toggleMap(false);
    else if (this.map.open && this.input.pressed('ping') && this.map.hover) this.map.pingHere(...this.map.hover);
    if (this.input.pressed('shoulder')) { this.rig.shoulder *= -1; this.hud.toast?.(this.rig.shoulder > 0 ? 'Right shoulder' : 'Left shoulder'); }
    if (this.input.pressed('inventory')) this.toggleInventory();
    else if (this.inv.open && (this.input.pressed('pause') || !p.alive)) this.toggleInventory(false);
    if (this.inv.open) this.inv.tick(dt);
    if (this._ovrPick) {
      const c = this._ovrPick;
      for (let i = 0; i < 3; i++) if (this.input.pressed('slot' + (i + 1)) && c.opts[i]) { this.pickOverride(c.opts[i]); break; }
      if (this._ovrPick && (c.claimed || !p.alive || p.pos.distanceTo(new THREE.Vector3(c.x, c.y, c.z)) > 5 || this.input.pressed('pause'))) this.pickOverride(null);
    }
    if (this.modBench.open) {
      if (this.input.pressed('pause') || this.input.pressed('interact') || !p.alive || p.pos.distanceTo(this._modAt) > 4) this.toggleModBench(false);
      else this.modBench.tick(dt);
    }
    if (this.spectating) this.updateSpectate(dt);
    if (this.warmup > 0) this.updateWarmup(dt);
    this.updateEmoteWheel(dt);
    if (p.alive) {
      p.readInput(dt, this.input, this.rig);
      this.updatePlayerCombat(dt);
    } else {
      p.intent.mx = p.intent.mz = 0;
      p.setBuildMode(null);
      const look = this.input.consumeLook();
      this.rig.addLook(look.x, look.y);
    }
    const busMove = p.state === 'bus' ? this.input.move() : null;
    this.bus.update(dt, this.time, this.bus.mode === 'drive' && busMove ? busMove.x : 0, (r) => this._busRing(r));
    if (this.bus.mode === 'surf' && p.state === 'bus' && busMove) {
      p.surfLat = Math.max(-88, Math.min(88, (p.surfLat || 0) + busMove.x * 12 * dt));
      if (this.input.pressed('jump')) p.surfJumpT = this.time;
    }
    let aboard = 0, players = 0;
    for (const a of this.actors) {
      if (a.npc) continue;
      players++;
      if (a.state === 'bus') { if (this.bus.mode === 'surf') { this.bus.surfPos(a.surfLat || 0, a.pos); a.root.visible = true; a.bodyYaw = this.bus.heading; } else a.pos.copy(this.bus.pos); aboard++; }
    }
    if (this.bus.active) {
      this.bus.setAboard(players ? aboard / players : 0);
      this.sound.busEngine(p.state === 'bus');
      // thank the bus driver (you once; a few bots too)
      if (p.state === 'bus' && this.bus.mode === 'bus' && this.input.pressed('interact') && !this._thanked) {
        this._thanked = true;
        this.hud.thankDriver?.(p);
        this.sound.play('pickup');
      }
      if (this.bus.mode !== 'surf' && this.bots.length && Math.random() < dt * 0.35 && (this._botThanks || 0) < 6) {
        const b = this.bots[Math.floor(Math.random() * this.bots.length)];
        if (b.state === 'bus' && !b.thanked) { b.thanked = true; this._botThanks = (this._botThanks || 0) + 1; this.hud.thankDriver?.(b); }
      }
    }
    if (p.state === 'bus' && this.warmup <= 0 && ((this.input.pressed('jump') && this.bus.canDrop) || !this.bus.active)) {
      p.jumpFromBus(this.bus.mode === 'surf' ? this.bus.surfPos(p.surfLat || 0, _origin).setY(this.bus.pos.y + 2) : this.bus.pos, this.bus.vel);
      if (this.bus.mode === 'surf') {
        // the wave throws you onto the island; jumping right as it launches gives extra height
        const perfect = this.time - (p.surfJumpT ?? -9) < 0.6;
        p.vel.set(this.bus.vel.x * 1.6, perfect ? 30 : 22, this.bus.vel.z * 1.6);
        if (perfect) this.hud.accolade?.('Perfect Launch', 25);
      }
      this.hud.banner(isTouch ? 'Steer with the stick — glider opens automatically' : 'Steer with WASD — glider opens automatically', 4);
      this.sound.play('glider');
    }
    for (const b of this.bots) {
      if (b.state === 'bus' && !this.bus.active && this.warmup <= 0) {
        b.jumpFromBus(this.bus.mode === 'surf' ? this.bus.surfPos(b.surfLat || 0, _origin).setY(this.bus.pos.y + 2) : this.bus.pos, this.bus.vel);
        if (this.bus.mode === 'surf') b.vel.set(this.bus.vel.x * 1.6, 20 + Math.random() * 8, this.bus.vel.z * 1.6);
      }
      b.update(dt);
    }
    if (this.warmup <= 0) this.updateStorm(dt);
    this.loot.update(dt, this.time);
    this.building.update(dt);
    this.homes.update(dt, this.actors, this.camera.position);
    this.world.destructibles.update(dt);
    this.traps.update(dt, this.actors);
    this.projectiles.update(dt);
    this.fire.update(dt);
    this.gadgets.update(dt);
    this.overrides.update(dt);
    // hired NPCs stay near whoever hired them
    for (const b of this.bots) if (b.hiredBy && b.alive) { b.leash.x = b.hiredBy.pos.x; b.leash.z = b.hiredBy.pos.z; if (!b.hiredBy.alive) b.hiredBy = null; }
    // bounty: eliminate the marked player before time runs out
    if (this.bounty && (this.time > this.bounty.until || !this.bounty.target.alive)) {
      const bt = this.bounty; this.bounty = null;
      if (!bt.target.alive && bt.target.killer === this.player) { this.player.gold += bt.reward; this.hud.banner?.(`Bounty complete! +${bt.reward} gold`, 3); this.sound.play('buy'); }
      else if (this.player.alive) this.hud.toast?.(bt.target.alive ? 'Bounty expired' : 'Someone else got your bounty');
    }
    if (this.warmup <= 0) this.rifts.update(dt);
    // Constant Heal override: out of combat, health then shield tick back up
    if (this.overrides.has('heal') && (this._healT = (this._healT || 0) + dt) >= 1) {
      this._healT = 0;
      for (const a of this.actors) if (a.alive && !a.npc && this.time - (a.lastHurtTime || 0) > 5 && this.time - (a.lastFireTime || 0) > 5) { if (a.health < 100) a.health = Math.min(100, a.health + 3); else a.shield = Math.min(100, a.shield + 3); }
    }
    for (const a of this.actors) {
      if (!a.sprite) continue;
      if (a.distToCam === undefined || a.distToCam < 80 || a.isPlayer) a.sprite.update(dt); else a.sprite.mesh.visible = false;
      // bots with a Water Sprite heal with it when hurt
      if (!a.isPlayer && a.alive && a.sprite.kind === 'water' && a.health < 50 && a.sprite.cooldownLeft <= 0 && this.warmup <= 0) a.sprite.useAbility();
    }
    this.combat.updateBursts(dt);
    this.world.traversal.update(dt, this.time, this.actors);
    if (this.warmup <= 0) this.events.update(dt, this.time);
    this.boss.update(dt);
    if (this.warmup <= 0) this.dayCycle.update(this.time);
    this.weather.update(dt);
    this.ambient.update(dt, this.time);
    for (const a of this.actors) {
      a.updateMovement(dt);
      for (const w of a.items) {
        const ev = w && w.update(dt, (a.medallions?.has('reload') ? 1.6 : 1) * (this.overrides.has('speedshot') ? 1.25 : 1));
        if (ev === 'reloaded') { a.finishReload(w); if (a.isPlayer) this.sound.play('reloaded'); }
        else if (ev === 'shell') {
          a.finishReload(w, 1);
          if (w.ammo < w.mag && a.ammoFor(w.def.ammoType) > 0) { w.reloadT = w.reloadTime; if (a.isPlayer) this.sound.play('reload'); }
          else { w.reloading = false; if (a.isPlayer) this.sound.play('reloaded'); }
        }
      }
      if (this.warmup <= 0) this.loot.autoPickup(a);
    }
    this.sound.updateListener?.(this.camera);
    this.sound.chestHum?.(p.alive && p.state === 'ground' ? this.loot.nearestChest(p.pos, 18) : null, p.pos);
    const view = this.spectating || p;
    const scoped = p.alive && p.aiming && p.state === 'ground' && !!p.weapon?.def.scope;
    const mode = this.spectating ? (view.state === 'ground' ? 'ground' : view.state) : !p.alive || p.victory ? 'dead' : p.state === 'ground' ? (scoped ? 'scope' : p.aiming ? 'aim' : 'ground') : p.state;
    const inScope = scoped && this.rig.fov < 30;
    this.hud.scope?.(inScope);
    if (p.state === 'ground') p.root.visible = !inScope; // your own hero would block the scope view
    this.rig.aimZoom = view.weapon?.zoom || 0;
    this.rig.fastAds = view.weapon?.mods?.under === 'angled';
    this.rig.update(dt, view.state === 'bus' ? this.bus.mesh.position : view.pos, mode);
    if (this.cinematic) this._victoryCam(dt);
    // one frustum per frame for character culling
    this.camera.updateMatrixWorld();
    _projView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(_projView);
    for (const a of this.actors) a.updateVisual(dt, this.camera.position);
    this.focus.copy(view.pos);
    this.pings.update(dt);
    this.snow?.update(dt, this.camera);
    const cam = this.camera.position;
    this.stormFX.update(dt, this.camera, this.state === 'playing' && view.state !== 'bus' && !this.storm.isInside(cam.x, cam.z) ? 1 : 0);
    // inside the storm: lightning, a rumbling screen shake that grows the deeper you are, and thunder
    const inStorm = this.state === 'playing' && view.state !== 'bus' && view.alive && !this.storm.isInside(view.pos.x, view.pos.z) && this.gadgets.stormAt(view.pos) !== 'safe';
    if (inStorm) {
      const depth = Math.min(1, (Math.hypot(view.pos.x - this.storm.center.x, view.pos.z - this.storm.center.y) - this.storm.radius) / 60);
      this.rig.shake = Math.max(this.rig.shake, 0.04 + 0.1 * depth);
      this._boltT = (this._boltT ?? 3) - dt;
      if (this._boltT <= 0) {
        this._boltT = 3 + Math.random() * 5 * (1 - depth * 0.5);
        this.hud.lightning?.();
        this.sound.play(depth > 0.4 ? 'thunderNear' : 'thunder', null, { vol: 0.35 + 0.4 * depth });
      }
    }
    this.map.draw();
    this._humVizT = (this._humVizT || 0) - dt;
    if (this._humVizT <= 0 && p.alive && p.state === 'ground') {
      this._humVizT = 1;
      const c = this.loot.nearestChest(p.pos, 18);
      if (c) this.hud.soundViz('chest', _origin.set(c.x, c.y, c.z), 1 - Math.hypot(c.x - p.pos.x, c.z - p.pos.z) / 18);
    }
    this.world.update(dt, this.time, this.focus, this.camera);
    this.effects.update(dt);
    this.hud.update(dt);
    this.input.endFrame();
  }

  updatePlayerCombat(dt) {
    const p = this.player, input = this.input;
    if (!p.alive) return;
    for (let i = 0; i < 6; i++) if (input.pressed('slot' + (i + 1))) p.switchSlot(i);
    const wheel = input.consumeWheel();
    if (wheel && p.buildMode) {
      const i = PIECES.indexOf(p.buildMode);
      p.setBuildMode(PIECES[(i + Math.sign(wheel) + PIECES.length) % PIECES.length]);
    } else if (wheel) {
      for (let k = 1; k <= 6; k++) {
        const i = (p.slot + Math.sign(wheel) * k + 12) % 6;
        if (p.items[i]) { p.switchSlot(i); break; }
      }
    }
    if (input.pressed('reload') && !p.buildMode) this.combat.reload(p);
    if (input.pressed('sprite')) { const msg = p.sprite ? p.sprite.useAbility() : 'Equip a Sprite in the Locker'; if (msg) this.hud.toast?.(msg); }
    if (input.pressed('drop') && !p.buildMode && p.state === 'ground') this.dropFromSlot(p.slot, Infinity);
    if (input.pressed('ping') && p.state !== 'bus') {
      const dir = this.camera.getWorldDirection(_dir);
      this.pings.ping(_origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist), dir);
    }
    // no shooting or building while swimming
    if (p.swimming) {
      if (p.buildMode) p.setBuildMode(null);
      this.hud.prompt?.(null);
      return;
    }
    // hidden in a haystack / dumpster: only leaving is possible
    if (p.hiddenIn) {
      this.hud.prompt?.(`Hidden · Jump or ${(this.input.keyFor('interact') || 'E').replace(/^Key/, '')} to leave`);
      if (input.pressed('jump') || input.pressed('interact')) this.events.unhide(p);
      return;
    }
    if (this.updateBuild(dt)) return;
    if (p.state === 'ground') {
      const door = this.homes.nearestDoor(p.pos, 1.7);
      const near = (door && { kind: 'door', door, text: door.open ? 'Close Door' : 'Open Door' }) || this.world.traversal.nearestInteractable(p) || this.overrides.nearest(p.pos) || this.events.nearestInteractable(p.pos) || this.boss.nearestInteractable(p) || this.loot.nearestInteractable(p.pos);
      const text = !near ? null : near.text || (near.kind === 'chest' ? (near.chest.rare ? 'Open Rare Chest' : 'Open Chest') : near.kind === 'ammobox' ? 'Open Ammo Box' : `Pick up ${this.loot.label(near.pickup)}`);
      this.hud.prompt?.(text || (p.canRedeploy() ? `Deploy glider · ${keyLabel(this.input.keyFor('jump'))}` : null), near?.pickup?.weapon?.rarity ?? near?.rarity, near?.pickup?.weapon || null, near?.pickup || null);
      // containers are searched by holding interact (Fortnite-style), unless "tap to search" is on;
      // swapping into a full inventory is a short hold too
      const full = near?.pickup && (near.pickup.type === 'weapon' || near.pickup.type === 'consumable') && !p.items.some((it, i) => i > 0 && !it);
      const need = !near ? 0 : full ? (setting(this, 'holdToSwap') ? 0.35 : 0) : setting(this, 'tapToSearch', false) ? 0 : HOLD_TIME[near.kind] || 0;
      const tgt = near && (near.chest || near.box || near.supply || near.llama || near.pickup || near.vending || near.door || near.bench || near.hide || near.forage || near.kind);
      let act = false;
      if (near && need > 0 && this.warmup <= 0) {
        if (input.down('interact')) {
          if (this._holdTgt !== tgt) { this._holdTgt = tgt; this._holdT = 0; }
          this._holdT += dt;
          if (this._holdT >= need && !this._holdDone) { act = true; this._holdDone = true; }
        } else { this._holdTgt = null; this._holdT = 0; this._holdDone = false; }
        this.hud.holdProgress?.(this._holdTgt === tgt && !this._holdDone ? Math.min(1, this._holdT / need) : 0);
      } else {
        act = !!near && input.pressed('interact');
        if (!input.down('interact')) this._holdDone = false;
        this.hud.holdProgress?.(0);
      }
      if (near && act && this.warmup > 0) this.hud.toast?.('Loot unlocks when the match starts');
      else if (near && act) {
        if (near.kind === 'supply') this.events.openSupply(near.supply, p);
        else if (near.kind === 'vault') { const msg = this.boss.openVault(p); if (msg) this.hud.toast?.(msg); }
        else if (near.kind === 'vending') { const msg = this.events.buy(near.vending, p); if (msg) this.hud.toast?.(msg); }
        else if (near.kind === 'door') this.homes.setDoor(near.door, !near.door.open);
        else if (near.kind === 'zip' || near.kind === 'ascender') this.world.traversal.grab(p, near);
        else if (near.kind === 'override') this.openOverridePick(near.console);
        else if (near.kind === 'npc') this.openNpcDialog(near.npc);
        else if (near.kind === 'forecast') { p.scanPhase = this.storm.phase; this.sound.play('stormChime'); this.hud.banner?.('Storm forecast · the circle after next is on your map', 3); }
        else if (near.kind === 'llama') this.events.openLlama(near.llama, p);
        else if (near.kind === 'forage') { const msg = this.events.eat(near.forage, p); if (msg) this.hud.toast?.(msg); }
        else if (near.kind === 'hide') { const msg = this.events.hide(near.hide, p); if (msg) this.hud.toast?.(msg); }
        else if (near.kind === 'modbench') this.toggleModBench(true);
        else if (near.kind === 'dealer') { const msg = this.events.buyExotic(near.dealer, p); this.hud.toast?.(msg || `Bought ${WEAPONS[near.dealer.type].name}`); }
        else if (near.kind === 'bench') { const msg = this.events.upgrade(near.bench, p); this.hud.toast?.(msg || `Upgraded to ${p.held.name}`); }
        else if (near.kind === 'chest') this.loot.openChest(near.chest, p);
        else if (near.kind === 'ammobox') this.loot.openAmmoBox(near.box, p);
        else { const msg = this.loot.collect(near.pickup, p); if (msg) this.hud.toast?.(msg); }
      }
    } else this.hud.prompt?.(p.state === 'bus' && !this._thanked && this.bus.active && this.bus.mode === 'bus' ? 'Thank the bus driver' : null);
    this.updateConsumable(dt);
    this.combat.updateWeak(p);
    if (input.down('fire')) p.emote = null;
    const held = p.held;
    if (!held || p.state !== 'ground') return;
    if (held.isConsumable && held.def.throw) {
      if (setting(this, 'throwArc')) this.projectiles.showArc(p, this.camera.getWorldDirection(_dir));
      if (input.down('fire')) {
        const dir = this.camera.getWorldDirection(_dir);
        p.bodyYaw = p.aimYaw;
        p.throwHeld(dir);
      }
      return;
    }
    if (held.isConsumable && held.def.rod) {
      if (input.pressed('fire')) {
        const msg = this.gadgets.useRod(p, this.camera.position, this.camera.getWorldDirection(_dir));
        if (msg) this.hud.toast?.(msg);
      }
      return;
    }
    if (held.isConsumable && held.def.oneup) {
      if (input.pressed('fire')) this.hud.toast?.('Keep it in your inventory: it brings you back once');
      return;
    }
    if (held.isConsumable && held.def.key) {
      if (input.pressed('fire')) this.hud.toast?.('Take it to the vault at Rusty Works');
      return;
    }
    if (held.isConsumable && held.def.wingsuit) {
      if (input.pressed('fire') && p.startWingsuit()) p.consumeHeld();
      return;
    }
    if (held.isConsumable && held.def.sliders) {
      if (input.pressed('fire')) this.hud.toast?.('Sprint, then slide (crouch) to jet-slide');
      return;
    }
    if (held.isConsumable && held.def.grapple) {
      if (input.pressed('fire')) this.fireGrapple(p);
      return;
    }
    if (held.isConsumable && held.def.trap) {
      const dir = this.camera.getWorldDirection(_dir);
      const plan = this.traps.preview(p, this.camera.position, dir);
      if (input.pressed('fire')) {
        if (plan && this.traps.place(p, plan)) p.consumeHeld();
        else this.hud.toast?.('Aim at a floor nearby');
      }
      return;
    }
    if (held.isConsumable && held.def.place) {
      if (input.pressed('fire')) {
        if (this.events.placeItem(p, held.def.place)) p.consumeHeld();
        else this.hud.toast?.('Needs flat ground');
      }
      return;
    }
    if (held.isConsumable) {
      if (input.pressed('fire') && p.useT <= 0) {
        if (!p.startUse()) this.hud.toast?.(held.def.heal ? 'Health is already full' : 'Shield is already full');
      }
      return;
    }
    // Kinetic Blade: aim (right click) dashes forward
    if (held.isGun && held.def.dash && input.pressed('aim') && p.state === 'ground') {
      if (!this.combat.bladeDash(p, this.camera.getWorldDirection(_dir))) this.hud.toast?.('Dash recharging');
    }
    // bows: holding fire draws, letting go looses the arrow
    const bowRelease = held.isGun && held.def.charge && !input.down('fire') && held.charge > 0 && this.time - (held.lastTry ?? -9) < 0.25;
    if (!input.down('fire') && !bowRelease) return;
    const dir = this.camera.getWorldDirection(_dir);
    const origin = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist + 0.25);
    if (bowRelease) {
      p.character.root.updateMatrixWorld(true);
      p.bodyYaw = p.aimYaw;
      this.combat.fire(p, origin, dir, p.muzzleWorld(_muzzle), { release: true });
      return;
    }
    if (held.isPickaxe) {
      p.bodyYaw = p.aimYaw;
      this.combat.melee(p, origin, dir, 2.8);
      return;
    }
    if (!held.canFire()) {
      if (input.pressed('fire') && held.ammo <= 0) this.sound.play('empty');
      if (held.ammo <= 0) this.combat.reload(p);
      return;
    }
    p.character.root.updateMatrixWorld(true);
    p.bodyYaw = p.aimYaw;
    this.combat.fire(p, origin, dir, p.muzzleWorld(_muzzle));
  }

  // Build mode: Q/Z/V/X pick a piece (touch: place it right away), fire places, right-click
  // cycles the material, B toggles, G edits the wall you look at. Returns true while building.
  updateBuild(dt) {
    const p = this.player, input = this.input, b = this.building;
    this._buildCd = Math.max(0, (this._buildCd || 0) - dt);
    if (this.zeroBuild) {
      if (p.buildMode) p.setBuildMode(null);
      if ((input.pressed('build') || input.pressed('ninety') || PIECES.some((k) => input.pressed(k))) && !this._buildCd) { this.hud.toast?.('Zero Build · no building in this mode'); this._buildCd = 1; }
      return false;
    }
    if (input.pressed('resetEdit') && p.state === 'ground') this.resetEditLooked();
    if (input.pressed('edit') && p.state === 'ground') {
      // in build mode with a wall / floor and nothing of yours in view: pre-edit the blueprint
      if (this.preEditing) { this.finishPreEdit(); return true; }
      if (p.buildMode && (p.buildMode === 'wall' || p.buildMode === 'floor') && setting(this, 'preEdits') && !this._lookedBuild()) { this.startPreEdit(); return true; }
      this.toggleEdit(); return !!this.editing;
    }
    if (this.preEditing) { this.updatePreEdit(); return true; }
    // "confirm edit on release": letting go of the edit key applies the edit
    if (this.editing && setting(this, 'editOnRelease', false) && !input.down('edit')) { this.toggleEdit(); return false; }
    if (this.editing) { this.updateEdit(); return true; }
    for (const piece of PIECES) {
      if (!input.pressed(piece)) continue;
      if (this.touch) { this.placePiece(piece); return false; }
      p.setBuildMode(piece);
    }
    if (input.pressed('build')) p.setBuildMode(p.buildMode ? null : this._lastPiece || 'wall');
    if (input.pressed('ninety') && p.state === 'ground') {
      const dir = b.do90(p, b.pickMat(p, p.buildMat));
      if (dir) { p.autoRun = { x: dir.x, z: dir.z, t: dir.dist / 6.4 + 0.15, top: dir.top }; p.vel.y = Math.max(p.vel.y, 5); }
      else this.hud.toast?.(`Need ${COST * 5} materials for a 90`);
    }
    if (input.pressed('buildmat')) this.cycleBuildMat();
    if (!p.buildMode || p.state !== 'ground' || !p.alive) {
      if (p.buildMode && !p.alive) p.setBuildMode(null);
      b.hideGhost();
      return false;
    }
    this._lastPiece = p.buildMode;
    // the reload key turns the ramp before you place it
    if (input.pressed('reload') && p.buildMode === 'ramp') { p.buildRot = ((p.buildRot || 0) + 1) & 3; this.sound.play('click'); }
    const simple = setting(this, 'simpleBuild', false);
    let piece = p.buildMode;
    if (simple) {
      // Simple Build: fire places walls; aim places a floor, ramp or cone depending on where you look
      piece = input.down('aim') ? (p.aimPitch < -0.45 ? 'floor' : p.aimPitch > 0.45 ? 'cone' : 'ramp') : 'wall';
    } else if (input.pressed('aim')) this.cycleBuildMat();
    const plan = b.plan(p, piece, p.aimYaw, p.aimPitch, { rot: piece === 'ramp' ? p.buildRot || 0 : 0 });
    if (this.preEdits?.[piece]) plan.preMask = this.preEdits[piece];
    const mat = b.pickMat(p, p.buildMat);
    b.showGhost(plan, b.isValid(plan, p, mat));
    this.hud.prompt?.(null);
    if ((simple ? input.down('fire') || input.down('aim') : input.down('fire')) && this._buildCd <= 0) this.placePiece(piece, plan);
    return true;
  }

  placePiece(piece, plan) {
    const p = this.player, b = this.building;
    if (p.state !== 'ground') return;
    plan = plan || b.plan(p, piece, p.aimYaw, p.aimPitch);
    const mat = b.pickMat(p, p.buildMat);
    if (!mat) { if (!this._buildCd) this.hud.toast?.(`Need ${COST} materials — harvest with the axe`); this._buildCd = 0.4; return; }
    if (mat !== p.buildMat) { p.buildMat = mat; }
    // floating ramps get a floor under them (ramp-rush helper)
    if (piece === 'ramp' && !b._grounded(plan.box) && b.canAfford(p)) b.build(p, b.floorUnder(plan), b.pickMat(p, p.buildMat));
    if (b.build(p, plan, mat)) this._buildCd = 0.09; // turbo build while the button is held
  }

  cycleBuildMat() {
    const p = this.player;
    const i = BUILD_MATS.indexOf(p.buildMat);
    p.buildMat = BUILD_MATS[(i + 1) % BUILD_MATS.length];
    this.sound.play('click');
  }

  // The build of yours under the crosshair (for edits), or null.
  _lookedBuild() {
    const dir = this.camera.getWorldDirection(_dir);
    const origin = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist * 0.8);
    const s = this.world.raycast(origin, dir, 7)?.collider?.structure;
    return s && s.owner === this.player ? s : null;
  }

  // Reset-edit key: your looked-at build goes back to its plain shape (or clears a pre-edit).
  resetEditLooked() {
    const b = this.building;
    if (this.editing) { b.edit(this.editing.s, null); this.stopEdit(); this.hud.toast?.('Edit reset'); return; }
    const s = this._lookedBuild();
    if (s?.type === 'wall' || s?.type === 'floor') { b.edit(s, null); return; }
    if (s?.type === 'ramp' && s.half) { s.half = -1; b.editRamp(s); s.dirX = -s.dirX; s.dirZ = -s.dirZ; b._refit(s); return; }
    if (s?.type === 'cone' && s.shape) { b.editCone(s, 0); return; }
    const piece = this.player.buildMode;
    if (piece && this.preEdits?.[piece]) { this.preEdits[piece] = 0; this.hud.toast?.('Pre-edit cleared'); }
  }

  // Pre-edit: shape the held wall / floor blueprint; every one you place comes out edited.
  startPreEdit() {
    const p = this.player, b = this.building;
    const plan = b.plan(p, p.buildMode, p.aimYaw, p.aimPitch);
    this.preEdits ||= {};
    this.preEditing = { s: plan, type: p.buildMode, mask: this.preEdits[p.buildMode] || 0, paint: null };
    b.hideGhost();
    b.showEditGrid(plan, this.preEditing.mask);
    this.hud.editHint?.(true);
  }

  updatePreEdit() {
    const e = this.preEditing, input = this.input;
    if (!this.player.alive || !this.player.buildMode) { this.finishPreEdit(true); return; }
    if (input.pressed('aim')) { e.mask = 0; this.building.showEditGrid(e.s, 0); return; }
    if (setting(this, 'editOnRelease', false) && !input.down('edit')) { this.finishPreEdit(); return; }
    if (!input.down('fire')) { e.paint = null; return; }
    const tile = this.building.pickTile(this.camera.position, this.camera.getWorldDirection(_dir));
    if (tile < 0) return;
    const bit = 1 << tile;
    if (e.paint === null) e.paint = !(e.mask & bit);
    const next = e.paint ? e.mask | bit : e.mask & ~bit;
    if (next !== e.mask && next !== 511) { e.mask = next; this.building.showEditGrid(e.s, e.mask); this.sound.play('click'); }
  }

  finishPreEdit(cancel = false) {
    const e = this.preEditing;
    this.preEditing = null;
    this.building.showEditGrid(null);
    this.hud.editHint?.(false);
    if (cancel || !e) return;
    this.preEdits[e.type] = e.mask;
    this.hud.toast?.(e.mask ? `Pre-edit saved: every ${e.type} comes out edited (reset-edit key clears it)` : 'Pre-edit cleared');
  }

  // Edit mode (G): pick tiles on your own wall / floor, G again to confirm. Ramps and cones change shape.
  toggleEdit() {
    const b = this.building, p = this.player;
    if (this.editing) {
      const { s, mask } = this.editing;
      if (s.hp > 0) b.edit(s, mask);
      this.stopEdit();
      return;
    }
    const dir = this.camera.getWorldDirection(_dir);
    const origin = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist * 0.8);
    const hit = this.world.raycast(origin, dir, 7);
    const s = hit?.collider?.structure;
    if (!s) { this.hud.toast?.('Look at one of your builds to edit it'); return; }
    if (s.owner !== p) { this.hud.toast?.('You can only edit your own builds'); return; }
    if (s.type === 'cone') { b.editCone(s, p.aimYaw); return; }
    if (s.type === 'ramp') { b.editRamp(s); return; }
    p.setBuildMode(null);
    this.editing = { s, mask: s.editMask || 0, paint: null };
    b.showEditGrid(s, this.editing.mask);
    this.hud.editHint?.(true);
  }

  stopEdit() {
    this.editing = null;
    this.building.showEditGrid(null);
    this.hud.editHint?.(false);
  }

  updateEdit() {
    const e = this.editing, p = this.player, input = this.input;
    if (!e.s || e.s.hp <= 0 || e.s.falling || !p.alive || p.pos.distanceTo(e.s.mesh.position) > 9) { this.stopEdit(); return; }
    if (input.pressed('aim')) { this.building.edit(e.s, null); this.stopEdit(); this.hud.toast?.('Edit reset'); return; }
    if (!input.down('fire')) { e.paint = null; return; }
    const dir = this.camera.getWorldDirection(_dir);
    const tile = this.building.pickTile(this.camera.position, dir);
    if (tile < 0) return;
    const bit = 1 << tile;
    // the first tile you press decides whether the drag selects or deselects
    if (e.paint === null) e.paint = !(e.mask & bit);
    const next = e.paint ? e.mask | bit : e.mask & ~bit;
    if (next !== e.mask && next !== 511) { e.mask = next; this.building.showEditGrid(e.s, e.mask); this.sound.play('click'); }
  }

  // Channel the held consumable; finishing applies it and uses up one from the stack.
  // Grappler: pull toward the surface under the crosshair (up to 60 m).
  fireGrapple(p) {
    if (p.grapple) return;
    const dir = this.camera.getWorldDirection(_dir);
    const o = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist);
    const hit = this.world.raycast(o, dir, 60, {});
    if (!hit) { this.hud.toast?.('Too far to grapple'); return; }
    const to = o.clone().addScaledVector(dir, Math.max(0, hit.t - 0.6));
    if (p.startGrapple(to)) { p.consumeHeld(); this.sound.play('launch'); }
  }

  _updateGrappleLine() {
    const p = this.player, g = p?.grapple;
    if (!this._cable) {
      this._cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffd23f' }));
      this._cable.frustumCulled = false;
      this.scene.add(this._cable);
    }
    this._cable.visible = !!g;
    if (!g) return;
    const a = this._cable.geometry.attributes.position;
    const c = p.chest(_v1);
    a.setXYZ(0, c.x, c.y + 0.3, c.z);
    a.setXYZ(1, g.to.x, g.to.y, g.to.z);
    a.needsUpdate = true;
  }

  // Particle effects that come with some emotes.
  emoteFx(a, clip, pos = a.pos) {
    const fx = EMOTE_FX[clip];
    if (fx === 'confetti') setTimeout(() => this.effects.confetti(new THREE.Vector3(pos.x, pos.y - 4.5, pos.z)), 450);
    else if (fx === 'sparkle') {
      const c = new THREE.Color();
      for (let k = 0; k < 6; k++) setTimeout(() => {
        for (let i = 0; i < 14; i++) { c.setHSL(0.12 + Math.random() * 0.6, 1, 0.7); this.effects.sparks.emit(pos.x + (Math.random() - 0.5) * 1.4, pos.y + 0.4 + Math.random() * 1.6, pos.z + (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, c, 0.8, 0.15, -1); }
      }, k * 350);
    }
  }

  updateConsumable(dt) {
    const p = this.player;
    this._updateGrappleLine();
    const it = p.tickUse(dt);
    if (!it) return;
    if (!it.def.rift) this.meta.track('heal');
    this.sound.play(it.def.rift ? 'launch' : it.def.heal ? 'heal' : 'shield');
    if (it.count > 0 && p.held === it && this.input.down('fire')) p.startUse();
  }

  updateWarmup(dt) {
    const before = Math.ceil(this.warmup);
    this.warmup -= dt;
    const now = Math.ceil(this.warmup);
    if (now !== before && (now === 10 || now <= 5) && now > 0) this.hud.banner(`Bus leaves in ${now}`, 1);
    this.hud.warmupLabel?.(this.warmup);
    for (const r of [...this.respawns]) {
      if (this.time < r.t) continue;
      this.respawns.splice(this.respawns.indexOf(r), 1);
      this._warmupSpawn(r.a);
      if (r.a.isPlayer) this.hud.banner('Back in!', 1.2);
    }
    if (this.warmup <= 0) this.beginBus();
  }

  _victoryCam(dt) {
    const c = this.cinematic, p = this.player;
    c.t += dt / (c.t < 2.2 ? 0.35 : 0.8);
    c.yaw += dt * 1.2;
    const r = 5.5 - Math.min(1.5, c.t * 0.4);
    this.camera.position.set(p.pos.x + Math.sin(c.yaw) * r, p.pos.y + 2 + Math.sin(c.t * 0.8) * 0.4, p.pos.z + Math.cos(c.yaw) * r);
    this.camera.lookAt(p.pos.x, p.pos.y + 1.2, p.pos.z);
    if (this.camera.fov !== 55) { this.camera.fov = 55; this.camera.updateProjectionMatrix(); }
    p.bodyYaw = Math.atan2(this.camera.position.x - p.pos.x, this.camera.position.z - p.pos.z);
    if (c.t > c.dur) this.cinematic = null;
  }

  // Emote wheel: hold the emote key, flick the mouse toward an emote, release to play it.
  // A quick tap plays your equipped emote; on touch the wheel's slices are tappable.
  updateEmoteWheel(dt) {
    const p = this.player, input = this.input;
    const can = p.alive && p.state === 'ground' && !p.buildMode && !this.editing;
    const w = this.emoteWheel;
    if (!w) {
      if (input.pressed('emote') && can) {
        const list = this.meta.profile.d.owned.map((id) => COSMETICS[id]).filter((c) => c?.type === 'emote');
        const eq = this.meta.profile.equippedItem('emote');
        list.sort((a, b) => (b.id === eq.id) - (a.id === eq.id));
        this.emoteWheel = { t: 0, x: 0, y: 0, sel: -1, list: list.slice(0, 8), touch: !!this.touch };
        this.hud.emoteWheel(this.emoteWheel);
      }
      return;
    }
    w.t += dt;
    if (!w.touch) {
      const l = input.consumeLook();
      w.x = Math.max(-1, Math.min(1, w.x + l.x * 4)); w.y = Math.max(-1, Math.min(1, w.y + l.y * 4));
      const n = w.list.length;
      w.sel = Math.hypot(w.x, w.y) > 0.35 ? Math.round((((Math.atan2(w.x, -w.y) / (Math.PI * 2)) + 1) % 1) * n) % n : -1;
      this.hud.emoteWheel(w);
    }
    const release = w.touch ? w.picked !== undefined : !input.down('emote');
    if (!release && can) return;
    const pick = w.touch ? w.picked : w.sel >= 0 ? w.sel : w.t < 0.25 ? 0 : -1;
    if (can && pick >= 0 && w.list[pick]) { p.emote = p.emote === w.list[pick].value ? null : w.list[pick].value; if (p.emote) this.emoteFx(p, p.emote); }
    this.emoteWheel = null;
    this.hud.emoteWheel(null);
  }

  startSpectate(actor) {
    this.spectating = actor;
    this.hud.showSpectate(actor);
  }

  updateSpectate() {
    if (this.input.pressed('jump') || this.input.pressed('interact')) { this.finishSpectate(); return; }
    // click / aim: switch to the next / previous player still alive (nearest first)
    const dirn = this.input.pressed('fire') ? 1 : this.input.pressed('aim') ? -1 : 0;
    if (!dirn || !this.spectating) return;
    const cur = this.spectating;
    const list = this.actors.filter((a) => a.alive && !a.npc && !a.isPlayer && a.state !== 'bus').sort((a, b) => a.pos.distanceTo(cur.pos) - b.pos.distanceTo(cur.pos));
    if (list.length < 2) return;
    const i = list.indexOf(cur);
    this.startSpectate(list[(i + dirn + list.length) % list.length]);
  }

  finishSpectate() {
    if (this.state !== 'playing' || !this.deathInfo) return;
    this.endMatch(false, this.deathInfo.place, this.deathInfo.killer, 300);
  }

  updateStorm(dt) {
    const ev = this.storm.update(dt * (this.stormScale || 1), this.time);
    if (ev === 'shrink') { this.hud.banner?.(this.storm.moving ? 'The storm eye is moving!' : 'The storm eye is shrinking!', 3); this.sound.play('phase'); }
    else if (ev === 'phase') { this.hud.banner?.('Storm eye forming', 3); this.sound.play('stormChime'); if (this.player.alive) this.meta.track('circle'); }
    this._updateSurge(dt);
    this.stormTick += dt;
    const outside = this.player.alive && this.player.state !== 'bus' && !this.storm.isInside(this.player.pos.x, this.player.pos.z);
    this.hud.stormTint?.(outside);
    if (this.stormTick >= 1) {
      this.stormTick -= 1;
      const dmg = this.storm.damage;
      for (const a of this.actors) {
        if (!a.alive || a.state === 'bus') continue;
        const flip = this.gadgets.stormAt(a.pos);
        if (flip === 'safe' || (this.storm.isInside(a.pos.x, a.pos.z) && flip !== 'storm')) continue;
        a.health -= dmg;
        a.lastHurtTime = this.time;
        if (a.isPlayer) { this.sound.play('storm'); this.effects.damageNumber(this.player.chest(_origin), dmg, false, false); this.hud.stormFlash?.(); }
        if (a.health <= 0) { a.health = 0; a.die(null); }
      }
    }
  }

  // Storm surge: from the third circle on, while more players are alive than the circle allows,
  // whoever has dealt the least damage takes 25 every 5 s. Deal damage to stay safe.
  _updateSurge(dt) {
    const st = this.storm, limits = [0, 0, 0, 60, 45, 32, 22, 14, 9, 6, 4, 3];
    const scale = (this.actors.filter((a) => !a.npc).length) / 100;
    const limit = Math.max(3, Math.round((limits[st.phase] || 0) * scale));
    const alive = this.actors.filter((a) => a.alive && !a.npc && a.state !== 'bus');
    this.surge = st.phase >= 3 && limit > 3 && alive.length > limit ? { limit, over: alive.length - limit } : null;
    if (!this.surge) { this._surgeT = 5; return; }
    const sorted = alive.sort((a, b) => (a.dmgDealt || 0) - (b.dmgDealt || 0));
    this.surge.need = Math.round((sorted[this.surge.over]?.dmgDealt || 0) + 1);
    if (!this._surgeWarned || this._surgeWarned !== st.phase) {
      this._surgeWarned = st.phase;
      this.hud.banner?.(`STORM SURGE · deal ${this.surge.need}+ damage to stay safe`, 3.5);
    }
    this._surgeT = (this._surgeT ?? 5) - dt;
    if (this._surgeT > 0) return;
    this._surgeT = 5;
    for (const a of sorted.slice(0, this.surge.over)) {
      a.health -= 25;
      a.lastHurtTime = this.time;
      if (a.isPlayer) {
        this.sound.play('storm');
        this.effects.damageNumber(a.chest(_origin), 25, false, false);
        this.hud.banner?.(`Storm Surge! Deal ${this.surge.need}+ damage to stay safe`, 2.5);
      }
      if (a.health <= 0) { a.health = 0; a.deathCause = 'storm'; a.die(null); }
    }
  }

  // Players still in the match (NPC boss and guards don't count).
  get aliveCount() { return this.actors.reduce((n, a) => n + (a.alive && !a.npc ? 1 : 0), 0); }

  onActorDied(actor, killer) {
    this.effects.eliminate(actor.pos, actor.color);
    this.sound.play(killer?.isPlayer ? 'elim' : 'break', actor.pos);
    if (this.warmup > 0) {
      // warm-up: nothing counts, respawn shortly
      this.hud.killFeed?.(killer, actor);
      this.respawns.push({ a: actor, t: this.time + 2.5 });
      if (actor.isPlayer) this.hud.banner('Respawning…', 2);
      return;
    }
    if (actor.npc) {
      this.hud.killFeed?.(killer, actor);
      this.boss.onDeath(actor);
      if (killer?.isPlayer && actor.npc === 'boss') { this.meta.track('boss'); this.meta.track('bossKill'); }
      this.loot?.dropInventory(actor);
      if (actor === this.spectating) {
        const next = killer && killer.alive && !killer.npc ? killer : this.actors.find((x) => x.alive && !x.npc && !x.isPlayer);
        if (next) this.startSpectate(next);
      }
      return;
    }
    if (killer?.isPlayer && actor !== killer) this.addSpriteXp(20);
    if (killer?.isPlayer && actor !== killer) {
      this.meta.track('kill', 1, { dist: killer.pos.distanceTo(actor.pos), first: !this._firstBlood });
      if (killer.crowned) this.meta.track('crownKill');
    }
    if (killer && killer !== actor) this._firstBlood = true;
    // siphon: the eliminator regains 75 health, then shield, over 5 s (arena: an instant +50)
    if (killer && killer !== actor && killer.alive) {
      if (this.mode === 'arena') {
        let give = 50;
        const h = Math.min(give, 100 - killer.health); killer.health += h; give -= h;
        killer.shield = Math.min(100, killer.shield + give);
        if (killer.isPlayer) this.hud.pickupNote?.('+50 Siphon', '#7dff8a');
      } else {
        const sip = this.overrides.has('siphon') ? 150 : 75;
        killer.regen = { rate: 15, left: sip + (killer.regen?.left || 0), acc: 0 };
        if (killer.isPlayer) this.hud.pickupNote?.(`+${sip} Siphon`, '#7dff8a');
      }
    }
    if (killer && killer !== actor) killer.kills++;
    this.hud.killFeed?.(killer, actor);
    this.loot?.dropInventory(actor);
    if (this.state !== 'playing') return;
    const p = this.player;
    if (actor === p) {
      this.hud.hurt();
      this.hud.prompt(null);
      if (this.sound.musicName === 'endgame' || this.sound.musicName === 'bus') this.sound.music(null);
      this.deathInfo = { place: this.aliveCount + 1, killer: killer && killer !== p ? killer : null, time: this.time };
      // watch whoever got you (after a beat), like the real thing
      const k = this.deathInfo.killer;
      if (k && k.alive && this.aliveCount > 1) {
        setTimeout(() => { if (this.state === 'playing' && !p.alive) this.startSpectate(k); }, 1600);
      } else this.endMatch(false, this.deathInfo.place, this.deathInfo.killer);
    } else if (actor === this.spectating) {
      // the one we watch went down: follow their killer, or the closest survivor
      const next = killer && killer.alive && killer !== actor ? killer : this.actors.filter((a) => a.alive).sort((a, b) => a.pos.distanceTo(actor.pos) - b.pos.distanceTo(actor.pos))[0];
      if (this.aliveCount <= 1) {
        this.hud.banner(`${next ? next.name : 'Someone'} wins!`, 3);
        setTimeout(() => this.finishSpectate(), 2500);
      }
      if (next) this.startSpectate(next);
    } else if (!p.alive && this.spectating && this.aliveCount === 1) {
      this.hud.banner(`${this.spectating.name} wins!`, 3);
      setTimeout(() => this.finishSpectate(), 2500);
    } else if (p.alive && this.aliveCount === 1) {
      p.victory = true;
      this.hud.banner('#1 VICTORY!', 4);
      this.sound.music(null);
      this.effects.confetti(p.pos);
      setTimeout(() => this.effects.confetti(p.pos), 700);
      setTimeout(() => this.effects.confetti(p.pos), 1600);
      // slow-motion orbit around the winner before the results
      this.cinematic = { t: 0, dur: 5, yaw: this.rig.yaw };
      this.endMatch(true, 1, null, 5200);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.post?.setSize(window.innerWidth, window.innerHeight);
  }
}

const _dir = new THREE.Vector3(), _origin = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _v1 = new THREE.Vector3();
const _projView = new THREE.Matrix4();

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
