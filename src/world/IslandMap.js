// The island's layout comes from a data map (public/maps/island.png, built by tools/build-island-map.py
// from the Fortnite Chapter 1 Season 3 map): coastline, lake and rivers, forests, fields, swamp.
// 512 x 512 samples, 5 m each, centred on the world origin.
export const MAP_N = 512;
export const MAP_CELL = 5;
const CH = ['land', 'forest', 'water', 'field', 'swamp', 'dirt'];

export const ISLAND_MAP = { ready: false, data: {} };

export async function loadIslandMap(url = '/maps/island.png') {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    for (const k of CH) ISLAND_MAP.data[k] = new Float32Array(MAP_N * MAP_N);
    const W = cv.width;
    for (let y = 0; y < MAP_N; y++) {
      for (let x = 0; x < MAP_N; x++) {
        const a = (y * W + x) * 4, b = (y * W + x + MAP_N) * 4, k = y * MAP_N + x;
        ISLAND_MAP.data.land[k] = px[a] / 255; ISLAND_MAP.data.forest[k] = px[a + 1] / 255; ISLAND_MAP.data.water[k] = px[a + 2] / 255;
        ISLAND_MAP.data.field[k] = px[b] / 255; ISLAND_MAP.data.swamp[k] = px[b + 1] / 255; ISLAND_MAP.data.dirt[k] = px[b + 2] / 255;
      }
    }
    ISLAND_MAP.ready = true;
  } catch (e) {
    console.warn('island map missing, using the generated island', e);
  }
}

// bilinear sample of a channel at world (x, z); 0 outside the map
export function mapAt(ch, x, z) {
  const d = ISLAND_MAP.data[ch];
  if (!d) return 0;
  const fx = x / MAP_CELL + MAP_N / 2 - 0.5, fz = z / MAP_CELL + MAP_N / 2 - 0.5;
  if (fx < 0 || fz < 0 || fx >= MAP_N - 1 || fz >= MAP_N - 1) return 0;
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * MAP_N + i;
  return (d[k] * (1 - tx) + d[k + 1] * tx) * (1 - tz) + (d[k + MAP_N] * (1 - tx) + d[k + MAP_N + 1] * tx) * tz;
}

// Fortnite-map pixel (on the 1024 px image with its grid labels) -> world metres
export const fromMap = (px, py) => [Math.round((((px * 2 - 48) * MAP_N) / 1952 - MAP_N / 2) * MAP_CELL), Math.round((((py * 2 - 48) * MAP_N) / 1952 - MAP_N / 2) * MAP_CELL)];
