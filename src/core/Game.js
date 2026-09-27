import * as THREE from 'three';
import { World } from '../world/World.js';
import { TOWNS } from '../world/Terrain.js';
import { CharacterAssets } from '../player/Character.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Input } from './Input.js';
import { quality } from './device.js';
import { Sound } from './Audio.js';
import { Effects } from '../effects/Effects.js';
import { Combat } from '../weapons/Combat.js';
import { Weapon } from '../weapons/Weapon.js';
import { Bot } from '../bots/Bot.js';
import { BOT_NAMES, botColors } from '../bots/names.js';
import { Storm } from '../world/Storm.js';
import { Bus } from '../world/Bus.js';
import { HUD } from '../ui/HUD.js';

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
    window.addEventListener('resize', () => this.onResize());
  }

  async init(progress = () => {}) {
    progress(0.1, 'Loading robots…');
    this.assets = await CharacterAssets.load();
    progress(0.35, 'Shaping the island…');
    await nextFrame();
    this.world = new World(this.scene, this.renderer);
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
    this.rig = new CameraRig(this.camera, this.world);
    this.focus = new THREE.Vector3();
    this.startMatch();
    progress(1, 'Ready!');
  }

  startMatch() {
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.effects.clear();
    this.time = 0;
    this.stormTick = 0;
    this.matchOver = false;
    this.bus.launch();
    this.storm.reset();

    this.player = new Player(this);
    this.actors.push(this.player);
    this.player.giveWeapon(new Weapon('pistol', 0), 0);

    const colors = botColors(19);
    this.bots = [];
    for (let i = 0; i < 19; i++) {
      const b = new Bot(this, BOT_NAMES[i], colors[i], Math.random());
      b.giveWeapon(new Weapon('pistol', 0));
      this.bots.push(b);
      this.actors.push(b);
    }
    for (const b of this.bots) this._planDrop(b);
    for (const a of this.actors) { a.setState('bus'); a.pos.copy(this.bus.pos); }
    this.rig.yaw = Math.atan2(-this.bus.vel.x, -this.bus.vel.z) + 0.6;
    this.rig.pitch = -0.25;
    this.hud.show(true);
    this.hud.banner?.('Press SPACE to jump from the Battle Bus', 6);
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
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.time += dt;
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
      this.hud.banner?.('Steer with WASD — glider opens automatically', 4);
      this.sound.play('glider');
    }
    for (const b of this.bots) {
      if (b.state === 'bus' && !this.bus.active) b.jumpFromBus(this.bus.pos, this.bus.vel);
      b.update(dt);
    }
    this.updateStorm(dt);
    for (const a of this.actors) {
      a.updateMovement(dt);
      for (const w of a.weapons) if (w && w.update(dt) === 'reloaded' && a.isPlayer) this.sound.play('reloaded');
    }
    const mode = !p.alive ? 'dead' : p.state === 'ground' ? (p.aiming ? 'aim' : 'ground') : p.state;
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
    for (let i = 0; i < 3; i++) if (input.pressed('slot' + (i + 1))) p.switchSlot(i);
    const wheel = input.consumeWheel();
    if (wheel) {
      for (let k = 1; k <= 3; k++) {
        const i = (p.slot + Math.sign(wheel) * k + 3) % 3;
        if (p.weapons[i]) { p.switchSlot(i); break; }
      }
    }
    if (input.pressed('reload')) this.combat.reload(p);
    if (input.down('fire') && p.weapon && p.state === 'ground') {
      if (!p.weapon.canFire()) {
        if (input.pressed('fire') && p.weapon.ammo <= 0) this.sound.play('empty');
        if (p.weapon.ammo <= 0) this.combat.reload(p);
        return;
      }
      const dir = this.camera.getWorldDirection(_dir);
      const origin = _origin.copy(this.camera.position).addScaledVector(dir, this.rig.curDist + 0.25);
      p.character.root.updateMatrixWorld(true);
      p.bodyYaw = p.aimYaw;
      this.combat.fire(p, origin, dir, p.muzzleWorld(_muzzle));
    }
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
    if (actor === this.player) this.hud.hurt();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const _dir = new THREE.Vector3(), _origin = new THREE.Vector3(), _muzzle = new THREE.Vector3();

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
