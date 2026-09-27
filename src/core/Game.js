import * as THREE from 'three';
import { World } from '../world/World.js';
import { TOWNS } from '../world/Terrain.js';
import { CharacterAssets, CHARACTER_TYPES } from '../player/Character.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Input } from './Input.js';
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
import { Pings } from '../ui/Pings.js';
import { StormFX } from '../effects/StormFX.js';
import { isTouch } from './device.js';

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
    this.ambient = new Ambient(this);
    this._firstMatch = true;
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.quality = new Quality(this);
    this.quality.apply();
    this.rig = new CameraRig(this.camera, this.world);
    this.focus = new THREE.Vector3();
    this.pings = new Pings(this, ui);
    this.map = new MapScreen(ui, this);
    this.stormFX = new StormFX(this.scene);
    this.sound.onPositional = (name, pos, v) => this.hud.soundViz(name, pos, v);
    this.menus = new Menus(ui, this);
    if (isTouch) {
      document.body.classList.add('touch');
      this.touch = new TouchControls(ui, this.input, this);
    }
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    this.state = 'menu';
    this.menus.showMenu(true);
    progress(1, 'Ready!');
  }

  // Menu "Play" / end screen "Play Again": new match without reloading the page.
  play() {
    this.map.show(false);
    this.menus.showMenu(false);
    this.menus.hideEnd();
    this.menus.showPause(false);
    this.paused = false;
    this.hud.reset();
    this.startMatch();
    this.state = 'playing';
    this.touch?.show(true);
    if (!isTouch) this.input.requestLock();
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

  onPointerLockChange() {
    if (isTouch) return;
    if (this._mapUnlock) { this._mapUnlock = false; return; }
    if (this.map?.open) return;
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
      const alive = (this.deathInfo?.time ?? this.time) - this.matchStart;
      this.menus.showEnd({ victory, place, killer: killer?.name, cause: p.deathCause, kills: p.kills, time: Math.max(0, alive) });
      this.sound.play(victory ? 'victory' : 'defeat');
    }, delay);
  }

  startMatch() {
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.effects.clear();
    this.time = 0;
    this.stormTick = 0;
    this.matchStart = 0;
    this.bus.launch();
    this.storm.reset();
    this.building.reset();
    this.pings.reset();
    this.spectating = null;
    this.deathInfo = null;
    this.hud.showSpectate(null);
    if (!this._firstMatch) this.loot.reset();
    this._firstMatch = false;

    this.player = new Player(this);
    this.actors.push(this.player);

    const colors = botColors(19);
    this.bots = [];
    for (let i = 0; i < 19; i++) {
      const b = new Bot(this, BOT_NAMES[i], colors[i], Math.random(), CHARACTER_TYPES[i % CHARACTER_TYPES.length]);
      this.bots.push(b);
      this.actors.push(b);
    }
    for (const b of this.bots) this._planDrop(b);
    for (const a of this.actors) { a.setState('bus'); a.pos.copy(this.bus.pos); }
    this.rig.yaw = Math.atan2(-this.bus.vel.x, -this.bus.vel.z) + 0.6;
    this.rig.pitch = -0.25;
    this.hud.show(true);
    this.hud.banner(isTouch ? 'Tap JUMP to drop from the Storm Bus' : 'Press SPACE to jump from the Storm Bus', 6);
    this.sound.play('bus');
    this.input.enabled = true;
  }

  // Bots pick a landing spot (often a town) and a moment to jump.
  _planDrop(b) {
    const w = this.world;
    const towns = TOWNS;
    let x = 0, z = 0;
    for (let i = 0; i < 30; i++) {
      if (Math.random() < 0.4) {
        const t = towns[Math.floor(Math.random() * towns.length)];
        x = t.x + (Math.random() - 0.5) * t.r * 1.2; z = t.z + (Math.random() - 0.5) * t.r * 1.2;
      } else {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 140;
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

  start() {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    if (this.state === 'menu') this.updateMenu(dt);
    else if (!this.paused) {
      this.update(dt);
      if (this.state === 'playing') this.quality.monitor(dt);
    }
    this.post.render(dt);
  }

  // Slow cinematic orbit behind the start screen.
  updateMenu(dt) {
    this.time += dt;
    const t = this.time * 0.04;
    this.camera.position.set(Math.cos(t) * 185, 70, Math.sin(t) * 185);
    this.camera.lookAt(0, 8, 0);
    this.focus.set(0, 0, 0);
    this.world.update(dt, this.time, this.focus, this.camera);
    this.loot.update(dt, this.time);
    this.ambient.update(dt, this.time);
    this.effects.update(dt);
  }

  update(dt) {
    this.time += dt;
    if (this.input.pressed('mute')) this.hud.toast(this.sound.toggleMute() ? 'Sound off' : 'Sound on');
    const p = this.player;
    if (this.input.pressed('map')) this.toggleMap();
    else if (this.map.open && this.input.pressed('pause')) this.toggleMap(false);
    if (this.spectating) this.updateSpectate(dt);
    if (p.alive) {
      p.readInput(dt, this.input, this.rig);
      this.updatePlayerCombat(dt);
    } else {
      p.intent.mx = p.intent.mz = 0;
      p.setBuildMode(null);
      const look = this.input.consumeLook();
      this.rig.addLook(look.x, look.y);
    }
    this.bus.update(dt, this.time);
    for (const a of this.actors) if (a.state === 'bus') a.pos.copy(this.bus.pos);
    if (p.state === 'bus' && ((this.input.pressed('jump') && this.bus.canDrop) || !this.bus.active)) {
      p.jumpFromBus(this.bus.pos, this.bus.vel);
      this.hud.banner(isTouch ? 'Steer with the stick — glider opens automatically' : 'Steer with WASD — glider opens automatically', 4);
      this.sound.play('glider');
    }
    for (const b of this.bots) {
      if (b.state === 'bus' && !this.bus.active) b.jumpFromBus(this.bus.pos, this.bus.vel);
      b.update(dt);
    }
    this.updateStorm(dt);
    this.loot.update(dt, this.time);
    this.building.update(dt);
    this.ambient.update(dt, this.time);
    for (const a of this.actors) {
      a.updateMovement(dt);
      for (const w of a.items) {
        if (w && w.update(dt) === 'reloaded') { a.finishReload(w); if (a.isPlayer) this.sound.play('reloaded'); }
      }
      this.loot.autoPickup(a);
    }
    this.sound.updateListener?.(this.camera);
    this.sound.chestHum?.(p.alive && p.state === 'ground' ? this.loot.nearestChest(p.pos, 18) : null, p.pos);
    const view = this.spectating || p;
    const mode = this.spectating ? (view.state === 'ground' ? 'ground' : view.state) : !p.alive || p.victory ? 'dead' : p.state === 'ground' ? (p.aiming ? 'aim' : 'ground') : p.state;
    this.rig.update(dt, view.state === 'bus' ? this.bus.mesh.position : view.pos, mode);
    for (const a of this.actors) a.updateVisual(dt, this.camera.position);
    this.focus.copy(view.pos);
    this.pings.update(dt);
    const cam = this.camera.position;
    this.stormFX.update(dt, this.camera, this.state === 'playing' && view.state !== 'bus' && !this.storm.isInside(cam.x, cam.z) ? 1 : 0);
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
    if (input.pressed('ping') && p.state !== 'bus') {
      const dir = this.camera.getWorldDirection(_dir);
      this.pings.ping(_origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist), dir);
    }
    if (this.updateBuild(dt)) return;
    if (p.state === 'ground') {
      const near = this.loot.nearestInteractable(p.pos);
      const text = !near ? null : near.kind === 'chest' ? 'Open Chest' : near.kind === 'ammobox' ? 'Open Ammo Box' : `Pick up ${this.loot.label(near.pickup)}`;
      this.hud.prompt?.(text, near?.pickup?.weapon?.rarity);
      if (near && input.pressed('interact')) {
        if (near.kind === 'chest') this.loot.openChest(near.chest, p);
        else if (near.kind === 'ammobox') this.loot.openAmmoBox(near.box, p);
        else { const msg = this.loot.collect(near.pickup, p); if (msg) this.hud.toast?.(msg); }
      }
    } else this.hud.prompt?.(null);
    this.updateConsumable(dt);
    const held = p.held;
    if (!held || p.state !== 'ground') return;
    if (held.isConsumable) {
      if (input.pressed('fire') && p.useT <= 0) {
        if (!p.startUse()) this.hud.toast?.(held.def.heal ? 'Health is already full' : 'Shield is already full');
      }
      return;
    }
    if (!input.down('fire')) return;
    const dir = this.camera.getWorldDirection(_dir);
    const origin = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist + 0.25);
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
    if (input.pressed('edit') && p.state === 'ground') this.editLookedAtWall();
    for (const piece of PIECES) {
      if (!input.pressed(piece)) continue;
      if (this.touch) { this.placePiece(piece); return false; }
      p.setBuildMode(piece);
    }
    if (input.pressed('build')) p.setBuildMode(p.buildMode ? null : this._lastPiece || 'wall');
    if (input.pressed('buildmat')) this.cycleBuildMat();
    if (!p.buildMode || p.state !== 'ground' || !p.alive) {
      if (p.buildMode && !p.alive) p.setBuildMode(null);
      b.hideGhost();
      return false;
    }
    this._lastPiece = p.buildMode;
    if (input.pressed('aim')) this.cycleBuildMat();
    const plan = b.plan(p, p.buildMode, p.aimYaw, p.aimPitch);
    const mat = b.pickMat(p, p.buildMat);
    b.showGhost(plan, b.isValid(plan, p, mat));
    this.hud.prompt?.(null);
    if (input.down('fire') && this._buildCd <= 0) this.placePiece(p.buildMode, plan);
    return true;
  }

  placePiece(piece, plan) {
    const p = this.player, b = this.building;
    if (p.state !== 'ground') return;
    plan = plan || b.plan(p, piece, p.aimYaw, p.aimPitch);
    const mat = b.pickMat(p, p.buildMat);
    if (!mat) { if (!this._buildCd) this.hud.toast?.(`Need ${COST} materials — harvest with the axe`); this._buildCd = 0.4; return; }
    if (mat !== p.buildMat) { p.buildMat = mat; }
    if (b.build(p, plan, mat)) this._buildCd = 0.16;
  }

  cycleBuildMat() {
    const p = this.player;
    const i = BUILD_MATS.indexOf(p.buildMat);
    p.buildMat = BUILD_MATS[(i + 1) % BUILD_MATS.length];
    this.sound.play('click');
  }

  // Cut a door / window into the wall under the crosshair (only your own pieces, like the real thing).
  editLookedAtWall() {
    const dir = this.camera.getWorldDirection(_dir);
    const origin = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist * 0.8);
    const hit = this.world.raycast(origin, dir, 7);
    const s = hit?.collider?.structure;
    if (!s || s.type !== 'wall') { this.hud.toast?.('Look at one of your walls to edit it'); return; }
    if (s.owner !== this.player) { this.hud.toast?.('You can only edit your own walls'); return; }
    const e = this.building.edit(s);
    this.hud.toast?.(e === 'door' ? 'Edit: door' : e === 'window' ? 'Edit: window' : 'Edit: reset');
  }

  // Channel the held consumable; finishing applies it and uses up one from the stack.
  updateConsumable(dt) {
    const p = this.player;
    const it = p.tickUse(dt);
    if (!it) return;
    this.sound.play(it.def.heal ? 'heal' : 'shield');
    if (it.count > 0 && p.held === it && this.input.down('fire')) p.startUse();
  }

  startSpectate(actor) {
    this.spectating = actor;
    this.hud.showSpectate(actor);
  }

  updateSpectate() {
    if (this.input.pressed('jump') || this.input.pressed('interact')) this.finishSpectate();
  }

  finishSpectate() {
    if (this.state !== 'playing' || !this.deathInfo) return;
    this.endMatch(false, this.deathInfo.place, this.deathInfo.killer, 300);
  }

  updateStorm(dt) {
    const ev = this.storm.update(dt, this.time);
    if (ev === 'shrink') { this.hud.banner?.(this.storm.moving ? 'The storm is moving!' : 'The storm is closing in!', 3); this.sound.play('phase'); }
    else if (ev === 'phase') this.hud.banner?.('Storm shrinks again soon', 3);
    this.stormTick += dt;
    const outside = this.player.alive && this.player.state !== 'bus' && !this.storm.isInside(this.player.pos.x, this.player.pos.z);
    this.hud.stormTint?.(outside);
    if (this.stormTick >= 1) {
      this.stormTick -= 1;
      const dmg = this.storm.damage;
      for (const a of this.actors) {
        if (!a.alive || a.state === 'bus') continue;
        if (this.storm.isInside(a.pos.x, a.pos.z)) continue;
        a.health -= dmg;
        a.lastHurtTime = this.time;
        if (a.isPlayer) { this.sound.play('storm'); this.effects.damageNumber(this.player.chest(_origin), dmg, false, false); }
        if (a.health <= 0) { a.health = 0; a.die(null); }
      }
    }
  }

  get aliveCount() { return this.actors.reduce((n, a) => n + (a.alive ? 1 : 0), 0); }

  onActorDied(actor, killer) {
    this.effects.eliminate(actor.pos, actor.color);
    this.sound.play(killer?.isPlayer ? 'elim' : 'break', actor.pos);
    if (killer && killer !== actor) killer.kills++;
    this.hud.killFeed?.(killer, actor);
    this.loot?.dropInventory(actor);
    if (this.state !== 'playing') return;
    const p = this.player;
    if (actor === p) {
      this.hud.hurt();
      this.hud.prompt(null);
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
      this.hud.banner('#1 VICTORY!', 3);
      this.effects.confetti(p.pos);
      setTimeout(() => this.effects.confetti(p.pos), 700);
      this.endMatch(true, 1, null);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.post?.setSize(window.innerWidth, window.innerHeight);
  }
}

const _dir = new THREE.Vector3(), _origin = new THREE.Vector3(), _muzzle = new THREE.Vector3();

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
