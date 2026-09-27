// Weapon + rarity tables. Most guns are hitscan; the sniper and rocket launcher fire projectiles.

export const RARITIES = [
  { key: 'common', name: 'Common', color: '#b9bec7', mult: 1.0 },
  { key: 'uncommon', name: 'Uncommon', color: '#5bd43b', mult: 1.08 },
  { key: 'rare', name: 'Rare', color: '#3d8dff', mult: 1.16 },
  { key: 'epic', name: 'Epic', color: '#b64cff', mult: 1.25 },
  { key: 'legendary', name: 'Legendary', color: '#ffb52b', mult: 1.34 },
  { key: 'mythic', name: 'Mythic', color: '#ffe94d', mult: 1.5 }, // boss & vault only
];

export const WEAPONS = {
  pistol: {
    key: 'pistol', name: 'Pistol', icon: 'PST', ammoType: 'light',
    draw: 0.2, headMult: 2,
    damage: 23, pellets: 1, rate: 5.5, mag: 16, reload: 1.3,
    spread: 0.012, bloom: 0.02, maxSpread: 0.075, recover: 0.22,
    range: 150, falloffStart: 35, recoil: 0.02, idealRange: 16, shake: 0.12,
  },
  ar: {
    key: 'ar', name: 'Assault Rifle', icon: 'AR', ammoType: 'medium',
    draw: 0.3, headMult: 1.5,
    damage: 30, pellets: 1, rate: 5.5, mag: 30, reload: 2.2,
    spread: 0.007, bloom: 0.011, maxSpread: 0.055, recover: 0.18,
    range: 230, falloffStart: 60, recoil: 0.014, idealRange: 34, shake: 0.14, drop: 380,
  },
  shotgun: {
    key: 'shotgun', name: 'Tactical Shotgun', icon: 'TAC', ammoType: 'shells',
    draw: 0.45, shellReload: 0.42, headMult: 2,
    damage: 8.5, pellets: 10, rate: 1.45, mag: 8, reload: 4.2,
    spread: 0.075, bloom: 0, maxSpread: 0.075, recover: 1,
    range: 50, falloffStart: 9, recoil: 0.07, idealRange: 7, shake: 0.4,
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
    range: 45, falloffStart: 8, recoil: 0.09, idealRange: 6, shake: 0.5,
  },
  burst: {
    key: 'burst', name: 'Burst Rifle', icon: 'BRS', ammoType: 'medium',
    draw: 0.35, headMult: 1.5,
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
};

// Weighted loot tables: sniper and rocket are rare on the floor, likelier in rare chests / supply drops.
const WEAPON_WEIGHTS = {
  floor: { ar: 24, burst: 8, shotgun: 13, pump: 12, smg: 22, pistol: 18, sniper: 3, rocket: 0 },
  chest: { ar: 22, burst: 10, shotgun: 13, pump: 14, smg: 18, pistol: 8, sniper: 9, rocket: 5 },
  rare: { ar: 16, burst: 10, shotgun: 8, pump: 16, smg: 10, pistol: 0, sniper: 20, rocket: 20 },
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
