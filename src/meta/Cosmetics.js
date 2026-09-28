// Locker catalog. Everything is earned in play (reward track, quests, Storm Coins from matches).
// rarity: 0 common .. 4 legendary (same colours as weapon rarities).

export const SLOTS = [
  { key: 'hero', name: 'Hero' },
  { key: 'tint', name: 'Outfit Color' },
  { key: 'backbling', name: 'Back Bling' },
  { key: 'pickaxe', name: 'Harvesting Tool' },
  { key: 'glider', name: 'Glider' },
  { key: 'trail', name: 'Contrail' },
  { key: 'emote', name: 'Emote' },
  { key: 'wrap', name: 'Weapon Wrap' },
  { key: 'sprite', name: 'Sprite' },
  { key: 'kicks', name: 'Kicks' },
  { key: 'sidekick', name: 'Sidekick' },
  { key: 'spray', name: 'Spray' },
  { key: 'loading', name: 'Loading Screen' },
  { key: 'lobbymusic', name: 'Lobby Music' },
];

export const PRICES = [200, 300, 600, 1000, 1500];

const items = [
  // heroes: Quaternius outfit characters (the default look for you and the bots)
  // styles: alternate looks for an outfit (picked in the Locker)
  { id: 'hero_ranger_m', type: 'hero', name: 'Trail Ranger', rarity: 1, value: 'Male_Ranger', starter: true, styles: [['Classic', null], ['Night Watch', '#34406b'], ['Autumn', '#b8642f']] },
  { id: 'hero_ranger_f', type: 'hero', name: 'Forest Ranger', rarity: 1, value: 'Female_Ranger', starter: true, styles: [['Classic', null], ['Frost', '#9fd8ff'], ['Crimson', '#b8323f']] },
  { id: 'hero_peasant_m', type: 'hero', name: 'Village Hand', rarity: 1, value: 'Male_Peasant', starter: true, styles: [['Classic', null], ['Harvest', '#d9a13a'], ['Slate', '#5a6475']] },
  { id: 'hero_peasant_f', type: 'hero', name: 'Harvest Keeper', rarity: 1, value: 'Female_Peasant', starter: true, styles: [['Classic', null], ['Meadow', '#6fbf5a'], ['Plum', '#7a3f8f']] },
  // heroes (KayKit adventurers)
  { id: 'hero_rogue_hooded', type: 'hero', name: 'Hooded Scout', rarity: 1, value: 'Rogue_Hooded', tint: '#2f5d3a', starter: true },
  { id: 'hero_knight', type: 'hero', name: 'Sir Bolt', rarity: 1, value: 'Knight', tint: '#8f9bb0', starter: true },
  { id: 'hero_rogue', type: 'hero', name: 'Quickstep', rarity: 2, value: 'Rogue', tint: '#6b3fa0' },
  { id: 'hero_barbarian', type: 'hero', name: 'Big Grumble', rarity: 3, value: 'Barbarian', tint: '#8a5a2b' },
  { id: 'hero_mage', type: 'hero', name: 'Storm Weaver', rarity: 4, value: 'Mage', tint: '#3a5fd9' },
  // skins: a hero with its own colours and headgear
  { id: 'skin_party', type: 'hero', name: 'Party Pal', rarity: 1, value: 'Barbarian', tint: '#ff7ab8', hat: 'party' },
  { id: 'skin_dusty', type: 'hero', name: 'Dusty', rarity: 2, value: 'Rogue', tint: '#c9a06a', hat: 'cowboy' },
  { id: 'skin_frost', type: 'hero', name: 'Frostbite', rarity: 3, value: 'Knight', tint: '#bfeaff', hat: 'ice_horns' },
  { id: 'skin_pumpkin', type: 'hero', name: "Jack O'Knight", rarity: 3, value: 'Knight', tint: '#ff8a2a', hat: 'pumpkin' },
  { id: 'skin_pirate', type: 'hero', name: 'Captain Salt', rarity: 3, value: 'Barbarian', tint: '#2f6bff', hat: 'pirate' },
  { id: 'skin_ninja', type: 'hero', name: 'Shadow Step', rarity: 3, value: 'Rogue_Hooded', tint: '#2a2a3a', hat: 'ninja' },
  { id: 'skin_astro', type: 'hero', name: 'Star Voyager', rarity: 4, value: 'Rogue', tint: '#e9eef5', hat: 'astro' },
  { id: 'skin_saint', type: 'hero', name: 'Saint Spark', rarity: 4, value: 'Mage', tint: '#fff3b0', hat: 'halo' },
  // back blings
  { id: 'bb_antenna', type: 'backbling', name: 'Antenna Pack', rarity: 0, value: 'antenna', starter: true },
  { id: 'bb_none', type: 'backbling', name: 'None', rarity: 0, value: null, starter: true },
  { id: 'bb_quiver', type: 'backbling', name: 'Quiver', rarity: 1, value: 'quiver' },
  { id: 'bb_shield', type: 'backbling', name: 'Round Shield', rarity: 1, value: 'shield' },
  { id: 'bb_llama', type: 'backbling', name: 'Lil Llama', rarity: 2, value: 'llama' },
  { id: 'bb_guitar', type: 'backbling', name: 'Riff', rarity: 2, value: 'guitar' },
  { id: 'bb_cape', type: 'backbling', name: 'Royal Cape', rarity: 3, value: 'cape' },
  { id: 'bb_sword', type: 'backbling', name: 'Big Blade', rarity: 3, value: 'sword' },
  { id: 'bb_jetpack', type: 'backbling', name: 'Jet Set', rarity: 4, value: 'jetpack' },
  { id: 'bb_wings', type: 'backbling', name: 'Featherlight', rarity: 4, value: 'wings' },
  { id: 'bb_crystal', type: 'backbling', name: 'Void Shard', rarity: 4, value: 'crystal' },
  // harvesting tools
  { id: 'pick_default', type: 'pickaxe', name: 'Trusty Axe', rarity: 0, value: null, starter: true },
  { id: 'pick_pan', type: 'pickaxe', name: 'Frying Pan', rarity: 1, value: 'pan' },
  { id: 'pick_wrench', type: 'pickaxe', name: 'Big Wrench', rarity: 1, value: 'wrench' },
  { id: 'pick_candy', type: 'pickaxe', name: 'Candy Cane', rarity: 2, value: 'candy' },
  { id: 'pick_hammer', type: 'pickaxe', name: 'Sledge', rarity: 2, value: 'hammer' },
  { id: 'pick_crystal', type: 'pickaxe', name: 'Frost Cutter', rarity: 3, value: 'crystal' },
  { id: 'pick_neon', type: 'pickaxe', name: 'Neon Edge', rarity: 4, value: 'neon' },
  { id: 'pick_gold', type: 'pickaxe', name: 'Golden Axe', rarity: 4, value: 'gold' },
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
  { id: 'emote_moon', type: 'emote', name: 'Moonwalk', rarity: 2, value: 'Walking_Backwards' },
  { id: 'emote_chop', type: 'emote', name: 'Chop Chop', rarity: 1, value: '1H_Melee_Attack_Chop' },
  { id: 'emote_hop', type: 'emote', name: 'Hop Hop', rarity: 1, value: 'Jump_Full_Short' },
  { id: 'emote_dodge', type: 'emote', name: 'Dodge This', rarity: 2, value: 'Dodge_Left' },
  { id: 'emote_faint', type: 'emote', name: 'Dramatic Faint', rarity: 2, value: 'Death_B' },
  { id: 'emote_find', type: 'emote', name: 'Treasure Find', rarity: 1, value: 'PickUp' },
  { id: 'emote_power', type: 'emote', name: 'Power Up', rarity: 3, value: 'Spellcast_Raise', fx: 'sparkle' },
  { id: 'emote_confetti', type: 'emote', name: 'Confetti Toss', rarity: 3, value: 'Throw', fx: 'confetti' },
  { id: 'emote_summon', type: 'emote', name: 'Grand Summon', rarity: 4, value: 'Spellcast_Long', fx: 'sparkle' },
  // weapon wraps
  // sprites: companions with a power (they level up as you play)
  { id: 'sp_none', type: 'sprite', name: 'No Sprite', rarity: 0, value: null, starter: true },
  { id: 'sp_water', type: 'sprite', name: 'Water Sprite', rarity: 2, value: 'water', starter: true },
  { id: 'sp_earth', type: 'sprite', name: 'Earth Sprite', rarity: 2, value: 'earth', starter: true },
  { id: 'sp_fire', type: 'sprite', name: 'Fire Sprite', rarity: 2, value: 'fire', starter: true },
  // kicks (shoes over the outfit's boots)
  { id: 'kick_none', type: 'kicks', name: 'Outfit Default', rarity: 0, value: null, starter: true },
  { id: 'kick_white', type: 'kicks', name: 'Clean Whites', rarity: 1, value: { base: '#f4f6f8', sole: '#d8dde4', accent: '#3a86ff' }, starter: true },
  { id: 'kick_red', type: 'kicks', name: 'Hot Streaks', rarity: 2, value: { base: '#e63946', sole: '#f4f6f8', accent: '#1d1d1d' } },
  { id: 'kick_neon', type: 'kicks', name: 'Neon Runners', rarity: 3, value: { base: '#1b1f2a', sole: '#39ff88', accent: '#ff3df0' } },
  { id: 'kick_gold', type: 'kicks', name: 'Gold Rush', rarity: 4, value: { base: '#ffc93c', sole: '#fff3c4', accent: '#8a5a00' } },
  // sidekicks: a little companion that follows you around (no gameplay effect)
  { id: 'sk_none', type: 'sidekick', name: 'No Sidekick', rarity: 0, value: null, starter: true },
  { id: 'sk_pup', type: 'sidekick', name: 'Buddy the Pup', rarity: 1, value: 'pup', starter: true },
  { id: 'sk_kitty', type: 'sidekick', name: 'Whiskers', rarity: 2, value: 'kitty' },
  { id: 'sk_penguin', type: 'sidekick', name: 'Waddles', rarity: 3, value: 'penguin' },
  // sprays (from the emote wheel's second page)
  { id: 'spray_gg', type: 'spray', name: 'GG', rarity: 0, value: { text: 'GG', a: '#20d6c0', b: '#2f6bff' }, starter: true },
  { id: 'spray_bolt', type: 'spray', name: 'Storm Bolt', rarity: 1, value: { text: '⚡', a: '#ffd23f', b: '#ff7a3a' }, starter: true },
  { id: 'spray_llama', type: 'spray', name: 'Llama Love', rarity: 1, value: { text: 'LLAMA', a: '#c77dff', b: '#7ee8fa' } },
  { id: 'spray_crown', type: 'spray', name: 'Crowned', rarity: 3, value: { text: '♛', a: '#ffe066', b: '#b37400' } },
  // loading screens (shown as the match loads in)
  { id: 'load_default', type: 'loading', name: 'Stormbound', rarity: 0, value: { a: '#1d3f9c', b: '#20d6c0', title: 'STORMBOUND' }, starter: true },
  { id: 'load_sunset', type: 'loading', name: 'Sunset Drop', rarity: 1, value: { a: '#ff7a3a', b: '#6b2fb3', title: 'SUNSET DROP' } },
  { id: 'load_storm', type: 'loading', name: 'Eye of the Storm', rarity: 2, value: { a: '#2a0f4a', b: '#c05cff', title: 'EYE OF THE STORM' } },
  { id: 'load_victory', type: 'loading', name: 'Victory Lap', rarity: 3, value: { a: '#8a5a00', b: '#ffd23f', title: 'VICTORY LAP' } },
  // lobby music
  { id: 'lm_shuffle', type: 'lobbymusic', name: 'Shuffle', rarity: 0, value: null, starter: true },
  { id: 'lm_menu', type: 'lobbymusic', name: 'Main Theme', rarity: 0, value: 'menu', starter: true },
  { id: 'lm_title', type: 'lobbymusic', name: 'Sky High', rarity: 1, value: 'title' },
  { id: 'lm_alt', type: 'lobbymusic', name: 'Cloud Nine', rarity: 2, value: 'title_alt' },
  { id: 'lm_battle', type: 'lobbymusic', name: 'Battle Bus', rarity: 3, value: 'battle' },
  { id: 'wrap_none', type: 'wrap', name: 'Factory', rarity: 0, value: null, starter: true },
  { id: 'wrap_camo', type: 'wrap', name: 'Leafy Camo', rarity: 1, value: { color: '#6b8f4a', emissive: '#000000' } },
  { id: 'wrap_ice', type: 'wrap', name: 'Glacier', rarity: 2, value: { color: '#bfeaff', emissive: '#2a7fbf' } },
  { id: 'wrap_neon', type: 'wrap', name: 'Neon Pulse', rarity: 3, value: { color: '#ff4fd8', emissive: '#a0209a' } },
  { id: 'wrap_gold', type: 'wrap', name: 'Gilded', rarity: 4, value: { color: '#ffcc33', emissive: '#8a5a00' } },
];

