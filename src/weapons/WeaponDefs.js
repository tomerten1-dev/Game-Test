// Weapon + rarity tables. Most guns are hitscan; the sniper and rocket launcher fire projectiles.

export const RARITIES = [
  { key: 'common', name: 'Common', color: '#b9bec7', mult: 1.0 },
  { key: 'uncommon', name: 'Uncommon', color: '#5bd43b', mult: 1.08 },
  { key: 'rare', name: 'Rare', color: '#3d8dff', mult: 1.16 },
  { key: 'epic', name: 'Epic', color: '#b64cff', mult: 1.25 },
  { key: 'legendary', name: 'Legendary', color: '#f5890e', mult: 1.34 },
  { key: 'mythic', name: 'Mythic', color: '#ffe94d', mult: 1.5 }, // boss & vault only
  { key: 'exotic', name: 'Exotic', color: '#4ff4ff', mult: 1.0 }, // bought from dealers; stats are in the gun itself
];
export const EXOTIC = 6;

// Mod bench attachments (Fortnite: four slots, 75 bars to add or swap one).
export const MOD_COST = 75;
export const MODS = {
  optic: [['reddot', 'Red Dot', 'Light 1.15x zoom'], ['holo', 'Holo', '1.3x zoom'], ['x2', '2x Scope', '2x zoom'], ['x4', '4x Scope', '4x zoom']],
  mag: [['drum', 'Drum Mag', '+50% magazine'], ['speed', 'Speed Mag', '30% faster reloads']],
  under: [['angled', 'Angled Grip', 'Faster aim and draw'], ['vertical', 'Vertical Grip', 'Less spread and recoil when aiming'], ['laser', 'Laser', 'Tighter hip fire']],
  barrel: [['brake', 'Muzzle Brake', '40% less recoil'], ['suppressor', 'Suppressor', 'Quieter shots, hidden from sound markers']],
};
export const MOD_SLOTS = [['optic', 'Optic'], ['mag', 'Magazine'], ['under', 'Underbarrel'], ['barrel', 'Barrel']];
export const OPTIC_ZOOM = { reddot: 1.15, holo: 1.3, x2: 2, x4: 4 };

