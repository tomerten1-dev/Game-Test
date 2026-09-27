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
import { Weapon } from '../weapons/Weapon.js';
import { Bot } from '../bots/Bot.js';
import { BOT_NAMES, botColors } from '../bots/names.js';
import { Storm } from '../world/Storm.js';
import { Bus } from '../world/Bus.js';
import { Loot } from '../world/Loot.js';
import { Building } from '../world/Building.js';
import { HUD } from '../ui/HUD.js';
import { Ambient } from '../effects/Ambient.js';
import { Menus } from '../ui/Menus.js';
import { TouchControls } from '../ui/TouchControls.js';
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

  onPointerLockChange() {
    if (isTouch) return;
    if (this.input.locked) {
      this.paused = false;
      this.menus.showPause(false);
    } else if (this.state === 'playing' && this.player?.alive) {
      this.paused = true;
      this.input.reset();
      this.menus.showPause(true);
    }
  }

  endMatch(victory, place, killer) {
    if (this.state !== 'playing') return;
    this.state = 'ending';
    const p = this.player;
    setTimeout(() => {
      this.state = 'ended';
      this.touch?.show(false);
      if (document.pointerLockElement) document.exitPointerLock();
      this.menus.showEnd({ victory, place, killer: killer?.name, cause: p.deathCause, kills: p.kills, time: Math.max(0, this.time - this.matchStart) });
      this.sound.play(victory ? 'victory' : 'defeat');
    }, victory ? 2600 : 2200);
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
    if (!this._firstMatch) this.loot.reset();
    this._firstMatch = false;

    this.player = new Player(this);
    this.actors.push(this.player);
    this.player.giveWeapon(new Weapon('pistol', 0), 1);
    this.player.addAmmo('light', 48);
    this.player.switchSlot(1);

    const colors = botColors(19);
    this.bots = [];
    for (let i = 0; i < 19; i++) {
      const b = new Bot(this, BOT_NAMES[i], colors[i], Math.random(), CHARACTER_TYPES[i % CHARACTER_TYPES.length]);
      b.giveWeapon(new Weapon('pistol', 0), 1);
      b.switchSlot(1);
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
    if (p.alive) {
      p.readInput(dt, this.input, this.rig);
      this.updatePlayerCombat(dt);
    } else {
      p.intent.mx = p.intent.mz = 0;
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
    const mode = !p.alive || p.victory ? 'dead' : p.state === 'ground' ? (p.aiming ? 'aim' : 'ground') : p.state;
    this.rig.update(dt, p.state === 'bus' ? this.bus.mesh.position : p.pos, mode);
    for (const a of this.actors) a.updateVisual(dt, this.camera.position);
    this.focus.copy(p.pos);
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
    if (wheel) {
      for (let k = 1; k <= 6; k++) {
        const i = (p.slot + Math.sign(wheel) * k + 12) % 6;
        if (p.items[i]) { p.switchSlot(i); break; }
      }
    }
    if (input.pressed('reload')) this.combat.reload(p);
    if (p.state === 'ground') {
      if (input.pressed('wall') && !this.building.buildWall(p) && p.wood < 10) this.hud.toast?.('Need 10 wood');
      if (input.pressed('ramp') && !this.building.buildRamp(p) && p.wood < 10) this.hud.toast?.('Need 10 wood');
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
        if (held.usableBy(p)) { p.useT = held.def.time; p.useItem = held; this.sound.play('use'); }
        else this.hud.toast?.(held.def.heal ? 'Health is already full' : 'Shield is already full');
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

  // Channel the held consumable; finishing applies it and uses up one from the stack.
  updateConsumable(dt) {
    const p = this.player;
    if (p.useT <= 0) return;
    const it = p.useItem;
    if (p.held !== it || !it) { p.useT = 0; return; }
    p.useT -= dt;
    if (p.useT > 0) return;
    p.useT = 0;
    it.apply(p);
    this.sound.play(it.def.heal ? 'heal' : 'shield');
    if (--it.count <= 0) {
      p.items[p.slot] = null;
      const next = p.items.findIndex((x, i) => i > 0 && x);
      p.switchSlot(next > 0 ? next : 0);
    } else if (it.usableBy(p) && this.input.down('fire')) { p.useT = it.def.time; this.sound.play('use'); }
  }

  updateStorm(dt) {
    const ev = this.storm.update(dt, this.time);
    if (ev === 'shrink') { this.hud.banner?.('The storm is closing in!', 3); this.sound.play('phase'); }
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
      this.endMatch(false, this.aliveCount + 1, killer && killer !== p ? killer : null);
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
