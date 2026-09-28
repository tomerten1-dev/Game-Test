import * as THREE from 'three';

// Sprites (Fortnite Chapter 6+): a little elemental companion that floats by your shoulder in place of
// a back bling and gives a power. You keep them between matches; opening chests and eliminations level
// the equipped one up (levels 1-3), which makes its power stronger.
export const SPRITES = {
  water: { name: 'Water Sprite', color: '#4fc3ff', desc: 'Sprite key: heal health and shield over a few seconds', heal: [40, 50, 60], cd: [60, 50, 40] },
  earth: { name: 'Earth Sprite', color: '#8fd16a', desc: 'Chests sometimes give you an extra rare item', chance: [0.25, 0.35, 0.45] },
  fire: { name: 'Fire Sprite', color: '#ff7a2a', desc: 'Every so much damage you deal sets your target alight', need: [175, 150, 125] },
};
export const SPRITE_LEVELS = [0, 50, 150]; // xp needed for level 1 / 2 / 3
export const spriteLevel = (xp = 0) => (xp >= SPRITE_LEVELS[2] ? 3 : xp >= SPRITE_LEVELS[1] ? 2 : 1);

const _v = new THREE.Vector3();
const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: '#10141c' });

export class SpriteCompanion {
  constructor(actor, kind) {
    this.actor = actor;
    this.kind = kind;
    this.def = SPRITES[kind];
    this.readyAt = 0;
    this.dmgAcc = 0;
    const g = new THREE.Group();
    const col = new THREE.Color(this.def.color);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.92 }));
    body.scale.y = 1.15;
    g.add(body);
    for (const x of [-0.06, 0.06]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, 0.04, 0.14); g.add(e); }
    // element detail: a droplet tip, a leaf pair or a flame tuft
    const detail = new THREE.MeshStandardMaterial({ color: col.clone().offsetHSL(0, 0, 0.15), emissive: col, emissiveIntensity: 0.6 });
    if (kind === 'water') { const d = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 10), detail); d.position.y = 0.22; g.add(d); }
    else if (kind === 'earth') for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.06), detail); l.position.set(0.07 * s, 0.2, 0); l.rotation.z = -0.5 * s; g.add(l); }
    else for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), detail); f.position.set((i - 1) * 0.06, 0.2 + (i === 1 ? 0.04 : 0), 0); g.add(f); }
    g.traverse((o) => { o.castShadow = false; });
    this.mesh = g;
    this.t = Math.random() * 10;
    actor.game.scene.add(g);
    if (actor.backBling) actor.backBling.visible = false; // it takes the back bling's place
  }

  get level() { return this.actor.spriteLevel || 1; }
  get cooldownLeft() { return Math.max(0, this.readyAt - this.actor.game.time); }

  // Water Sprite power (the sprite key; bots use it when hurt).
  useAbility() {
    const a = this.actor, g = a.game;
    if (this.kind !== 'water') return 'This sprite has a passive power';
    if (this.cooldownLeft > 0) return `Sprite recharging · ${Math.ceil(this.cooldownLeft)} s`;
    if (a.health >= 100 && a.shield >= 100) return 'Health and shield are full';
    const amt = this.def.heal[this.level - 1];
    a.regen = { left: amt + (a.regen?.left || 0), rate: 20, acc: 0, both: true };
    this.readyAt = g.time + this.def.cd[this.level - 1];
    g.sound.play('shield', a.isPlayer ? null : a.pos, { range: 30 });
    for (let i = 0; i < 24; i++) g.effects.sparks.emit(a.pos.x, a.pos.y + 1, a.pos.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 3, new THREE.Color('#6fd8ff'), 0.6, 0.16, 2);
    return null;
  }

  // Fire Sprite: damage you deal charges it; at the threshold your target catches fire.
  onDealt(target, amount) {
    if (this.kind !== 'fire' || !target?.alive) return;
    this.dmgAcc += amount;
    if (this.dmgAcc < this.def.need[this.level - 1]) return;
    this.dmgAcc = 0;
    this.actor.game.fire?.ignite(target.pos, this.actor, { r: 2.2, dur: 4, gen: 2 });
  }

  // Earth Sprite: sometimes one extra rare item from a chest.
  bonusChest() {
    return this.kind === 'earth' && Math.random() < this.def.chance[this.level - 1];
  }

  update(dt) {
    const a = this.actor;
    this.t += dt;
    const vis = a.alive && a.root.visible && a.state !== 'bus';
    this.mesh.visible = vis;
    if (!vis) return;
    // float beside the right shoulder, bobbing, turning with you
    const yaw = a.bodyYaw ?? 0;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    _v.set(a.pos.x - rx * 0.55 - Math.sin(yaw) * 0.25, a.pos.y + 1.85 + Math.sin(this.t * 2.2) * 0.08, a.pos.z - rz * 0.55 - Math.cos(yaw) * 0.25);
    this.mesh.position.lerp(_v, Math.min(1, dt * 8));
    this.mesh.rotation.y = yaw + Math.sin(this.t * 1.3) * 0.3;
  }

  dispose() {
    this.actor.game.scene.remove(this.mesh);
    if (this.actor.backBling) this.actor.backBling.visible = true;
  }
}
