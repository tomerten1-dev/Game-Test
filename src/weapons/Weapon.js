import { WEAPONS, RARITIES } from './WeaponDefs.js';

// higher rarity reloads faster
const RELOAD_MUL = [1, 0.95, 0.9, 0.85, 0.8, 0.75];

// A weapon instance: ammo, reload, bloom and fire cooldown.
export class Weapon {
  constructor(type, rarity = 0) {
    this.isGun = true;
    this.type = type;
    this.def = WEAPONS[type];
    this.lastShot = -10;
    this.rarity = rarity;
    this.ammo = this.def.mag;
    this.bloom = 0;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.drawT = 0; // equip time before it can fire
  }

  get rarityInfo() { return RARITIES[this.rarity]; }
  get damage() { return this.def.damage * RARITIES[this.rarity].mult; }
  // mythics carry their boss's name ("The Foreman's Burst Rifle")
  get name() { return this.title || `${RARITIES[this.rarity].name} ${this.def.name}`; }

  // Rough power score for bots comparing loot.
  get score() {
    const d = this.def;
    const base = d.key === 'sniper' ? 150 : d.key === 'rocket' ? 140 : d.damage * d.pellets * Math.min(d.rate, 6);
    return base * RARITIES[this.rarity].mult * (d.key === 'pistol' ? 0.6 : 1);
  }

  // reloadMul > 1 speeds up reloading only (the Warden's medallion)
  update(dt, reloadMul = 1) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.drawT = Math.max(0, this.drawT - dt);
    this.bloom = Math.max(0, this.bloom - this.def.recover * dt);
    if (this.reloading) {
      this.reloadT -= dt * reloadMul;
      if (this.reloadT <= 0) {
        // shotguns load one shell at a time (the owner decides whether to keep going)
        if (this.def.shellReload) return 'shell';
        this.reloading = false;
        return 'reloaded'; // the owner moves ammo from its reserve (Actor.finishReload)
      }
    }
    return null;
  }

  // opts: { crouched, still, now, aiming } -> rifles and pistols get a perfect first shot when standing still;
  // aiming down sights tightens every gun (shotguns a little, the rest a lot)
  spread(moving, airborne, opts = {}) {
    const d = this.def;
    if (opts.scoped && d.scopedSpread !== undefined) return d.scopedSpread + (moving ? 0.01 : 0) + (airborne ? 0.03 : 0);
    const crouch = opts.crouched ? 0.7 : 1;
    if (d.pellets > 1) return d.spread * (airborne ? 1.3 : 1) * (opts.crouched ? 0.85 : 1) * (opts.aiming ? 0.8 : 1);
    if (d.firstShot && opts.still && !airborne && opts.now !== undefined && opts.now - this.lastShot > 0.5 && this.bloom < 0.004) return 0;
    return (d.spread + this.bloom + (moving ? d.spread * 1.2 : 0) + (airborne ? d.spread * 3 : 0)) * crouch * (opts.aiming ? 0.45 : 1);
  }

  // shotgun damage multiplier by distance (Fortnite pump: full to 7 m, 78% at 10 m, 49% at 15 m, nothing past its range)
  shotgunFalloff(t) {
    const d = this.def, k = d.range / 31; // longer-range shotguns stretch the same curve
    const pts = [[0, 1], [7 * k, 1], [10 * k, 0.78], [15 * k, 0.49], [22 * k, 0.2], [d.range, 0]];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) { const [a, fa] = pts[i - 1], [b, fb] = pts[i]; return fa + (fb - fa) * ((t - a) / (b - a || 1)); }
    }
    return 0;
  }
  // most damage one shotgun blast can deal (Fortnite caps it by rarity)
  get damageCap() { return this.def.cap ? this.def.cap + 10 * Math.min(4, this.rarity) : Infinity; }
  get reloadTime() { return (this.def.shellReload || this.def.reload) * RELOAD_MUL[this.rarity]; }

  // shotguns can fire mid-reload (that stops the reload); nothing fires while being drawn
  canFire() { return (!this.reloading || (this.def.shellReload && this.ammo > 0)) && this.cooldown <= 0 && this.ammo > 0 && this.drawT <= 0; }

  onFire(now = 0) {
    if (this.reloading) this.reloading = false;
    this.lastShot = now;
    this.ammo--;
    this.cooldown = 1 / this.def.rate;
    this.bloom = Math.min(this.def.maxSpread, this.bloom + this.def.bloom);
  }

  startReload(reserve = Infinity) {
    if (this.reloading || this.ammo >= this.def.mag || reserve <= 0) return false;
    this.reloading = true;
    this.reloadT = this.reloadTime;
    return true;
  }

  cancelReload() { this.reloading = false; }
}
