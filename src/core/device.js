// Device detection + quality presets (lower settings on touch devices).

export const isTouch =
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  window.matchMedia?.('(pointer: coarse)').matches;

export const isMobile = isTouch && Math.min(window.innerWidth, window.innerHeight) < 900;

export const quality = isMobile
  ? { pixelRatio: Math.min(window.devicePixelRatio, 1.25), shadowSize: 1024, shadowRange: 40, grassCount: 3500, grassRadius: 28, trees: 260, antialias: false }
  : { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowSize: 2048, shadowRange: 65, grassCount: 22000, grassRadius: 55, trees: 380, antialias: true };
