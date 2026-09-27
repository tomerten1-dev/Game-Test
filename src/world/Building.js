import * as THREE from 'three';

const GRID = 4;
const HEIGHT = 4;
const COST = 10;

function woodTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const planks = 5;
  for (let i = 0; i < planks; i++) {
    const shade = [0xc9, 0xbd, 0xd3, 0xc2, 0xcc][i];
    ctx.fillStyle = `rgb(${shade}, ${Math.round(shade * 0.66)}, ${Math.round(shade * 0.38)})`;
    ctx.fillRect(0, (i * 128) / planks, 128, 128 / planks);
    ctx.fillStyle = 'rgba(70,35,10,0.55)';
    ctx.fillRect(0, (i * 128) / planks, 128, 3);
    ctx.fillStyle = 'rgba(70,35,10,0.35)';
    for (let k = 0; k < 2; k++) ctx.fillRect(10 + ((i * 37 + k * 50) % 100), (i * 128) / planks + 8, 4, 4);
  }
  ctx.strokeStyle = '#7a4a22';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 118, 118);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Player/bot-built wood walls and ramps snapped to a 4m grid.
export class Building {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.tex = woodTexture();
    this.structures = [];
    this.keys = new Map();
    this.wallGeo = new THREE.BoxGeometry(GRID, HEIGHT, 0.24);
    this.wallGeo.translate(0, HEIGHT / 2, 0);
    const len = Math.hypot(GRID, HEIGHT);
    this.rampGeo = new THREE.BoxGeometry(GRID, 0.2, len);
  }

  reset() {
    for (const s of [...this.structures]) this._remove(s, false);
    this.structures = [];
    this.keys.clear();
  }

  static dirFromYaw(yaw) {
    // 0:+Z 1:+X 2:-Z 3:-X
    const i = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
    return [[0, 1], [1, 0], [0, -1], [-1, 0]][i];
  }

  _baseY(actor, x, z, extent) {
    const w = this.world;
    const feet = actor.pos.y;
    const terrain = Math.min(
      w.heightAt(x, z), w.heightAt(x + extent[0], z + extent[1]), w.heightAt(x - extent[0], z - extent[1]),
    );
    // standing on a structure/ramp: build from the feet level
    if (feet - w.heightAt(actor.pos.x, actor.pos.z) > 0.8) return feet - 0.05;
    return Math.max(terrain - 0.3, -1);
  }

  buildWall(actor) { return this.buildWallFacing(actor, actor.aimYaw); }

  buildWallFacing(actor, yaw) {
    if (actor.wood < COST || actor.state !== 'ground') return false;
    const [dx, dz] = Building.dirFromYaw(yaw);
    const ix = Math.floor(actor.pos.x / GRID), iz = Math.floor(actor.pos.z / GRID);
    let cx, cz, alongX;
    if (dx !== 0) { cx = (dx > 0 ? ix + 1 : ix) * GRID; cz = iz * GRID + GRID / 2; alongX = false; }
    else { cz = (dz > 0 ? iz + 1 : iz) * GRID; cx = ix * GRID + GRID / 2; alongX = true; }
    const y0 = this._baseY(actor, cx, cz, alongX ? [GRID / 2, 0] : [0, GRID / 2]);
    const level = Math.round(y0 / 2);
    const key = `w:${cx}:${cz}:${level}`;
    if (this.keys.has(key)) return false;
    const mesh = new THREE.Mesh(this.wallGeo, new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.85 }));
    mesh.position.set(cx, y0, cz);
    mesh.rotation.y = alongX ? 0 : Math.PI / 2;
    const h = 0.12;
    const col = alongX
      ? { kind: 'box', minX: cx - GRID / 2, maxX: cx + GRID / 2, minZ: cz - h, maxZ: cz + h, y0, y1: y0 + HEIGHT }
      : { kind: 'box', minX: cx - h, maxX: cx + h, minZ: cz - GRID / 2, maxZ: cz + GRID / 2, y0, y1: y0 + HEIGHT };
    return this._add('wall', mesh, col, key, actor, 150);
  }

  buildRamp(actor) {
    if (actor.wood < COST || actor.state !== 'ground') return false;
    const [dx, dz] = Building.dirFromYaw(actor.aimYaw);
    const px = actor.pos.x + dx * 2.2, pz = actor.pos.z + dz * 2.2;
    const ix = Math.floor(px / GRID), iz = Math.floor(pz / GRID);
    const cx = ix * GRID + GRID / 2, cz = iz * GRID + GRID / 2;
    const y0 = this._baseY(actor, cx - dx * GRID / 2, cz - dz * GRID / 2, [0, 0]);
    const level = Math.round(y0 / 2);
    const key = `r:${cx}:${cz}:${level}`;
    if (this.keys.has(key)) return false;
    const mesh = new THREE.Mesh(this.rampGeo, new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.85 }));
    mesh.position.set(cx, y0 + HEIGHT / 2, cz);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.rotation.x = -Math.atan2(HEIGHT, GRID);
    const col = { kind: 'ramp', minX: cx - GRID / 2, maxX: cx + GRID / 2, minZ: cz - GRID / 2, maxZ: cz + GRID / 2, y0, y1: y0 + HEIGHT, dirX: dx, dirZ: dz };
    return this._add('ramp', mesh, col, key, actor, 140);
  }

  _add(type, mesh, col, key, actor, hp) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(1, 0.05, 1);
    this.scene.add(mesh);
    const s = { type, mesh, col, key, hp, maxHp: hp, grow: 0, owner: actor, base: mesh.position.clone() };
    if (type === 'ramp') mesh.scale.setScalar(0.05);
    col.dynamic = true;
    col.structure = s;
    s.damage = (amount, by) => this.damage(s, amount, by);
    this.world.colliders.add(col);
    this.keys.set(key, s);
    this.structures.push(s);
    actor.wood -= COST;
    this.game.sound.play('build', actor.isPlayer ? null : actor.pos);
    return true;
  }

  damage(s, amount) {
    if (s.hp <= 0) return;
    s.hp -= amount;
    s.hitT = 0.12;
    const k = Math.max(0, s.hp / s.maxHp);
    s.mesh.material.color.setRGB(0.6 + 0.4 * k, 0.5 + 0.5 * k, 0.45 + 0.55 * k);
    if (s.hp <= 0) this._remove(s, true);
  }

  _remove(s, fx) {
    this.world.colliders.remove(s.col);
    this.scene.remove(s.mesh);
    s.mesh.material.dispose();
    this.keys.delete(s.key);
    const i = this.structures.indexOf(s);
    if (i >= 0) this.structures.splice(i, 1);
    if (fx) {
      const p = s.mesh.position;
      const c = new THREE.Color('#b07a45');
      for (let i = 0; i < 26; i++) {
        this.game.effects.debris.emit(p.x + (Math.random() - 0.5) * 3, p.y + (s.type === 'wall' ? Math.random() * 3.5 : 0), p.z + (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 5, Math.random() * 5, (Math.random() - 0.5) * 5, c, 0.9, 0.22, 14);
      }
      this.game.sound.play('break', p);
    }
  }

  update(dt) {
    for (const s of this.structures) {
      if (s.grow < 1) {
        s.grow = Math.min(1, s.grow + dt * 6);
        const k = 1 - Math.pow(1 - s.grow, 3);
        if (s.type === 'ramp') s.mesh.scale.setScalar(Math.max(0.05, k));
        else s.mesh.scale.set(1, Math.max(0.05, k), 1);
      }
      if (s.hitT > 0) {
        s.hitT -= dt;
        s.mesh.position.copy(s.base);
        if (s.hitT > 0) { s.mesh.position.x += (Math.random() - 0.5) * 0.06; s.mesh.position.z += (Math.random() - 0.5) * 0.06; }
      }
    }
  }
}
