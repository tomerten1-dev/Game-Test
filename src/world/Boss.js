import * as THREE from 'three';
import { Bot } from '../bots/Bot.js';
import { Weapon } from '../weapons/Weapon.js';
import { Loot } from './Loot.js';

const _v = new THREE.Vector3();

// The Foreman: an NPC boss guarding Rusty Works with a few guards. He drops the Vault Keycard;
// the vault next door holds mythic and legendary loot. NPCs never count as players.
export class BossEvent {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.boss = null;
  }

  get vault() { return this.game.world.towns.vault; }

  spawn() {
    const g = this.game, v = this.vault;
    if (!v) return;
    const home = { x: v.front.x - 6, z: v.front.z + 4, r: 32 };
    const boss = new Bot(g, 'The Foreman', '#ff8a2a', 0.95, 'Barbarian');
    boss.npc = 'boss';
    boss.health = 400; boss.maxHealth = 400; boss.shield = 200;
    boss.character.root.scale.setScalar(1.3);
    boss.items[1] = new Weapon('burst', 5);
    boss.items[2] = new Weapon('pump', 4);
    this._place(boss, home, 0);
    boss.leash = home;
    this.boss = boss;
    const guards = [];
    for (let i = 0; i < 3; i++) {
      const gd = new Bot(g, `Rusty Guard ${i + 1}`, '#8a96a3', 0.55, 'Knight');
      gd.npc = 'guard';
      gd.health = 150; gd.maxHealth = 150;
      gd.items[1] = new Weapon(i === 1 ? 'pump' : 'ar', 2);
      gd.leash = home;
      this._place(gd, home, (i + 1) * 2.1);
      guards.push(gd);
    }
    this.npcs = [boss, ...guards];
    for (const n of this.npcs) { n.switchSlot(1); g.actors.push(n); g.bots.push(n); }
  }

  _place(a, home, ang) {
    const x = home.x + Math.cos(ang) * (ang ? 7 : 0), z = home.z + Math.sin(ang) * (ang ? 7 : 0);
    a.spawnGround(x, z);
    a.landTime = -999;
  }

  // Boss drops: keycard, his mythic, shields.
  onDeath(a) {
    const loot = this.game.loot;
    if (a.npc !== 'boss') return;
    const at = _v.copy(a.pos).setY(a.pos.y + 1);
    loot.spawnPickup({ type: 'consumable', ctype: 'keycard', count: 1 }, at, new THREE.Vector3(0, 5, 0));
    loot.spawnPickup({ type: 'consumable', ctype: 'bigshield', count: 2 }, at, new THREE.Vector3(2, 4, 1));
    this.game.hud.banner('The Foreman is down! Grab the Vault Keycard', 3);
  }

  // Vault door: needs a keycard in the inventory.
  nearestInteractable(actor, reach = 3) {
    const v = this.vault;
    if (!v || v.opened) return null;
    if (Math.hypot(actor.pos.x - v.front.x, actor.pos.z - v.front.z) > reach) return null;
    const has = actor.items.some((it) => it?.type === 'keycard');
    return { kind: 'vault', text: has ? 'Open Vault' : "Vault (needs the Foreman's keycard)", rarity: 5 };
  }

  openVault(actor) {
    const v = this.vault, g = this.game;
    if (!v || v.opened) return null;
    const slot = actor.items.findIndex((it) => it?.type === 'keycard');
    if (slot < 0) return 'You need the Vault Keycard (the Foreman at Rusty Works has it)';
    actor.items[slot] = null;
    if (actor.slot === slot) actor.switchSlot(0);
    v.opened = true;
    v.openT = 0;
    if (actor.isPlayer) g.meta?.track('vault');
    g.world.colliders.remove(v.doorCol);
    g.sound.play('supply');
    g.hud.banner('VAULT OPENED!', 2.5);
    const inside = (dx, dz) => _v.set(v.x + dx, v.y + 0.8, v.z + dz);
    const drops = [
      { type: 'weapon', weapon: new Weapon('rocket', 5) },
      { type: 'weapon', weapon: new Weapon(Math.random() < 0.5 ? 'sniper' : 'pump', 4) },
      { type: 'ammo', ammoType: 'rockets', amount: 6 },
      { type: 'ammo', ammoType: 'heavy', amount: 12 },
      { type: 'consumable', ctype: 'bigshield', count: 3 },
      { type: 'consumable', ctype: 'medkit', count: 2 },
      { type: 'mat', matType: 'metal', amount: 200 },
    ];
    drops.push(Loot.ammoFor(drops[1].weapon));
    drops.forEach((d, i) => g.loot.spawnPickup(d, inside(-2 + (i % 4) * 1.3, -1.5 + Math.floor(i / 4) * 1.6)));
    return null;
  }

  update(dt) {
    const v = this.vault;
    if (v?.opened && v.openT < 1) {
      v.openT = Math.min(1, v.openT + dt * 0.8);
      v.door.position.y = v.y + 1.7 + v.openT * 3.3;
    }
  }

  reset() {
    this.npcs = [];
    this.boss = null;
    const v = this.vault;
    if (v && v.opened) {
      v.opened = false;
      v.door.position.y = v.y + 1.7;
      this.game.world.colliders.add(v.doorCol);
    }
  }
}
