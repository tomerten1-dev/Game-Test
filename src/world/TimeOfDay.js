import * as THREE from 'three';
import { SKY_TOP, SKY_HORIZON, createSkyMesh } from './Sky.js';

// Per-match lighting moods. The sun keeps its direction (terrain shadows are baked),
// only colours, intensities and the sky gradient change.
export const MOODS = {
  day: { name: 'Sunny Day', top: '#1c5ad8', horizon: '#aedcff', hemiSky: '#cfe8ff', hemiGround: '#6f8f4a', hemi: 1.1, sun: '#ffe3b8', sunI: 2.6, cloud: '#aebfd9', exposure: 1.0 },
  golden: { name: 'Golden Hour', top: '#3862c0', horizon: '#ffc896', hemiSky: '#ffe2c4', hemiGround: '#7d6c3c', hemi: 0.95, sun: '#ffb574', sunI: 2.8, cloud: '#ffcfa6', exposure: 1.03 },
  dusk: { name: 'Dusk', top: '#1f2d70', horizon: '#f59e8c', hemiSky: '#c2bcff', hemiGround: '#4c4d57', hemi: 0.8, sun: '#ff9d6e', sunI: 2.0, cloud: '#d9a7c9', exposure: 1.06 },
  night: { name: 'Night', top: '#070d24', horizon: '#26336a', hemiSky: '#7d8fd6', hemiGround: '#2a2f45', hemi: 0.55, sun: '#a9bcff', sunI: 0.85, cloud: '#5a6390', exposure: 1.25, stars: 1, sunGlow: 0.25, env: 0.25 },
};

// In-match day/night timeline (seconds after the bus leaves) with smooth transitions.
const CYCLE = [[0, 'day'], [150, 'golden'], [270, 'dusk'], [390, 'night']];
const BLEND = 45;
const _a = new THREE.Color(), _b = new THREE.Color();

export class DayCycle {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.name = 'day';
  }

  start() { this.active = true; this.name = null; this.apply(0); }
  stop() { this.active = false; }

  // Blend the lighting for match time t.
  apply(t) {
    let i = 0;
    while (i < CYCLE.length - 1 && t >= CYCLE[i + 1][0]) i++;
    const cur = MOODS[CYCLE[i][1]];
    const next = CYCLE[i + 1];
    let k = 0, to = cur;
    if (next && t > next[0] - BLEND) { to = MOODS[next[1]]; k = (t - (next[0] - BLEND)) / BLEND; }
    const { world, scene, renderer } = this.game;
    const mix = (x, y) => _a.set(x).lerp(_b.set(y), k);
    SKY_TOP.copy(mix(cur.top, to.top));
    SKY_HORIZON.copy(mix(cur.horizon, to.horizon));
    scene.background.copy(SKY_HORIZON);
    if (scene.fog) scene.fog.color.copy(SKY_HORIZON);
    this.game.stormFX?.setBaseFog(scene.fog);
    const L = world.lighting;
    L.hemi.color.copy(mix(cur.hemiSky, to.hemiSky));
    L.hemi.groundColor.copy(mix(cur.hemiGround, to.hemiGround));
    L.hemi.intensity = cur.hemi + (to.hemi - cur.hemi) * k;
    L.sun.color.copy(mix(cur.sun, to.sun));
    L.sun.intensity = cur.sunI + (to.sunI - cur.sunI) * k;
    for (const im of world.clouds.templates) im.material.emissive.copy(mix(cur.cloud, to.cloud));
    renderer.toneMappingExposure = cur.exposure + (to.exposure - cur.exposure) * k;
    const u = world.sky.material.uniforms;
    u.uStars.value = (cur.stars || 0) + ((to.stars || 0) - (cur.stars || 0)) * k;
    u.uSunGlow.value = (cur.sunGlow ?? 1) + ((to.sunGlow ?? 1) - (cur.sunGlow ?? 1)) * k;
    scene.environmentIntensity = 0.55 * ((cur.env ?? 1) + ((to.env ?? 1) - (cur.env ?? 1)) * k);
    const name = k > 0.5 ? to.name : cur.name;
    if (name !== this.name) {
      if (this.name && this.active) this.game.hud?.banner(name === 'Night' ? 'Night falls…' : name, 2.5);
      this.name = name;
    }
  }

  update(t) { if (this.active) this.apply(t); }
}

export function pickMood() {
  const r = Math.random();
  return r < 0.5 ? 'day' : r < 0.8 ? 'golden' : 'dusk';
}

export function applyMood(game, key) {
  const m = MOODS[key];
  const { world, scene, renderer } = game;
  SKY_TOP.set(m.top);
  SKY_HORIZON.set(m.horizon);
  scene.background = SKY_HORIZON.clone();
  if (scene.fog) scene.fog.color.copy(SKY_HORIZON);
  game.stormFX?.setBaseFog(scene.fog);
  const L = world.lighting;
  L.hemi.color.set(m.hemiSky);
  L.hemi.groundColor.set(m.hemiGround);
  L.hemi.intensity = m.hemi;
  L.sun.color.set(m.sun);
  L.sun.intensity = m.sunI;
  for (const im of world.clouds.templates) im.material.emissive.set(m.cloud);
  renderer.toneMappingExposure = m.exposure;
  const u = world.sky.material.uniforms;
  u.uStars.value = m.stars || 0;
  u.uSunGlow.value = m.sunGlow ?? 1;
  // re-bake the sky reflections so metals and water pick up the new colours
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(createSkyMesh(100));
  const old = world.envMap;
  world.envMap = pmrem.fromScene(envScene, 0.02, 0.1, 500).texture;
  scene.environment = world.envMap;
  scene.environmentIntensity = 0.55 * (m.env ?? 1);
  pmrem.dispose();
  old?.dispose();
  return m;
}
