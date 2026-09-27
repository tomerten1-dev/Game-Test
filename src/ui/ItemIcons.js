import * as THREE from 'three';
import { makeWeaponMesh, makePickaxeMesh } from '../weapons/WeaponModels.js';
import { makeConsumableMesh } from '../world/ItemMeshes.js';

// Hotbar / inventory icons rendered from the real 3D models (guns, heals, throwables, the axe).
// A small offscreen renderer draws each item once; the PNG is cached per type (and rarity).
const SIZE = 128;
let renderer = null, scene = null, camera = null;
const cache = new Map();

function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#6a7890', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fd8ff', 1.2);
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
}

function objectFor(item) {
  if (!item) return null;
  if (item.isGun) return makeWeaponMesh(item.type, item.rarity);
  if (item.isPickaxe) return makePickaxeMesh();
  if (item.isConsumable) return makeConsumableMesh(item.type);
  return null;
}

function keyFor(item) {
  if (item.isGun) return `g:${item.type}:${item.rarity}`;
  if (item.isPickaxe) return 'pickaxe';
  return `c:${item.type}`;
}

// data: URL of the item's icon, or null when there's no model for it.
export function itemIcon(item) {
  if (!item) return null;
  const key = keyFor(item);
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try {
    const obj = objectFor(item);
    if (obj) {
      if (!renderer) setup();
      const pivot = new THREE.Group();
      pivot.add(obj);
      // guns: side view, muzzle to the right and tilted up a touch; everything else: 3/4 view
      if (item.isGun) pivot.rotation.set(0, Math.PI / 2, 0.18);
      else if (item.isPickaxe) pivot.rotation.set(0, 0.6, -0.5);
      else pivot.rotation.set(0.25, -0.6, 0);
      scene.add(pivot);
      pivot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pivot);
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const r = Math.max(s.x, s.y, s.z) * 0.62;
      const dist = r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.set(c.x, c.y + r * 0.1, c.z + dist);
      camera.lookAt(c);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      url = renderer.domElement.toDataURL('image/png');
      scene.remove(pivot);
    }
  } catch { url = null; }
  cache.set(key, url);
  return url;
}
