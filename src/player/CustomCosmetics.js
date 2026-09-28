import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { registerCustomCosmetic } from '../meta/Cosmetics.js';

// Your own cosmetic models: .glb / .gltf files in <project>/cosmetics/gliders, /pickaxes and /backblings
// become Locker items (always owned, named after the file). The folder is git-ignored, so the models
// stay on your computer. Each model is sized to fit the slot (glider span, pickaxe length, back bling
// height) and centred; orientation comes from the file.
const FILES = import.meta.glob('/cosmetics/*/*.{glb,gltf,GLB,GLTF}', { query: '?url', import: 'default', eager: true });
const KINDS = { gliders: 'glider', glider: 'glider', pickaxes: 'pickaxe', pickaxe: 'pickaxe', backblings: 'backbling', backbling: 'backbling', backpacks: 'backbling', backpack: 'backbling' };

export const CUSTOM_MODELS = {}; // id -> { kind, scene, size, box }
export const CUSTOM_BY_KIND = { glider: [], pickaxe: [], backbling: [] }; // cosmetic values, for bots

export async function loadCosmeticFolder() {
  const loader = new GLTFLoader();
  for (const [path, url] of Object.entries(FILES)) {
    const parts = path.split('/'), folder = parts[parts.length - 2].toLowerCase(), file = parts[parts.length - 1];
    const kind = KINDS[folder];
    if (!kind) continue;
    try {
      const g = await loader.loadAsync(url);
      const scene = g.scene;
      scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      if (box.isEmpty()) continue;
      const id = `${kind}_${file.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_')}`;
      CUSTOM_MODELS[id] = { kind, scene, box, size: box.getSize(new THREE.Vector3()) };
      const value = kind === 'glider' ? [`model:${id}`, '#ffffff'] : `model:${id}`;
      CUSTOM_BY_KIND[kind].push(value);
      registerCustomCosmetic(kind, id, file, value);
    } catch (e) { console.warn('cosmetic file', path, e); }
  }
}

export const isModel = (v) => typeof v === 'string' && v.startsWith('model:');

// A fresh copy of a folder model, sized for its slot. `ref` is the default mesh for that slot (used to
// match the pickaxe's size and grip).
export function customCosmetic(value, ref = null) {
  const m = CUSTOM_MODELS[value.slice(6)];
  if (!m) return null;
  const inner = m.scene.clone(true);
  const { size, box } = m;
  const c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  g.add(inner);
  if (m.kind === 'glider') {
    // span the widest side over ~4.4 m, sitting above the head like the default glider
    const s = 4.4 / Math.max(size.x, size.z, 0.01);
    inner.scale.setScalar(s);
    inner.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    g.position.set(0, 2.2, 0);
  } else if (m.kind === 'backbling') {
    const s = 0.72 / Math.max(size.y, 0.01);
    inner.scale.setScalar(s);
    inner.position.set(-c.x * s, -c.y * s, -c.z * s);
  } else {
    // pickaxe: the longest side becomes the handle (up), matched to the default tool's length and grip
    const L = Math.max(size.x, size.y, size.z);
    if (L === size.x) inner.rotation.z = Math.PI / 2;
    else if (L === size.z) inner.rotation.x = -Math.PI / 2;
    let len = 1.0, bottom = 0;
    if (ref) { const rb = new THREE.Box3().setFromObject(ref); len = rb.max.y - rb.min.y || 1; bottom = rb.min.y; }
    const s = len / L;
    inner.scale.setScalar(s);
    g.updateMatrixWorld(true);
    const nb = new THREE.Box3().setFromObject(inner);
    const nc = nb.getCenter(new THREE.Vector3());
    inner.position.set(-nc.x, bottom - nb.min.y, -nc.z);
  }
  g.name = `custom-${m.kind}`;
  return g;
}
