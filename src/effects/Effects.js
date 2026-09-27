import * as THREE from 'three';

// Pooled visual effects: muzzle flashes, tracers, particles, damage numbers, elimination bursts.

function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,220,140,0.8)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.translate(64, 64);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.25, 'rgba(255,210,90,0.95)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? 22 : 64;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Particles {
  constructor(scene, max, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.baseAlpha = new Float32Array(max).fill(1);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uBoost: { value: additive ? 2.4 : 1 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec4 color;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        uniform float uBoost;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, ${additive ? '0.0' : '0.35'}, d) * vColor.a;
          gl_FragColor = vec4(vColor.rgb * uBoost, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.mat = mat;
  }

  emit(x, y, z, vx, vy, vz, color, life, size, gravity, alpha = 1) {
    this.baseAlpha[this.cursor] = alpha;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = color.r; this.col[i * 4 + 1] = color.g; this.col[i * 4 + 2] = color.b; this.col[i * 4 + 3] = 1;
    this.life[i] = life; this.maxLife[i] = life;
    this.baseSize[i] = size; this.size[i] = size;
    this.grav[i] = gravity;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      const drag = 1 - Math.min(1, dt * 2);
      this.vel[k] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.col[i * 4 + 3] = Math.min(1, t * 2) * this.baseAlpha[i];
      this.size[i] = this.grav[i] < 0 ? this.baseSize[i] * (1.6 - 0.6 * t) : this.baseSize[i] * (0.4 + 0.6 * t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.size.fill(0); }
}

const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

export class Effects {
  constructor(scene, camera, uiRoot) {
    this.scene = scene;
    this.camera = camera;
    this.sparks = new Particles(scene, 1400, true);
    this.debris = new Particles(scene, 1000, false);

    // muzzle flashes
    const flashTex = starTexture();
    const flashGeo = new THREE.PlaneGeometry(1, 1);
    this.flashes = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ map: flashTex, color: new THREE.Color(3, 2.6, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false;
      m.renderOrder = 6;
      scene.add(m);
      this.flashes.push({ mesh: m, life: 0 });
    }
    this.flashCursor = 0;
    this.flashLight = new THREE.PointLight('#ffb347', 0, 9, 2);
    scene.add(this.flashLight);

    // tracers: crossed quads along +Z from 0..1
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1,
      0, -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 0, 0, 0.5, 1, 0, -0.5, 1,
    ], 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute([
      0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
    ], 2));
    const tracerTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = 8; cv.height = 64;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(255,240,200,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 64);
      const h = ctx.createLinearGradient(0, 0, 8, 0);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.tracers = [];
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ map: tracerTex, color: '#ffe08a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 6;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 0.08 });
    }
    this.tracerCursor = 0;

    // shockwave rings for eliminations
    const ringTex = glowTexture();
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0 });
    }
    this.glowTex = ringTex;

    // floating damage numbers (DOM pool)
    this.numbers = [];
    this.numberLayer = document.createElement('div');
    this.numberLayer.className = 'dmg-layer';
    uiRoot.appendChild(this.numberLayer);
    for (let i = 0; i < 30; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.display = 'none';
      this.numberLayer.appendChild(el);
      this.numbers.push({ el, life: 0, pos: new THREE.Vector3(), vx: 0 });
    }
    this.numberCursor = 0;
  }

  muzzle(pos, dir, scale = 1, light = false) {
    const f = this.flashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % this.flashes.length;
    f.mesh.position.copy(pos);
    f.mesh.quaternion.copy(this.camera.quaternion);
    f.mesh.rotateZ(Math.random() * Math.PI);
    f.mesh.scale.setScalar((0.45 + Math.random() * 0.25) * scale);
    f.mesh.visible = true;
    f.life = 0.05;
    if (light) {
      this.flashLight.position.copy(pos).addScaledVector(dir, 0.3);
      this.flashLight.intensity = 18;
      this.lightLife = 0.06;
    }
  }

  tracer(from, to, color = '#ffe08a', width = 0.045) {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(width, width, len);
    t.mesh.material.color.set(color).multiplyScalar(2.5);
    t.mesh.material.opacity = 1;
    t.mesh.visible = true;
    t.max = t.life = Math.min(0.12, 0.05 + len / 900);
  }

  impact(pos, kind = 'terrain', normal = _up) {
    const sparkCol = _c.set('#ffd27a');
    for (let i = 0; i < 6; i++) {
      this.sparks.emit(pos.x, pos.y, pos.z,
        (Math.random() - 0.5) * 6 + normal.x * 3, Math.random() * 4 + normal.y * 2, (Math.random() - 0.5) * 6 + normal.z * 3,
        sparkCol, 0.18 + Math.random() * 0.15, 0.06, 12);
    }
    const col = kind === 'wood' ? '#b07a45' : kind === 'stone' ? '#9a968f' : kind === 'leaf' ? '#5aa84a' : kind === 'robot' ? '#e8f2ff' : '#8b7a55';
    for (let i = 0; i < 5; i++) {
      _c.set(col).multiplyScalar(0.8 + Math.random() * 0.4);
      this.debris.emit(pos.x, pos.y, pos.z,
        (Math.random() - 0.5) * 3 + normal.x * 2, Math.random() * 3.5 + 1, (Math.random() - 0.5) * 3 + normal.z * 2,
        _c, 0.5 + Math.random() * 0.4, 0.09 + Math.random() * 0.06, 14);
    }
  }

  hitSparks(pos, color) {
    for (let i = 0; i < 10; i++) {
      _c.set(i % 2 ? '#ffffff' : color);
      this.sparks.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7, _c, 0.25 + Math.random() * 0.2, 0.08, 10);
    }
  }

  eliminate(pos, color) {
    const c = new THREE.Color(color);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
      _c.copy(c).lerp(new THREE.Color('#ffffff'), Math.random() * 0.5);
      this.sparks.emit(pos.x, pos.y + 1 + Math.random(), pos.z, Math.cos(a) * s, 2 + Math.random() * 8, Math.sin(a) * s, _c, 0.6 + Math.random() * 0.6, 0.18 + Math.random() * 0.12, 9);
    }
    for (let i = 0; i < 30; i++) {
      _c.copy(c).multiplyScalar(0.7);
      this.debris.emit(pos.x, pos.y + 1, pos.z, (Math.random() - 0.5) * 8, 3 + Math.random() * 6, (Math.random() - 0.5) * 8, _c, 1.0 + Math.random() * 0.5, 0.14, 16);
    }
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.mesh.position.set(pos.x, pos.y + 0.3, pos.z);
    r.mesh.material.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.3).multiplyScalar(2);
    r.life = 0.6;
    r.mesh.visible = true;
  }

  dust(pos, amount = 4, strength = 1) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random()) * strength;
      _c.set('#e3d6bd').multiplyScalar(0.9 + Math.random() * 0.15);
      this.debris.emit(pos.x + Math.cos(a) * 0.3, pos.y + 0.1, pos.z + Math.sin(a) * 0.3, Math.cos(a) * sp, 0.4 + Math.random() * 0.6, Math.sin(a) * sp, _c, 0.6 + Math.random() * 0.4, 0.35 + Math.random() * 0.25, -0.6, 0.55);
    }
  }

  confetti(pos) {
    const cols = ['#ff5d73', '#ffd23f', '#2ee6c9', '#6c8cff', '#b64cff', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      _c.set(cols[i % cols.length]);
      this.debris.emit(pos.x + (Math.random() - 0.5) * 6, pos.y + 6 + Math.random() * 3, pos.z + (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4, _c, 2.2 + Math.random(), 0.12, 2.5);
    }
  }

  damageNumber(pos, amount, headshot = false, shield = false) {
    const n = this.numbers[this.numberCursor];
    this.numberCursor = (this.numberCursor + 1) % this.numbers.length;
    n.pos.copy(pos);
    n.pos.x += (Math.random() - 0.5) * 0.6;
    n.vx = (Math.random() - 0.5) * 0.8;
    n.life = 0.9;
    n.el.textContent = Math.round(amount);
    n.el.className = 'dmg-num' + (headshot ? ' head' : '') + (shield ? ' shield' : '');
    n.el.style.display = 'block';
  }

  update(dt) {
    this.sparks.update(dt);
    this.debris.update(dt);
    const h = window.innerHeight * this.camera.projectionMatrix.elements[5] * 0.5;
    this.sparks.mat.uniforms.uScale.value = h;
    this.debris.mat.uniforms.uScale.value = h;
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) f.mesh.visible = false;
    }
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      if (this.lightLife <= 0) this.flashLight.intensity = 0;
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / t.max);
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / 0.6;
      r.mesh.scale.setScalar(0.5 + k * 7);
      r.mesh.material.opacity = Math.max(0, 1 - k);
      if (r.life <= 0) r.mesh.visible = false;
    }
    const w = window.innerWidth, hh = window.innerHeight;
    for (const n of this.numbers) {
      if (n.life <= 0) continue;
      n.life -= dt;
      if (n.life <= 0) { n.el.style.display = 'none'; continue; }
      n.pos.y += dt * 1.4;
      n.pos.x += n.vx * dt;
      _v.copy(n.pos).project(this.camera);
      if (_v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = 'block';
      const x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * hh;
      const age = 0.9 - n.life;
      const s = age < 0.12 ? 0.6 + age * 6 : 1.3 - Math.min(0.3, (age - 0.12) * 0.6);
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
      n.el.style.opacity = Math.min(1, n.life * 3);
    }
  }

  clear() {
    this.sparks.clear();
    this.debris.clear();
    for (const n of this.numbers) { n.life = 0; n.el.style.display = 'none'; }
    for (const t of this.tracers) { t.life = 0; t.mesh.visible = false; }
    for (const f of this.flashes) { f.life = 0; f.mesh.visible = false; }
  }
}
