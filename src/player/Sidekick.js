import * as THREE from 'three';

// Sidekicks (Fortnite): a little pet that trots after you. No gameplay effect and nobody can hurt it;
// it hops when you emote or jump and gets excited when you open a chest.
const LOOKS = {
  pup: { body: '#c98a4b', belly: '#f1dcc0', ear: '#7a4f2c' },
  kitty: { body: '#8a8f99', belly: '#e8e8ee', ear: '#5a5f69' },
  penguin: { body: '#1f2430', belly: '#f4f6f8', ear: '#ffb347' },
};
const _v = new THREE.Vector3();

export class Sidekick {
  constructor(owner, kind) {
    this.owner = owner;
    this.kind = kind;
    const L = LOOKS[kind] || LOOKS.pup;
    const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    if (kind === 'penguin') {
      add(new THREE.SphereGeometry(0.22, 12, 10), m(L.body), 0, 0.3, 0).scale.set(1, 1.35, 0.95);
      add(new THREE.SphereGeometry(0.16, 12, 10), m(L.belly), 0, 0.27, 0.09).scale.set(1, 1.4, 0.8);
      add(new THREE.ConeGeometry(0.05, 0.12, 6), m(L.ear), 0, 0.5, 0.2).rotation.x = Math.PI / 2;
      for (const x of [-0.08, 0.08]) add(new THREE.BoxGeometry(0.08, 0.03, 0.12), m(L.ear), x, 0.02, 0.05);
    } else {
      add(new THREE.BoxGeometry(0.26, 0.2, 0.42), m(L.body), 0, 0.3, 0);
      add(new THREE.BoxGeometry(0.2, 0.08, 0.3), m(L.belly), 0, 0.2, 0);
      const head = add(new THREE.BoxGeometry(0.22, 0.2, 0.2), m(L.body), 0, 0.48, 0.22);
      add(new THREE.BoxGeometry(0.1, 0.08, 0.08), m(L.belly), 0, 0.44, 0.34);
      for (const x of [-0.07, 0.07]) {
        const ear = add(kind === 'kitty' ? new THREE.ConeGeometry(0.05, 0.1, 4) : new THREE.BoxGeometry(0.06, 0.12, 0.04), m(L.ear), x, 0.62, 0.2);
        if (kind !== 'kitty') ear.rotation.z = x * 4;
      }
      for (const [x, z] of [[-0.09, -0.14], [0.09, -0.14], [-0.09, 0.14], [0.09, 0.14]]) add(new THREE.BoxGeometry(0.06, 0.2, 0.06), m(L.body), x, 0.1, z);
      const tail = add(new THREE.BoxGeometry(0.04, 0.04, 0.2), m(L.body), 0, 0.38, -0.28);
      tail.rotation.x = kind === 'kitty' ? -0.9 : -0.5;
      this.tail = tail;
      this.head = head;
    }
    for (const x of [-0.05, 0.05]) add(new THREE.SphereGeometry(0.022, 6, 6), new THREE.MeshBasicMaterial({ color: '#111' }), x, kind === 'penguin' ? 0.52 : 0.52, kind === 'penguin' ? 0.17 : 0.33);
    g.scale.setScalar(1.15);
    this.mesh = g;
    this.pos = owner.pos.clone();
    this.vy = 0; this.y = owner.pos.y; this.t = 0; this.hopT = 0;
    owner.game.scene.add(g);
  }

  hop(n = 1) { if (this.y <= this.ground + 0.01) this.vy = 3.2 * n; }

  update(dt) {
    const o = this.owner, g = o.game;
    this.t += dt;
    const vis = o.alive && o.state === 'ground' && o.root.visible;
    this.mesh.visible = vis;
    if (!vis) { this.pos.copy(o.pos); this.y = o.pos.y; return; }
    // stay a couple of metres behind and to the left of its owner
    const yaw = o.bodyYaw ?? 0;
    _v.set(o.pos.x - Math.sin(yaw) * 1.6 + Math.cos(yaw) * 1.0, 0, o.pos.z - Math.cos(yaw) * 1.6 - Math.sin(yaw) * 1.0);
    const dx = _v.x - this.pos.x, dz = _v.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 25) { this.pos.set(_v.x, o.pos.y, _v.z); }
    else if (d > 0.4) {
      const sp = Math.min(d * 3, 11) * dt;
      this.pos.x += (dx / d) * sp; this.pos.z += (dz / d) * sp;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    } else this.mesh.rotation.y += (yaw - this.mesh.rotation.y) * Math.min(1, dt * 3);
    this.ground = g.world.groundAt(this.pos.x, this.pos.z, o.pos.y + 1.5, 0.2);
    // hop along with emotes and jumps
    if ((o.emote && Math.sin(this.t * 6) > 0.95) || (!o.onGround && o.vel.y > 3)) this.hop();
    this.vy -= 14 * dt;
    this.y = Math.max(this.ground, this.y + this.vy * dt);
    if (this.y <= this.ground) this.vy = 0;
    const moving = d > 0.4;
    this.mesh.position.set(this.pos.x, this.y + (moving ? Math.abs(Math.sin(this.t * 14)) * 0.05 : 0), this.pos.z);
    if (this.tail) this.tail.rotation.y = Math.sin(this.t * (moving ? 14 : 6)) * 0.6;
  }

  dispose() { this.owner.game.scene.remove(this.mesh); }
}
