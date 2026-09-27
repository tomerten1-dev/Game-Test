import * as THREE from 'three';

const DROPS = 900;
const BOX = 36; // rain volume around the camera
const STORM_FOG = new THREE.Color('#6a2bb0');

// Inside the storm: purple fog closes in and rain streaks fall around the camera.
export class StormFX {
  constructor(scene) {
    this.scene = scene;
    this.k = 0;
    const pos = new Float32Array(DROPS * 6);
    this.seed = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) {
      this.seed[i * 3] = Math.random() * BOX;
      this.seed[i * 3 + 1] = Math.random() * BOX;
      this.seed[i * 3 + 2] = Math.random() * BOX;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#d9c2ff', transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
    this.baseFog = scene.fog ? { color: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far } : null;
    this.t = 0;
  }

  setBaseFog(fog) {
    if (fog) this.baseFog = { color: fog.color.clone(), near: this.baseFog?.near ?? fog.near, far: this.baseFog?.far ?? fog.far };
  }

  // inside = 0..1 (1 = camera is in the storm)
  update(dt, camera, inside) {
    this.k += (inside - this.k) * Math.min(1, dt * 2.5);
    const k = this.k;
    const fog = this.scene.fog;
    if (fog && this.baseFog) {
      fog.color.copy(this.baseFog.color).lerp(STORM_FOG, k * 0.85);
      fog.near = this.baseFog.near + (12 - this.baseFog.near) * k;
      fog.far = this.baseFog.far + (150 - this.baseFog.far) * k;
    }
    this.rain.visible = k > 0.02;
    if (!this.rain.visible) return;
    this.t += dt;
    this.rain.material.opacity = 0.55 * k;
    const a = this.rain.geometry.attributes.position.array;
    const c = camera.position;
    const fall = this.t * 38;
    for (let i = 0; i < DROPS; i++) {
      // wrap each drop inside a box that follows the camera (no per-drop state)
      const x = c.x - BOX / 2 + ((this.seed[i * 3] - c.x) % BOX + BOX) % BOX;
      const z = c.z - BOX / 2 + ((this.seed[i * 3 + 2] - c.z) % BOX + BOX) % BOX;
      const y = c.y + BOX / 2 - ((this.seed[i * 3 + 1] + fall) % BOX);
      const o = i * 6;
      a[o] = x; a[o + 1] = y; a[o + 2] = z;
      a[o + 3] = x + 0.12; a[o + 4] = y - 1.1; a[o + 5] = z + 0.05;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
