import * as THREE from 'three';
import { SKY_TOP, SKY_HORIZON } from '../world/Sky.js';

// Per-match weather and night extras:
//  - rain: streaks around the camera (not indoors), a rain loop, greyer sky, closer fog, dimmer sun
//  - thunderstorm: rain + lightning strikes (bolt, sky flash, thunder that arrives late with
//    distance); a strike close by hurts, fells trees and starts a small fire
//  - night: everyone carries a flashlight (your own lights the way; bots' beams give them away)

const STREAKS = 2600, BOX = 70, HIGH = 40;
const GREY = new THREE.Color('#8a95a6');
const _c = new THREE.Color(), _v = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);

export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.kind = 'clear';
    this.rain = 0;       // current intensity 0..1
    this.target = 0;
    this.flash = 0;
    this.thunder = [];
    this.bolts = [];
    this.strikeT = 10;
    this._buildRain();
    this._buildLights();
  }

  // Pick this match's weather. Returns a banner text (or null).
  roll(opts = {}) {
    const snowy = opts.snow, desert = opts.desert;
    const r = Math.random();
    // rain and thunderstorms are switched off: every match is clear (night matches still happen)
    void r; void snowy; void desert;
    this.kind = 'clear';
    this.night = Math.random() < 0.2;
    this.start();
    const w = this.kind === 'storm' ? 'Thunderstorm' : this.kind === 'rain' ? 'Rain' : null;
    return this.night ? (w ? `Night match · ${w}` : 'Night match') : w;
  }

  start() {
    this.target = this.kind === 'clear' ? 0 : this.kind === 'storm' ? 1 : 0.7;
    this.strikeT = 8 + Math.random() * 8;
    this.active = true;
  }

  stop() {
    this.active = false;
    this.kind = 'clear';
    this.target = 0;
    this.rain = 0;
    this.night = false;
    this.flash = 0;
    this.thunder = [];
    for (const b of this.bolts) this.game.scene.remove(b.line);
    this.bolts = [];
    this.streaks.visible = false;
    this._setLoop(0);
    this._lightsOff();
  }

  // ---------- rain ----------
  _buildRain() {
    this.seed = new Float32Array(STREAKS * 3);
    for (let i = 0; i < STREAKS * 3; i++) this.seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    this.streaks = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#b9c8dc', transparent: true, opacity: 0.35, depthWrite: false }));
    this.streaks.frustumCulled = false;
    this.streaks.visible = false;
    this.game.scene.add(this.streaks);
    this.t = 0;
  }

  _updateRain(dt) {
    const g = this.game, cam = g.camera.position;
    // no rain drawn indoors
    const inside = g.homes?.houseAt(cam.x, cam.z);
    const indoors = inside && cam.y < inside.h.y + inside.h.top;
    this.streaks.visible = this.rain > 0.02 && !indoors;
    if (!this.streaks.visible) return;
    this.t += dt;
    const a = this.streaks.geometry.attributes.position.array;
    const fall = this.t * 24, wind = this.t * 2.5, s = this.seed;
    for (let i = 0; i < STREAKS; i++) {
      const k = i * 3;
      const x = cam.x - BOX / 2 + (((s[k] * BOX + wind - cam.x) % BOX) + BOX) % BOX;
      const z = cam.z - BOX / 2 + (((s[k + 2] * BOX + wind * 0.4 - cam.z) % BOX) + BOX) % BOX;
      const y = cam.y + HIGH / 2 - ((s[k + 1] * HIGH + fall * (0.85 + s[k] * 0.3)) % HIGH);
      const o = i * 6;
      a[o] = x; a[o + 1] = y; a[o + 2] = z;
      a[o + 3] = x - 0.07; a[o + 4] = y - 0.75; a[o + 5] = z - 0.03;
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
    this.streaks.material.opacity = 0.32 * this.rain;
  }

  // Rain loop: filtered noise through the master volume.
  _setLoop(v) {
    const snd = this.game.sound, ctx = snd.ctx;
    if (!ctx || !snd.noise || ctx.state !== 'running') return;
    if (!this.loop) {
      const src = ctx.createBufferSource();
      src.buffer = snd.noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(f); f.connect(lp); lp.connect(gain); gain.connect(snd.master);
      src.start();
      this.loop = { gain };
    }
    this.loop.gain.gain.setTargetAtTime(snd.muted ? 0 : v, ctx.currentTime, 0.4);
  }

  // Greyer sky, closer fog, dimmer sun (applied on top of the day cycle each frame).
  _tint() {
    const r = this.rain, g = this.game;
    if (r <= 0.001 && this.flash <= 0) return;
    const L = g.world.lighting;
    SKY_TOP.lerp(_c.copy(GREY).multiplyScalar(0.7), 0.55 * r);
    SKY_HORIZON.lerp(GREY, 0.5 * r);
    g.scene.background.copy(SKY_HORIZON);
    if (g.scene.fog) g.scene.fog.color.copy(SKY_HORIZON);
    L.hemi.intensity *= 1 - 0.3 * r;
    L.sun.intensity *= 1 - 0.6 * r;
    const bf = g.stormFX?.baseFog;
    if (bf) { bf.color.copy(SKY_HORIZON); bf.near = 130 - 80 * r; bf.far = 600 - 280 * r; }
    // lightning flash
    if (this.flash > 0) {
      L.hemi.intensity += this.flash * 2.2;
      g.renderer.toneMappingExposure += this.flash * 0.7;
    }
  }

  // ---------- lightning ----------
  _strike(near) {
    const g = this.game, p = g.player?.pos || g.camera.position;
    const a = Math.random() * Math.PI * 2, d = near ? 12 + Math.random() * 22 : 45 + Math.random() * 180;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const y = g.world.groundAt(x, z, 200, 0.3);
    // jagged bolt from the clouds down to the ground
    const pts = [];
    let bx = x + (Math.random() - 0.5) * 20, bz = z + (Math.random() - 0.5) * 20;
    const top = y + 130, n = 14;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push(new THREE.Vector3(bx + (x - bx) * k + (i && i < n ? (Math.random() - 0.5) * 7 : 0), top + (y - top) * k, bz + (z - bz) * k + (i && i < n ? (Math.random() - 0.5) * 7 : 0)));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e8f1ff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false;
    g.scene.add(line);
    this.bolts.push({ line, t: 0.28 });
    this.flash = 1;
    this.flash2 = 0.12; // second flicker
    const pos = new THREE.Vector3(x, y, z);
    const dist = pos.distanceTo(g.camera.position);
    this.thunder.push({ t: dist / 340, pos, near: dist < 60 });
    // what it hits
    for (let i = 0; i < 24; i++) g.effects.sparks.emit(x, y + 0.3, z, (Math.random() - 0.5) * 10, 2 + Math.random() * 8, (Math.random() - 0.5) * 10, _c.set('#cfe3ff'), 0.4, 0.25, 6);
    for (const act of g.actors) {
      if (!act.alive || act.state === 'bus') continue;
      const ad = Math.hypot(act.pos.x - x, act.pos.z - z);
      if (ad > 4 || Math.abs(act.pos.y - y) > 4) continue;
      act.takeDamage(30 * (1 - ad / 5), null, false);
      act.vel.y = Math.max(act.vel.y, 6); act.onGround = false;
    }
    for (const c of g.world.colliders.query(x - 3, x + 3, z - 3, z + 3, [])) if (c.obj && c.kind === 'circle' && c.tree) g.world.destructibles.damage(c, 9999, null);
    if (y > 1) g.projectiles?.areas.push({ type: 'fire', pos, owner: null, r: 2.2, t: 5, dur: 5, emit: 0, dps: 10, tick: 0 });
  }

  // ---------- flashlights ----------
  _buildLights() {
    const scene = this.game.scene;
    const mk = (i) => { const l = new THREE.SpotLight('#fff1d6', 0, 55, 0.42, 0.55, 1.4); l.castShadow = false; scene.add(l); scene.add(l.target); return l; };
    this.playerLight = mk(1.4);
    this.botLights = [mk(), mk()];
    // visible beams for bots (so you can spot them in the dark)
    const cone = new THREE.ConeGeometry(2.4, 11, 16, 1, true);
    cone.translate(0, -5.5, 0); // apex at the origin, opening along -y
    this.beams = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 28);
    this.beams.count = 0;
    this.beams.frustumCulled = false;
    scene.add(this.beams);
  }

  _lightsOff() {
    this.playerLight.intensity = 0;
    for (const l of this.botLights) l.intensity = 0;
    this.beams.count = 0;
  }

  _updateLights(dark) {
    const g = this.game, p = g.player;
    if (dark < 0.05 || !p) { this._lightsOff(); return; }
    // yours: from the chest along where you aim
    const dir = g.camera.getWorldDirection(_d);
    if (p.alive && p.state === 'ground') {
      this.playerLight.position.set(p.pos.x + dir.x * 0.4, p.pos.y + 1.45, p.pos.z + dir.z * 0.4);
      this.playerLight.target.position.copy(this.playerLight.position).addScaledVector(dir, 12);
      this.playerLight.intensity = 70 * dark;
    } else this.playerLight.intensity = 0;
    // bots: two real lights on the nearest, beams on everyone close enough to matter
    const near = [];
    for (const b of g.bots) {
      if (!b.alive || b.state !== 'ground' || b.hiddenIn) continue;
      const d2 = (b.pos.x - p.pos.x) ** 2 + (b.pos.z - p.pos.z) ** 2;
      if (d2 < 130 * 130) near.push([d2, b]);
    }
    near.sort((a, b) => a[0] - b[0]);
    this.botLights.forEach((l, i) => {
      const b = near[i]?.[1];
      if (!b || near[i][0] > 70 * 70) { l.intensity = 0; return; }
      const fx = Math.sin(b.aimYaw), fz = Math.cos(b.aimYaw);
      l.position.set(b.pos.x + fx * 0.4, b.pos.y + 1.45, b.pos.z + fz * 0.4);
      l.target.position.set(l.position.x + fx * 12, l.position.y - 1.5, l.position.z + fz * 12);
      l.intensity = 45 * dark;
    });
    let n = 0;
    for (const [, b] of near) {
      if (n >= this.beams.instanceMatrix.count) break;
      const fx = Math.sin(b.aimYaw), fz = Math.cos(b.aimYaw);
      _v.set(fx, -0.12, fz).normalize();
      _q.setFromUnitVectors(DOWN, _v);
      _m.compose(_d.set(b.pos.x + fx * 0.4, b.pos.y + 1.45, b.pos.z + fz * 0.4), _q, _v.set(1, 1, 1));
      this.beams.setMatrixAt(n++, _m);
    }
    this.beams.count = n;
    this.beams.instanceMatrix.needsUpdate = true;
    this.beams.material.opacity = 0.075 * dark;
  }

  // ---------- per frame ----------
  update(dt) {
    const g = this.game;
    const dark = this.active ? g.dayCycle?.dark || 0 : 0;
    // houses glow warm through their windows at night
    if (g.homes) { g.homes.glassMat.emissive.set('#ffcf7a'); g.homes.glassMat.emissiveIntensity = dark * 0.9; }
    if (!this.active) return;
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), dt * 0.25);
    this._updateRain(dt);
    this._setLoop(0.11 * this.rain);
    // lightning
    if (this.kind === 'storm' && g.state === 'playing') {
      this.strikeT -= dt;
      if (this.strikeT <= 0) { this.strikeT = 6 + Math.random() * 10; this._strike(Math.random() < 0.22); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t -= dt;
      b.line.material.opacity = Math.max(0, b.t / 0.28) * (0.6 + Math.random() * 0.4);
      if (b.t <= 0) { g.scene.remove(b.line); b.line.geometry.dispose(); this.bolts.splice(i, 1); }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      if (this.flash <= 0 && this.flash2 > 0) { this.flash = 0.6; this.flash2 = 0; }
    }
    for (let i = this.thunder.length - 1; i >= 0; i--) {
      const th = this.thunder[i];
      th.t -= dt;
      if (th.t <= 0) { g.sound.play(th.near ? 'thunderNear' : 'thunder'); this.thunder.splice(i, 1); }
    }
    this._tint();
    this._updateLights(dark);
  }
}
