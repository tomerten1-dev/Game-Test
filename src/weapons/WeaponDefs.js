// Weapon + rarity tables. All guns are hitscan.

export const RARITIES = [
  { key: 'common', name: 'Common', color: '#b9bec7', mult: 1.0 },
  { key: 'uncommon', name: 'Uncommon', color: '#5bd43b', mult: 1.08 },
  { key: 'rare', name: 'Rare', color: '#3d8dff', mult: 1.16 },
  { key: 'epic', name: 'Epic', color: '#b64cff', mult: 1.25 },
  { key: 'legendary', name: 'Legendary', color: '#ffb52b', mult: 1.34 },
];

export const WEAPONS = {
  pistol: {
    key: 'pistol', name: 'Pistol', icon: 'PST', ammoType: 'light',
    damage: 23, pellets: 1, rate: 5.5, mag: 16, reload: 1.3,
    spread: 0.012, bloom: 0.02, maxSpread: 0.075, recover: 0.22,
    range: 150, falloffStart: 35, recoil: 0.02, idealRange: 16, shake: 0.12,
  },
  ar: {
    key: 'ar', name: 'Assault Rifle', icon: 'AR', ammoType: 'medium',
    damage: 30, pellets: 1, rate: 5.5, mag: 30, reload: 2.2,
    spread: 0.007, bloom: 0.011, maxSpread: 0.055, recover: 0.18,
    range: 230, falloffStart: 60, recoil: 0.014, idealRange: 34, shake: 0.14,
  },
  shotgun: {
    key: 'shotgun', name: 'Shotgun', icon: 'SG', ammoType: 'shells',
    damage: 11, pellets: 10, rate: 1.05, mag: 5, reload: 3.4,
    spread: 0.075, bloom: 0, maxSpread: 0.075, recover: 1,
    range: 50, falloffStart: 9, recoil: 0.07, idealRange: 7, shake: 0.4,
  },
  smg: {
    key: 'smg', name: 'SMG', icon: 'SMG', ammoType: 'light',
    damage: 16, pellets: 1, rate: 12, mag: 30, reload: 2.0,
    spread: 0.02, bloom: 0.007, maxSpread: 0.08, recover: 0.25,
    range: 110, falloffStart: 22, recoil: 0.008, idealRange: 13, shake: 0.08,
  },
};

export const LOOT_WEAPONS = ['ar', 'shotgun', 'smg', 'pistol'];

// Weighted rarity roll; `luck` shifts toward rarer drops (chests > floor loot).
export function rollRarity(rand = Math.random, luck = 0) {
  const w = [40 - luck * 20, 30, 18 + luck * 6, 9 + luck * 8, 3 + luck * 6];
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < w.length; i++) {
    if ((r -= w[i]) <= 0) return i;
  }
  return 0;
}
