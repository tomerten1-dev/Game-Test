import * as THREE from 'three';
import { part, merge, mat } from './geomUtils.js';

export const BUS_HEIGHT = 110;
const SPEED = 26;

function buildBusMesh() {
  const blue = '#2f6bff', white = '#f4f7ff', glass = '#1c2d5a', dark = '#272b35', yellow = '#ffd23f';
  const p = [];
  p.push(part(new THREE.BoxGeometry(3.2, 2.6, 8), blue, mat(0, 1.6, 0)));
  p.push(part(new THREE.BoxGeometry(3.25, 0.5, 8.05), white, mat(0, 2.3, 0)));
  p.push(part(new THREE.BoxGeometry(3.0, 0.3, 7.6), white, mat(0, 3.0, 0)));
  p.push(part(new THREE.BoxGeometry(3.3, 0.35, 8.1), yellow, mat(0, 0.55, 0)));
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) p.push(part(new THREE.BoxGeometry(0.1, 0.9, 1.3), glass, mat(s * 1.62, 1.85, -2.6 + i * 1.7)));
  }
  p.push(part(new THREE.BoxGeometry(2.6, 1.1, 0.1), glass, mat(0, 1.9, 4.02)));
  p.push(part(new THREE.BoxGeometry(2.8, 0.6, 0.12), white, mat(0, 0.9, 4.04)));
  for (const s of [-1, 1]) {
    p.push(part(new THREE.BoxGeometry(0.5, 0.3, 0.1), yellow, mat(s * 1.1, 0.9, 4.1)));
    for (const z of [-2.6, 2.6]) p.push(part(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), dark, mat(s * 1.5, 0.35, z, 0, 0, Math.PI / 2)));
    // wings + jet engines
    p.push(part(new THREE.BoxGeometry(2.6, 0.18, 1.8), white, mat(s * 2.8, 1.4, 0, 0, 0, s * -0.08)));
    p.push(part(new THREE.CylinderGeometry(0.45, 0.55, 2.2, 12), '#c9d2e6', mat(s * 3.4, 1.1, -0.3, Math.PI / 2, 0, 0)));
    p.push(part(new THREE.CylinderGeometry(0.46, 0.46, 0.3, 12), blue, mat(s * 3.4, 1.1, 0.8, Math.PI / 2, 0, 0)));
  }
  const body = new THREE.Mesh(merge(p), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2, flatShading: true }));
  body.castShadow = true;
  const group = new THREE.Group();
  group.add(body);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 10), flameMat);
    f.rotation.x = -Math.PI / 2;
    f.position.set(s * 3.4, 1.1, -2.6);
    group.add(f);
    flames.push(f);
  }
  group.userData.flames = flames;
  // roof railing
  const rail = [];
  for (const s of [-1, 1]) {
    rail.push(part(new THREE.BoxGeometry(0.08, 0.08, 7.4), white, mat(s * 1.45, 3.75, 0)));
    for (let z = -3.5; z <= 3.5; z += 1.4) rail.push(part(new THREE.BoxGeometry(0.07, 0.6, 0.07), white, mat(s * 1.45, 3.45, z)));
  }
  rail.push(part(new THREE.BoxGeometry(2.9, 0.08, 0.08), white, mat(0, 3.75, 3.7)), part(new THREE.BoxGeometry(2.9, 0.08, 0.08), white, mat(0, 3.75, -3.7)));
  const railMesh = new THREE.Mesh(merge(rail), body.material);
  group.add(railMesh);
  // striped hot-air balloon holding it all up
  const env = new THREE.SphereGeometry(4.2, 16, 12);
  const col = [];
  const pos = env.attributes.position;
  const cA = new THREE.Color('#ff5a5f'), cB = new THREE.Color('#fff4d6'), cC = new THREE.Color('#2f6bff');
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const band = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16) % 2;
    const c = pos.getY(i) < -2.8 ? cC : band ? cA : cB;
    col.push(c.r, c.g, c.b);
  }
  env.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.scale(1, 1.18, 1);
  const balloon = new THREE.Mesh(env, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, flatShading: true }));
  balloon.position.y = 12.5;
  balloon.castShadow = true;
  group.add(balloon);
  const ropePts = [];
  for (const [x, z] of [[-1.4, -3.6], [1.4, -3.6], [-1.4, 3.6], [1.4, 3.6]]) ropePts.push(new THREE.Vector3(x, 3.1, z), new THREE.Vector3(x * 1.5, 8.6, z * 0.55));
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropePts), new THREE.LineBasicMaterial({ color: '#3a2f25' })));
  // little riders on the roof (they hop off as people drop)
  const riders = [];
  const riderCols = ['#20d6c0', '#ff5a5f', '#ffd23f', '#a15cff', '#6ef0a8', '#ff8a4c', '#5fd4ff', '#ff7ab8'];
  riderCols.forEach((c, i) => {
    const r = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 8), bodyM);
    torso.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: '#f1c7a0', roughness: 0.7 }));
    head.position.y = 1.12;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 3, 6), bodyM);
    arm.position.set(0.33, 1.0, 0);
    r.add(torso, head, arm);
    r.position.set(i % 2 ? 0.7 : -0.7, 3.15, -2.9 + Math.floor(i / 2) * 1.9);
    r.userData.arm = arm;
    r.userData.phase = i * 0.8;
    group.add(r);
    riders.push(r);
  });
  group.userData.riders = riders;
  group.userData.balloon = balloon;
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
    for (const r of this.mesh.userData.riders) {
      if (!r.visible) continue;
      r.userData.arm.rotation.z = -2.2 + Math.sin(t * 6 + r.userData.phase) * 0.5; // waving
      r.position.y = 3.15 + Math.max(0, Math.sin(t * 3 + r.userData.phase)) * 0.12;
    }
    this.mesh.userData.balloon.rotation.y += dt * 0.15;
    if (this.progress >= 1.05) { this.active = false; this.mesh.visible = false; }
  }
}
