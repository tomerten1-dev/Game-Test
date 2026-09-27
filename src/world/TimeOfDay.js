import * as THREE from 'three';
import { SKY_TOP, SKY_HORIZON, createSkyMesh } from './Sky.js';

// Per-match lighting moods. The sun keeps its direction (terrain shadows are baked),
// only colours, intensities and the sky gradient change.
export const MOODS = {
  day: { name: 'Sunny Day', top: '#1c5ad8', horizon: '#aedcff', hemiSky: '#cfe8ff', hemiGround: '#6f8f4a', hemi: 1.1, sun: '#ffe3b8', sunI: 2.6, cloud: '#aebfd9', exposure: 1.0 },
  golden: { name: 'Golden Hour', top: '#3862c0', horizon: '#ffc896', hemiSky: '#ffe2c4', hemiGround: '#7d6c3c', hemi: 0.95, sun: '#ffb574', sunI: 2.8, cloud: '#ffcfa6', exposure: 1.03 },
  dusk: { name: 'Dusk', top: '#1f2d70', horizon: '#f59e8c', hemiSky: '#c2bcff', hemiGround: '#4c4d57', hemi: 0.8, sun: '#ff9d6e', sunI: 2.0, cloud: '#d9a7c9', exposure: 1.06 },
};

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
  // re-bake the sky reflections so metals and water pick up the new colours
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(createSkyMesh(100));
  const old = world.envMap;
  world.envMap = pmrem.fromScene(envScene, 0.02, 0.1, 500).texture;
  scene.environment = world.envMap;
  pmrem.dispose();
  old?.dispose();
  return m;
}
