export const BOT_NAMES = [
  'Sparky', 'Bolt', 'Nova', 'Pixel', 'Turbo', 'Gizmo', 'Rusty', 'Zippy', 'Blaze', 'Echo',
  'Comet', 'Nimbus', 'Fizz', 'Rocket', 'Mochi', 'Byte', 'Jinx', 'Pebble', 'Vortex', 'Waffles',
];

// Distinct, saturated colors around the hue wheel (skipping the player's teal).
export function botColors(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let h = (i * 137.5 + 10) % 360;
    if (h > 150 && h < 195) h = (h + 60) % 360;
    const s = 70 + (i % 3) * 8, l = 52 + (i % 2) * 6;
    out.push(`hsl(${h.toFixed(0)}, ${s}%, ${l}%)`);
  }
  return out;
}
