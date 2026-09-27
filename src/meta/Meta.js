import { Profile } from './Profile.js';
import { COSMETICS } from './Cosmetics.js';
import { dailyQuests, weeklyQuests, weekKey, questDef, today, matchRewards, applyXp, shopOffers, MILESTONES, milestoneReward, arenaPoints, arenaDivision, matchMedals } from './Progression.js';

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

  ensureWeekly() {
    const wk = weekKey();
    const w = this.p.d.weekly;
    if (!w || w.week !== wk) { this.p.d.weekly = { week: wk, list: weeklyQuests(wk) }; this.p.save(); }
    return this.p.d.weekly.list;
  }

  weekly() { return this.ensureWeekly().map((q) => ({ ...q, def: questDef(q) })); }

  // Milestone tiers reached per stat (claimed ones are remembered).
  milestones() {
    const st = this.p.d.stats, claimed = this.p.d.milestones || {};
    return MILESTONES.map((m) => {
      const v = st[m.stat] || 0;
      const tier = m.tiers.filter((t) => v >= t).length;
      return { ...m, value: v, tier, claimed: claimed[m.id] || 0, next: m.tiers[tier] };
    });
  }

  startMatch() {
    this.ensureQuests();
    this.ensureWeekly();
    this.match = { kills: 0, damage: 0, chests: 0, supply: 0, harvested: 0, built: 0, heals: 0, circles: 0, questsDone: 0, weeklyDone: 0, landed: null,
      shots: 0, hits: 0, heads: 0, buildDamage: 0, longest: 0, trees: 0, firstBlood: false, bossKills: 0, crownKills: 0 };
  }

  // Report something that happened to the player during a real match (not warm-up).
  track(event, amount = 1, extra = null) {
    const m = this.match;
    const g = this.game;
    if (!m || g.warmup > 0 || g.state !== 'playing') return;
    if (event === 'kill') { m.kills += amount; if (extra?.dist) m.longest = Math.max(m.longest, extra.dist); if (extra?.first) m.firstBlood = true; }
    else if (event === 'shot') m.shots += amount;
    else if (event === 'hit') { m.hits += amount; if (extra) m.heads += amount; }
    else if (event === 'buildDamage') m.buildDamage += amount;
    else if (event === 'tree') m.trees += amount;
    else if (event === 'bossKill') m.bossKills += amount;
    else if (event === 'damage') m.damage += amount;
    else if (event === 'chest') m.chests += amount;
    else if (event === 'supply') m.supply += amount;
    else if (event === 'harvest') m.harvested += amount;
    else if (event === 'build') m.built += amount;
    else if (event === 'heal') m.heals += amount;
    else if (event === 'circle') m.circles += amount;
    else if (event === 'land') m.landed = extra;
    else if (event === 'crownKill') m.crownKills = (m.crownKills || 0) + amount;
    if (event === 'shot' || event === 'hit' || event === 'buildDamage' || event === 'tree' || event === 'bossKill') return;
    if (event === 'chest' || event === 'supply') g.hud.pickupNote(`+${event === 'chest' ? 40 : 100} XP`, '#ffd23f');
    for (const q of [...this.ensureQuests(), ...this.ensureWeekly()]) {
      if (q.done) continue;
      const def = questDef(q);
      if (def.event !== event) continue;
      if (event === 'land' && extra !== q.town) continue;
      q.progress = Math.min(def.target, q.progress + amount);
      if (q.progress >= def.target) {
        q.done = true;
        if (q.weekly) m.weeklyDone++; else m.questsDone++;
        g.hud.banner(`${q.weekly ? 'Weekly quest' : 'Quest'} complete! ${def.text}`, 3);
        g.sound.play('buy');
      }
    }
    this.p.save();
  }

  // Wrap up: stats, XP, coins and level-ups. Returns the breakdown for the results screen.
  finishMatch({ place, timeAlive, crowned = false, mode = 'solo' }) {
    if (!this.match) this.startMatch();
    if (place <= 10) this._questEvent('top10');
    if (place === 1) this._questEvent('win');
    const m = this.match;
    this.match = null;
    const s = { ...m, place, timeAlive, crowned };
    // win to earn (or keep) the crown for the next match
    this.p.d.crowned = place === 1;
    if (place === 1 && crowned) this.p.d.stats.crownedWins = (this.p.d.stats.crownedWins || 0) + 1;
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
    // milestone tiers reached with this match's stats
    const claimed = (this.p.d.milestones ||= {});
    const reached = [];
    for (const ms of this.milestones()) {
      for (let t = claimed[ms.id] || 0; t < ms.tier; t++) {
        const r = milestoneReward(t);
        rewards.xp.push([`Milestone: ${ms.name} ${ms.tiers[t]}`, r.xp]);
        rewards.coins.push([`Milestone: ${ms.name}`, r.coins]);
        rewards.totalXp += r.xp; rewards.totalCoins += r.coins;
        reached.push(ms.name);
      }
      claimed[ms.id] = Math.max(claimed[ms.id] || 0, ms.tier);
    }
    // medals (accolades) for this match, each worth some XP
    const medals = matchMedals(s);
    for (const md of medals) { rewards.xp.push([`Medal: ${md.name}`, md.xp]); rewards.totalXp += md.xp; }
    // arena: hype points and divisions
    let arena = null;
    if (mode === 'arena') {
      const A = (this.p.d.arena ||= { points: 0, best: 0, matches: 0, wins: 0 });
      const from = A.points, res = arenaPoints(from, { place, kills: m.kills });
      A.points = Math.max(0, from + res.total);
      A.best = Math.max(A.best, A.points);
      A.matches++;
      if (place === 1) A.wins++;
      const d0 = arenaDivision(from), d1 = arenaDivision(A.points);
      arena = { ...res, from, to: A.points, division: d1, promoted: d1.index > d0.index };
      if (arena.promoted) { rewards.xp.push([`Promoted to ${d1.name}`, 500]); rewards.coins.push([`Promoted to ${d1.name}`, 150]); rewards.totalXp += 500; rewards.totalCoins += 150; }
    }
    const before = { level: this.p.d.level, xp: this.p.d.xp };
    this.p.d.coins += rewards.totalCoins;
    const levelUps = applyXp(this.p, rewards.totalXp);
    this.p.save();
    return { ...rewards, levelUps, before, after: { level: this.p.d.level, xp: this.p.d.xp }, arena, medals, stats: s };
  }

  _questEvent(event) {
    for (const q of [...this.ensureQuests(), ...this.ensureWeekly()]) {
      const def = questDef(q);
      if (q.done || def.event !== event) continue;
      q.progress = Math.min(def.target, q.progress + 1);
      if (q.progress >= def.target) { q.done = true; if (q.weekly) this.match.weeklyDone++; else this.match.questsDone++; }
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
