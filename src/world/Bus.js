import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const BUS_HEIGHT = 110;
const SPEED = 26;

// Painted side panel: blue body, white band with "STORM BUS" and a lightning bolt, yellow pinstripe.
function liveryTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3a7bff'); g.addColorStop(1, '#1d4fd8');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#ffffff'; x.fillRect(0, 150, 1024, 46);
  x.fillStyle = '#ffd23f'; x.fillRect(0, 200, 1024, 12);
  x.fillStyle = '#1d4fd8'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('STORM BUS', 512, 188);
  // lightning bolt
  x.fillStyle = '#ffd23f';
  x.beginPath(); x.moveTo(372, 154); x.lineTo(350, 178); x.lineTo(362, 178); x.lineTo(350, 196); x.lineTo(378, 168); x.lineTo(366, 168); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Balloon envelope: vertical gores alternating blue and white, with a darker crown and skirt.
function balloonTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  const gores = 14;
  for (let i = 0; i < gores; i++) {
    x.fillStyle = i % 2 ? '#ffffff' : '#2f6bff';
    x.fillRect((i * 1024) / gores, 0, 1024 / gores + 1, 512);
  }
  // soft shading between gores
  for (let i = 0; i < gores; i++) {
    const gx = (i * 1024) / gores;
    const gr = x.createLinearGradient(gx, 0, gx + 1024 / gores, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    x.fillStyle = gr; x.fillRect(gx, 0, 1024 / gores, 512);
  }
  x.fillStyle = '#ffd23f'; x.fillRect(0, 300, 1024, 18);      // equator band
  x.fillStyle = '#1d3f9c'; x.fillRect(0, 0, 1024, 40);         // crown
  x.fillStyle = '#1d3f9c'; x.fillRect(0, 470, 1024, 42);       // skirt
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBusMesh() {
  const group = new THREE.Group();
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const blue = M({ color: '#2a66ff', roughness: 0.35, metalness: 0.25 });
  const white = M({ color: '#f4f7ff', roughness: 0.4, metalness: 0.1 });
  const chrome = M({ color: '#dfe6f0', roughness: 0.18, metalness: 0.9 });
  const glass = M({ color: '#2a4a86', roughness: 0.06, metalness: 0.6, emissive: '#10214a', emissiveIntensity: 0.4 });
  const dark = M({ color: '#23262e', roughness: 0.7 });
  const yellow = M({ color: '#ffd23f', roughness: 0.4, emissive: '#ffd23f', emissiveIntensity: 0.15 });
  const light = M({ color: '#fff6d0', emissive: '#fff1b0', emissiveIntensity: 2.2 });
  const tail = M({ color: '#ff3b4e', emissive: '#ff3b4e', emissiveIntensity: 1.6 });
  const livery = M({ map: liveryTexture(), roughness: 0.35, metalness: 0.2 });
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const L = 9, W = 3.1, H = 2.9; // body length (z), width (x), height

  // body shell with rounded edges, a lighter roof and a sloped nose
  add(new RoundedBoxGeometry(W, H, L, 4, 0.38), blue, 0, 0.55 + H / 2, 0);
  add(new RoundedBoxGeometry(W - 0.1, 0.35, L - 0.4, 3, 0.15), white, 0, 0.55 + H + 0.1, 0);
  add(new RoundedBoxGeometry(W - 0.05, 1.3, 1.6, 3, 0.35), blue, 0, 1.2, L / 2 + 0.55);          // hood
  add(new THREE.BoxGeometry(W - 0.2, 0.08, 1.4), white, 0, 1.88, L / 2 + 0.6);                    // hood stripe
  // painted sides
  for (const s of [-1, 1]) {
    const p = add(new THREE.PlaneGeometry(L - 1.0, 1.35), livery, s * (W / 2 + 0.012), 1.25, 0, 0, s * Math.PI / 2);
    p.castShadow = false;
  }
  // side windows with pillars
  const winCount = 5, span = L - 2.6;
  for (let i = 0; i < winCount; i++) {
    const z = -span / 2 + (i + 0.5) * (span / winCount) - 0.3;
    for (const s of [-1, 1]) {
      add(new RoundedBoxGeometry(0.06, 1.0, span / winCount - 0.28, 2, 0.03), glass, s * (W / 2 + 0.01), 2.55, z);
      add(new THREE.BoxGeometry(0.07, 1.1, 0.12), white, s * (W / 2 + 0.02), 2.55, z + (span / winCount) / 2);
    }
  }
  // door on the right, windshield + frame, rear window
  add(new RoundedBoxGeometry(0.06, 2.2, 1.0, 2, 0.05), glass, W / 2 + 0.015, 1.85, L / 2 - 0.85);
  add(new THREE.BoxGeometry(0.07, 2.3, 0.08), chrome, W / 2 + 0.03, 1.85, L / 2 - 0.85);
  add(new RoundedBoxGeometry(W - 0.4, 1.15, 0.08, 2, 0.06), glass, 0, 2.6, L / 2 + 0.01, -0.12);
  add(new THREE.BoxGeometry(W - 0.25, 0.12, 0.12), white, 0, 3.22, L / 2 - 0.05);
  add(new RoundedBoxGeometry(W - 0.8, 0.9, 0.08, 2, 0.06), glass, 0, 2.6, -L / 2 - 0.01);
  // bumpers, grille, lights
  add(new RoundedBoxGeometry(W + 0.1, 0.32, 0.3, 2, 0.1), chrome, 0, 0.72, L / 2 + 1.35);
  add(new RoundedBoxGeometry(W + 0.1, 0.32, 0.3, 2, 0.1), chrome, 0, 0.72, -L / 2 - 0.1);
  add(new THREE.BoxGeometry(1.4, 0.5, 0.06), dark, 0, 1.22, L / 2 + 1.36);
  for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.04, 0.44, 0.07), chrome, k * 0.18, 1.22, L / 2 + 1.37);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), light, s * 1.1, 1.3, L / 2 + 1.36, Math.PI / 2);
    add(new THREE.TorusGeometry(0.21, 0.035, 6, 16), chrome, s * 1.1, 1.3, L / 2 + 1.4);
    add(new THREE.BoxGeometry(0.35, 0.22, 0.06), tail, s * 1.2, 1.1, -L / 2 - 0.02);
    add(new THREE.BoxGeometry(0.3, 0.14, 0.06), yellow, s * 1.2, 1.45, L / 2 + 1.36);
    // mirrors
    add(new THREE.BoxGeometry(0.08, 0.35, 0.22), dark, s * (W / 2 + 0.35), 2.35, L / 2 + 0.2);
    add(new THREE.BoxGeometry(0.35, 0.04, 0.04), dark, s * (W / 2 + 0.17), 2.35, L / 2 + 0.2);
  }
  // wheels with hubcaps and arches
  for (const s of [-1, 1]) for (const z of [-L / 2 + 1.6, L / 2 - 0.4]) {
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 20), dark, s * (W / 2 - 0.12), 0.62, z, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.47, 16), chrome, s * (W / 2 - 0.1), 0.62, z, 0, 0, Math.PI / 2);
    add(new THREE.TorusGeometry(0.72, 0.1, 6, 20, Math.PI), white, s * (W / 2 + 0.02), 0.62, z, 0, s * Math.PI / 2, 0);
  }
  // jet thrusters on stubby wings, with glowing exhaust
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const s of [-1, 1]) {
    add(new RoundedBoxGeometry(1.6, 0.18, 1.6, 2, 0.08), white, s * (W / 2 + 0.75), 1.6, -1.2, 0, 0, s * -0.1);
    add(new THREE.CylinderGeometry(0.5, 0.42, 2.4, 20), chrome, s * (W / 2 + 1.35), 1.5, -1.4, Math.PI / 2);
    add(new THREE.TorusGeometry(0.5, 0.08, 8, 20), blue, s * (W / 2 + 1.35), 1.5, -0.2);
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16), M({ color: '#9fe8ff', emissive: '#4fc8ff', emissiveIntensity: 2 }), s * (W / 2 + 1.35), 1.5, -2.62, Math.PI / 2);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.2, 14), flameMat);
    f.rotation.x = -Math.PI / 2;
    f.position.set(s * (W / 2 + 1.35), 1.5, -3.75);
    group.add(f);
    flames.push(f);
  }
  group.userData.flames = flames;
  // roof frame the balloon ropes tie onto
  const top = 0.55 + H + 0.28;
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.06, L - 1.2, 8), chrome, s * (W / 2 - 0.25), top + 0.25, 0, Math.PI / 2);
  for (const z of [-(L - 1.2) / 2, (L - 1.2) / 2]) {
    add(new THREE.CylinderGeometry(0.06, 0.06, W - 0.5, 8), chrome, 0, top + 0.25, z, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), chrome, s * (W / 2 - 0.25), top + 0.1, z);
  }
  // the balloon: smooth envelope with gores, a load ring and ropes down to the roof frame
  const env = new THREE.SphereGeometry(4.6, 48, 32);
  env.scale(1, 1.15, 1);
  const balloon = new THREE.Mesh(env, M({ map: balloonTexture(), roughness: 0.55 }));
  balloon.position.y = 13.4;
  balloon.castShadow = true;
  group.add(balloon);
  const ringY = 13.4 - 4.6 * 1.15 + 0.6;
  add(new THREE.TorusGeometry(1.5, 0.08, 8, 28), dark, 0, ringY, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(1.5, 1.2, 0.8, 24, 1, true), M({ color: '#1d3f9c', roughness: 0.6, side: THREE.DoubleSide }), 0, ringY - 0.35, 0);
  const ropeMat = M({ color: '#3a2f25', roughness: 0.9 });
  const anchors = [[-(W / 2 - 0.25), -(L - 1.2) / 2], [W / 2 - 0.25, -(L - 1.2) / 2], [-(W / 2 - 0.25), (L - 1.2) / 2], [W / 2 - 0.25, (L - 1.2) / 2]];
  for (const [x, z] of anchors) {
    const a = new THREE.Vector3(x, top + 0.25, z), b = new THREE.Vector3(Math.sign(x) * 1.06, ringY, Math.sign(z) * 1.06);
    const len = a.distanceTo(b);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), ropeMat);
    rope.position.copy(a).add(b).multiplyScalar(0.5);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    group.add(rope);
  }
  group.userData.balloon = balloon;
  group.userData.riders = [];
  return group;
}

