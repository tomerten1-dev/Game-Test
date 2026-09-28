import * as THREE from 'three';

// 12 zones like Fortnite: 1 damage a second for the early circles, 12 a second by circle 6 and 20 by circle 8;
// the last four circles move instead of just shrinking.
export const STORM_PHASES = [
  { wait: 60, shrink: 50, radius: 290, dmg: 1 },
  { wait: 45, shrink: 40, radius: 210, dmg: 1 },
  { wait: 40, shrink: 34, radius: 145, dmg: 1 },
  { wait: 35, shrink: 30, radius: 95, dmg: 1 },
  { wait: 30, shrink: 25, radius: 62, dmg: 5 },
  { wait: 25, shrink: 22, radius: 44, dmg: 12 },
  { wait: 22, shrink: 20, radius: 30, dmg: 15 },
  { wait: 20, shrink: 18, radius: 20, dmg: 20 },
  { wait: 18, shrink: 16, radius: 13, dmg: 20 },
  { wait: 16, shrink: 15, radius: 8, dmg: 20 },
  { wait: 14, shrink: 14, radius: 4, dmg: 20 },
  { wait: 12, shrink: 20, radius: 0, dmg: 20 },
];
export const MOVING_FROM = STORM_PHASES.length - 4;
const START_RADIUS = 580;

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const frag = /* glsl */ `
uniform float uTime;
uniform float uRadius;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  float around = vUv.x * 6.2831 * uRadius;
  float s = sin(around * 0.22 + vWorld.y * 0.18 - uTime * 1.6);
  float s2 = sin(around * 0.07 - vWorld.y * 0.05 + uTime * 0.7);
  float stripe = smoothstep(0.55, 0.95, s) * 0.55 + smoothstep(0.2, 1.0, s2) * 0.25;
  float h = clamp((vWorld.y + 10.0) / 185.0, 0.0, 1.0);
  float fade = pow(1.0 - h, 1.6);
  vec3 base = vec3(0.45, 0.12, 0.85);
  vec3 hi = vec3(0.95, 0.55, 1.0);
  vec3 col = mix(base, hi, stripe);
  float groundGlow = smoothstep(18.0, 0.0, abs(vWorld.y - 4.0)) * 0.35;
  float a = (0.32 + stripe * 0.35 + groundGlow) * fade;
  gl_FragColor = vec4(col + groundGlow, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Storm {
  constructor(scene, terrain) {
    this.terrain = terrain;
    const geo = new THREE.CylinderGeometry(1, 1, 190, 96, 1, true);
    geo.translate(0, 80, 0);
    this.uniforms = { uTime: { value: 0 }, uRadius: { value: START_RADIUS } };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.center = new THREE.Vector2();
    this.radius = START_RADIUS;
    this.fromCenter = new THREE.Vector2();
    this.fromRadius = START_RADIUS;
    this.nextCenter = new THREE.Vector2();
    this.nextRadius = START_RADIUS;
    this.reset();
  }

  reset() {
    this.phase = 0;
    this.stage = 'wait';
    this.timer = STORM_PHASES[0].wait;
    this.center.set(0, 0);
    this.radius = START_RADIUS;
    this.tick = 0;
    this._pickNext();
    this._apply();
  }

  // Start the match already k circles in (smaller maps for Reload / Blitz).
  fastForward(k) {
    for (let i = 0; i < k && i < STORM_PHASES.length - 1; i++) {
      this.radius = STORM_PHASES[i].radius;
      this.center.copy(this.nextCenter);
      this.phase = i + 1;
      this.stage = 'wait';
      this.timer = STORM_PHASES[this.phase].wait;
      this._pickNext();
    }
    this._apply();
  }

  get damage() { return STORM_PHASES[Math.min(this.phase, STORM_PHASES.length - 1)].dmg; }

  _pickNext() {
    const ph = STORM_PHASES[this.phase];
    this.fromCenter.copy(this.center);
    this.fromRadius = this.radius;
    this.nextRadius = ph.radius;
    // the last two circles can drift out of the current one ("moving zones")
    this.moving = this.phase >= MOVING_FROM;
    // a circle already revealed early (Storm Scout) is the one that comes
    if (this._future?.phase === this.phase) this.nextCenter.copy(this._future.center);
    else this._pickCenter(this.center, this.radius, this.phase, this.nextCenter);
    this._future = null;
  }

  _pickCenter(center, radius, phase, out) {
    const ph = STORM_PHASES[phase];
    const moving = phase >= MOVING_FROM;
    const maxOff = moving ? radius * 0.9 + ph.radius + 6 : Math.max(0, radius - ph.radius) * (phase === 0 ? 0.35 : 0.9);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * maxOff;
      const x = center.x + Math.cos(a) * r, z = center.y + Math.sin(a) * r;
      const nearCenter = moving && Math.hypot(x - center.x, z - center.y) < radius * 0.6;
      if (this.terrain.heightAt(x, z) > 2.2 && Math.hypot(x, z) < 325 && !nearCenter) return out.set(x, z);
    }
    return out.copy(center);
  }

  // The circle after the next one, decided now so it can be shown early (Storm Scout). null in the last phase.
  peekFuture() {
    const ph = this.phase + 1;
    if (ph >= STORM_PHASES.length) return null;
    if (this._future?.phase !== ph) this._future = { phase: ph, center: this._pickCenter(this.nextCenter, this.nextRadius, ph, new THREE.Vector2()), radius: STORM_PHASES[ph].radius };
    return this._future;
  }

  // returns an event name when the phase changes
  update(dt, t) {
    this.uniforms.uTime.value = t;
    let event = null;
    if (this.stage === 'done') return null;
    this.timer -= dt;
    const ph = STORM_PHASES[this.phase];
    if (this.stage === 'wait') {
      if (this.timer <= 0) { this.stage = 'shrink'; this.timer = ph.shrink; event = 'shrink'; }
    } else if (this.stage === 'shrink') {
      const k = 1 - Math.max(0, this.timer) / ph.shrink;
      this.center.lerpVectors(this.fromCenter, this.nextCenter, k);
      this.radius = this.fromRadius + (this.nextRadius - this.fromRadius) * k;
      if (this.timer <= 0) {
        this.center.copy(this.nextCenter);
        this.radius = this.nextRadius;
        this.phase++;
        if (this.phase >= STORM_PHASES.length) { this.stage = 'done'; this.phase = STORM_PHASES.length - 1; event = 'final'; }
        else { this.stage = 'wait'; this.timer = STORM_PHASES[this.phase].wait; this._pickNext(); event = 'phase'; }
      }
    }
    this._apply();
    return event;
  }

  _apply() {
    const r = Math.max(0.5, this.radius);
    this.mesh.scale.set(r, 1, r);
    this.mesh.position.set(this.center.x, 0, this.center.y);
    this.mesh.visible = r < START_RADIUS - 20;
    this.uniforms.uRadius.value = r;
  }

  isInside(x, z, margin = 0) { return Math.hypot(x - this.center.x, z - this.center.y) < this.radius + margin; }

  // "Safe" for AI = inside the upcoming circle (so they rotate early).
  isSafe(x, z, margin = 0) {
    const c = this.safeCenter();
    return Math.hypot(x - c.x, z - c.y) < this.safeRadius() + margin;
  }
  safeCenter() { return this.stage === 'wait' ? this.nextCenter : this.nextCenter; }
  // How far outside the next circle a point is (0 inside).
  distOutsideNext(p) { return Math.max(0, Math.hypot(p.x - this.nextCenter.x, p.z - this.nextCenter.y) - this.nextRadius); }
  safeRadius() { return Math.max(3, this.nextRadius); }

  get label() {
    if (this.stage === 'done') return 'FINAL';
    return this.stage === 'wait' ? 'Storm shrinks in' : 'Storm shrinking';
  }
}
