"""Turn a top-down island map image into the data map the terrain generator reads.

Usage: python3 tools/build-island-map.py <map image> public/maps/island.png

Output (1024 x 512 RGB PNG, both halves cover the same 512 x 512 area, 5 m per pixel):
  left  half: R = land (0 sea .. 255 land, softened coast), G = forest density, B = inland water (lake / rivers)
  right half: R = yellow field, G = swamp, B = dirt / rocky ground
"""
import sys
from collections import deque
from PIL import Image, ImageFilter, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
N = 512
img = Image.open(src).convert('RGB')
# the square grid area of the source image (no labels) - found by eye on the 2048 px map
img = img.crop((48, 48, 2000, 2000)).resize((N, N), Image.LANCZOS)
px = img.load()

def is_water(r, g, b):
    return b >= g - 4 and b > r + 8

water = [[is_water(*px[x, y]) for x in range(N)] for y in range(N)]
# sea: flood fill from the edges through water
sea = [[False] * N for _ in range(N)]
q = deque()
for i in range(N):
    for (x, y) in ((i, 0), (i, N - 1), (0, i), (N - 1, i)):
        if water[y][x] and not sea[y][x]:
            sea[y][x] = True; q.append((x, y))
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < N and 0 <= ny < N and water[ny][nx] and not sea[ny][nx]:
            sea[ny][nx] = True; q.append((nx, ny))

# inland water: connected components that are not sea, dropping specks (pools, dark roofs)
inland = [[False] * N for _ in range(N)]
seen = [[False] * N for _ in range(N)]
for y in range(N):
    for x in range(N):
        if water[y][x] and not sea[y][x] and not seen[y][x]:
            comp = []; q = deque([(x, y)]); seen[y][x] = True
            while q:
                cx, cy = q.popleft(); comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < N and 0 <= ny < N and water[ny][nx] and not sea[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True; q.append((nx, ny))
            if len(comp) >= 30:
                for cx, cy in comp: inland[cy][cx] = True

land = Image.new('L', (N, N)); lp = land.load()
for y in range(N):
    for x in range(N):
        lp[x, y] = 0 if sea[y][x] else 255
wat = Image.new('L', (N, N)); wp = wat.load()
for y in range(N):
    for x in range(N):
        wp[x, y] = 255 if inland[y][x] else 0
# rivers: the thin river lines don't survive the colour test everywhere, so trace them by hand
# (lake -> sea)
d = ImageDraw.Draw(wat)
south = [(223, 222), (221, 236), (213, 250), (211, 266), (217, 282), (226, 298), (230, 312), (223, 326), (215, 340), (216, 358), (224, 372), (239, 388), (252, 404), (259, 420), (261, 440), (261, 462), (262, 480)]
north = [(245, 192), (258, 196), (272, 194), (284, 184), (296, 168), (307, 150), (315, 126), (318, 100), (322, 80), (325, 62)]
# the traces were taken on the uncropped image scaled to 512, so move them into the cropped grid
fix = lambda pts: [((x * 4 - 48) * N / 1952, (y * 4 - 48) * N / 1952) for x, y in pts]
d.line(fix(south), fill=255, width=4)
d.line(fix(north), fill=255, width=4)
land = land.filter(ImageFilter.GaussianBlur(2.2))
wat = wat.filter(ImageFilter.GaussianBlur(0.9))

forest = Image.new('L', (N, N)); fp = forest.load()
field = Image.new('L', (N, N)); fl = field.load()
swamp = Image.new('L', (N, N)); sw = swamp.load()
dirt = Image.new('L', (N, N)); dp = dirt.load()
blur = img.filter(ImageFilter.BoxBlur(1)); bp = blur.load()
for y in range(N):
    for x in range(N):
        if sea[y][x] or inland[y][x]: continue
        r, g, b = bp[x, y]
        lum = (r + g + b) / 3
        greenish = g > r + 12 and g > b + 18
        if greenish: fp[x, y] = int(max(0, min(1, (104 - lum) / 42)) * 255)
        rg = r / max(1, g)
        if rg > 0.86 and g > 108 and b < 80: fl[x, y] = int(min(1, (rg - 0.86) / 0.08) * 255)
        # the swamp only exists in the south-east
        if rg > 0.8 and lum < 72 and x > 300 and y > 320: sw[x, y] = int(min(1, (72 - lum) / 14) * 255)
        if rg > 0.8 and 60 < lum < 105 and not fl[x, y] and not sw[x, y]: dp[x, y] = int(min(1, (rg - 0.8) / 0.12) * 255)
forest = forest.filter(ImageFilter.GaussianBlur(1.6))
field = field.filter(ImageFilter.GaussianBlur(2.5))
swamp = swamp.filter(ImageFilter.GaussianBlur(3))
dirt = dirt.filter(ImageFilter.GaussianBlur(1.5))

out = Image.new('RGB', (N * 2, N))
out.paste(Image.merge('RGB', (land, forest, wat)), (0, 0))
out.paste(Image.merge('RGB', (field, swamp, dirt)), (N, 0))
out.save(dst, optimize=True)
print('wrote', dst)
