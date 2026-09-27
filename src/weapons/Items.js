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

// Boss medallions: a perk while you carry one, but every carrier shows up on everyone's map.
export const MEDALLIONS = {
  shield: { name: "Foreman's Medallion", perk: 'Shield regenerates', color: '#6cc4ff', icon: '⛊' },
  surge: { name: "Tide's Medallion", perk: 'Endless tactical sprint', color: '#39e0c9', icon: '➤' },
  reload: { name: "Warden's Medallion", perk: 'Reload 60% faster', color: '#ff6b5d', icon: '↻' },
  bloom: { name: "Bloom's Medallion", perk: 'Health regenerates', color: '#7dff8a', icon: '✚' },
};

export const CONSUMABLES = {
  bandage: { name: 'Bandages', heal: 15, cap: 75, time: 4, max: 15, stack: 5, icon: '✚', color: '#f2efe6' },
  medkit: { name: 'Medkit', heal: 100, cap: 100, time: 10, max: 3, stack: 1, icon: '✚', color: '#ff5a5f' },
  smallshield: { name: 'Small Shield', shield: 25, cap: 50, time: 2, max: 6, stack: 3, icon: '◆', color: '#6fd0ff' },
  bigshield: { name: 'Shield Potion', shield: 50, cap: 100, time: 5, max: 3, stack: 1, icon: '⛊', color: '#3d8dff' },
  medmist: { name: 'Med-Mist', throw: 'medmist', max: 3, stack: 1, icon: 'MST', color: '#7dffb2', radius: 4.5, fuse: 1, duration: 8, desc: 'Throw it: a healing mist (+10 health a second) for 8 s' },
  slurp: { name: 'Slurp Juice', heal: 75, shield: 75, cap: 100, time: 2, max: 2, stack: 1, overTime: 2, both: true, icon: 'SLP', color: '#b86bff', desc: '+1 health and +1 shield every half second, up to 75 each' },
  chugsplash: { name: 'Chug Splash', throw: 'chugsplash', max: 6, stack: 2, icon: 'SPL', color: '#39d0ff', radius: 3.5, fuse: 3, impact: true, heal: 20, desc: 'Throw it: +20 health or shield to everyone splashed' },
  flowberry: { name: 'Flowberry Fizz', fizz: true, time: 2, max: 2, stack: 1, icon: 'FBF', color: '#ff6fd0', desc: 'Shake it: splashes +5 shield every 0.5 s around you and gives low gravity for 10 s' },
  spicytaco: { name: 'Spicy Taco', heal: 20, cap: 100, time: 1, max: 4, stack: 2, speed: 12, icon: 'TCO', color: '#ffb347', desc: '+20 health and a speed boost for 12 s' },
  // fish (from the fishing rod)
  smallfry: { name: 'Small Fry', heal: 25, cap: 75, time: 1, max: 4, stack: 1, icon: 'FRY', color: '#9fd8ff', desc: '+25 health (up to 75)' },
  flopper: { name: 'Flopper', heal: 40, cap: 100, time: 1, max: 4, stack: 1, icon: 'FLP', color: '#6fd0ff', desc: '+40 health' },
  shieldfish: { name: 'Shield Fish', shield: 50, cap: 100, time: 1, max: 4, stack: 1, icon: 'SFH', color: '#3d8dff', desc: '+50 shield' },
  slurpfish: { name: 'Slurpfish', heal: 40, cap: 100, effective: true, time: 1, max: 4, stack: 1, icon: 'SLF', color: '#b86bff', desc: '+40 health, the rest goes to shield' },
  spicyfish: { name: 'Spicy Fish', heal: 15, cap: 100, time: 1, max: 4, stack: 1, speed: 10, icon: 'SPF', color: '#ff7a3a', desc: '+15 health and a speed boost' },
  goldfish: { name: 'Mythic Goldfish', throw: 'goldfish', max: 1, stack: 1, icon: 'GLD', color: '#ffe94d', impact: true, fuse: 3, damage: 250, desc: 'Throw it: 250 damage on a direct hit · pick it back up' },
  rod: { name: 'Fishing Rod', rod: true, max: 1, stack: 1, icon: 'ROD', color: '#c9a36a', desc: 'Cast into water, reel in when the bobber dips · bubbling spots catch better loot' },
  // gadgets
  bubble: { name: 'Shield Bubble', throw: 'bubble', max: 2, stack: 1, icon: 'BUB', color: '#7fd8ff', radius: 5.5, fuse: 1.4, duration: 30, desc: 'Throw it: a dome that stops all bullets in and out for 30 s' },
  portafort: { name: 'Port-a-Fort', throw: 'portafort', max: 2, stack: 1, icon: 'PAF', color: '#9aa7b8', fuse: 1.3, desc: 'Throw it: instantly builds a metal tower with a bounce tire inside' },
  stormflip: { name: 'Storm Flip', throw: 'stormflip', max: 2, stack: 1, icon: 'FLP', color: '#c05cff', radius: 8, fuse: 1.3, duration: 20, desc: 'In the storm: a safe bubble · outside: a small storm that hurts' },
  sos: { name: 'SOS Flare', sos: true, time: 1, max: 1, stack: 1, icon: 'SOS', color: '#ff4a3a', desc: 'Fire it into the sky: a supply drop comes down on you' },
  scanner: { name: 'Storm Scanner', scan: true, time: 1, max: 1, stack: 1, icon: 'SCN', color: '#c86bff', desc: 'Shows where the circle after next will be, for this phase' },
  oneup: { name: '1-Up Token', oneup: true, max: 1, stack: 1, icon: '1UP', color: '#7dff8a', desc: 'Carry it: when eliminated you redeploy with all your gear (once)' },
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
  gascan: { name: 'Gas Can', throw: 'gascan', max: 3, stack: 1, icon: 'GAS', color: '#e0392b', radius: 5.5, fuse: 1.2, desc: 'Toss it down, then shoot it: a big blast that sets the area on fire' },
  trap: { name: 'Spike Trap', trap: true, max: 3, stack: 1, icon: 'TRP', color: '#ffc629', desc: 'Place it on a floor: spikes hit anyone who walks over it for 75 (once)' },
  bouncer: { name: 'Bouncer', place: 'bouncer', max: 2, stack: 1, icon: 'BNC', color: '#5fe4ff', desc: 'Place it: bounce high · no fall damage when you land on it' },
  crashpad: { name: 'Crash Pad', throw: 'crashpad', max: 4, stack: 2, icon: 'CRP', color: '#ff7ab8', impact: true, fuse: 3, radius: 1, desc: 'Throw it: it inflates into a pad that bounces you and cancels fall damage' },
  wingsuit: { name: 'Wingsuit', wingsuit: true, max: 10, stack: 10, icon: 'WNG', color: '#6ff0c0', desc: 'Launch up and fly: dive to build speed, pull up to climb · 10 launches, 20 s cooldown' },
  sliders: { name: 'Seven Sliders', sliders: true, max: 1, stack: 1, icon: 'SLD', color: '#ff5a3d', desc: 'Slide while sprinting to jet-slide (even on water) · overheats after ~5 s, water cools it' },
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
    if (d.throw || d.place || d.key || d.grapple || d.rift || d.trap || d.fizz || d.sos || d.scan) return true;
    if (d.speed && d.heal) return true; // foods with a boost are fine at full health
    if (d.heal && d.shield) return a.health < d.cap || a.shield < d.cap;
    if (d.heal) return a.health < d.cap;
    return a.shield < d.cap;
  }

  apply(a) {
    const d = this.def;
    // Slurp: a pool that tops up health first, then shield
    if (d.overTime) { a.regen = { left: d.heal, rate: d.overTime, acc: 0, both: !!d.both }; return; }
    if (d.rift) { a.riftUp(); return; }
    if (d.fizz) { a.game?.gadgets?.fizz(a); return; }
    if (d.sos) { a.game?.gadgets?.sos(a); return; }
    if (d.scan) { a.scanPhase = a.game?.storm.phase; if (a.isPlayer) a.game?.hud?.banner?.('Storm scanned · the circle after next is on your map', 3); return; }
    if (d.speed) a.speedT = Math.max(a.speedT || 0, d.speed);
    if (d.effective) {
      const h = Math.min(d.heal, d.cap - a.health);
      a.health = Math.min(d.cap, a.health + d.heal);
      a.shield = Math.min(100, a.shield + (d.heal - Math.max(0, h)));
      return;
    }
    if (d.heal) a.health = Math.max(a.health, Math.min(d.cap, a.health + d.heal));
    if (d.shield) a.shield = Math.max(a.shield, Math.min(d.cap, a.shield + d.shield));
  }
}