export const WEAPONS = {
  pistol: {
    key: 'pistol', name: 'Pistol', icon: 'PST', ammoType: 'light',
    draw: 0.2, headMult: 2, firstShot: true,
    damage: 23, pellets: 1, rate: 5.5, mag: 16, reload: 1.3,
    spread: 0.012, bloom: 0.02, maxSpread: 0.075, recover: 0.22,
    range: 150, falloffStart: 35, recoil: 0.02, idealRange: 16, shake: 0.12,
  },
  ar: {
    key: 'ar', name: 'Assault Rifle', icon: 'AR', ammoType: 'medium',
    draw: 0.3, headMult: 2, firstShot: true,
    damage: 30, pellets: 1, rate: 5.5, mag: 30, reload: 2.2,
    spread: 0.007, bloom: 0.011, maxSpread: 0.055, recover: 0.18,
    range: 230, falloffStart: 60, recoil: 0.014, idealRange: 34, shake: 0.14, drop: 380,
  },
  shotgun: {
    key: 'shotgun', name: 'Tactical Shotgun', icon: 'TAC', ammoType: 'shells',
    draw: 0.45, shellReload: 0.42, headMult: 2,
    damage: 8.5, pellets: 10, rate: 1.45, mag: 8, reload: 4.2,
    spread: 0.075, bloom: 0, maxSpread: 0.075, recover: 1,
    range: 34, falloffStart: 7, cap: 150, recoil: 0.07, idealRange: 7, shake: 0.4,
  },
  smg: {
    key: 'smg', name: 'SMG', icon: 'SMG', ammoType: 'light',
    draw: 0.25, headMult: 1.75,
    damage: 16, pellets: 1, rate: 12, mag: 30, reload: 2.0,
    spread: 0.02, bloom: 0.007, maxSpread: 0.08, recover: 0.25,
    range: 110, falloffStart: 22, recoil: 0.008, idealRange: 13, shake: 0.08,
  },
  pump: {
    key: 'pump', name: 'Pump Shotgun', icon: 'PMP', ammoType: 'shells',
    draw: 0.45, shellReload: 0.55,
    damage: 11.5, pellets: 10, rate: 0.8, mag: 5, reload: 4.6, headMult: 2,
    spread: 0.058, bloom: 0, maxSpread: 0.058, recover: 1,
    range: 31, falloffStart: 7, cap: 165, recoil: 0.09, idealRange: 6, shake: 0.5,
  },
  burst: {
    key: 'burst', name: 'Burst Rifle', icon: 'BRS', ammoType: 'medium',
    draw: 0.35, headMult: 1.5, firstShot: true,
    damage: 27, pellets: 1, rate: 2.4, mag: 30, reload: 2.4, burst: 3, burstGap: 0.075,
    spread: 0.005, bloom: 0.006, maxSpread: 0.04, recover: 0.2,
    range: 230, falloffStart: 70, recoil: 0.011, idealRange: 38, shake: 0.12, drop: 420,
  },
  sniper: {
    key: 'sniper', name: 'Sniper Rifle', icon: 'SNP', ammoType: 'heavy',
    draw: 0.5,
    damage: 100, pellets: 1, rate: 0.4, mag: 1, reload: 2.4,
    spread: 0.035, bloom: 0, maxSpread: 0.035, recover: 1, scopedSpread: 0,
    range: 420, falloffStart: 400, recoil: 0.09, idealRange: 70, shake: 0.35, headMult: 2.5,
    projectile: { speed: 600, gravity: 6, pad: 0.16 }, scope: true, // fast, flat, a little forgiving
  },
  rocket: {
    key: 'rocket', name: 'Rocket Launcher', icon: 'RKT', ammoType: 'rockets',
    draw: 0.6, headMult: 1,
    damage: 85, pellets: 1, rate: 0.75, mag: 1, reload: 2.8,
    spread: 0.004, bloom: 0, maxSpread: 0.004, recover: 1,
    range: 300, falloffStart: 300, recoil: 0.08, idealRange: 30, shake: 0.4,
    projectile: { speed: 55, gravity: 0, explode: { radius: 5.5, structure: 450 } },
  },
  // ---- newer weapon types ----
  drum: {
    key: 'drum', name: 'Drum Gun', icon: 'DRM', ammoType: 'light', mods: true,
    draw: 0.35, headMult: 1.5,
    damage: 19, pellets: 1, rate: 9, mag: 50, reload: 3.2,
    spread: 0.022, bloom: 0.006, maxSpread: 0.075, recover: 0.22,
    range: 120, falloffStart: 25, recoil: 0.01, idealRange: 16, shake: 0.1,
  },
  minigun: {
    key: 'minigun', name: 'Minigun', icon: 'MNG', ammoType: 'medium', heavy: true,
    draw: 0.7, headMult: 1.5, spinUp: 0.6,
    damage: 15, pellets: 1, rate: 12, mag: 100, reload: 4.5,
    spread: 0.028, bloom: 0.003, maxSpread: 0.06, recover: 0.2,
    range: 130, falloffStart: 30, recoil: 0.006, idealRange: 18, shake: 0.08,
  },
  dmr: {
    key: 'dmr', name: 'DMR', icon: 'DMR', ammoType: 'medium', mods: true, firstShot: true, zoom: 1.6,
    draw: 0.4, headMult: 1.75,
    damage: 38, pellets: 1, rate: 3, mag: 10, reload: 2.4,
    spread: 0.005, bloom: 0.012, maxSpread: 0.04, recover: 0.25,
    range: 280, falloffStart: 90, recoil: 0.022, idealRange: 45, shake: 0.16, drop: 420,
  },
  handcannon: {
    key: 'handcannon', name: 'Hand Cannon', icon: 'HCN', ammoType: 'heavy', firstShot: true,
    draw: 0.3, headMult: 2,
    damage: 60, pellets: 1, rate: 1.2, mag: 7, reload: 2.1,
    spread: 0.01, bloom: 0.04, maxSpread: 0.07, recover: 0.2,
    range: 160, falloffStart: 35, recoil: 0.06, idealRange: 20, shake: 0.35,
  },
  dualpistol: {
    key: 'dualpistol', name: 'Dual Pistols', icon: 'DPS', ammoType: 'light', dual: true,
    draw: 0.3, headMult: 1.75,
    damage: 21, pellets: 1, rate: 8, mag: 24, reload: 2.4,
    spread: 0.02, bloom: 0.012, maxSpread: 0.08, recover: 0.22,
    range: 110, falloffStart: 22, recoil: 0.012, idealRange: 12, shake: 0.12,
  },
  flare: {
    key: 'flare', name: 'Flare Gun', icon: 'FLR', ammoType: 'heavy',
    draw: 0.4, headMult: 1,
    damage: 20, pellets: 1, rate: 0.9, mag: 6, reload: 2.2,
    spread: 0.004, bloom: 0, maxSpread: 0.004, recover: 1,
    range: 200, falloffStart: 200, recoil: 0.05, idealRange: 25, shake: 0.2,
    projectile: { speed: 70, gravity: 9, flare: true },
  },
  launcher: {
    key: 'launcher', name: 'Grenade Launcher', icon: 'GL', ammoType: 'rockets',
    draw: 0.55, headMult: 1,
    damage: 70, pellets: 1, rate: 1.3, mag: 6, reload: 3.6,
    spread: 0.006, bloom: 0, maxSpread: 0.006, recover: 1,
    range: 120, falloffStart: 120, recoil: 0.07, idealRange: 25, shake: 0.35,
    projectile: { speed: 42, gravity: 22, bounce: true, fuse: 1.6, explode: { radius: 4.5, structure: 220 } },
  },
  bow: {
    key: 'bow', name: 'Charge Bow', icon: 'BOW', ammoType: 'none', charge: 1.0,
    draw: 0.35, headMult: 2,
    damage: 100, pellets: 1, rate: 1.4, mag: 1, reload: 0.45,
    spread: 0.003, bloom: 0, maxSpread: 0.003, recover: 1,
    range: 300, falloffStart: 300, recoil: 0.03, idealRange: 35, shake: 0.12,
    projectile: { speed: 110, gravity: 11, pad: 0.1, arrow: true },
  },
  blade: {
    key: 'blade', name: 'Kinetic Blade', icon: 'BLD', ammoType: 'none', melee: true,
    draw: 0.3, headMult: 1,
    damage: 50, pellets: 1, rate: 1.7, mag: 1, reload: 0,
    spread: 0, bloom: 0, maxSpread: 0, recover: 1,
    range: 3.2, falloffStart: 3.2, recoil: 0, idealRange: 2.5, shake: 0.2, dash: 9,
  },
  // ---- exotics (only from dealers, fixed stats, no mods) ----
  tracker: {
    key: 'tracker', name: 'Shadow Tracker', icon: 'SHT', ammoType: 'light', exotic: 'mark', price: 400, firstShot: true,
    draw: 0.2, headMult: 2, desc: 'Hits reveal the target for 8 s',
    damage: 30, pellets: 1, rate: 5, mag: 16, reload: 1.3,
    spread: 0.01, bloom: 0.018, maxSpread: 0.07, recover: 0.22,
    range: 150, falloffStart: 40, recoil: 0.02, idealRange: 18, shake: 0.12,
  },
  sixshooter: {
    key: 'sixshooter', name: 'Marksman Six Shooter', icon: 'SIX', ammoType: 'medium', exotic: 'sixshooter', price: 400, firstShot: true,
    draw: 0.25, headMult: 2, desc: 'Hip fire fans fast; aim for slow, heavy, perfect shots',
    damage: 32, pellets: 1, rate: 6, mag: 6, reload: 2.3,
    spread: 0.03, bloom: 0.02, maxSpread: 0.08, recover: 0.25,
    range: 170, falloffStart: 45, recoil: 0.04, idealRange: 20, shake: 0.2,
  },
  dub: {
    key: 'dub', name: 'The Dub', icon: 'DUB', ammoType: 'shells', exotic: 'dub', price: 600,
    draw: 0.45, shellReload: 0.9, headMult: 2, desc: 'Each blast launches you backwards',
    damage: 9.5, pellets: 12, rate: 1.1, mag: 2, reload: 2.2, cap: 170,
    spread: 0.09, bloom: 0, maxSpread: 0.09, recover: 1,
    range: 28, falloffStart: 7, recoil: 0.1, idealRange: 6, shake: 0.55, push: 13,
  },
  stormscout: {
    key: 'stormscout', name: 'Storm Scout Sniper', icon: 'SCT', ammoType: 'heavy', exotic: 'scout', price: 500,
    draw: 0.5, headMult: 2.5, desc: 'While held, shows where the next storm circle will be',
    damage: 85, pellets: 1, rate: 0.6, mag: 3, reload: 2.2,
    spread: 0.03, bloom: 0, maxSpread: 0.03, recover: 1, scopedSpread: 0,
    range: 400, falloffStart: 380, recoil: 0.07, idealRange: 60, shake: 0.3,
    projectile: { speed: 520, gravity: 7, pad: 0.16 }, scope: true,
  },
};
export const EXOTICS = ['tracker', 'sixshooter', 'dub', 'stormscout'];