// The flying battle bus that carries everyone across the island.
export class Bus {
  constructor(scene) {
    this.mesh = buildBusMesh();
    this.mesh.scale.setScalar(1.8);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.start = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.active = false;
  }

  // Riders on the roof reflect how many players are still aboard (0..1).
  setAboard(frac) {
    const rs = this.mesh.userData.riders;
    rs.forEach((r, i) => { r.visible = i < Math.ceil(frac * rs.length); });
  }

  launch() {
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const off = (Math.random() - 0.5) * 160;
    const px = -dz * off, pz = dx * off;
    this.start.set(-dx * 420 + px, BUS_HEIGHT, -dz * 420 + pz);
    this.end.set(dx * 420 + px, BUS_HEIGHT, dz * 420 + pz);
    this.length = this.start.distanceTo(this.end);
    this.vel.set(dx * SPEED, 0, dz * SPEED);
    this.progress = 0;
    this.active = true;
    this.mesh.visible = true;
    this.pos.copy(this.start);
    this.mesh.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  // Doors open once the bus is over (or about to be over) the island.
  get canDrop() { return this.active && this.pos.length() < 350; }

  update(dt, t) {
    if (!this.active) return;
    this.progress += (SPEED * dt) / this.length;
    this.pos.lerpVectors(this.start, this.end, Math.min(1, this.progress));
    this.mesh.position.copy(this.pos);
    this.mesh.position.y += Math.sin(t * 1.5) * 0.4;
    this.mesh.rotation.z = Math.sin(t * 0.9) * 0.04;
    for (const f of this.mesh.userData.flames) f.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    this.mesh.userData.balloon.rotation.y += dt * 0.1;
    if (this.progress >= 1.05) { this.active = false; this.mesh.visible = false; }
  }
}
