import * as THREE from 'three';
import { part, merge, mat } from '../world/geomUtils.js';

// Stylized delta-wing glider shown above a character while gliding.
export function makeGlider(color, accentColor = '#ffd23f') {
  const c = new THREE.Color(color);
  const accent = new THREE.Color(accentColor);
  const wing = new THREE.BufferGeometry();
  const v = [
    0, 0, 1.2, -2.2, -0.35, -0.9, 0, 0.1, -0.5,
    0, 0, 1.2, 0, 0.1, -0.5, 2.2, -0.35, -0.9,
  ];
  wing.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  wing.computeVertexNormals();
  const stripe = new THREE.BufferGeometry();
  stripe.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.02, 1.0, -0.9, -0.12, 0.05, 0, 0.12, -0.2,
    0, 0.02, 1.0, 0, 0.12, -0.2, 0.9, -0.12, 0.05,
  ], 3));
  stripe.computeVertexNormals();
  const geo = merge([
    part(wing, c),
    part(stripe, accent, mat(0, 0.015, 0)),
    part(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), '#333842', mat(0, -0.05, 0.2, Math.PI / 2, 0, 0)),
    part(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), '#333842', mat(-0.3, -0.6, 0.25, 0, 0, 0.45)),
    part(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), '#333842', mat(0.3, -0.6, 0.25, 0, 0, -0.45)),
  ]);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }));
  m.castShadow = true;
  m.position.set(0, 2.55, 0);
  m.visible = false;
  return m;
}
