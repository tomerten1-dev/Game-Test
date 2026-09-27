import * as THREE from 'three';
import { damp, clamp } from '../core/noise.js';

const _pivot = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _want = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = {};

// Over-the-shoulder third-person camera that never clips into the ground or walls.
export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;
    this.pitch = -0.1;
    this.dist = 3.6;
    this.side = 0.72;
    this.up = 0.28;
    this.curDist = 3.6;
    this.recoil = 0;
    this.shake = 0;
    this.bob = 0;
    this.fov = 70;
    this.mode = 'ground';
  }

  addLook(dx, dy) {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.25, 1.15);
  }

  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  update(dt, target, mode) {
    this.mode = mode;
    // recoil kick recovers smoothly
    if (this.recoil > 0) {
      const r = Math.min(this.recoil, dt * 6 * Math.max(0.05, this.recoil));
      this.recoil -= r;
    }
    let dist = 3.6, side = 0.72, up = 0.28, fov = 70, pivotH = 1.55;
    if (mode === 'aim') { dist = 2.3; side = 0.65; fov = 55; }
    else if (mode === 'scope') { dist = 1.6; side = 0.55; fov = 20; }
    else if (mode === 'skydive' || mode === 'glide') { dist = 7.5; side = 0; up = 1.2; fov = 78; pivotH = 1.0; }
    else if (mode === 'bus') { dist = 18; side = 0; up = 4; fov = 70; pivotH = 0; }
    else if (mode === 'dead') { dist = 6; side = 0; up = 1.5; }
    this.side = damp(this.side, side, 8, dt);
    this.up = damp(this.up, up, 8, dt);
    this.fov = damp(this.fov, fov, 10, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

    _pivot.set(target.x, target.y + pivotH, target.z);
    const fwd = this.forward(_fwd);
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // shoulder origin
    const sx = _pivot.x + _right.x * this.side, sz = _pivot.z + _right.z * this.side, sy = _pivot.y + this.up;
    // boom collision
    _dir.copy(fwd).multiplyScalar(-1);
    let maxD = dist;
    if (mode !== 'bus') {
      _want.set(sx, sy, sz);
      const hit = this.world.raycast(_want, _dir, dist + 0.3, _hit);
      if (hit) maxD = Math.max(0.6, hit.t - 0.3);
    }
    this.curDist = maxD < this.curDist ? maxD : damp(this.curDist, maxD, 6, dt);
    const cam = this.camera.position;
    cam.set(sx + _dir.x * this.curDist, sy + _dir.y * this.curDist, sz + _dir.z * this.curDist);
    const g = this.world.heightAt(cam.x, cam.z) + 0.4;
    if (cam.y < g) cam.y = g;
    if (cam.y < 0.35) cam.y = 0.35; // stay above the water surface
    if (this.bob > 0.001) {
      cam.y -= Math.sin(Math.min(1, this.bob) * Math.PI * 0.5) * this.bob;
      this.bob = damp(this.bob, 0, 5, dt);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.35;
      cam.x += (Math.random() - 0.5) * s; cam.y += (Math.random() - 0.5) * s; cam.z += (Math.random() - 0.5) * s;
    }
    const lookPitch = this.pitch + this.recoil;
    const cp = Math.cos(lookPitch);
    _want.set(cam.x - Math.sin(this.yaw) * cp, cam.y + Math.sin(lookPitch), cam.z - Math.cos(this.yaw) * cp);
    this.camera.lookAt(_want);
  }
}
