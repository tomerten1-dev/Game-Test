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
import { Actor } from '../player/Actor.js';
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
    this.rig = new CameraRig(this.camera, this.world);
    this.focus = new THREE.Vector3();
    this.startMatch();
    progress(1, 'Ready!');
  }

  startMatch() {
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.player = new Player(this);
    this.actors.push(this.player);
    const t = TOWNS[0];
    this.player.spawnGround(t.x + 4, t.z + 4);
    this.player.giveWeapon(new Weapon('pistol', 0), 0);
    this.player.giveWeapon(new Weapon('ar', 2), 1);
    this.player.giveWeapon(new Weapon('shotgun', 4), 2);
    // Stage 3 training dummies
    const colors = ['#ff5d73', '#ffb830', '#9b5de5'];
    for (let i = 0; i < 3; i++) {
      const d = new Actor(this, { name: `Dummy ${i + 1}`, color: colors[i] });
      d.spawnGround(t.x - 6 + i * 5, t.z - 8);
      d.giveWeapon(new Weapon('smg', i + 1));
      d.shield = 50;
      this.actors.push(d);
    }
    this.rig.yaw = 0;
    this.hud.show(true);
    this.input.enabled = true;
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
    p.readInput(dt, this.input, this.rig);
    this.updatePlayerCombat(dt);
    for (const a of this.actors) {
      a.updateMovement(dt);
      for (const w of a.weapons) if (w && w.update(dt) === 'reloaded' && a.isPlayer) this.sound.play('reloaded');
    }
    const mode = p.state === 'ground' ? (p.aiming ? 'aim' : 'ground') : p.state;
    this.rig.update(dt, p.pos, mode);
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

  onActorDied(actor, killer) {
    this.effects.eliminate(actor.pos, actor.color);
    this.sound.play(killer?.isPlayer ? 'elim' : 'break', actor.pos);
    if (killer) killer.kills++;
    if (actor.name.startsWith('Dummy')) {
      setTimeout(() => { actor.alive = true; actor.health = 100; actor.shield = 50; actor.setState('ground'); actor.character.play('Idle', 0.2); }, 2500);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const _dir = new THREE.Vector3(), _origin = new THREE.Vector3(), _muzzle = new THREE.Vector3();

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
