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
  // thrown / placed items share the consumable stack logic
  grenade: { name: 'Grenade', throw: 'grenade', max: 6, stack: 3, icon: '●', color: '#8fd16a', damage: 70, radius: 5, fuse: 2.2 },
  smoke: { name: 'Smoke Grenade', throw: 'smoke', max: 4, stack: 2, icon: '☁', color: '#c9d3dc', radius: 6.5, fuse: 1.4, duration: 12 },
  impulse: { name: 'Impulse Grenade', throw: 'impulse', max: 4, stack: 2, icon: '✺', color: '#6fd0ff', radius: 6, fuse: 1.1, push: 17 },
  fire: { name: 'Fire Flask', throw: 'fire', max: 4, stack: 2, icon: '♨', color: '#ff8a2a', radius: 3.6, fuse: 1.2, duration: 6, dps: 14 },
  launchpad: { name: 'Launch Pad', place: 'launchpad', max: 1, stack: 1, icon: '⇑', color: '#ffcf3f' },
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
    if (d.throw || d.place || d.key) return true;
    if (d.heal) return a.health < d.cap;
    return a.shield < d.cap;
  }

  apply(a) {
    const d = this.def;
    if (d.heal) a.health = Math.max(a.health, Math.min(d.cap, a.health + d.heal));
    if (d.shield) a.shield = Math.max(a.shield, Math.min(d.cap, a.shield + d.shield));
  }
}
