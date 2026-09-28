import { COSMETIC_LIST, COSMETICS } from './Cosmetics.js';
import { mulberry32 } from '../core/noise.js';
import { TOWNS } from '../world/Terrain.js';

export const SEASON = { name: 'Season 1: Eye of the Storm', levels: 50 };

export const xpForLevel = (level) => 600 + 150 * (level - 1);

// Season reward track: a reward on every level (cosmetics or Storm Coins).
export const TRACK = {
  2: { coins: 150 }, 3: { item: 'tint_crimson' }, 4: { coins: 150 }, 5: { item: 'emote_kick' },
  6: { coins: 200 }, 7: { item: 'glider_sunset' }, 8: { coins: 200 }, 9: { item: 'trail_spark' },
  10: { item: 'hero_rogue' }, 11: { coins: 250 }, 12: { item: 'wrap_camo' }, 13: { coins: 250 },
  14: { item: 'tint_violet' }, 15: { item: 'emote_magic' }, 16: { coins: 300 }, 17: { item: 'glider_candy' },
  18: { coins: 300 }, 19: { item: 'trail_fire' }, 20: { item: 'hero_barbarian' }, 21: { coins: 300 },
  22: { item: 'wrap_ice' }, 23: { coins: 350 }, 24: { item: 'tint_midnight' }, 25: { item: 'emote_nap' },
  26: { coins: 400 }, 27: { item: 'glider_storm' }, 28: { item: 'trail_storm' }, 29: { coins: 500 },
  30: { item: 'hero_mage' },
  // season track continues: skins, back blings and tools
  31: { item: 'bb_quiver' }, 32: { coins: 300 }, 33: { item: 'pick_pan' }, 34: { item: 'emote_moon' },
  35: { item: 'skin_dusty' }, 36: { coins: 350 }, 37: { item: 'bb_llama' }, 38: { item: 'pick_candy' },
  39: { coins: 400 }, 40: { item: 'skin_frost' }, 41: { item: 'emote_power' }, 42: { item: 'bb_cape' },
  43: { coins: 400 }, 44: { item: 'pick_crystal' }, 45: { item: 'skin_ninja' }, 46: { coins: 500 },
  47: { item: 'bb_wings' }, 48: { item: 'emote_summon' }, 49: { coins: 600 }, 50: { item: 'skin_saint' },
};

