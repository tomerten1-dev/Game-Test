import * as THREE from 'three';
import { World } from '../world/World.js';
import { TOWNS } from '../world/Terrain.js';
import { CharacterAssets } from '../player/Character.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Input } from './Input.js';
import { quality } from './device.js';

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
    this.rig.yaw = 0;
    this.input.enabled = true;
  }

  start() {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.time += dt;
    const p = this.player;
    p.readInput(dt, this.input, this.rig);
    for (const a of this.actors) a.updateMovement(dt);
    const mode = p.state === 'ground' ? (p.aiming ? 'aim' : 'ground') : p.state;
    this.rig.update(dt, p.pos, mode);
    for (const a of this.actors) a.updateVisual(dt, this.camera.position);
    this.focus.copy(p.pos);
    this.world.update(dt, this.time, this.focus, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
