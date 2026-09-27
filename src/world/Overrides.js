import * as THREE from 'three';
import { TOWNS } from './Terrain.js';

// Match Overrides (Fortnite Chapter 7 Season 4): Override Consoles switch on a few times a match and
// show up on the map. The first player to reach one picks one of three rule changes, and it applies to
// the whole lobby for the rest of the match.
export const OVERRIDES = {
  sonic: { name: 'Sonic Speed', desc: 'Everyone sprints 20% faster' },
  heal: { name: 'Constant Heal', desc: 'Out of combat, health then shield regenerate' },
  stamina: { name: 'Infinite Stamina', desc: 'Tactical sprint never runs out' },
  headshot: { name: 'Headshot', desc: 'Headshots deal 25% more damage' },
  overshield: { name: 'Overshield', desc: 'Everyone gets +50 shield right now' },
  speedshot: { name: 'Speed Shooter', desc: 'Guns fire and reload 20% faster' },
  siphon: { name: 'Health Siphon', desc: 'Eliminations siphon twice as much' },
  bigfish: { name: 'Big Fish', desc: 'Every cast fishes like a fishing spot' },
  extralife: { name: 'Extra Life', desc: 'Everyone alive comes back once when eliminated' },
  morexp: { name: 'More XP', desc: '+50% XP from this match' },
};
const TIMES = [80, 230, 380]; // seconds into the match when a console switches on
const CLAIM_WINDOW = 45; // if nobody reaches it in time, some other player claims it

export class Overrides {
  constructor(game) {
    this.game = game;
    this.active = new Set();
    this.consoles = [];
    this.idx = 0;
  }

  has(k) { return this.active.has(k); }

  reset() {
    for (const c of this.consoles) this.game.scene.remove(c.group);
    this.consoles = [];
    this.active.clear();
    this.idx = 0;
  }

  _spawn() {
    const g = this.game;
    for (let i = 0; i < 60; i++) {
      const t = TOWNS[Math.floor(Math.random() * TOWNS.length)];
      const a = Math.random() * Math.PI * 2, d = t.r * (0.2 + Math.random() * 0.4);
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!g.storm.isSafe(x, z, -10) || !g.events._clearSpot(x, z, 1.4, 0.8)) continue;
      const y = g.world.heightAt(x, z);
      const group = new THREE.Group();
      const dark = new THREE.MeshStandardMaterial({ color: '#232838', roughness: 0.4, metalness: 0.6 });
      const glow = new THREE.MeshStandardMaterial({ color: '#ff3df0', emissive: '#ff1ee6', emissiveIntensity: 1.4 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 16), dark); base.position.y = 0.15;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), dark); post.position.y = 0.9;
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.08), glow); screen.position.set(0, 1.55, 0.2); screen.rotation.x = -0.4;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ff3df0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 31;
      for (const m of [base, post, screen]) { m.castShadow = true; group.add(m); }
      group.add(beam);
      group.position.set(x, y, z);
      g.scene.add(group);
      g.world.colliders.add({ kind: 'circle', x, z, r: 0.6, y0: y, y1: y + 1.5, crate: true });
      const opts = Object.keys(OVERRIDES).filter((k) => !this.active.has(k)).sort(() => Math.random() - 0.5).slice(0, 3);
      const c = { x, y, z, group, beam, opts, t: 0, town: t.name, claimed: false };
      this.consoles.push(c);
      g.hud?.banner?.(`Override Console online at ${t.name}!`, 3.5);
      g.sound.play('supply');
      return c;
    }
    return null;
  }

  nearest(pos) {
    for (const c of this.consoles) if (!c.claimed && Math.hypot(c.x - pos.x, c.z - pos.z) < 2.2 && Math.abs(c.y - pos.y) < 2.5) return { kind: 'override', console: c, text: 'Use Override Console', rarity: 5 };
    return null;
  }

  // Someone claimed the console and picked `key`.
  apply(c, key, who) {
    if (c.claimed || !OVERRIDES[key]) return;
    c.claimed = true;
    c.beam.visible = false;
    c.group.children[2].material = new THREE.MeshStandardMaterial({ color: '#555a66' });
    this.active.add(key);
    const g = this.game;
    if (key === 'overshield') for (const a of g.actors) if (a.alive && !a.npc) a.shield = Math.min(100, a.shield + 50);
    if (key === 'extralife') for (const a of g.actors) if (a.alive && !a.npc) a.extraLife = true;
    g.hud?.banner?.(`${who?.isPlayer ? 'You' : who?.name || 'Someone'} activated ${OVERRIDES[key].name}: ${OVERRIDES[key].desc}`, 4.5);
    g.sound.play('stormChime');
  }

  update(dt) {
    const g = this.game;
    if (g.state !== 'playing' || g.warmup > 0 || g.mode === 'arena') return;
    if (this.idx < TIMES.length && g.time > TIMES[this.idx] && g.storm.stage !== 'done') { this.idx++; this._spawn(); }
    for (const c of this.consoles) {
      if (c.claimed) continue;
      c.t += dt;
      c.beam.material.opacity = 0.15 + 0.1 * Math.sin(g.time * 4);
      // a bot standing at it, or nobody in time: another player picks for the lobby
      const bot = g.bots.find((b) => b.alive && !b.npc && Math.hypot(b.pos.x - c.x, b.pos.z - c.z) < 2.5);
      if (bot || c.t > CLAIM_WINDOW) this.apply(c, c.opts[Math.floor(Math.random() * c.opts.length)], bot || g.bots.find((b) => b.alive && !b.npc));
    }
  }

  mapIcons() {
    return this.consoles.filter((c) => !c.claimed).map((c) => ({ x: c.x, z: c.z, color: '#ff3df0', shape: 'square', label: 'Override Console' }));
  }
}
