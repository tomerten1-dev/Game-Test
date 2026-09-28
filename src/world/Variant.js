import * as THREE from 'three';
import { PALETTE, BIOMES } from './Terrain.js';
import { MOODS } from './TimeOfDay.js';

// Seasonal island variants. Chosen in Settings (or by calendar on "Auto"); the island is
// generated at load, so switching reloads the page.
export const VARIANTS = {
  summer: { name: 'Summer Island' },
  winter: {
    name: 'Winter Island',
    palette: { grassA: '#eef4fb', grassB: '#dbe7f3', dirt: '#c9d3de', sand: '#e4ebf2', wetSand: '#b9c7d4', rock: '#8a95a3', rockDark: '#6b7582', snow: '#ffffff', shallow: '#a7d8e6', deep: '#3f7f9a' },
    treeGreens: ['#dfe9f2', '#cfdde9', '#e8f0f7', '#bfd1e0'], autumn: ['#cfdde9'], pineGreens: ['#2e5d4a', '#3a6b58', '#284f41'],
    pineShade: 1.25, grass: ['#dce8f2', '#f4f8fc'], grassDensity: 0.35, trees: 0.9,
    day: { top: '#6f9fe0', horizon: '#e3efff', hemiSky: '#e8f2ff', hemiGround: '#c9d6e6', hemi: 1.15, sun: '#fff4e6', sunI: 2.3, cloud: '#dfe8f6', exposure: 0.95 },
    weather: 'snow',
  },
  desert: {
    name: 'Desert Island',
    palette: { grassA: '#e3c58a', grassB: '#d6b274', dirt: '#c99a5b', sand: '#f0d9a4', wetSand: '#d8bb82', rock: '#b67f55', rockDark: '#8f5f3e', snow: '#f0e2c4' },
    treeGreens: ['#8aa04c', '#9aa85a', '#7c8f45'], autumn: ['#b8a04a'], pineGreens: ['#6f7f3c', '#5f7035'],
    grass: ['#c9b06a', '#e0c887'], grassDensity: 0.25, trees: 0.35, cacti: true,
    day: { top: '#3f86dc', horizon: '#ffe3b5', hemiSky: '#fff0d6', hemiGround: '#b08a55', hemi: 1.05, sun: '#ffd9a0', sunI: 2.9, cloud: '#fff1dc', exposure: 1.0 },
  },
};

export function islandSetting() {
  try { return JSON.parse(localStorage.getItem('stormbound.profile.v1') || '{}')?.settings?.island || 'auto'; } catch { return 'auto'; }
}

function resolve() {
  const s = islandSetting();
  if (VARIANTS[s]) return s;
  return 'summer'; // "Auto" is the Season 3 island (no winter map by calendar)
}

export const VARIANT_KEY = resolve();
export const VARIANT = VARIANTS[VARIANT_KEY];

// Apply colour overrides before the terrain / foliage are generated.
if (VARIANT.palette) for (const [k, v] of Object.entries(VARIANT.palette)) PALETTE[k]?.set(v);
// the Season 3 island has no snow or desert: summer shows its fields and swamp instead
BIOMES.on = false;
BIOMES.zones = VARIANT_KEY === 'summer';
if (VARIANT.day) Object.assign(MOODS.day, VARIANT.day);
export const tint = (list, fallback) => (list ? list.map((c) => new THREE.Color(c)) : fallback);
