import { Profile } from './Profile.js';
import { COSMETICS } from './Cosmetics.js';
import { dailyQuests, questDef, today, matchRewards, applyXp, shopOffers } from './Progression.js';

// Glue between matches and saved progress: tracks in-match events, quests, rewards and the shop.
export class Meta {
  constructor(game) {
    this.game = game;
    this.profile = new Profile();
    this.ensureQuests();
    this.match = null;
  }

  get p() { return this.profile; }

  ensureQuests() {
    const q = this.p.d.quests;
    const day = today();
    if (q.day !== day) {
      this.p.d.quests = { day, list: dailyQuests(day) };
      this.p.save();
    }
    return this.p.d.quests.list;
  }

  quests() { return this.ensureQuests().map((q) => ({ ...q, def: questDef(q) })); }

  startMatch() {
    this.ensureQuests();
    this.match = { kills: 0, damage: 0, chests: 0, supply: 0, harvested: 0, built: 0, heals: 0, circles: 0, questsDone: 0, landed: null };
  }

  // Report something that happened to the player during a real match (not warm-up).
  track(event, amount = 1, extra = null) {
    const m = this.match;
    const g = this.game;
    if (!m || g.warmup > 0 || g.state !== 'playing') return;
    if (event === 'kill') m.kills += amount;
    else if (event === 'damage') m.damage += amount;
    else if (event === 'chest') m.chests += amount;
    else if (event === 'supply') m.supply += amount;
    else if (event === 'harvest') m.harvested += amount;
    else if (event === 'build') m.built += amount;
    else if (event === 'heal') m.heals += amount;
    else if (event === 'circle') m.circles += amount;
    else if (event === 'land') m.landed = extra;
    if (event === 'chest' || event === 'supply') g.hud.pickupNote(`+${event === 'chest' ? 40 : 100} XP`, '#ffd23f');
    for (const q of this.ensureQuests()) {
      if (q.done) continue;
      const def = questDef(q);
      if (def.event !== event) continue;
      if (event === 'land' && extra !== q.town) continue;
      q.progress = Math.min(def.target, q.progress + amount);
      if (q.progress >= def.target) {
        q.done = true;
        m.questsDone++;
        g.hud.banner(`Quest complete! ${def.text}`, 3);
        g.sound.play('buy');
      }
    }
    this.p.save();
  }

  // Wrap up: stats, XP, coins and level-ups. Returns the breakdown for the results screen.
  finishMatch({ place, timeAlive }) {
    if (!this.match) this.startMatch();
    if (place <= 10) this._questEvent('top10');
    const m = this.match;
    this.match = null;
    const s = { ...m, place, timeAlive };
    const rewards = matchRewards(s);
    const st = this.p.d.stats;
    st.matches++;
    if (place === 1) st.wins++;
    if (place <= 5) st.top5++;
    if (place <= 10) st.top10++;
    st.kills += m.kills;
    st.damage += Math.round(m.damage);
    st.chests += m.chests;
    st.built += m.built || 0;
    st.harvested += m.harvested || 0;
    st.timeAlive += Math.round(timeAlive);
    st.bestPlace = st.bestPlace ? Math.min(st.bestPlace, place) : place;
    const before = { level: this.p.d.level, xp: this.p.d.xp };
    this.p.d.coins += rewards.totalCoins;
    const levelUps = applyXp(this.p, rewards.totalXp);
    this.p.save();
    return { ...rewards, levelUps, before, after: { level: this.p.d.level, xp: this.p.d.xp } };
  }

  _questEvent(event) {
    for (const q of this.ensureQuests()) {
      const def = questDef(q);
      if (!q.done && def.event === event) { q.progress = def.target; q.done = true; this.match.questsDone++; }
    }
  }

  shop() { return shopOffers(today(), this.p); }

  // Spend Storm Coins (earned in play) on a cosmetic or the featured bundle.
  buy(ids, price) {
    const d = this.p.d;
    ids = ids.filter((id) => !this.p.owns(id));
    if (!ids.length) return 'Already owned';
    if (d.coins < price) return `You need ${price - d.coins} more Storm Coins`;
    d.coins -= price;
    for (const id of ids) this.p.grant(id);
    this.p.save();
    return null;
  }

  priceOf(id) { return COSMETICS[id]?.price ?? 0; }
}
