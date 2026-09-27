import * as THREE from 'three';
import { SUN_DIR } from './Sky.js';
import { quality } from '../core/device.js';
import { SHADOW } from './Bake.js';

export class Lighting {
  constructor(scene) {
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#6f8f4a', 1.1);
    scene.add(this.hemi);

    const sun = new THREE.DirectionalLight('#ffe3b8', 2.6);
    sun.castShadow = true;
    const range = quality.shadowRange;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    Object.assign(sun.shadow.camera, { left: -range, right: range, top: range, bottom: -range, near: 1, far: 400 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3; // soft PCF edges
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    this.range = range;
    this._texel = (range * 2) / quality.shadowSize;
  }

  setShadowQuality(size, range) {
    const sh = this.sun.shadow;
    if (sh.mapSize.x !== size) {
      sh.mapSize.set(size, size);
      if (sh.map) { sh.map.dispose(); sh.map = null; }
    }
    Object.assign(sh.camera, { left: -range, right: range, top: range, bottom: -range });
    sh.camera.updateProjectionMatrix();
    this.range = range;
    this._texel = (range * 2) / size;
    SHADOW.uRange.value = range;
  }

  // Shadow camera follows the focus point, snapped to shadow texels to avoid shimmering.
  follow(focus) {
    const s = this._texel;
    const x = Math.round(focus.x / s) * s;
    const z = Math.round(focus.z / s) * s;
    const y = focus.y;
    this.sun.target.position.set(x, y, z);
    this.sun.position.set(x + SUN_DIR.x * 200, y + SUN_DIR.y * 200, z + SUN_DIR.z * 200);
    this.sun.target.updateMatrixWorld();
    SHADOW.uFocus.value.copy(focus);
  }
}
