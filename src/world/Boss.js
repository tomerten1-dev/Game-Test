import * as THREE from 'three';
import { Bot } from '../bots/Bot.js';
import { Weapon } from '../weapons/Weapon.js';
import { Loot } from './Loot.js';
import { TOWNS } from './Terrain.js';
import { MEDALLIONS } from '../weapons/Items.js';

const _v = new THREE.Vector3();

// Bosses: NPCs guarding a town with a couple of guards. Each carries a named mythic weapon and a
// medallion (a perk for whoever carries it, but carriers show up on everyone's map). The Foreman
// at Rusty Works also drops the Vault Keycard. NPCs never count as players.
export const BOSSES = [
  { medal: 'shield', name: 'The Foreman', town: 'Rusty Works', color: '#ff8a2a', char: 'Barbarian', mythic: ['burst', "The Foreman's Burst Rifle"], side: ['pump', 4], guards: ['pump', 'ar', 'ar'], keycard: true },
  { medal: 'surge', name: 'Captain Tide', town: 'Salty Pier', color: '#39e0c9', char: 'Rogue', mythic: ['pump', "Captain Tide's Pump"], side: ['smg', 4], guards: ['smg', 'ar'] },
  { medal: 'reload', name: 'The Warden', town: 'Pebble City', color: '#ff6b5d', char: 'Knight', mythic: ['sniper', "The Warden's Sniper"], side: ['ar', 4], guards: ['ar', 'shotgun'] },
  { medal: 'bloom', name: 'Lady Bloom', town: 'Maple Hollow', color: '#7dff8a', char: 'Mage', mythic: ['smg', "Lady Bloom's SMG"], side: ['shotgun', 4], guards: ['shotgun', 'ar'] },
];

export class BossEvent {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.boss = null;
  }

  get vault() { return this.game.world.towns.vault; }

  spawn() {
    const g = this.game, v = this.vault;
    this.bosses = [];
    this.npcs = [];
    for (const cfg of BOSSES) {
      const t = TOWNS.find((x) => x.name === cfg.town);
      if (!t) continue;
      if (cfg.keycard && !v) continue;
      const home = cfg.keycard ? { x: v.front.x - 6, z: v.front.z + 4, r: 32 } : { x: t.x + 5, z: t.z + 3, r: t.r };
      const boss = new Bot(g, cfg.name, cfg.color, 0.95, cfg.char);
      boss.npc = 'boss';
      boss.bossCfg = cfg;
      boss.health = 400; boss.maxHealth = 400; boss.shield = 200;
      boss.character.root.scale.setScalar(1.3);
      const my = new Weapon(cfg.mythic[0], 5);
      my.title = cfg.mythic[1];
      boss.items[1] = my;
      boss.items[2] = new Weapon(cfg.side[0], cfg.side[1]);
      boss.medallions.add(cfg.medal);
      boss.gold = 300;
      this._place(boss, home, 0);
      boss.leash = home;
      this.bosses.push(boss);
      if (cfg.keycard) this.boss = boss;
      this.npcs.push(boss);
      cfg.guards.forEach((wt, i) => {
        const gd = new Bot(g, `${cfg.town.split(' ')[0]} Guard ${i + 1}`, '#8a96a3', 0.55, i % 2 ? 'Male_Ranger' : 'Male_Peasant');
        gd.npc = 'guard';
        gd.health = 150; gd.maxHealth = 150;
        gd.items[1] = new Weapon(wt, 2);
        gd.leash = home;
        this._place(gd, home, (i + 1) * 2.1);
        this.npcs.push(gd);
      });
    }
    for (const n of this.npcs) { n.switchSlot(1); g.actors.push(n); g.bots.push(n); }
  }

  _place(a, home, ang) {
    const x = home.x + Math.cos(ang) * (ang ? 7 : 0), z = home.z + Math.sin(ang) * (ang ? 7 : 0);
    a.spawnGround(x, z);
    a.landTime = -999;
  }

  // Boss drops (on top of their inventory: mythic, medallion, gold): shields, and the keycard.
  onDeath(a) {
    const loot = this.game.loot;
    if (a.npc !== 'boss') return;
    const at = _v.copy(a.pos).setY(a.pos.y + 1);
    const cfg = a.bossCfg || BOSSES[0];
    if (cfg.keycard) loot.spawnPickup({ type: 'consumable', ctype: 'keycard', count: 1 }, at, new THREE.Vector3(0, 5, 0));
    loot.spawnPickup({ type: 'consumable', ctype: 'bigshield', count: 2 }, at, new THREE.Vector3(2, 4, 1));
    const who = a.killer?.isPlayer ? 'You took down' : `${a.killer?.name || 'Someone'} took down`;
    this.game.hud.banner(`${who} ${cfg.name}! ${MEDALLIONS[cfg.medal].name} dropped${cfg.keycard ? ' · and the Vault Keycard' : ''}`, 3.5);
  }

  // Vault door: needs a keycard in the inventory.
  nearestInteractable(actor, reach = 3) {
    const v = this.vault;
    if (!v || v.opened) return null;
    if (Math.hypot(actor.pos.x - v.front.x, actor.pos.z - v.front.z) > reach) return null;
    const has = actor.keycard || actor.items.some((it) => it?.type === 'keycard');
    return { kind: 'vault', text: has ? 'Open Vault' : "Vault (needs the Foreman's keycard)", rarity: 5 };
  }

  openVault(actor) {
    const v = this.vault, g = this.game;
    if (!v || v.opened) return null;
    const slot = actor.items.findIndex((it) => it?.type === 'keycard');
    if (!actor.keycard && slot < 0) return 'You need the Vault Keycard (the Foreman at Rusty Works has it)';
    if (actor.keycard) actor.keycard = false;
    else { actor.items[slot] = null; if (actor.slot === slot) actor.switchSlot(0); }
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
    this.bosses = [];
    this.boss = null;
    const v = this.vault;
    if (v && v.opened) {
      v.opened = false;
      v.door.position.y = v.y + 1.7;
      this.game.world.colliders.add(v.doorCol);
    }
  }
}
