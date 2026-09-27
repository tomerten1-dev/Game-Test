// Locker catalog. Everything is earned in play (reward track, quests, Storm Coins from matches).
// rarity: 0 common .. 4 legendary (same colours as weapon rarities).

export const SLOTS = [
  { key: 'hero', name: 'Hero' },
  { key: 'tint', name: 'Outfit Color' },
  { key: 'glider', name: 'Glider' },
  { key: 'trail', name: 'Contrail' },
  { key: 'emote', name: 'Emote' },
  { key: 'wrap', name: 'Weapon Wrap' },
];

export const PRICES = [200, 300, 600, 1000, 1500];

const items = [
  // heroes (KayKit adventurers)
  { id: 'hero_rogue_hooded', type: 'hero', name: 'Hooded Scout', rarity: 1, value: 'Rogue_Hooded', starter: true },
  { id: 'hero_knight', type: 'hero', name: 'Sir Bolt', rarity: 1, value: 'Knight', starter: true },
  { id: 'hero_rogue', type: 'hero', name: 'Quickstep', rarity: 2, value: 'Rogue' },
  { id: 'hero_barbarian', type: 'hero', name: 'Big Grumble', rarity: 3, value: 'Barbarian' },
  { id: 'hero_mage', type: 'hero', name: 'Storm Weaver', rarity: 4, value: 'Mage' },
  // outfit colours
  { id: 'tint_teal', type: 'tint', name: 'Original', rarity: 0, value: null, starter: true },
  { id: 'tint_lagoon', type: 'tint', name: 'Lagoon', rarity: 0, value: '#20d6c0', starter: true },
  { id: 'tint_crimson', type: 'tint', name: 'Crimson', rarity: 1, value: '#ff4d5e' },
  { id: 'tint_sun', type: 'tint', name: 'Sunflower', rarity: 1, value: '#ffc93c' },
  { id: 'tint_ocean', type: 'tint', name: 'Deep Ocean', rarity: 1, value: '#2f6bff', starter: true },
  { id: 'tint_mint', type: 'tint', name: 'Mint', rarity: 1, value: '#6ef0a8' },
  { id: 'tint_violet', type: 'tint', name: 'Violet', rarity: 2, value: '#a15cff' },
  { id: 'tint_rose', type: 'tint', name: 'Rose', rarity: 2, value: '#ff7ab8' },
  { id: 'tint_midnight', type: 'tint', name: 'Midnight', rarity: 3, value: '#31365a' },
  { id: 'tint_frost', type: 'tint', name: 'Frost', rarity: 3, value: '#bfeaff' },
  { id: 'tint_gold', type: 'tint', name: 'Solid Gold', rarity: 4, value: '#ffcc33' },
  // gliders
  { id: 'glider_teal', type: 'glider', name: 'Breeze', rarity: 0, value: ['#20d6c0', '#ffd23f'], starter: true },
  { id: 'glider_sunset', type: 'glider', name: 'Sunset Wing', rarity: 1, value: ['#ff8a4c', '#ffe066'] },
  { id: 'glider_candy', type: 'glider', name: 'Candy Kite', rarity: 2, value: ['#ff7ab8', '#9ff3ff'] },
  { id: 'glider_storm', type: 'glider', name: 'Stormrider', rarity: 3, value: ['#7b3cff', '#c7a6ff'] },
  { id: 'glider_gold', type: 'glider', name: 'Gold Rush', rarity: 4, value: ['#ffcc33', '#fff3b0'] },
  // contrails
  { id: 'trail_none', type: 'trail', name: 'None', rarity: 0, value: null, starter: true },
  { id: 'trail_spark', type: 'trail', name: 'Sparkles', rarity: 1, value: ['#ffffff', '#bfefff'] },
  { id: 'trail_fire', type: 'trail', name: 'Afterburner', rarity: 2, value: ['#ffb347', '#ff5a2a'] },
  { id: 'trail_storm', type: 'trail', name: 'Storm Surge', rarity: 3, value: ['#c77dff', '#5fd4ff'] },
  { id: 'trail_rainbow', type: 'trail', name: 'Rainbow Road', rarity: 4, value: 'rainbow' },
  // emotes (KayKit animation clips)
  { id: 'emote_cheer', type: 'emote', name: 'Cheer', rarity: 0, value: 'Cheer', starter: true },
  { id: 'emote_wave', type: 'emote', name: 'Hello There', rarity: 0, value: 'Interact', starter: true },
  { id: 'emote_kick', type: 'emote', name: 'Show-off Kick', rarity: 1, value: 'Unarmed_Melee_Attack_Kick' },
  { id: 'emote_sit', type: 'emote', name: 'Take a Seat', rarity: 1, value: 'Sit_Floor_Idle' },
  { id: 'emote_magic', type: 'emote', name: 'Sparkle Hands', rarity: 2, value: 'Spellcasting' },
  { id: 'emote_block', type: 'emote', name: 'Guarded', rarity: 2, value: 'Block' },
  { id: 'emote_nap', type: 'emote', name: 'Power Nap', rarity: 3, value: 'Lie_Idle' },
  { id: 'emote_spin', type: 'emote', name: 'Tornado', rarity: 4, value: '2H_Melee_Attack_Spinning' },
  // weapon wraps
  { id: 'wrap_none', type: 'wrap', name: 'Factory', rarity: 0, value: null, starter: true },
  { id: 'wrap_camo', type: 'wrap', name: 'Leafy Camo', rarity: 1, value: { color: '#6b8f4a', emissive: '#000000' } },
  { id: 'wrap_ice', type: 'wrap', name: 'Glacier', rarity: 2, value: { color: '#bfeaff', emissive: '#2a7fbf' } },
  { id: 'wrap_neon', type: 'wrap', name: 'Neon Pulse', rarity: 3, value: { color: '#ff4fd8', emissive: '#a0209a' } },
  { id: 'wrap_gold', type: 'wrap', name: 'Gilded', rarity: 4, value: { color: '#ffcc33', emissive: '#8a5a00' } },
];

export const COSMETICS = Object.fromEntries(items.map((i) => [i.id, { ...i, price: PRICES[i.rarity] }]));
export const COSMETIC_LIST = items.map((i) => COSMETICS[i.id]);
export const STARTERS = items.filter((i) => i.starter).map((i) => i.id);
export const DEFAULT_EQUIPPED = { hero: 'hero_rogue_hooded', tint: 'tint_teal', glider: 'glider_teal', trail: 'trail_none', emote: 'emote_cheer', wrap: 'wrap_none' };

export const cosmetic = (id) => COSMETICS[id];
