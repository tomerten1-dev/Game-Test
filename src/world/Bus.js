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
  const flameMat = new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 10), flameMat);
    f.rotation.x = -Math.PI / 2;
    f.position.set(s * 3.4, 1.1, -2.6);
    group.add(f);
    flames.push(f);
  }
  group.userData.flames = flames;
  return group;
}

// The flying battle bus that carries everyone across the island.
export class Bus {
  constructor(scene) {
    this.mesh = buildBusMesh();
    this.mesh.scale.setScalar(1.4);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.start = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.active = false;
  }

  launch() {
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const off = (Math.random() - 0.5) * 80;
    const px = -dz * off, pz = dx * off;
    this.start.set(-dx * 250 + px, BUS_HEIGHT, -dz * 250 + pz);
    this.end.set(dx * 250 + px, BUS_HEIGHT, dz * 250 + pz);
    this.length = this.start.distanceTo(this.end);
    this.vel.set(dx * SPEED, 0, dz * SPEED);
    this.progress = 0;
    this.active = true;
    this.mesh.visible = true;
    this.pos.copy(this.start);
    this.mesh.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  // Doors open once the bus is over (or about to be over) the island.
  get canDrop() { return this.active && this.pos.length() < 200; }

  update(dt, t) {
    if (!this.active) return;
    this.progress += (SPEED * dt) / this.length;
    this.pos.lerpVectors(this.start, this.end, Math.min(1, this.progress));
    this.mesh.position.copy(this.pos);
    this.mesh.position.y += Math.sin(t * 1.5) * 0.4;
    this.mesh.rotation.z = Math.sin(t * 0.9) * 0.04;
    for (const f of this.mesh.userData.flames) f.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    if (this.progress >= 1.05) { this.active = false; this.mesh.visible = false; }
  }
}
