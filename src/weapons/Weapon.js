import { WEAPONS, RARITIES } from './WeaponDefs.js';

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
  }

  get rarityInfo() { return RARITIES[this.rarity]; }
  get damage() { return this.def.damage * RARITIES[this.rarity].mult; }
  get name() { return `${RARITIES[this.rarity].name} ${this.def.name}`; }

  // Rough power score for bots comparing loot.
  get score() {
    const d = this.def;
    const base = d.key === 'sniper' ? 150 : d.key === 'rocket' ? 140 : d.damage * d.pellets * Math.min(d.rate, 6);
    return base * RARITIES[this.rarity].mult * (d.key === 'pistol' ? 0.6 : 1);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.bloom = Math.max(0, this.bloom - this.def.recover * dt);
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        return 'reloaded'; // the owner moves ammo from its reserve (Actor.finishReload)
      }
    }
    return null;
  }

  // opts: { crouched, still, now } -> first shot is perfectly accurate when standing still
  spread(moving, airborne, opts = {}) {
    const d = this.def;
    if (opts.scoped && d.scopedSpread !== undefined) return d.scopedSpread + (moving ? 0.01 : 0) + (airborne ? 0.03 : 0);
    const crouch = opts.crouched ? 0.7 : 1;
    if (d.pellets > 1) return d.spread * (airborne ? 1.3 : 1) * (opts.crouched ? 0.85 : 1);
    if (opts.still && !airborne && opts.now !== undefined && opts.now - this.lastShot > 0.5 && this.bloom < 0.004) return 0;
    return (d.spread + this.bloom + (moving ? d.spread * 1.2 : 0) + (airborne ? d.spread * 3 : 0)) * crouch;
  }

  canFire() { return !this.reloading && this.cooldown <= 0 && this.ammo > 0; }

  onFire(now = 0) {
    this.lastShot = now;
    this.ammo--;
    this.cooldown = 1 / this.def.rate;
    this.bloom = Math.min(this.def.maxSpread, this.bloom + this.def.bloom);
  }

  startReload(reserve = Infinity) {
    if (this.reloading || this.ammo >= this.def.mag || reserve <= 0) return false;
    this.reloading = true;
    this.reloadT = this.def.reload;
    return true;
  }

  cancelReload() { this.reloading = false; }
}
