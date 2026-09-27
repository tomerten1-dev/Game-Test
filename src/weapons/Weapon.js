import { WEAPONS, RARITIES } from './WeaponDefs.js';

// A weapon instance: ammo, reload, bloom and fire cooldown.
export class Weapon {
  constructor(type, rarity = 0) {
    this.type = type;
    this.def = WEAPONS[type];
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
    return d.damage * d.pellets * Math.min(d.rate, 6) * RARITIES[this.rarity].mult * (d.key === 'pistol' ? 0.6 : 1);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.bloom = Math.max(0, this.bloom - this.def.recover * dt);
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        this.ammo = this.def.mag;
        return 'reloaded';
      }
    }
    return null;
  }

  spread(moving, airborne) {
    const d = this.def;
    if (d.pellets > 1) return d.spread * (airborne ? 1.3 : 1);
    return d.spread + this.bloom + (moving ? d.spread * 1.2 : 0) + (airborne ? d.spread * 3 : 0);
  }

  canFire() { return !this.reloading && this.cooldown <= 0 && this.ammo > 0; }

  onFire() {
    this.ammo--;
    this.cooldown = 1 / this.def.rate;
    this.bloom = Math.min(this.def.maxSpread, this.bloom + this.def.bloom);
  }

  startReload() {
    if (this.reloading || this.ammo >= this.def.mag) return false;
    this.reloading = true;
    this.reloadT = this.def.reload;
    return true;
  }

  cancelReload() { this.reloading = false; }
}
