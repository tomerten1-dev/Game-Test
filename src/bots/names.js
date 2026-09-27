const BASE = [
  'Sparky', 'Bolt', 'Nova', 'Pixel', 'Turbo', 'Gizmo', 'Rusty', 'Zippy', 'Blaze', 'Echo',
  'Comet', 'Nimbus', 'Fizz', 'Rocket', 'Mochi', 'Byte', 'Jinx', 'Pebble', 'Vortex', 'Waffles',
  'Dash', 'Ember', 'Frosty', 'Glitch', 'Hopper', 'Indigo', 'Jolt', 'Kiwi', 'Lumen', 'Mango',
  'Nacho', 'Orbit', 'Pogo', 'Quill', 'Rogue', 'Sprocket', 'Tofu', 'Ukulele', 'Vex', 'Wisp',
  'Yeti', 'Zephyr', 'Biscuit', 'Cobalt', 'Dynamo', 'Fable', 'Gumdrop', 'Havoc', 'Iggy', 'Juno',
  'Kaboom', 'Lolly', 'Marble', 'Noodle', 'Onyx', 'Pickle', 'Quasar', 'Ripple', 'Sherbet', 'Tango',
];
// 99 unique names: the base list plus a few numbered variants.
export const BOT_NAMES = [...BASE, ...BASE.slice(0, 39).map((n, i) => `${n}${[7, 42, 99, 3, 88, 21, 64][i % 7]}`)];

// Distinct, saturated colors around the hue wheel (skipping the player's teal).
export function botColors(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let h = (i * 137.508 + 10) % 360;
    if (h > 150 && h < 195) h = (h + 60) % 360;
    const s = 70 + (i % 3) * 8, l = 52 + (i % 2) * 6;
    out.push(`hsl(${h.toFixed(0)}, ${s}%, ${l}%)`);
  }
  return out;
}
