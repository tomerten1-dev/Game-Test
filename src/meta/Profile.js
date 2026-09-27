import { STARTERS, DEFAULT_EQUIPPED, COSMETICS } from './Cosmetics.js';

const KEY = 'stormbound.profile.v1';

export const DEFAULT_SETTINGS = {
  sensitivity: 1, fov: 70, master: 0.8, music: 0.5, hudScale: 1, soundViz: false, quality: 'auto', keys: {}, island: 'auto',
};

function fresh() {
  return {
    xp: 0, level: 1, coins: 0,
    owned: [...STARTERS],
    equipped: { ...DEFAULT_EQUIPPED },
    stats: { matches: 0, wins: 0, top5: 0, top10: 0, kills: 0, damage: 0, chests: 0, timeAlive: 0, bestPlace: 0, built: 0, harvested: 0 },
    quests: { day: '', list: [] },
    trackClaimed: [],
    settings: { ...DEFAULT_SETTINGS },
    shopBought: {},
  };
}

// The player's saved progress (browser storage only). Nothing here is ever bought with money:
// Storm Coins come from playing matches, quests and level-ups.
export class Profile {
  constructor() {
    const base = fresh();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }
    const d = saved && typeof saved === 'object' ? saved : {};
    this.data = {
      ...base, ...d,
      stats: { ...base.stats, ...(d.stats || {}) },
      settings: { ...base.settings, ...(d.settings || {}), keys: { ...(d.settings?.keys || {}) } },
      equipped: { ...base.equipped, ...(d.equipped || {}) },
      owned: [...new Set([...(d.owned || []), ...STARTERS])].filter((id) => COSMETICS[id]),
      quests: d.quests || base.quests,
    };
    // drop equipped items that no longer exist / aren't owned
    for (const [slot, id] of Object.entries(this.data.equipped)) if (!this.owns(id)) this.data.equipped[slot] = DEFAULT_EQUIPPED[slot];
  }

  get d() { return this.data; }
  owns(id) { return this.data.owned.includes(id); }
  grant(id) { if (COSMETICS[id] && !this.owns(id)) { this.data.owned.push(id); this.save(); return true; } return false; }
  equip(slot, id) { if (this.owns(id)) { this.data.equipped[slot] = id; this.save(); } }
  equippedItem(slot) { return COSMETICS[this.data.equipped[slot]]; }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }

  reset() { this.data = fresh(); this.save(); }
}
