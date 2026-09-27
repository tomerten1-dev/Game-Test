import * as THREE from 'three';

// Trees and rocks with hit points. Each one is drawn by one or more InstancedMeshes (and, for
// trees with a detailed near-camera version, a LOD record). When its HP runs out the instances
// are hidden, the collider removed, and a stand-in copy topples over (trees) or crumbles (rocks)
// before poofing into debris. Everything grows back for the next match.

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _c = new THREE.Color(), _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Destructibles {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.list = [];
    this.anims = [];
    this.game = null; // set by the game (effects, sound)
    this.onLodChange = null; // forces a tree LOD refresh
  }

  // handles: [{ im, idx }] — the instances that draw it (their current matrices are remembered).
  // opts: { kind: 'tree' | 'rock', hp, lod: { rec, shown(): bool, detail(): [{ geometry, material, matrix, color }] } }
  register(col, handles, opts) {
    if (!col) return null;
    const hs = handles.filter((h) => h.im).map((h) => {
      const mat = new THREE.Matrix4();
      h.im.getMatrixAt(h.idx, mat);
      return { im: h.im, idx: h.idx, mat };
    });
    const o = { col, handles: hs, kind: opts.kind, maxHp: opts.hp, hp: opts.hp, dead: false, lod: opts.lod || null, mat: opts.kind === 'rock' ? 'stone' : 'wood' };
    col.obj = o;
    this.list.push(o);
    return o;
  }

  // Damage a tree/rock collider. Returns true when it broke.
  damage(col, amount, by = null) {
    const o = col?.obj;
    if (!o || o.dead) return false;
    o.hp -= amount;
    if (o.hp > 0) return false;
    this.destroy(o, by);
    if (by?.isPlayer && o.kind === 'tree') this.game?.meta?.track('tree');
    return true;
  }

  destroy(o, by) {
    o.dead = true;
    o.hp = 0;
    this.colliders.remove(o.col);
    const c = o.col;
    const base = new THREE.Vector3(c.x, c.y0 + (o.kind === 'rock' ? 3 : 2), c.z);
    // the stand-in copy, built from whatever is drawing it right now
    const parts = o.lod?.shown() ? o.lod.detail() : o.handles.map((h) => ({
      geometry: h.im.geometry, material: h.im.material, matrix: h.mat,
      color: h.im.instanceColor ? h.im.getColorAt(h.idx, new THREE.Color()) : null,
    }));
    for (const h of o.handles) { h.im.setMatrixAt(h.idx, ZERO); h.im.instanceMatrix.needsUpdate = true; }
    if (o.lod) { o.lod.rec.removed = true; this.onLodChange?.(); }
    const pivot = new THREE.Group();
    pivot.position.copy(base);
    _inv.makeTranslation(-base.x, -base.y, -base.z);
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geometry, p.material, 1);
      im.setMatrixAt(0, _m.multiplyMatrices(_inv, p.matrix));
      if (p.color) im.setColorAt(0, p.color);
      im.castShadow = true;
      im.frustumCulled = false;
      pivot.add(im);
    }
    this.scene.add(pivot);
    // trees fall away from whoever cut them
    let dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5);
    if (by?.pos) dir.set(c.x - by.pos.x, 0, c.z - by.pos.z);
    if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
    dir.normalize();
    const axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
    const height = c.y1 - c.y0 - 2;
    this.anims.push({ o, pivot, axis, t: 0, angle: 0, spin: 0, height, dir });
    const g = this.game;
    if (g) {
      g.sound.play(o.kind === 'rock' ? 'break' : 'treeFall', base, { range: 80 });
      if (o.kind === 'rock') this._debris(base, '#9a968c', 40, height);
    }
  }

  _debris(pos, color, n, height = 2, spread = 1.5) {
    const fx = this.game?.effects;
    if (!fx) return;
    _c.set(color);
    for (let i = 0; i < n; i++) {
      fx.debris.emit(pos.x + (Math.random() - 0.5) * spread * 2, pos.y + Math.random() * Math.max(1, height * 0.6), pos.z + (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * 6, 1 + Math.random() * 5, (Math.random() - 0.5) * 6, _c, 1.0, 0.18 + Math.random() * 0.2, 14);
    }
  }

  update(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      if (a.o.kind === 'rock') {
        // crumble: sink and shrink
        const k = Math.min(1, a.t / 0.45);
        a.pivot.scale.setScalar(Math.max(0.01, 1 - k * k));
        a.pivot.position.y -= dt * 2;
        if (k >= 1) this._finish(i);
        continue;
      }
      // topple: accelerate like a real falling trunk, bounce a touch on landing, then poof
      if (a.angle < Math.PI / 2 - 0.08) {
        a.spin += dt * (0.9 + a.angle * 5.5);
        a.angle = Math.min(Math.PI / 2 - 0.08, a.angle + a.spin * dt);
        if (a.angle >= Math.PI / 2 - 0.08) {
          a.landT = a.t;
          this.game?.sound.play('build', a.pivot.position, { range: 60 });
          const tip = _v.copy(a.pivot.position).addScaledVector(a.dir, a.height * 0.6);
          if (this.game?.effects) this.game.effects.dust?.(tip, 10, 2.2);
        }
      }
      a.pivot.quaternion.setFromAxisAngle(a.axis, a.angle);
      if (a.landT !== undefined && a.t - a.landT > 0.5) {
        const k = Math.min(1, (a.t - a.landT - 0.5) / 0.3);
        a.pivot.scale.setScalar(Math.max(0.01, 1 - k));
        if (k >= 1) {
          // leaves and splinters where the tree lay
          for (let s = 0.2; s <= 1; s += 0.2) {
            const p = _v.copy(a.pivot.position).addScaledVector(a.dir, a.height * s);
            this._debris(p, s > 0.5 ? '#5c9a4a' : '#8a5a34', 7, 1, 1);
          }
          this._finish(i);
        }
      }
    }
  }

  _finish(i) {
    const a = this.anims[i];
    this.scene.remove(a.pivot);
    for (const ch of a.pivot.children) ch.dispose?.();
    this.anims.splice(i, 1);
  }

  // New match: every tree and rock back.
  reset() {
    for (let i = this.anims.length - 1; i >= 0; i--) this._finish(i);
    let lod = false;
    for (const o of this.list) {
      o.hp = o.maxHp;
      if (!o.dead) continue;
      o.dead = false;
      this.colliders.add(o.col);
      if (o.lod) { o.lod.rec.removed = false; lod = true; }
      for (const h of o.handles) { h.im.setMatrixAt(h.idx, h.mat); h.im.instanceMatrix.needsUpdate = true; }
    }
    if (lod) this.onLodChange?.(true);
  }
}