// Weighted loot tables: sniper and rocket are rare on the floor, likelier in rare chests / supply drops.
const WEAPON_WEIGHTS = {
  floor: { ar: 24, burst: 8, shotgun: 13, pump: 12, smg: 22, pistol: 18, sniper: 3, rocket: 0, drum: 4, dmr: 4, handcannon: 3, dualpistol: 3, flare: 2, bow: 2, launcher: 0, minigun: 1, blade: 1 },
  chest: { ar: 22, burst: 10, shotgun: 13, pump: 14, smg: 18, pistol: 8, sniper: 9, rocket: 5, drum: 5, dmr: 6, handcannon: 4, dualpistol: 3, flare: 3, bow: 3, launcher: 3, minigun: 2, blade: 2 },
  rare: { ar: 16, burst: 10, shotgun: 8, pump: 16, smg: 10, pistol: 0, sniper: 20, rocket: 20, drum: 4, dmr: 8, handcannon: 4, dualpistol: 0, flare: 2, bow: 4, launcher: 8, minigun: 5, blade: 3 },
};
export function rollWeaponType(table = 'floor', rand = Math.random) {
  const w = WEAPON_WEIGHTS[table];
  let r = rand() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k;
  return 'ar';
}

// Weighted rarity roll; `luck` shifts toward rarer drops (chests > floor loot).
export function rollRarity(rand = Math.random, luck = 0) {
  const w = [Math.max(0, 40 - luck * 20), Math.max(4, 30 - Math.max(0, luck - 1.5) * 20), 18 + luck * 6, 9 + luck * 8, 3 + luck * 6];
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < w.length; i++) {
    if ((r -= w[i]) <= 0) return i;
  }
  return 0;
}
