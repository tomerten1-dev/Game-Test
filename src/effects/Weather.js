import * as THREE from 'three';

const FLAKES = 1800;
const BOX = 50;

// Gentle snowfall around the camera (winter island).
export class Snowfall {
  constructor(scene) {
    const pos = new Float32Array(FLAKES * 3);
    this.seed = new Float32Array(FLAKES * 4);
    for (let i = 0; i < FLAKES; i++) {
      this.seed[i * 4] = Math.random() * BOX;
      this.seed[i * 4 + 1] = Math.random() * BOX;
      this.seed[i * 4 + 2] = Math.random() * BOX;
      this.seed[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9 }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.t = 0;
  }

  update(dt, camera) {
    this.t += dt;
    const a = this.points.geometry.attributes.position.array;
    const c = camera.position, fall = this.t * 2.2;
    for (let i = 0; i < FLAKES; i++) {
      const s = this.seed, k = i * 4;
      const sway = Math.sin(this.t * 0.8 + s[k + 3]) * 0.8;
      a[i * 3] = c.x - BOX / 2 + ((s[k] + sway - c.x) % BOX + BOX) % BOX;
      a[i * 3 + 1] = c.y + BOX / 2 - ((s[k + 1] + fall) % BOX);
      a[i * 3 + 2] = c.z - BOX / 2 + ((s[k + 2] - c.z) % BOX + BOX) % BOX;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