// Battle Pass pages (Fortnite Chapter 6+): the reward-track items grouped into pages. Every level you
// gain gives one claim to spend on any reward of an unlocked page; claiming 4 rewards on a page
// unlocks the next one. Coin rewards on the track still pay out automatically.
export const PASS_PAGES = (() => {
  const items = Object.keys(TRACK).map(Number).sort((a, b) => a - b).filter((l) => TRACK[l].item).map((l) => TRACK[l].item);
  const pages = [];
  for (let i = 0; i < items.length; i += 6) pages.push(items.slice(i, i + 6));
  if (pages.length > 1 && pages[pages.length - 1].length < 3) pages[pages.length - 2].push(...pages.pop()); // no tiny last page
  return pages;
})();
export const PAGE_UNLOCK = 4;
export function passState(profile) {
  const d = profile.d;
  const claimedOn = PASS_PAGES.map((pg) => pg.filter((id) => profile.owns(id)).length);
  const unlocked = PASS_PAGES.map((_, i) => i === 0 || claimedOn[i - 1] >= PAGE_UNLOCK);
  return { claims: d.passClaims || 0, claimedOn, unlocked };
}
// Spend one claim on a pass reward. Returns an error message or null.
export function claimPass(profile, id) {
  const d = profile.d, st = passState(profile);
  const page = PASS_PAGES.findIndex((pg) => pg.includes(id));
  if (page < 0 || profile.owns(id)) return 'Already claimed';
  if (!st.unlocked[page]) return `Claim ${PAGE_UNLOCK} rewards on page ${page} to unlock this page`;
  if ((d.passClaims || 0) <= 0) return 'Level up to earn another claim';
  d.passClaims--;
  profile.grant(id);
  profile.save();
  return null;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daySeed = (day, salt = 0) => [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7 + salt);

// Quest pool: `event` is what the match reports, `target` how many are needed.
const QUESTS = [
  { id: 'chests', text: 'Open {n} chests', event: 'chest', target: 3 },
  { id: 'elims', text: 'Eliminate {n} opponents', event: 'kill', target: 3 },
  { id: 'damage', text: 'Deal {n} damage to opponents', event: 'damage', target: 500 },
  { id: 'harvest', text: 'Harvest {n} materials', event: 'harvest', target: 200 },
  { id: 'build', text: 'Build {n} pieces', event: 'build', target: 20 },
  { id: 'heal', text: 'Use {n} healing or shield items', event: 'heal', target: 3 },
  { id: 'circles', text: 'Survive {n} storm circles', event: 'circle', target: 4 },
  { id: 'supply', text: 'Open a supply drop', event: 'supply', target: 1 },
  { id: 'pads', text: 'Bounce on {n} jump or launch pads', event: 'pad', target: 2 },
  { id: 'top10', text: 'Finish in the top 10', event: 'top10', target: 1 },
  { id: 'land', text: 'Land at {town}', event: 'land', target: 1 },
  { id: 'vend', text: 'Buy from a vending machine', event: 'vend', target: 1 },
];
export const QUEST_REWARD = { xp: 500, coins: 100 };
export const WEEKLY_REWARD = { xp: 2000, coins: 250 };

// Weekly pool: bigger goals that add up over many matches.
const WEEKLY = [
  { id: 'w_elims', text: 'Eliminate {n} opponents', event: 'kill', target: 25 },
  { id: 'w_damage', text: 'Deal {n} damage to opponents', event: 'damage', target: 5000 },
  { id: 'w_chests', text: 'Open {n} chests', event: 'chest', target: 30 },
  { id: 'w_harvest', text: 'Harvest {n} materials', event: 'harvest', target: 2000 },
  { id: 'w_build', text: 'Build {n} pieces', event: 'build', target: 200 },
  { id: 'w_circles', text: 'Survive {n} storm circles', event: 'circle', target: 30 },
  { id: 'w_top10', text: 'Finish in the top 10 in {n} matches', event: 'top10', target: 5 },
  { id: 'w_win', text: 'Win a match', event: 'win', target: 1 },
  { id: 'w_heal', text: 'Use {n} healing or shield items', event: 'heal', target: 20 },
  { id: 'w_supply', text: 'Open {n} supply drops', event: 'supply', target: 3 },
  { id: 'w_pads', text: 'Bounce on {n} jump or launch pads', event: 'pad', target: 10 },
  { id: 'w_boss', text: 'Defeat the Foreman at Rusty Works', event: 'boss', target: 1 },
  { id: 'w_vault', text: 'Open the vault at Rusty Works', event: 'vault', target: 1 },
];

// ISO-ish week key (Monday start) so everyone gets the same weekly set.
export function weekKey(d = new Date()) {
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return `${mon.getFullYear()}-W${String(mon.getMonth() + 1).padStart(2, '0')}${String(mon.getDate()).padStart(2, '0')}`;
}

export function weeklyQuests(week) {
  const r = mulberry32(daySeed(week, 7));
  const pool = [...WEEKLY];
  const out = [];
  while (out.length < 7) out.push({ id: pool.splice(Math.floor(r() * pool.length), 1)[0].id, progress: 0, done: false, weekly: true });
  return out;
}

// Career milestones: tiers of lifetime stats, each tier pays out once.
export const MILESTONES = [
  { id: 'm_kills', name: 'Eliminations', stat: 'kills', tiers: [10, 50, 150, 500] },
  { id: 'm_wins', name: 'Victories', stat: 'wins', tiers: [1, 5, 20, 50] },
  { id: 'm_matches', name: 'Matches played', stat: 'matches', tiers: [5, 25, 100, 300] },
  { id: 'm_damage', name: 'Damage dealt', stat: 'damage', tiers: [5000, 25000, 100000, 400000] },
  { id: 'm_chests', name: 'Chests opened', stat: 'chests', tiers: [25, 100, 300, 1000] },
  { id: 'm_built', name: 'Pieces built', stat: 'built', tiers: [100, 500, 2000, 8000] },
  { id: 'm_harvest', name: 'Materials harvested', stat: 'harvested', tiers: [1000, 5000, 20000, 80000] },
  { id: 'm_top10', name: 'Top 10 finishes', stat: 'top10', tiers: [5, 25, 100, 300] },
];
export const milestoneReward = (tier) => ({ xp: 1000 * (tier + 1), coins: 100 * (tier + 1) });

export function questDef(q) {
  const base = QUESTS.find((d) => d.id === q.id) || WEEKLY.find((d) => d.id === q.id);
  return { ...base, target: q.target ?? base.target, town: q.town, text: base.text.replace('{n}', q.target ?? base.target).replace('{town}', q.town || '') };
}

// Three quests per day, the same for everyone on that date.
export function dailyQuests(day) {
  const r = mulberry32(daySeed(day));
  const pool = [...QUESTS];
  const out = [];
  while (out.length < 3) {
    const q = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const entry = { id: q.id, progress: 0, done: false };
    if (q.id === 'land') entry.town = TOWNS[Math.floor(r() * TOWNS.length)].name;
    out.push(entry);
  }
  return out;
}

// Item Shop: one featured pair + six daily picks, rotating at midnight. Prices in Storm Coins only.
export function shopOffers(day, profile) {
  const r = mulberry32(daySeed(day, 99));
  const pool = COSMETIC_LIST.filter((c) => !c.starter);
  const pick = (list, n) => {
    const src = [...list], out = [];
    while (out.length < n && src.length) out.push(src.splice(Math.floor(r() * src.length), 1)[0]);
    return out;
  };
  const featured = pick(pool.filter((c) => c.rarity >= 3), 2);
  const daily = pick(pool.filter((c) => !featured.includes(c)), 6);
  const bundlePrice = Math.round(featured.reduce((a, c) => a + c.price, 0) * 0.8 / 50) * 50;
  return {
    featured: featured.map((c) => ({ item: c, owned: profile.owns(c.id) })),
    bundle: { items: featured, price: bundlePrice, owned: featured.every((c) => profile.owns(c.id)) },
    daily: daily.map((c) => ({ item: c, owned: profile.owns(c.id) })),
  };
}

// End-of-match XP + coins, itemised for the results screen.
export function matchRewards(s) {
  const xp = [];
  const coins = [];
  const alive = Math.floor(s.timeAlive);
  xp.push(['Time survived', Math.min(900, alive * 2)]);
  if (s.kills) { xp.push(['Eliminations', s.kills * 150]); coins.push(['Eliminations', s.kills * 10]); }
  if (s.chests) xp.push(['Chests opened', s.chests * 40]);
  if (s.supply) xp.push(['Supply drops', s.supply * 100]);
  if (s.damage) xp.push(['Damage dealt', Math.round(s.damage / 4)]);
  if (s.crownKills) xp.push(['Crown eliminations', s.crownKills * 100]);
  if (s.rings) xp.push(['Battle Bus rings', s.rings * 50]);
  if (s.place === 1 && s.crowned) { xp.push(['Crowned Victory Royale!', 1500]); coins.push(['Crowned Victory Royale!', 200]); }
  if (s.place === 1) { xp.push(['Victory!', 1000]); coins.push(['Victory!', 250]); }
  else if (s.place <= 5) { xp.push(['Top 5', 300]); coins.push(['Top 5', 100]); }
  else if (s.place <= 10) { xp.push(['Top 10', 150]); coins.push(['Top 10', 50]); }
  coins.push(['Match played', 25]);
  if (s.questsDone) { xp.push(['Daily quests', s.questsDone * QUEST_REWARD.xp]); coins.push(['Daily quests', s.questsDone * QUEST_REWARD.coins]); }
  if (s.weeklyDone) { xp.push(['Weekly quests', s.weeklyDone * WEEKLY_REWARD.xp]); coins.push(['Weekly quests', s.weeklyDone * WEEKLY_REWARD.coins]); }
  return { xp, coins, totalXp: xp.reduce((a, b) => a + b[1], 0), totalCoins: coins.reduce((a, b) => a + b[1], 0) };
}

// Apply XP, level-ups (coins + track rewards) to the profile. Returns what happened.
export function applyXp(profile, amount) {
  const d = profile.d;
  const events = [];
  d.xp += amount;
  while (d.xp >= xpForLevel(d.level)) {
    d.xp -= xpForLevel(d.level);
    d.level++;
    d.coins += 100;
    const reward = TRACK[d.level];
    const ev = { level: d.level, coins: 100, claim: true };
    d.passClaims = (d.passClaims || 0) + 1; // one Battle Pass reward to claim per level
    if (reward && !d.trackClaimed.includes(d.level)) {
      d.trackClaimed.push(d.level);
      if (reward.coins) { d.coins += reward.coins; ev.coins += reward.coins; }
    }
    events.push(ev);
  }
  profile.save();
  return events;
}

// ---------- Ranked (the Arena mode) ----------
// Fortnite Ranked: 18 ranks, Bronze I to Unreal. Placement and eliminations add rank progress; from
// Platinum up each match costs a little, so the top ranks move slower. Bots get sharper as you climb.
const RANK_MIN = [0, 60, 130, 210, 300, 400, 510, 630, 760, 900, 1050, 1210, 1380, 1560, 1750, 1950, 2200, 2500];
const RANK_TIERS = [['Bronze', '#c7874f'], ['Silver', '#c9d3de'], ['Gold', '#ffc93c'], ['Platinum', '#6fe0d0'], ['Diamond', '#6fb8ff']];
export const ARENA_DIVISIONS = [
  ...RANK_TIERS.flatMap(([name, color], t) => ['I', 'II', 'III'].map((n, k) => {
    const i = t * 3 + k;
    return { name: `${name} ${n}`, min: RANK_MIN[i], fare: t >= 3 ? 2 + (i - 9) : 0, elim: t >= 3 ? 3 : t >= 1 ? 4 : 5, color, skill: i * 0.02 };
  })),
  { name: 'Elite', min: RANK_MIN[15], fare: 9, elim: 3, color: '#b86bff', skill: 0.32 },
  { name: 'Champion', min: RANK_MIN[16], fare: 10, elim: 3, color: '#ff7a3a', skill: 0.35 },
  { name: 'Unreal', min: RANK_MIN[17], fare: 12, elim: 3, color: '#ff4fd8', skill: 0.38 },
];

export function arenaDivision(points) {
  let i = 0;
  while (i < ARENA_DIVISIONS.length - 1 && points >= ARENA_DIVISIONS[i + 1].min) i++;
  return { ...ARENA_DIVISIONS[i], index: i, next: ARENA_DIVISIONS[i + 1] || null };
}

// Points for one arena match: [label, points] rows and the total.
export function arenaPoints(points, { place, kills }) {
  const div = arenaDivision(points);
  const rows = [];
  if (div.fare) rows.push(['Bus fare', -div.fare]);
  if (place <= 25) rows.push(['Top 25', 10]);
  if (place <= 15) rows.push(['Top 15', 10]);
  if (place <= 5) rows.push(['Top 5', 10]);
  if (place === 1) rows.push(['Victory Royale', 30]);
  if (kills) rows.push([`Eliminations ×${kills}`, kills * div.elim]);
  return { rows, total: rows.reduce((a, r) => a + r[1], 0) };
}

// ---------- match medals (accolades) ----------
export const MEDALS = [
  { id: 'victory', name: 'Victory Royale', icon: '👑', xp: 0, test: (s) => s.place === 1 },
  { id: 'crowned', name: 'Crowned', icon: '♛', xp: 300, test: (s) => s.place === 1 && s.crowned },
  { id: 'first', name: 'First Blood', icon: '🩸', xp: 150, test: (s) => s.firstBlood },
  { id: 'sharp', name: 'Sharpshooter', icon: '🎯', xp: 200, test: (s) => s.shots >= 20 && s.hits / s.shots >= 0.5 },
  { id: 'head', name: 'Headhunter', icon: '💥', xp: 150, test: (s) => s.heads >= 5 },
  { id: 'marksman', name: 'Marksman', icon: '🔭', xp: 200, test: (s) => s.longest >= 100 },
  { id: 'spree', name: 'Rampage', icon: '🔥', xp: 250, test: (s) => s.kills >= 5 },
  { id: 'demo', name: 'Demolition', icon: '🧨', xp: 150, test: (s) => s.buildDamage >= 1000 },
  { id: 'builder', name: 'Master Builder', icon: '🧱', xp: 100, test: (s) => s.built >= 60 },
  { id: 'lumber', name: 'Lumberjack', icon: '🪓', xp: 100, test: (s) => s.trees >= 5 },
  { id: 'treasure', name: 'Treasure Hunter', icon: '🧰', xp: 100, test: (s) => s.chests >= 6 },
  { id: 'boss', name: 'Boss Slayer', icon: '💀', xp: 300, test: (s) => s.bossKills >= 1 },
  { id: 'survivor', name: 'Survivor', icon: '⏱', xp: 100, test: (s) => s.place <= 10 },
];
export function matchMedals(s) { return MEDALS.filter((m) => { try { return m.test(s); } catch { return false; } }); }
