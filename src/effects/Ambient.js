import * as THREE from 'three';

const _c = new THREE.Color();
const LEAF_COLORS = ['#6cc24a', '#9bd35a', '#f39a34', '#f4b83f'];

function makeBird() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.7, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 5), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, 0, 0, -0.2, 1.1, 0, -0.05], 3));
  wingGeo.computeVertexNormals();
  const wl = new THREE.Mesh(wingGeo, mat), wr = new THREE.Mesh(wingGeo, mat);
  wr.scale.x = -1;
  g.add(wl, wr);
  g.userData.wings = [wl, wr];
  return g;
}

// Ambient life: birds circling, falling leaves, chest sparkles, fountain spray.
export class Ambient {
  constructor(game) {
    this.game = game;
    this.birds = [];
    for (let f = 0; f < 2; f++) {
      const cx = (Math.random() - 0.5) * 160, cz = (Math.random() - 0.5) * 160;
      for (let i = 0; i < 6; i++) {
        const b = makeBird();
        b.scale.setScalar(0.9 + Math.random() * 0.3);
        game.scene.add(b);
        this.birds.push({ mesh: b, cx, cz, r: 35 + Math.random() * 10 + f * 20, h: 45 + f * 12 + Math.random() * 6, ph: i * 0.18 + Math.random() * 0.1, speed: (0.16 + f * 0.04) * (f ? -1 : 1), flap: Math.random() * 6 });
      }
    }
    this.leafT = 0;
    this.sparkT = 0;
  }

  update(dt, t) {
    const g = this.game;
    for (const b of this.birds) {
      const a = t * b.speed + b.ph;
      const x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r;
      b.mesh.position.set(x, b.h + Math.sin(t * 0.7 + b.ph * 5) * 2, z);
      b.mesh.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(b.speed), Math.cos(a) * Math.sign(b.speed)) + Math.PI / 2 * 0;
      b.mesh.lookAt(b.cx + Math.cos(a + 0.1 * Math.sign(b.speed)) * b.r, b.mesh.position.y, b.cz + Math.sin(a + 0.1 * Math.sign(b.speed)) * b.r);
      const flap = Math.sin(t * 9 + b.flap) * 0.7 * (Math.sin(t * 0.8 + b.flap) > -0.2 ? 1 : 0.15);
      b.mesh.userData.wings[0].rotation.z = flap;
      b.mesh.userData.wings[1].rotation.z = -flap;
    }
    const cam = g.camera.position;
    const fx = g.effects;
    // falling leaves from nearby canopies
    this.leafT -= dt;
    if (this.leafT <= 0) {
      this.leafT = 0.25;
      const occ = g.world.foliage.occluders;
      for (let k = 0; k < 6; k++) {
        const o = occ[Math.floor(Math.random() * occ.length)];
        if (!o || Math.abs(o.x - cam.x) > 35 || Math.abs(o.z - cam.z) > 35 || o.r < 1.2) continue;
        _c.set(LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]);
        fx.debris.emit(o.x + (Math.random() - 0.5) * o.r, o.y - o.r * 0.3, o.z + (Math.random() - 0.5) * o.r,
          (Math.random() - 0.5) * 1.5 + 0.6, -0.3, (Math.random() - 0.5) * 1.5, _c, 3.5, 0.1, 0.35);
        break;
      }
    }
    // chest sparkles
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = 0.08;
      for (const c of g.loot.chests) {
        if (c.opened || Math.abs(c.x - cam.x) > 40 || Math.abs(c.z - cam.z) > 40 || Math.random() > 0.35) continue;
        _c.set('#ffe28a');
        fx.sparks.emit(c.x + (Math.random() - 0.5) * 1.1, c.y + 0.4 + Math.random() * 0.4, c.z + (Math.random() - 0.5) * 0.8,
          0, 0.8 + Math.random() * 0.8, 0, _c, 0.8, 0.07, -0.2);
      }
    }
    // fountain spray
    for (const f of g.world.towns.fountains || []) {
      if (Math.abs(f.x - cam.x) > 55 || Math.abs(f.z - cam.z) > 55) continue;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.5;
        _c.set('#dff6ff');
        fx.debris.emit(f.x, f.y + 0.1, f.z, Math.cos(a) * s, 3.2 + Math.random() * 0.8, Math.sin(a) * s, _c, 0.75, 0.09, 9, 0.8);
      }
    }
  }
}
