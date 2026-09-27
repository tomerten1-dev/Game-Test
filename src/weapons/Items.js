// Non-gun inventory items: the pickaxe, stackable consumables, ammo and building materials.

export const AMMO = {
  light: { name: 'Light Ammo', color: '#8fd3ff', box: 18, icon: 'L' },
  medium: { name: 'Medium Ammo', color: '#7be06a', box: 20, icon: 'M' },
  shells: { name: 'Shells', color: '#ff9f6b', box: 6, icon: 'S' },
  heavy: { name: 'Heavy Ammo', color: '#d9b3ff', box: 6, icon: 'H' },
  rockets: { name: 'Rockets', color: '#ff7a59', box: 3, icon: 'R' },
};

export const MATS = {
  wood: { name: 'Wood', color: '#d19a5b' },
  stone: { name: 'Stone', color: '#b9bec7' },
  metal: { name: 'Metal', color: '#8fb4d9' },
};
export const MAT_CAP = 999;

export const CONSUMABLES = {
  bandage: { name: 'Bandages', heal: 15, cap: 75, time: 3.2, max: 15, stack: 5, icon: '✚', color: '#f2efe6' },
  medkit: { name: 'Medkit', heal: 100, cap: 100, time: 6, max: 3, stack: 1, icon: '✚', color: '#ff5a5f' },
  smallshield: { name: 'Small Shield', shield: 25, cap: 50, time: 2, max: 6, stack: 3, icon: '◆', color: '#6fd0ff' },
  bigshield: { name: 'Shield Potion', shield: 50, cap: 100, time: 4.5, max: 3, stack: 1, icon: '⛊', color: '#3d8dff' },
  medmist: { name: 'Med-Mist', heal: 30, cap: 100, time: 1.4, max: 3, stack: 1, mobile: true, icon: 'MST', color: '#7dffb2', desc: '+30 health · use it on the move' },
  slurp: { name: 'Slurp Juice', heal: 75, shield: 75, cap: 100, time: 2, max: 2, stack: 1, overTime: 3, icon: 'SLP', color: '#b86bff', desc: '+75 health, then shield, over time' },
  chug: { name: 'Chug Jug', heal: 100, shield: 100, cap: 100, time: 15, max: 1, stack: 1, icon: 'CHG', color: '#39d0ff', desc: 'Full health and shield · 15 s to drink' },
  keg: { name: 'Shield Keg', place: 'keg', max: 1, stack: 1, icon: 'KEG', color: '#3d8dff', desc: 'Place it: shields everyone nearby up to 100' },
  campfire: { name: 'Campfire', place: 'campfire', max: 2, stack: 1, icon: 'CMP', color: '#ffa04a', desc: 'Place it: heals everyone nearby over time' },
  // thrown / placed items share the consumable stack logic
  grenade: { name: 'Grenade', throw: 'grenade', max: 6, stack: 3, icon: '●', color: '#8fd16a', damage: 70, radius: 5, fuse: 2.2 },
  smoke: { name: 'Smoke Grenade', throw: 'smoke', max: 4, stack: 2, icon: '☁', color: '#c9d3dc', radius: 6.5, fuse: 1.4, duration: 12 },
  impulse: { name: 'Impulse Grenade', throw: 'impulse', max: 4, stack: 2, icon: '✺', color: '#6fd0ff', radius: 6, fuse: 1.1, push: 17 },
  fire: { name: 'Fire Flask', throw: 'fire', max: 4, stack: 2, icon: '♨', color: '#ff8a2a', radius: 3.6, fuse: 1.2, duration: 6, dps: 14 },
  shockwave: { name: 'Shockwave Grenade', throw: 'shockwave', max: 6, stack: 2, icon: 'SHK', color: '#8f7bff', radius: 5.5, fuse: 3, push: 30, impact: true, desc: 'Launches everyone nearby (you too) · no fall damage' },
  grappler: { name: 'Grappler', grapple: true, max: 10, stack: 10, icon: 'GRP', color: '#ffd23f', desc: 'Pull yourself to where you aim · 10 charges' },
  rift: { name: 'Rift-to-Go', rift: true, time: 0.6, max: 1, stack: 1, icon: 'RFT', color: '#c86bff', desc: 'Warp high into the sky and glide' },
  launchpad: { name: 'Launch Pad', place: 'launchpad', max: 1, stack: 1, icon: '⇑', color: '#ffcf3f', desc: 'Place it: launch into the air and glide' },
  keycard: { name: 'Vault Keycard', key: true, max: 1, stack: 1, icon: '⌘', color: '#ffe94d' },
};
export const CONSUMABLE_TYPES = Object.keys(CONSUMABLES);
export const HEAL_TYPES = CONSUMABLE_TYPES.filter((k) => CONSUMABLES[k].heal || CONSUMABLES[k].shield);

export class Pickaxe {
  constructor() {
    this.isPickaxe = true;
    this.type = 'pickaxe';
    this.name = 'Harvesting Axe';
    this.cooldown = 0;
  }
  update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); return null; }
  cancelReload() {}
}

export class Consumable {
  constructor(type, count = 1) {
    this.isConsumable = true;
    this.type = type;
    this.count = count;
  }
  get def() { return CONSUMABLES[this.type]; }
  get name() { return this.def.name; }
  update() { return null; }
  cancelReload() {}

  // Can this actor benefit right now?
  usableBy(a) {
    const d = this.def;
    if (d.throw || d.place || d.key || d.grapple || d.rift) return true;
    if (d.heal && d.shield) return a.health < d.cap || a.shield < d.cap;
    if (d.heal) return a.health < d.cap;
    return a.shield < d.cap;
  }

  apply(a) {
    const d = this.def;
    // Slurp: a pool that tops up health first, then shield
    if (d.overTime) { a.regen = { left: d.heal, rate: d.overTime, acc: 0 }; return; }
    if (d.rift) { a.riftUp(); return; }
    if (d.heal) a.health = Math.max(a.health, Math.min(d.cap, a.health + d.heal));
    if (d.shield) a.shield = Math.max(a.shield, Math.min(d.cap, a.shield + d.shield));
  }
}