export const COSMETICS = Object.fromEntries(items.map((i) => [i.id, { ...i, price: PRICES[i.rarity] }]));
export const COSMETIC_LIST = items.map((i) => COSMETICS[i.id]);

// Custom skins (your own models, saved in this browser) become hero items at start-up.
export function registerCustomSkin(id, name, builtin = false) {
  const cid = `custom_${id}`;
  if (COSMETICS[cid]) return cid;
  // "fishstick_skin.glb" -> "Fishstick Skin"
  const nice = name.replace(/\.(glb|gltf)$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const item = { id: cid, type: 'hero', name: nice, rarity: builtin ? 4 : 3, value: `Custom:${id}`, custom: true, builtin, price: 0 };
  COSMETICS[cid] = item;
  COSMETIC_LIST.splice(COSMETIC_LIST.findIndex((c) => c.type === 'hero' && !c.custom), 0, item); // before the built-in heroes, in the order you added them
  return cid;
}
export function unregisterCustomSkin(id) {
  const cid = `custom_${id}`;
  delete COSMETICS[cid];
  const i = COSMETIC_LIST.findIndex((c) => c.id === cid);
  if (i >= 0) COSMETIC_LIST.splice(i, 1);
}
export const STARTERS = items.filter((i) => i.starter).map((i) => i.id);
export const DEFAULT_EQUIPPED = { hero: 'hero_ranger_m', tint: 'tint_teal', backbling: 'bb_antenna', pickaxe: 'pick_default', glider: 'glider_teal', trail: 'trail_none', emote: 'emote_cheer', wrap: 'wrap_none', sprite: 'sp_water', kicks: 'kick_none', sidekick: 'sk_none', spray: 'spray_gg', loading: 'load_default', lobbymusic: 'lm_shuffle' };
// emote clip -> particle effect played with it
export const EMOTE_FX = Object.fromEntries(items.filter((i) => i.type === 'emote' && i.fx).map((i) => [i.value, i.fx]));

export const cosmetic = (id) => COSMETICS[id];
