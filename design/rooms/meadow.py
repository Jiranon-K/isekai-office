from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import json
import math
import random

from PIL import Image

W, H = 640, 384
LAYOUT = str(ROOT / "design/room-layout.json")
OUT = str(ROOT / "web/public/assets/rooms/meadow.png")
PREVIEW = str(ROOT / "design/preview-meadow.png")

PAL = []


def hexrgb(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def register(colors):
    indexes = []
    for c in colors:
        PAL.append(hexrgb(c))
        indexes.append(len(PAL) - 1)
    return indexes


K = register(["#33364a"])[0]
S = [K] + register(["#5b5d70", "#878899", "#b2afb2", "#d7d0c3", "#f1ebdc"])
F = register(["#a39e9e", "#c6bfb3"])
L = register(["#55709a", "#7d9fc7", "#a9c7e3", "#d7e9f4"])
M = register(["#3d5249", "#5a7662", "#7f9b80", "#abc3a0"])
B = register(["#47393b", "#6c5853", "#917b6d", "#b7a28b"])
G = register(["#a2703e", "#d6a35b", "#f0d18f", "#fcf3d2"])
R = register(["#7a6476", "#a68c9b"])
V = register(["#6c5c9a", "#9d8cc8"])

UP = {}
DOWN = {}


def link_ramp(ramp, below=None, above=None):
    for i, c in enumerate(ramp):
        UP[c] = ramp[i + 1] if i + 1 < len(ramp) else (above if above is not None else c)
        DOWN[c] = ramp[i - 1] if i > 0 else (below if below is not None else c)


link_ramp(S)
link_ramp(F, below=S[2], above=S[4])
link_ramp(L, below=S[1], above=S[5])
link_ramp(M, below=K, above=M[3])
link_ramp(B, below=K, above=S[4])
link_ramp(G, below=B[2])
link_ramp(R, below=B[1], above=S[4])
link_ramp(V, below=K, above=L[3])

WARM = dict(UP)
WARM[S[3]] = F[1]
WARM[F[1]] = S[4]
WARM[S[4]] = S[5]
WARM[S[5]] = G[3]
WARM[F[0]] = F[1]
WARM[B[2]] = B[3]
WARM[B[3]] = G[2]
WARM[M[2]] = M[3]
WARM[M[3]] = G[2]

COOL = dict(UP)
COOL[S[4]] = S[5]
COOL[F[1]] = S[4]

cv = [[S[3]] * W for _ in range(H)]
floor = [[False] * W for _ in range(H)]

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAYER[y % 4][x % 4] + 0.5) / 16.0


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def vnoise(x, y, scale, s=0):
    gx, gy = x / scale, y / scale
    x0, y0 = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - x0, gy - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    a = hsh(x0, y0, s)
    b = hsh(x0 + 1, y0, s)
    c = hsh(x0, y0 + 1, s)
    d = hsh(x0 + 1, y0 + 1, s)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def inside(x, y):
    return 0 <= x < W and 0 <= y < H


def px(x, y, c):
    if inside(x, y):
        cv[y][x] = c


def get(x, y):
    return cv[y][x] if inside(x, y) else None


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(x, y, c)


def hline(x0, x1, y, c):
    rect(x0, y, x1, y, c)


def vline(x, y0, y1, c):
    rect(x, y0, x, y1, c)


def darken(x, y, n=1):
    if not inside(x, y):
        return
    for _ in range(n):
        cv[y][x] = DOWN[cv[y][x]]


def lighten(x, y, n=1, table=None):
    if not inside(x, y):
        return
    t = table or UP
    for _ in range(n):
        cv[y][x] = t.get(cv[y][x], cv[y][x])


def ellipse_mask(cx, cy, rx, ry):
    out = set()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                out.add((x, y))
    return out


def rect_mask(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def fill(mask, c):
    for x, y in mask:
        px(x, y, c)


def edge(mask):
    out = set()
    for x, y in mask:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in mask:
                out.add((x, y))
                break
    return out


def side_edges(mask, dx, dy):
    return {(x, y) for x, y in mask if (x + dx, y + dy) not in mask}


def outline(mask, c):
    fill(edge(mask), c)


def solid(mask, base, light, dark, ink):
    fill(mask, base)
    inner = mask - edge(mask)
    fill(side_edges(inner, 0, -1) | side_edges(inner, -1, 0), light)
    fill(side_edges(inner, 0, 1) | side_edges(inner, 1, 0), dark)
    outline(mask, ink)


def outline_outer(mask, c, xa, ya, xb, yb):
    ring = set()
    for x, y in mask:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p not in mask and xa <= p[0] <= xb and ya <= p[1] <= yb:
                ring.add(p)
    for x, y in ring:
        if get(x, y) is not None and get(x, y) not in (K, B[0]):
            px(x, y, c)
    return ring


def claim(mask):
    for x, y in mask:
        if inside(x, y):
            floor[y][x] = False


SHADOW_MASKS = []


def cast(mask, off=3):
    SHADOW_MASKS.append((mask, off))


def apply_shadows():
    for mask, off in SHADOW_MASKS:
        targets = {}
        for x, y in mask:
            for k in range(1, off + 1):
                p = (x + k, y + k)
                if p in mask:
                    continue
                if p not in targets or targets[p] > k:
                    targets[p] = k
        for (x, y), k in targets.items():
            if not inside(x, y) or not floor[y][x]:
                continue
            if k == off and (x + y) % 2 == 0:
                continue
            darken(x, y)


rng = random.Random(41)

STONE_TONES = (S[4], S[4], S[3], F[1])


def stones(mask, ox, oy, sw, sh, seed, tones=STONE_TONES, joint=S[2]):
    row = 0
    for y in range(oy, oy + 240, sh):
        shift = (row % 2) * (sw // 2) + int(hsh(row, 0, seed) * 3)
        x = ox - shift
        while x < ox + 240:
            w = sw + int(hsh(x, y, seed) * 4) - 1
            blk = {(xx, yy) for xx in range(x, x + w) for yy in range(y, y + sh) if (xx, yy) in mask}
            if blk:
                base = tones[int(hsh(x, y, seed + 1) * len(tones)) % len(tones)]
                fill(blk, base)
                for xx, yy in blk:
                    if (xx, yy - 1) not in blk or (xx - 1, yy) not in blk:
                        px(xx, yy, UP[base])
                    if (xx, yy + 1) not in blk or (xx + 1, yy) not in blk:
                        px(xx, yy, joint if (xx, yy + 1) not in blk else DOWN[base])
                if len(blk) > 30 and hsh(x, y, seed + 3) < 0.3:
                    cx = x + 2 + int(hsh(x, y, seed + 4) * max(1, w - 5))
                    for k in range(3):
                        if (cx + k // 2, y + 2 + k) in blk:
                            px(cx + k // 2, y + 2 + k, DOWN[base])
            x += w
        row += 1


def flower(x, y, c=None, leaf=True):
    c = L[2] if c is None else c
    px(x, y, c)
    px(x - 1, y, DOWN[c] if c != S[5] else S[4])
    px(x, y - 1, UP[c] if c != S[5] else S[5])
    if leaf:
        px(x + 1, y + 1, M[2])
        px(x, y + 1, M[1])


def tuft(x, y, h=3, bloom=None):
    for k in range(h):
        px(x + (k % 2 if h > 3 else 0), y - k, M[2] if k < h - 1 else M[3])
    px(x - 1, y, M[1])
    px(x + 1, y - 1, M[2])
    if bloom is not None:
        px(x, y - h, bloom)
        px(x + 1, y - h, DOWN[bloom])


def wall_face():
    rect(0, 0, W - 1, 47, S[4])
    y = 8
    row = 0
    while y < 40:
        h = 8 if y + 8 <= 40 else 40 - y
        x = -rng.randint(0, 12) if row % 2 else -rng.randint(10, 20)
        while x < W:
            w = rng.choice((14, 17, 20, 22, 24, 27, 30))
            wall_block(x, y, w, h)
            x += w
        y += h
        row += 1
    beam()
    plinth()
    wall_cracks()
    wall_vines()
    wall_base_flowers()


def wall_block(x, y, w, h):
    tone = rng.random()
    base = S[4] if tone < 0.62 else (S[5] if tone < 0.78 else F[1])
    hi = UP[base] if base != S[5] else S[5]
    lo = DOWN[base]
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not 0 <= xx < W:
                continue
            if yy == y + h - 1 or xx == x + w - 1:
                c = S[2] if hsh(xx, yy, 300) < 0.85 else S[3]
            elif yy == y and xx < x + w - 2:
                c = hi
            elif xx == x and yy < y + h - 2:
                c = hi
            elif yy == y + h - 2 and xx > x + 1:
                c = lo
            else:
                c = base
                v = vnoise(xx, yy, 3, 301)
                if v > 0.72 and bayer(xx, yy) < 0.5:
                    c = lo
            px(xx, yy, c)
    if hsh(x, y, 302) < 0.3 and w > 16:
        sx = x + 3 + int(hsh(x, y, 303) * (w - 8))
        px(sx, y + 3, lo)
        px(sx + 1, y + 3, lo)
        px(sx + 1, y + 4, S[2])


def beam():
    for x in range(W):
        for y in range(0, 3):
            px(x, y, B[0] if y < 2 else B[1])
        px(x, 3, B[3] if hsh(x, 3, 310) < 0.7 else B[2])
        px(x, 4, B[2])
        px(x, 5, B[2] if vnoise(x, 5, 4, 311) < 0.6 else B[1])
        px(x, 6, B[1])
        px(x, 7, K if hsh(x, 7, 312) < 0.8 else B[0])
    for x in range(10, W, 46):
        vline(x, 3, 6, B[1])
        px(x + 1, 4, B[3])
    for x in range(W):
        if bayer(x, 8) < 0.5:
            darken(x, 8)
        if bayer(x, 9) < 0.25:
            darken(x, 9)


def plinth():
    for x in range(W):
        px(x, 40, S[5] if hsh(x, 40, 320) < 0.7 else S[4])
        for y in range(41, 46):
            v = vnoise(x, y, 5, 321)
            px(x, y, S[3] if v < 0.62 else F[0])
        px(x, 41, F[1])
        px(x, 46, S[2])
        px(x, 47, S[1])
    for x in range(6, W, 37):
        vline(x, 41, 46, S[2])
        px(x + 1, 41, S[4])


def wall_cracks():
    for sx, sy, ln in ((36, 12, 9), (118, 30, 7), (226, 14, 8), (300, 30, 6), (402, 26, 9), (520, 14, 7), (596, 28, 8), (186, 22, 6)):
        x, y = sx, sy
        for k in range(ln):
            px(x, y, S[2])
            px(x + 1, y, S[3])
            y += 1
            x += (1 if hsh(sx, k, 330) < 0.4 else (-1 if hsh(sx, k, 331) < 0.3 else 0))
        flower(x, y, L[2])
        flower(sx + 2, sy - 1, S[5], leaf=False)
        px(sx + 3, sy, M[2])


def wall_vines():
    for vx, ln in ((22, 20), (92, 14), (196, 26), (254, 12), (384, 16), (428, 22), (512, 10), (566, 18), (630, 24)):
        for k in range(ln):
            xx = vx + int(round(math.sin(k * 0.45 + vx) * 1.3))
            px(xx, 8 + k, M[1] if k % 4 else M[2])
            if k % 3 == 1:
                px(xx + 1, 8 + k, M[2])
                px(xx + 2, 7 + k, M[3])
            if k % 3 == 2:
                px(xx - 1, 8 + k, M[2])
            if k % 7 == 5:
                px(xx - 2, 8 + k, L[2])
        px(vx, 8 + ln, M[3])
        px(vx + 1, 9 + ln, L[3] if vx % 2 else S[5])


def wall_base_flowers():
    for x in range(W):
        n = vnoise(x, 0, 6, 340)
        if n > 0.42:
            top = 46 - int((n - 0.42) * 22)
            for y in range(top, 47):
                px(x, y, M[2] if (y - top) < 2 else M[1])
            px(x, top, M[3] if hsh(x, top, 341) < 0.6 else M[2])
            if hsh(x, 0, 342) < 0.22:
                c = L[2] if hsh(x, 1, 343) < 0.7 else S[5]
                px(x, top - 1, c)
                px(x, top - 2, UP[c] if c != S[5] else S[5])
                if hsh(x, 2, 344) < 0.5:
                    px(x + 1, top - 1, DOWN[c] if c != S[5] else S[4])


def side_walls():
    for x0, inner_dir in ((0, 1), (624, -1)):
        for y in range(0, H):
            for x in range(x0, x0 + 16):
                local = x - x0 if inner_dir == 1 else x0 + 15 - x
                if local < 11:
                    n = vnoise(x, y, 5, 350)
                    c = S[3] if n < 0.5 else S[4]
                    if (y + (7 if x0 else 0)) % 13 == 0:
                        c = S[2]
                    elif (y + (7 if x0 else 0)) % 13 == 1:
                        c = S[5] if n < 0.7 else S[4]
                    if (y // 13 + x0) % 2 == 0 and local == 5:
                        c = S[2]
                    px(x, y, c)
                    mn = vnoise(x, y, 6, 351)
                    if mn > 0.66:
                        px(x, y, M[2] if mn > 0.76 else M[1])
                    if mn > 0.82:
                        px(x, y, M[3])
                    if mn > 0.76 and hsh(x, y, 352) < 0.06:
                        px(x, y, L[2])
                elif local < 13:
                    px(x, y, S[1])
                else:
                    px(x, y, S[2] if inner_dir == 1 else S[4])
        lip = x0 + 11 if inner_dir == 1 else x0 + 4
        for y in range(0, H):
            px(lip, y, S[1])
        edge_x = x0 + 15 if inner_dir == 1 else x0
        for y in range(48, H):
            px(edge_x, y, K)


def bottom_wall():
    for x in range(0, W):
        if 304 <= x <= 335:
            continue
        for y in range(368, H):
            g = vnoise(x, y * 4, 9, 360)
            c = S[3]
            if y in (369, 370):
                c = S[5] if hsh(x, y, 361) < 0.6 or y == 369 else S[4]
            elif y < 373:
                c = S[4]
            elif y > 379:
                c = S[2]
            if 372 < y < 380:
                if g > 0.66:
                    c = S[2]
                elif g < 0.3:
                    c = S[4]
            px(x, y, c)
        px(x, 368, S[1])
    for jx in (52, 128, 210, 262, 382, 446, 520, 590):
        for y in range(369, H):
            px(jx, y, S[1])
            px(jx + 1, y, S[2])
            px(jx - 1, y, S[4] if y < 374 else S[3])
        px(jx + 1, 369, S[4])
    for x in range(0, W):
        if 296 <= x <= 343:
            continue
        n = vnoise(x, 0, 6, 362)
        if n > 0.5:
            top = 369 + (1 if n < 0.58 else 0)
            depth = 2 + int((n - 0.5) * 14)
            for y in range(top, min(H, top + depth)):
                px(x, y, M[2] if y < top + depth - 1 else M[1])
            px(x, top, M[3])
            if hsh(x, 1, 363) < 0.14:
                c = L[2] if hsh(x, 2, 364) < 0.7 else S[5]
                px(x, top - 1, c)
                px(x, top, DOWN[c] if c != S[5] else S[4])


def floor_flags():
    seeds = {}
    sx, sy = 28, 18
    for gy in range(-1, H // sy + 2):
        for gx in range(-1, W // sx + 2):
            jx = hsh(gx, gy, 370) * sx * 0.8
            jy = hsh(gx, gy, 371) * sy * 0.8
            seeds[(gx, gy)] = (gx * sx + jx, gy * sy + jy, hsh(gx, gy, 372))
    info = {}
    region = []
    for y in range(48, H):
        for x in range(16, 624):
            if y >= 368 and not (304 <= x <= 335):
                continue
            region.append((x, y))
            gx, gy = x // sx, y // sy
            best = []
            for oy in (-1, 0, 1):
                for ox in (-1, 0, 1):
                    s = seeds[(gx + ox, gy + oy)]
                    d = math.hypot(x - s[0], (y - s[1]) * 1.35)
                    best.append((d, s[2], s[0], s[1]))
            best.sort()
            info[(x, y)] = (best[1][0] - best[0][0], best[0][1], best[0][2], best[0][3])
    mortar = {p for p, v in info.items() if v[0] < 1.3}
    for p in region:
        x, y = p
        if p in mortar:
            n = vnoise(x, y, 9, 373)
            c = F[0]
            if n > 0.5:
                c = M[2] if hsh(x, y, 374) < 0.6 else M[3]
            elif hsh(x, y, 375) < 0.2:
                c = S[3]
            px(x, y, c)
            continue
        tone, cx, cy = info[p][1], info[p][2], info[p][3]
        worn = abs(cx - 320) < 34 and cy > 150
        if worn:
            base = S[4] if tone < 0.8 else F[1]
        else:
            base = S[4] if tone < 0.45 else (F[1] if tone < 0.86 else S[3])
        c = base
        if (x, y - 1) in mortar:
            c = UP[base]
        elif (x - 1, y) in mortar and bayer(x, y) < 0.5:
            c = UP[base]
        if (x, y + 1) in mortar or ((x + 1, y) in mortar and bayer(x, y) < 0.5):
            c = DOWN[base]
        px(x, y, c)
    for p in mortar:
        x, y = p
        if hsh(x, y, 377) < 0.012 and 50 < y < 366:
            c = L[2] if hsh(x, y, 378) < 0.75 else S[5]
            px(x, y, c)
            px(x + 1, y, DOWN[c] if c != S[5] else S[4])
            px(x, y - 1, UP[c] if c != S[5] else S[5])
            px(x - 1, y + 1, M[2])
    crack_rng = random.Random(9)
    for _ in range(38):
        x = crack_rng.randint(30, 610)
        y = crack_rng.randint(60, 360)
        ln = crack_rng.randint(4, 9)
        for k in range(ln):
            if (x, y) in info and (x, y) not in mortar:
                px(x, y, F[0] if k % 4 else S[2])
            x += crack_rng.choice((1, 1, 0, -1))
            y += 1
        if crack_rng.random() < 0.6:
            flower(x, y, L[2] if crack_rng.random() < 0.7 else S[5])


def floor_meadow():
    for y in range(48, 368):
        for x in range(16, 624):
            edge_d = min((x - 16) * 1.3, (623 - x) * 1.3, (y - 48) * 2.2, (367 - y) * 1.2)
            corner = 0.0
            for cx, cy, r in ((40, 370, 120), (600, 370, 120), (320, 380, 70), (606, 96, 60), (24, 196, 60), (200, 372, 50), (450, 372, 56), (24, 100, 40)):
                d = math.hypot(x - cx, (y - cy) * 1.2) / r
                corner = max(corner, 1 - d)
            n = vnoise(x, y, 8, 380) * 0.75 + vnoise(x, y, 3, 381) * 0.25 - edge_d / 34.0 + corner * 0.95 + 0.06
            if n > 0.5:
                c = M[3]
                if n < 0.52:
                    c = M[2]
                elif hsh(x, y // 3, 386) < 0.2:
                    c = M[2]
                elif n > 0.66 and hsh(x, (y + 1) // 3, 388) < 0.12:
                    c = M[1]
                px(x, y, c)
                if n > 0.55 and hsh(x, y, 382) < 0.06:
                    c = L[2] if hsh(x, y, 383) < 0.72 else (S[5] if hsh(x, y, 384) < 0.7 else L[3])
                    px(x, y, c)
                    px(x, y - 1, UP[c] if c != S[5] else S[5])
                    if hsh(x, y, 385) < 0.5:
                        px(x + 1, y, DOWN[c] if c != S[5] else S[4])
            elif n > 0.44 and hsh(x, y, 387) < 0.05:
                px(x, y, M[2])
                px(x, y - 1, M[3])


def mark_floor():
    for y in range(48, H):
        for x in range(16, 624):
            if y >= 368 and not (304 <= x <= 335):
                continue
            floor[y][x] = True


def back_shadow():
    for x in range(16, 624):
        for y in (48, 49):
            darken(x, y)
        if bayer(x, 50) < 0.5:
            darken(x, 50)
        if bayer(x, 51) < 0.25:
            darken(x, 51)
    for y in range(48, 368):
        darken(16, y)
        darken(17, y)
        if bayer(18, y) < 0.5:
            darken(18, y)


def window(x0, sill_item):
    frame = set()
    for y in range(3, 32):
        for x in range(x0, x0 + 32):
            dx = (x + 0.5 - (x0 + 16)) / 15.5
            dy = (y + 0.5 - 17) / 14.0
            if y < 17:
                if dx * dx + dy * dy <= 1.0:
                    frame.add((x, y))
            elif x0 + 1 <= x <= x0 + 30:
                frame.add((x, y))
    opening = set()
    for x, y in frame:
        dx = (x + 0.5 - (x0 + 16)) / 11.5
        dy = (y + 0.5 - 17) / 10.0
        if y < 17:
            if dx * dx + dy * dy <= 1.0:
                opening.add((x, y))
        elif x0 + 5 <= x <= x0 + 26 and y <= 26:
            opening.add((x, y))
    rim = frame - opening
    stones(rim, x0, 3, 6, 4, 400 + x0, tones=(S[5], S[4], S[4]), joint=S[3])
    for x, y in rim:
        if (x, y - 1) not in frame:
            px(x, y, S[5])
        if x > x0 + 16 and (x + 1, y) not in frame:
            px(x, y, S[3])
    keystone = rect_mask(x0 + 14, 3, x0 + 17, 7)
    fill(keystone, S[5])
    vline(x0 + 17, 4, 7, S[3])
    outline(frame, K)
    sunlit_arch(frame, x0)
    for x, y in opening:
        yy = y - 7
        if yy < 6:
            c = L[3] if bayer(x, y) < 0.9 else L[2]
        elif yy < 11:
            c = L[2] if bayer(x, y) < 0.5 else L[3]
        else:
            c = L[2]
        px(x, y, c)
    for x, y in opening:
        far = 22 + math.sin((x - x0) * 0.25 + x0) * 1.6
        near = 24 + math.sin((x - x0) * 0.33 + 1.7) * 1.4
        if y > near:
            c = M[2] if bayer(x, y) < 0.6 else M[3]
            if hsh(x, y, 401) < 0.18:
                c = L[3] if hsh(x, y, 402) < 0.6 else L[1]
            px(x, y, c)
        elif y > far:
            px(x, y, L[1] if bayer(x, y) < 0.6 else M[3])
    for x, y in ((x0 + 8, 12), (x0 + 9, 12), (x0 + 10, 11), (x0 + 11, 12), (x0 + 7, 12), (x0 + 20, 15), (x0 + 21, 15), (x0 + 22, 14), (x0 + 23, 15)):
        if (x, y) in opening:
            px(x, y, S[5])
    vline(x0 + 16, 7, 26, B[1])
    vline(x0 + 15, 8, 26, B[3])
    hline(x0 + 5, x0 + 26, 18, B[1])
    hline(x0 + 6, x0 + 25, 17, B[3])
    inner = edge(opening)
    for x, y in inner:
        if x > x0 + 16 or y > 25:
            px(x, y, S[3])
    for x, y in ((x0 + 7, 22), (x0 + 8, 21), (x0 + 9, 20), (x0 + 11, 22), (x0 + 12, 21)):
        px(x, y, S[5])
    rect(x0 + 1, 27, x0 + 30, 28, S[5])
    hline(x0 + 1, x0 + 22, 27, G[3])
    rect(x0 + 1, 29, x0 + 30, 30, S[4])
    hline(x0 + 1, x0 + 30, 31, S[2])
    hline(x0, x0 + 31, 32, K)
    px(x0, 27, K)
    px(x0 + 31, 27, K)
    vline(x0, 28, 31, K)
    vline(x0 + 31, 28, 31, K)
    for i, x in enumerate(range(x0 + 2, x0 + 30, 4)):
        if hsh(x, 33, 403) < 0.6:
            ln = 2 + (i * 3) % 4
            for k in range(ln):
                px(x + (k % 2), 32 + k, M[2] if k < ln - 1 else M[3])
    for x, y in ((x0 - 1, 20), (x0, 16), (x0 + 32, 22), (x0 + 31, 18)):
        px(x, y, M[2])
        px(x, y + 1, M[1])
    px(x0 - 1, 19, L[2])
    px(x0 + 32, 21, S[5])
    sill_item(x0)


def sunlit_arch(frame, x0):
    ring = edge(frame)
    inner = frame - ring
    for x, y in inner:
        if y >= 17 or (x, y - 1) not in ring and (x - 1, y) not in ring:
            continue
        px(x, y, G[3] if x < x0 + 19 else S[5])


def sill_bottle(x0):
    m = ellipse_mask(x0 + 24, 25, 2.6, 2.4)
    fill(m, L[1])
    for x, y in m:
        if x > x0 + 24:
            px(x, y, L[0])
    px(x0 + 23, 24, L[3])
    outline(m, K)
    vline(x0 + 24, 20, 22, L[1])
    px(x0 + 24, 19, B[2])
    for x, y, c in ((x0 + 23, 17, L[2]), (x0 + 25, 16, S[5]), (x0 + 24, 18, M[2]), (x0 + 26, 18, M[2]), (x0 + 22, 18, M[2])):
        px(x, y, c)


def sill_cup(x0):
    m = rect_mask(x0 + 5, 23, x0 + 10, 27)
    fill(m, S[5])
    vline(x0 + 10, 23, 27, S[3])
    hline(x0 + 5, x0 + 10, 25, L[1])
    outline(m, S[1])
    for x, y, c in ((x0 + 6, 21, L[2]), (x0 + 8, 20, L[3]), (x0 + 9, 22, M[2]), (x0 + 7, 22, M[2]), (x0 + 10, 21, S[5])):
        px(x, y, c)


def banner(x0, base, hi, lo, motif, tear):
    for x in range(x0 + 1, x0 + 31):
        px(x, 5, B[3])
        px(x, 6, B[2])
        px(x, 7, B[1])
    hline(x0 + 1, x0 + 30, 4, B[0])
    hline(x0 + 1, x0 + 30, 8, B[0])
    vline(x0, 5, 7, B[0])
    vline(x0 + 31, 5, 7, B[0])
    px(x0 + 1, 6, G[1])
    px(x0 + 30, 6, G[1])
    cloth = set()
    for y in range(9, 46):
        if y < 38:
            for x in range(x0 + 5, x0 + 27):
                cloth.add((x, y))
        else:
            k = y - 38
            for x in range(x0 + 5 + k * 2 - (1 if k < 2 else 0), x0 + 27 - k * 2 + (1 if k < 2 else 0)):
                cloth.add((x, y))
    cloth = {(x, y) for (x, y) in cloth if not (y > 36 and hsh(x, y, 410 + x0) < 0.08)}
    fill(cloth, base)
    for x, y in cloth:
        f = (x - x0 - 5) % 7
        if f == 0:
            px(x, y, hi)
        elif f == 5:
            px(x, y, lo)
        if vnoise(x, y, 4, 411 + x0) > 0.7 and bayer(x, y) < 0.5:
            px(x, y, hi)
    for x, y in cloth:
        if x in (x0 + 7, x0 + 24) and 11 <= y <= 36:
            px(x, y, G[1] if (y % 5) else lo)
        if y in (11, 36) and x0 + 7 <= x <= x0 + 24:
            px(x, y, G[1] if (x % 5) else lo)
    motif(x0 + 16, 23)
    if tear:
        tx, ty = tear
        for x, y in ((tx, ty), (tx + 1, ty), (tx, ty + 1), (tx + 1, ty + 1), (tx + 2, ty + 1)):
            px(x, y, S[3])
        px(tx - 1, ty, lo)
        px(tx + 2, ty + 2, lo)
    for x, y in cloth:
        if (x + 1, y) not in cloth and (x, y - 1) in cloth:
            px(x, y, lo)
    outline(cloth, B[0])
    for x, y in cloth:
        if (x, y + 1) not in cloth and y > 37 and hsh(x, y, 412) < 0.5:
            px(x, y + 1, hi)
    for k in range(1, 12):
        if hsh(x0 + 27, k, 413) < 0.6:
            px(x0 + 27, 12 + k, S[3])


def star_motif(cx, cy):
    for k in range(-5, 6):
        px(cx + k, cy, S[5] if abs(k) < 3 else S[4])
        px(cx, cy + k, S[5] if abs(k) < 3 else S[4])
    for k in (-2, -1, 1, 2):
        px(cx + k, cy + k, S[4])
        px(cx + k, cy - k, S[4])
    px(cx, cy, G[3])
    for i, (x, y) in enumerate(((cx - 6, cy + 5), (cx - 7, cy + 7), (cx - 9, cy + 8), (cx + 5, cy - 7), (cx - 5, cy - 8))):
        px(x, y, S[4] if i < 3 else G[2])


def flower_motif(cx, cy):
    vline(cx, cy + 2, cy + 10, M[2])
    for dx, dy in ((-2, 6), (-3, 5), (2, 8), (3, 7)):
        px(cx + dx, cy + dy, M[3])
    for ang in range(5):
        a = -math.pi / 2 + ang * 2 * math.pi / 5
        pm = ellipse_mask(cx + math.cos(a) * 3.4, cy - 2 + math.sin(a) * 3.4, 2.3, 2.3)
        fill(pm, L[3])
        for x, y in pm:
            if (x + 1, y + 1) not in pm:
                px(x, y, L[2])
    px(cx, cy - 2, G[2])
    px(cx + 1, cy - 2, G[1])


def road_motif(cx, cy):
    for k in range(18):
        x = cx + int(round(math.sin(k * 0.42) * 4)) - (k - 9) // 6
        y = cy + 9 - k
        px(x, y, S[4])
        px(x + 1, y, S[5] if k < 12 else S[4])
        if k < 6:
            px(x + 2, y, S[4])
    for x, y in ((cx - 6, cy + 2), (cx + 6, cy + 4), (cx - 5, cy + 7), (cx + 5, cy - 1)):
        px(x, y, M[3])
        px(x + 1, y + 1, M[2])
    for x, y in ((cx + 3, cy - 9), (cx + 2, cy - 10), (cx + 4, cy - 10), (cx + 3, cy - 11), (cx + 3, cy - 10)):
        px(x, y, G[2] if (x, y) != (cx + 3, cy - 10) else G[3])
    px(cx - 4, cy - 9, S[5])
    px(cx - 7, cy - 5, S[4])


def quest_board():
    x0, y0, x1, y1 = 273, 6, 366, 44
    vline(282, 0, 7, B[1])
    vline(357, 0, 7, B[1])
    px(283, 3, M[2])
    px(356, 4, M[3])
    board = rect_mask(x0, y0, x1, y1)
    fill(board, B[3])
    rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3, B[2])
    for x in range(x0 + 3, x1 - 2):
        for y in range(y0 + 4, y1 - 2):
            if (y - y0) % 7 == 0:
                px(x, y, B[1] if hsh(x, y, 420) < 0.8 else B[2])
            elif vnoise(x, y, 3, 421) > 0.74 and bayer(x, y) < 0.5:
                px(x, y, B[3])
    for x in range(x0, x1 + 1):
        px(x, y0, S[4] if hsh(x, 1, 422) < 0.5 else B[3])
        px(x, y1 - 1, B[2])
    for y in range(y0, y1 + 1):
        px(x0, y, S[4] if hsh(1, y, 423) < 0.4 else B[3])
        px(x1 - 1, y, B[2])
    hline(x0 + 3, x1 - 3, y0 + 3, B[1])
    vline(x0 + 3, y0 + 3, y1 - 3, B[1])
    outline(board, B[0])
    board_rim(x0, y0, x1)
    notes = [
        (281, 11, 12, 14, "p"), (296, 10, 11, 10, "flower"), (310, 12, 14, 12, "p"),
        (328, 9, 10, 13, "p"), (342, 12, 15, 11, "map"), (284, 28, 11, 11, "p"),
        (300, 25, 14, 13, "p"), (318, 27, 10, 11, "flower"), (333, 25, 11, 13, "p"), (348, 27, 9, 11, "p"),
    ]
    pins = [L[1], V[0], G[1], L[1], V[0], G[1], L[1], V[0], G[1], L[1]]
    for i, (nx, ny, nw, nh, kind) in enumerate(notes):
        rect(nx + 1, ny + 1, nx + nw, ny + nh, B[1])
        paper = S[5] if i % 3 else S[4]
        rect(nx, ny, nx + nw - 1, ny + nh - 1, paper)
        hline(nx, nx + nw - 1, ny, G[3] if i % 3 else S[5])
        vline(nx + nw - 1, ny + 1, ny + nh - 1, S[3])
        hline(nx + 1, nx + nw - 1, ny + nh - 1, S[3])
        if kind == "p":
            for li, yy in enumerate(range(ny + 3, ny + nh - 2, 2)):
                xx = nx + 2
                end = nx + nw - 3 - (3 if li % 3 == 2 else 0)
                while xx <= end:
                    seg = 1 + int(hsh(xx, yy, 424 + i) * 3)
                    for k in range(seg):
                        if xx + k <= end:
                            px(xx + k, yy, S[2] if hsh(xx + k, yy, 425) < 0.85 else B[2])
                    xx += seg + 1
        elif kind == "flower":
            cx = nx + nw // 2
            vline(cx, ny + 4, ny + nh - 2, M[2])
            px(cx - 1, ny + nh - 4, M[3])
            px(cx + 1, ny + nh - 5, M[3])
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                px(cx + dx, ny + 3 + dy, L[2])
            px(cx, ny + 3, G[2])
        else:
            for yy in range(ny + 2, ny + nh - 2):
                for xx in range(nx + 2, nx + nw - 2):
                    if vnoise(xx, yy, 3, 426) > 0.58:
                        px(xx, yy, M[3] if vnoise(xx, yy, 3, 426) < 0.7 else M[2])
            for k in range(nw - 4):
                px(nx + 2 + k, ny + 4 + int(round(math.sin(k * 0.8) * 1.5)) + k // 4, B[2] if k % 2 else B[1])
            px(nx + nw - 4, ny + nh - 4, R[0])
            px(nx + nw - 3, ny + nh - 5, R[0])
        if i % 4 == 1:
            px(nx + nw - 1, ny + nh - 1, B[1])
            px(nx + nw - 2, ny + nh - 1, S[3])
            px(nx + nw - 1, ny + nh - 2, S[3])
        cx = nx + nw // 2
        px(cx, ny + 1, pins[i])
        px(cx - 1, ny, UP[pins[i]])
        px(cx, ny, pins[i])
    for x, y in ((x0 + 1, y0 - 1), (x0 + 2, y0 - 2), (x0 - 1, y0 + 2), (x1, y0 - 1), (x1 + 1, y0 + 3), (x0 + 1, y1 + 1), (x1 - 2, y1 + 1)):
        px(x, y, M[2])
    px(x0 + 2, y0 - 3, L[2])
    px(x1 - 1, y0 - 2, S[5])
    dried = [(x1 - 6, y1 - 1), (x0 + 6, y1 - 1)]
    for dx, dy in dried:
        for k in range(6):
            px(dx + (k % 2), dy + k - 3, R[1] if k < 2 else B[2])
        px(dx - 1, dy - 3, R[0])


def board_rim(x0, y0, x1):
    for x in range(x0 + 1, x1):
        px(x, y0 + 1, G[2] if min(x - x0, x1 - x) < 14 else S[5])
    for k in range(20):
        if k < 10 or bayer(x0, y0 + k) < 0.5:
            px(x0 + 1, y0 + 2 + k, G[2])
            px(x1 - 1, y0 + 2 + k, G[2])


def lantern(x0, y0):
    cx = x0 + 8
    for y in range(8, y0 + 2):
        px(cx + (1 if (y // 3) % 2 else 0), y, S[1])
    hline(cx - 3, cx + 4, y0 + 1, K)
    hline(cx - 2, cx + 3, y0, K)
    hline(cx - 2, cx + 3, y0 + 1, S[2])
    box = rect_mask(cx - 3, y0 + 2, cx + 4, y0 + 12)
    fill(box, G[2])
    for x, y in box:
        d = math.hypot(x + 0.5 - cx - 0.5, (y + 0.5 - y0 - 7) * 0.8)
        if d < 2:
            px(x, y, G[3])
        elif d > 3.4:
            px(x, y, G[1])
    vline(cx, y0 + 2, y0 + 12, K)
    vline(cx + 1, y0 + 2, y0 + 12, S[1])
    outline(box, K)
    px(cx - 2, y0 + 4, S[5])
    hline(cx - 4, cx + 5, y0 + 13, K)
    hline(cx - 3, cx + 4, y0 + 13, S[2])
    hline(cx - 2, cx + 3, y0 + 14, K)
    px(cx, y0 + 15, K)
    px(cx + 1, y0 + 15, G[1])
    px(cx - 4, y0 + 3, M[2])
    px(cx + 5, y0 + 6, M[2])
    px(cx + 5, y0 + 7, M[1])


def glow(cx, cy, radius, strength=1.0, table=None, floor_only=False, wall_only=False):
    t = table or WARM
    for y in range(int(cy - radius), int(cy + radius) + 1):
        for x in range(int(cx - radius), int(cx + radius) + 1):
            if not inside(x, y):
                continue
            if floor_only and not floor[y][x]:
                continue
            if wall_only and y > 47:
                continue
            d = math.hypot(x - cx, (y - cy) * 1.2) / radius
            if d >= 1:
                continue
            v = (1 - d) * strength
            if v > bayer(x, y):
                lighten(x, y, 1, t)
            if v - 0.9 > bayer(x, y):
                lighten(x, y, 1, t)


def dried_bundle(x, y, c1, c2, ln):
    px(x, y, B[1])
    px(x, y + 1, B[2])
    hline(x - 1, x + 1, y + 2, R[0])
    for k in range(ln):
        w = 1 + (k > 1) + (k > 4)
        for i in range(-w + 1, w):
            col = c1 if i <= 0 else c2
            if (i + k) % 3 == 0:
                col = B[2]
            px(x + i, y + 3 + k, col)
    px(x, y + 3 + ln, B[1])


def fireplace():
    x0, x1 = 432, 495
    chim = rect_mask(439, 0, 488, 24)
    stones(chim, 440, 0, 9, 6, 430)
    for y in range(0, 25):
        px(439, y, S[1])
        px(488, y, S[1])
    beam_mask = rect_mask(x0 + 1, 20, x1 - 1, 26)
    fill(beam_mask, B[2])
    hline(x0 + 2, x1 - 2, 21, B[3])
    hline(x0 + 2, x1 - 2, 22, B[3])
    hline(x0 + 2, x1 - 2, 25, B[1])
    for x in range(x0 + 4, x1 - 3, 9):
        px(x, 23, B[1])
        px(x + 1, 24, B[1])
    outline(beam_mask, B[0])
    rect(443, 13, 445, 19, S[5])
    vline(445, 13, 19, S[4])
    outline(rect_mask(443, 13, 445, 19), S[2])
    px(444, 12, B[1])
    px(444, 11, G[3])
    px(444, 10, G[2])
    jar = ellipse_mask(481, 16, 3.3, 3.4)
    fill(jar, L[1])
    for x, y in jar:
        if x > 481:
            px(x, y, L[0])
    px(480, 14, L[3])
    outline(jar, K)
    for x, y, c in ((478, 9, R[1]), (480, 8, G[2]), (482, 9, R[1]), (484, 10, B[3]), (479, 11, B[2]), (481, 10, B[2]), (483, 11, B[2]), (481, 12, B[1])):
        px(x, y, c)
    for i, (bx, c1, c2) in enumerate(((452, R[1], R[0]), (458, L[1], L[0]), (463, S[4], S[3]))):
        h = 7 - i
        book = rect_mask(bx, 19 - h, bx + 4, 19)
        fill(book, c1)
        vline(bx + 4, 19 - h, 19, c2)
        hline(bx, bx + 4, 19 - h + 2, G[1])
        outline(book, K)
    tilt = [(468, 19), (469, 18), (470, 17), (471, 16), (472, 15), (473, 14)]
    for x, y in tilt:
        px(x, y, K)
        px(x + 1, y, B[3])
        px(x + 2, y, B[2])
        px(x + 3, y, K)
    surround = rect_mask(436, 27, 491, 54)
    stones(surround, 436, 27, 8, 6, 431)
    for y in range(27, 55):
        px(436, y, S[1])
        px(491, y, S[1])
    box = rect_mask(447, 31, 480, 54)
    warm_ring(box, surround)
    fill(box, K)
    for x, y in box:
        if y > 45:
            v = (y - 45) / 9.0
            if v > bayer(x, y):
                px(x, y, S[1])
            if v > 0.7 and v - 0.35 > bayer(x, y):
                px(x, y, G[0])
    for x, y in edge(box):
        px(x, y, S[2] if y > 34 else S[1])
    arch = {(x, y) for (x, y) in box if (x, y - 1) not in box}
    fill(arch, S[5])
    logs = [(452, 52, 476, 50), (455, 50, 474, 53)]
    for ax, ay, bx, by in logs:
        steps = max(abs(bx - ax), abs(by - ay))
        for k in range(steps + 1):
            x = round(ax + (bx - ax) * k / steps)
            y = round(ay + (by - ay) * k / steps)
            px(x, y - 1, B[3])
            px(x, y, B[2])
            px(x, y + 1, B[1])
    fl = set()
    for y in range(35, 52):
        h = (51 - y) / 16.0
        w = 9 * (1 - h) ** 0.7
        sway = math.sin(y * 0.6) * 1.5 * h
        for x in range(447, 481):
            if abs(x + 0.5 - 464 - sway) <= w:
                fl.add((x, y))
    for tx, ty, tl in ((456, 41, 4), (472, 39, 5), (461, 33, 3), (467, 34, 3)):
        for k in range(tl):
            fl.add((tx + (k % 2), ty + k))
    fill(fl, G[1])
    for x, y in fl:
        d = abs(x + 0.5 - 464) / 9.0 + (51 - y) / 30.0
        if d < 0.45:
            px(x, y, G[3])
        elif d < 0.7:
            px(x, y, G[2])
    for x, y in edge(fl):
        if cv[y][x] == G[1]:
            px(x, y, G[0])
    for x, y in ((458, 35), (471, 34), (452, 39), (476, 41)):
        px(x, y, G[2])
    for bx, c1, c2 in ((441, R[1], B[2]), (486, L[1], L[0])):
        dried_bundle(bx, 27, c1, c2, 7)
    hearth = rect_mask(x0 + 1, 55, x1 - 1, 63)
    fill(hearth, S[4])
    for y in range(55, 59):
        for x in range(x0 + 1, x1):
            px(x, y, S[5] if hsh(x, y, 432) < 0.8 else S[4])
    hline(x0 + 1, x1 - 1, 59, S[3])
    for x in range(x0 + 6, x1 - 2, 12):
        vline(x, 60, 62, S[2])
        px(x + 1, 60, S[5])
    outline(hearth, K)
    for x in range(447, 481):
        px(x, 55, G[1] if bayer(x, 55) < 0.6 else S[4])
    kettle(441, 54)
    for x, y in ((x0 + 4, 63), (x0 + 22, 63), (x1 - 8, 63)):
        flower(x, y - 1, L[2], leaf=False)
        px(x + 1, y, M[2])
    logpile = [(482, 50), (486, 50), (484, 47)]
    for lx, ly in logpile:
        m = ellipse_mask(lx + 0.5, ly + 0.5, 2.5, 2)
        fill(m, B[3])
        px(lx, ly, B[2])
        outline(m, B[0])
    claim(rect_mask(x0, 48, x1, 63))
    cast(hearth, 3)


def warm_ring(box, surround):
    for x, y in surround - box:
        near = min(abs(x - bx) + abs(y - by) for bx, by in ((min(max(x, 447), 480), min(max(y, 31), 54)),))
        if near <= 2:
            lighten(x, y, 1, WARM)


def kettle(cx, base_y):
    body = ellipse_mask(cx + 0.5, base_y - 3.5, 5.5, 4.5)
    body = {(x, y) for (x, y) in body if y <= base_y}
    fill(body, S[2])
    for x, y in body:
        if x < cx - 1 and (x, y - 1) in body:
            px(x, y, S[3])
        if x > cx + 2:
            px(x, y, S[1])
    px(cx - 2, base_y - 6, S[5])
    px(cx - 3, base_y - 5, S[4])
    outline(body, K)
    hline(cx - 1, cx + 2, base_y - 8, K)
    hline(cx - 1, cx + 2, base_y - 9, S[2])
    px(cx, base_y - 10, K)
    px(cx + 1, base_y - 10, K)
    for k in range(4):
        px(cx + 6 + k // 2, base_y - 3 - k, K)
        px(cx + 6 + k // 2, base_y - 2 - k, S[2])
    for x, y in ((cx - 4, base_y - 10), (cx - 3, base_y - 12), (cx - 2, base_y - 13), (cx + 3, base_y - 12), (cx + 4, base_y - 13)):
        px(x, y, K)
    for x, y in ((cx + 9, base_y - 9), (cx + 10, base_y - 11), (cx + 9, base_y - 13)):
        px(x, y, S[5])


def bookshelves():
    x0, x1, ytop, ybot = 32, 191, 36, 79
    body = rect_mask(x0, ytop, x1, ybot)
    fill(body, B[2])
    rect(x0, ytop, x1, ytop + 5, B[3])
    hline(x0, x1, ytop + 1, S[5])
    for x in range(x0, x1 + 1):
        if hsh(x, 0, 440) < 0.25:
            px(x, ytop + 2, S[4])
        if hsh(x, 1, 441) < 0.3:
            px(x, ytop + 4, B[2])
    hline(x0, x1, ytop + 5, B[1])
    rr = random.Random(13)
    rows = [(43, 53), (56, 65), (68, 76)]
    cols = [(x0 + 4, x0 + 30), (x0 + 35, x0 + 62), (x0 + 67, x0 + 93), (x0 + 98, x0 + 124), (x0 + 129, x1 - 4)]
    for (cx0, cx1) in cols:
        for (ry0, ry1) in rows:
            rect(cx0, ry0, cx1, ry1, B[1])
            hline(cx0, cx1, ry0, B[0])
            for x in range(cx0, cx1 + 1):
                if bayer(x, ry0 + 1) < 0.5:
                    px(x, ry0 + 1, B[0])
                for y in range(ry0 + 2, ry1 + 1):
                    if bayer(x, y) < 0.2:
                        px(x, y, B[0])
            x = cx0 + rr.randint(0, 2)
            while x < cx1 - 1:
                r = rr.random()
                if r < 0.07 and x < cx1 - 7:
                    jar = ellipse_mask(x + 3, ry1 - 3, 3, 3.2)
                    fill(jar, L[2] if rr.random() < 0.6 else G[2])
                    for p in jar:
                        if (p[0] + 1, p[1]) not in jar:
                            px(p[0], p[1], DOWN[cv[p[1]][p[0]]])
                    px(x + 2, ry1 - 4, S[5])
                    hline(x + 2, x + 4, ry1 - 6, B[3])
                    if rr.random() < 0.6:
                        px(x + 2, ry1 - 8, L[2])
                        px(x + 4, ry1 - 9, S[5])
                        px(x + 3, ry1 - 7, M[2])
                    x += 8
                    continue
                if r < 0.14 and x < cx1 - 7:
                    for k in range(3):
                        sc = ellipse_mask(x + 3, ry1 - 1 - k * 2, 3, 1.3)
                        fill(sc, S[4])
                        px(x + 1, ry1 - 1 - k * 2, S[5])
                        px(x + 5, ry1 - 1 - k * 2, S[3])
                    x += 8
                    continue
                if r < 0.2:
                    x += rr.randint(2, 4)
                    continue
                w = rr.choice((2, 3, 3, 4, 4))
                h = rr.randint(ry1 - ry0 - 5, ry1 - ry0 - 1)
                main, dark = rr.choice(BOOKS)
                if x + w > cx1:
                    break
                lean = 2 if (rr.random() < 0.12 and x + w + 2 < cx1) else 0
                book(x, ry1, h, w, main, dark, G[1] if rr.random() < 0.5 else None, lean)
                x += w + (2 if lean else 0) + (1 if rr.random() < 0.15 else 0)
        for (ry0, ry1) in rows:
            hline(cx0, cx1, ry1 + 1, B[3])
            hline(cx0, cx1, ry1 + 2, B[1])
    posts = [x0, x0 + 31, x0 + 63, x0 + 94, x0 + 125, x1 - 3]
    for cx in posts:
        for y in range(ytop + 6, ybot):
            wob = 1 if math.sin(y * 0.35 + cx) > 0.6 else 0
            px(cx + wob, y, B[3])
            px(cx + 1 + wob, y, B[2])
            px(cx + 2 + wob, y, B[2])
            px(cx + 3 + wob, y, B[1])
        rect(cx - 1, ytop - 2, cx + 4, ytop + 1, B[3])
    hline(x0, x1, ybot - 1, B[1])
    hline(x0, x1, ybot - 2, B[2])
    for wx in (64, 144):
        shelf_sun(wx, x0 + 1, x1 - 1, ytop + 6, ybot - 3)
    knobs = set()
    for cx in posts:
        knobs |= rect_mask(cx - 1, ytop - 3, cx + 4, ytop)
    outline(body | knobs, B[0])
    for cx in posts:
        hline(cx, cx + 3, ytop - 3, B[0])
        px(cx, ytop - 2, S[4])
        px(cx + 1, ytop - 2, S[4])
    for x in range(x0 + 2, x1 - 1):
        if vnoise(x, 0, 5, 442) > 0.6:
            px(x, ytop + 3, M[2])
            px(x, ytop + 2, M[3])
            if hsh(x, 3, 443) < 0.2:
                px(x, ytop + 1, L[2] if hsh(x, 4, 444) < 0.7 else S[5])
    for vx, ln in ((x0 + 14, 7), (x0 + 108, 10), (x0 + 150, 5)):
        for k in range(ln):
            xx = vx + int(round(math.sin(k * 0.7) * 1.2))
            px(xx, ytop + 4 + k, M[2])
            if k % 3 == 1:
                px(xx + 1, ytop + 4 + k, M[3])
        px(vx, ytop + 4 + ln, L[2])
    satchel = rect_mask(x0 + 70, ytop - 8, x0 + 84, ytop - 1)
    fill(satchel, B[2])
    hline(x0 + 71, x0 + 83, ytop - 7, B[3])
    vline(x0 + 84, ytop - 7, ytop - 1, B[1])
    hline(x0 + 70, x0 + 84, ytop - 4, B[1])
    px(x0 + 77, ytop - 4, G[2])
    px(x0 + 77, ytop - 3, G[1])
    outline(satchel, B[0])
    for k in range(9):
        px(x0 + 72 + k, ytop - 9 - int(round(math.sin(k / 8 * math.pi) * 3)), B[0])
    claim(rect_mask(x0, 48, x1, ybot))
    cast(rect_mask(x0, ybot - 2, x1, ybot), 3)


def shelf_sun(wx, xa, xb, ya, yb):
    for y in range(ya, yb + 1):
        centre = wx + (y - 33) * 0.55
        for x in range(max(xa, int(centre - 9)), min(xb, int(centre + 9)) + 1):
            d = abs(x + 0.5 - centre) / 8.0
            if d >= 1 or cv[y][x] in (K, B[0]):
                continue
            if d < 0.6 or bayer(x, y) < 0.5:
                lighten(x, y, 1, WARM)


def book(x, ybot, h, w, main, dark, band=None, lean=0):
    for i in range(w):
        for k in range(h):
            xx = x + i + (lean * k // h if lean else 0)
            px(xx, ybot - k, main if i < w - 1 else dark)
        px(x + i + (lean if lean else 0), ybot - h + 1, UP.get(main, main) if i == 0 else main)
    if band is not None and h > 5:
        for i in range(w):
            px(x + i, ybot - h + 3, band)
            if h > 8:
                px(x + i, ybot - 2, band)


BOOKS = [
    (L[1], L[0]), (M[2], M[1]), (B[3], B[2]), (R[1], R[0]), (S[4], S[3]),
    (L[2], L[1]), (G[1], G[0]), (M[3], M[2]), (R[0], B[1]), (B[2], B[1]),
]


def plant(tx, ty, kind):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 8
    pot = set()
    if kind == "stonepot":
        for y in range(y0 + 9, y0 + 16):
            w = 6 if y > y0 + 9 else 5
            for x in range(cx - w, cx + w):
                pot.add((x, y))
        stones(pot, cx - 6, y0 + 9, 4, 3, 450 + tx, tones=(S[4], S[3], F[1]))
        outline(pot, S[1])
    elif kind == "tub":
        for y in range(y0 + 8, y0 + 16):
            w = 5 if y < y0 + 14 else 4
            if y == y0 + 8:
                w = 6
            for x in range(cx - w, cx + w):
                pot.add((x, y))
        solid(pot, B[2], B[3], B[1], B[0])
        hline(cx - 5, cx + 4, y0 + 9, B[1])
        hline(cx - 4, cx + 3, y0 + 12, R[0])
    elif kind == "jar":
        for y in range(y0 + 7, y0 + 16):
            w = 3 if y < y0 + 9 else (5 if y < y0 + 15 else 4)
            for x in range(cx - w, cx + w):
                pot.add((x, y))
        solid(pot, L[1], L[2], L[0], K)
        px(cx - 3, y0 + 10, L[3])
        hline(cx - 4, cx + 3, y0 + 13, S[4])
    else:
        for i, (dx, dy, rx) in enumerate(((-5, 13, 3), (4, 14, 3.5), (0, 15, 3), (-2, 11, 2.5), (5, 11, 2.2))):
            m = ellipse_mask(cx + dx, y0 + dy, rx, 1.8)
            m = {(x, y) for (x, y) in m if x0 <= x < x0 + 16 and y < y0 + 16}
            fill(m, S[4] if i % 2 else F[1])
            for x, y in side_edges(m, 0, 1):
                px(x, y, S[2])
            for x, y in side_edges(m, 0, -1):
                px(x, y, S[5])
            pot |= m
        outline(pot, S[1])
    leaves = set()
    rr = random.Random(tx * 31 + ty)
    fronds = 9 if kind != "wild" else 11
    root_y = y0 + (9 if kind != "wild" else 12)
    for i in range(fronds):
        ang = -math.pi / 2 + (i - (fronds - 1) / 2) * (2.7 / fronds) + rr.uniform(-0.12, 0.12)
        ln = rr.uniform(9, 14)
        for k in range(int(ln)):
            t = k / ln
            x = cx - 0.5 + math.cos(ang) * k + math.cos(ang) * t * t * 2
            y = root_y + math.sin(ang) * k + t * t * 3
            leaves.add((int(round(x)), int(round(y))))
            if 0.15 < t < 0.85:
                leaves.add((int(round(x + math.sin(ang))), int(round(y))))
    leaves |= ellipse_mask(cx, root_y - 4, 4.5, 3.5)
    leaves = {(x, y) for (x, y) in leaves if x0 <= x < x0 + 16 and y0 - 10 <= y < y0 + 13}
    fill(leaves, M[2])
    for x, y in leaves:
        if (x, y - 1) not in leaves or (x - 1, y) not in leaves:
            px(x, y, M[3])
        elif (x, y + 1) not in leaves or (x + 1, y) not in leaves:
            px(x, y, M[1])
    outline_outer(leaves, M[0], x0, y0 - 10, x0 + 15, y0 + 15)
    blooms = L[2] if kind in ("stonepot", "wild") else (S[5] if kind == "tub" else L[3])
    tips = sorted(leaves, key=lambda p: (p[1], p[0]))
    count = 0
    placed = []
    for x, y in tips:
        if count >= 10:
            break
        if (x, y - 1) not in leaves and hsh(x, y, 451) < 0.6 and all(abs(x - a) + abs(y - b) > 2 for a, b in placed):
            placed.append((x, y))
            c = blooms if hsh(x, y, 452) < 0.75 else (S[5] if blooms != S[5] else L[2])
            px(x, y - 1, c)
            px(x + 1, y - 1, DOWN[c] if c != S[5] else S[4])
            px(x, y - 2, UP[c] if c != S[5] else S[5])
            count += 1
    claim(pot | leaves)
    cast(pot, 3)


def desk():
    x0, x1 = 32, 159
    top = rect_mask(x0 + 1, 130, x1 - 1, 147)
    front = rect_mask(x0 + 2, 148, x1 - 2, 168)
    legs = set()
    for lx in (x0 + 2, x0 + 63, x1 - 9):
        for y in range(166, 176):
            spread = (y - 166) // 3
            for x in range(lx - spread, lx + 8 + spread):
                if x0 <= x <= x1:
                    legs.add((x, y))
    allm = top | front | legs
    fill(front, B[2])
    for x in range(x0 + 2, x1 - 1):
        vn = vnoise(x, 0, 3, 460)
        if vn > 0.62:
            vline(x, 149, 167, B[1])
        elif vn < 0.3:
            vline(x, 149, 167, B[3] if bayer(x, 0) < 0.5 else B[2])
    for i in range(4):
        px0 = x0 + 6 + i * 31
        rect(px0, 151, px0 + 24, 164, B[1])
        hline(px0, px0 + 24, 151, B[0])
        vline(px0, 151, 164, B[0])
        hline(px0 + 1, px0 + 24, 164, B[3])
        vline(px0 + 24, 152, 164, B[3])
        for x in range(px0 + 2, px0 + 23):
            for y in range(153, 163):
                if bayer(x, y) < 0.25:
                    px(x, y, B[2])
        rect(px0 + 10, 156, px0 + 14, 158, B[3])
        px(px0 + 12, 157, G[2])
        outline(rect_mask(px0 + 10, 156, px0 + 14, 158), B[0])
    fill(legs, B[2])
    for x, y in legs:
        if (x - 1, y) not in legs:
            px(x, y, B[3])
        if (x + 1, y) not in legs:
            px(x, y, B[1])
    fill(top, B[3])
    for y in range(131, 147):
        for x in range(x0 + 2, x1 - 1):
            if vnoise(x * 0.3, y, 2, 461) > 0.68:
                px(x, y, S[4])
            elif vnoise(x * 0.3, y, 2, 462) > 0.75:
                px(x, y, B[2])
    hline(x0 + 2, x1 - 2, 131, S[4])
    hline(x0 + 1, x1 - 1, 147, B[1])
    hline(x0 + 1, x1 - 1, 146, B[2])
    outline(allm, B[0])
    for y in range(148, 169):
        px(x0 + 2, y, B[0])
        px(x1 - 2, y, B[0])
    for x in range(x0 + 4, x1 - 3):
        if vnoise(x, 1, 4, 463) > 0.62:
            px(x, 168, M[2])
            px(x, 167, M[3] if hsh(x, 1, 464) < 0.5 else M[2])
            if hsh(x, 2, 465) < 0.12:
                px(x, 166, L[2])
    for bx, by in ((x0 + 10, 135), (x0 + 76, 136)):
        page = rect_mask(bx, by, bx + 17, by + 7)
        fill(page, S[5])
        for x, y in page:
            if x > bx + 8:
                px(x, y, S[4])
        vline(bx + 8, by, by + 7, S[3])
        for y in range(by + 2, by + 7, 2):
            hline(bx + 2, bx + 6, y, S[3])
            hline(bx + 10, bx + 15 - (y % 3), y, B[2])
        outline(page, B[1])
        hline(bx + 1, bx + 16, by + 8, B[1])
    for x, y in ((x0 + 13, 140), (x0 + 15, 139)):
        px(x, y, L[2])
        px(x + 1, y + 1, M[2])
    ink = ellipse_mask(x0 + 35, 140, 2.6, 2.6)
    fill(ink, L[0])
    px(x0 + 34, 139, L[2])
    outline(ink, K)
    for k in range(7):
        px(x0 + 36 + k // 2, 138 - k, S[5] if k > 1 else S[4])
    stack = [(x0 + 44, 143, 13, L[1], L[0]), (x0 + 45, 140, 11, R[1], R[0]), (x0 + 43, 137, 12, M[2], M[1])]
    for sx, sy, sw, c1, c2 in stack:
        rect(sx, sy, sx + sw, sy + 2, c1)
        hline(sx, sx + sw, sy + 2, c2)
        hline(sx + 1, sx + sw - 1, sy, UP[c1])
        vline(sx + sw, sy, sy + 2, S[4])
        outline(rect_mask(sx, sy, sx + sw, sy + 2), K)
    cnd = rect_mask(x0 + 64, 132, x0 + 66, 139)
    fill(cnd, S[5])
    vline(x0 + 66, 132, 139, S[4])
    outline(cnd, S[2])
    px(x0 + 65, 131, B[1])
    px(x0 + 65, 129, G[2])
    px(x0 + 65, 130, G[3])
    px(x0 + 65, 128, G[1])
    hline(x0 + 62, x0 + 68, 140, B[1])
    mp = rect_mask(x0 + 98, 137, x0 + 113, 143)
    fill(mp, S[4])
    for x, y in mp:
        if vnoise(x, y, 3, 466) > 0.6:
            px(x, y, M[3])
    for k in range(12):
        px(x0 + 100 + k, 140 + int(round(math.sin(k * 0.7))), B[2] if k % 2 else B[1])
    px(x0 + 109, 139, R[0])
    vline(x0 + 105, 137, 143, S[3])
    outline(mp, B[1])
    glass = rect_mask(x0 + 118, 136, x0 + 122, 142)
    fill(glass, L[2])
    vline(x0 + 122, 136, 142, L[1])
    px(x0 + 119, 137, L[3])
    outline(glass, K)
    for x, y, c in ((x0 + 119, 133, L[2]), (x0 + 121, 132, S[5]), (x0 + 120, 134, M[2]), (x0 + 122, 134, M[2]), (x0 + 118, 134, M[2]), (x0 + 120, 131, L[3])):
        px(x, y, c)
    claim(allm)
    cast(front | legs, 3)


def starglass_table():
    x0, x1 = 496, 607
    top = rect_mask(x0 + 2, 144, x1 - 2, 155)
    front = rect_mask(x0 + 3, 156, x1 - 3, 166)
    peds = set()
    for lx in (x0 + 8, x1 - 22):
        for y in range(166, 176):
            spread = 1 if y > 172 else 0
            for x in range(lx - spread, lx + 15 + spread):
                peds.add((x, y))
    stones(peds, x0, 166, 7, 5, 470, tones=(S[3], F[1]))
    fill(top, S[4])
    for x, y in top:
        if vnoise(x, y, 4, 471) > 0.68 and bayer(x, y) < 0.5:
            px(x, y, S[5])
        if vnoise(x, y, 5, 472) < 0.25 and bayer(x, y) < 0.3:
            px(x, y, S[3])
    hline(x0 + 3, x1 - 3, 145, S[5])
    hline(x0 + 2, x1 - 2, 154, S[3])
    hline(x0 + 2, x1 - 2, 155, S[3])
    stones(front, x0 + 3, 156, 13, 6, 473, tones=(S[3], S[3], F[1]))
    allm = top | front | peds
    outline(allm, K)
    for x in range(x0 + 5, x1 - 4):
        if vnoise(x, 2, 4, 474) > 0.6:
            px(x, 166, M[2])
            px(x, 165, M[3])
            if hsh(x, 3, 475) < 0.15:
                px(x, 164, L[2])
    chart = rect_mask(x0 + 10, 146, x0 + 36, 153)
    fill(chart, S[5])
    for x, y in chart:
        if (x + 1, y) not in chart or (x, y + 1) not in chart:
            px(x, y, S[4])
    stars = [(x0 + 13, 148), (x0 + 18, 151), (x0 + 23, 147), (x0 + 28, 150), (x0 + 33, 148), (x0 + 31, 152)]
    for (ax, ay), (bx, by) in zip(stars, stars[1:]):
        steps = max(abs(bx - ax), abs(by - ay))
        for k in range(1, steps):
            if k % 2 == 0:
                px(round(ax + (bx - ax) * k / steps), round(ay + (by - ay) * k / steps), L[2])
    for x, y in stars:
        px(x, y, L[0])
    outline(chart, S[2])
    px(x0 + 9, 146, B[3])
    px(x0 + 9, 153, B[3])
    px(x0 + 37, 146, B[3])
    px(x0 + 37, 153, B[3])
    comp = ellipse_mask(x0 + 51.5, 150.5, 3.5, 3)
    fill(comp, G[1])
    inner = ellipse_mask(x0 + 51.5, 150.5, 2.2, 1.8)
    fill(inner, S[5])
    px(x0 + 51, 149, R[0])
    px(x0 + 52, 151, L[0])
    outline(comp, B[0])
    cnd = rect_mask(x0 + 41, 145, x0 + 43, 152)
    fill(cnd, S[5])
    vline(x0 + 43, 145, 152, S[4])
    outline(cnd, S[2])
    px(x0 + 42, 144, B[1])
    px(x0 + 42, 143, G[3])
    px(x0 + 42, 142, G[2])
    hline(x0 + 39, x0 + 45, 153, B[1])
    orb_pool(top)
    stand = set()
    for y in range(144, 152):
        w = 2 if y < 149 else 4
        for x in range(567 - w, 568 + w):
            stand.add((x, y))
    fill(stand, G[1])
    for x, y in stand:
        if x < 566:
            px(x, y, G[2])
        if x > 568:
            px(x, y, G[0])
    outline(stand, B[0])
    hline(561, 574, 152, S[3])
    ball = ellipse_mask(567.5, 138.5, 7.5, 7.5)
    fill(ball, L[2])
    for x, y in ball:
        d = math.hypot(x + 0.5 - 565.5, y + 0.5 - 135.5)
        if d < 3.6:
            px(x, y, L[3])
        if x + y > 567 + 138 + 4:
            px(x, y, L[1])
        if x + y > 567 + 138 + 8:
            px(x, y, L[0])
    px(568, 139, G[3])
    px(567, 139, G[2])
    px(569, 139, G[2])
    px(568, 138, G[2])
    px(568, 140, G[2])
    px(564, 134, S[5])
    px(563, 135, S[5])
    outline(ball, K)
    for x, y in ((560, 131), (576, 133), (573, 128), (559, 143)):
        px(x, y, L[3])
    bk = rect_mask(x0 + 86, 145, x0 + 100, 150)
    fill(bk, R[1])
    hline(x0 + 86, x0 + 100, 145, S[4])
    hline(x0 + 86, x0 + 100, 146, S[5])
    vline(x0 + 100, 145, 150, R[0])
    hline(x0 + 87, x0 + 99, 148, G[1])
    outline(bk, K)
    flw = [(x0 + 102, 151, L[2]), (x0 + 104, 150, S[5]), (x0 + 103, 152, M[2])]
    for x, y, c in flw:
        px(x, y, c)
    claim(allm | ball | stand)
    cast(front | peds, 3)


def orb_pool(top):
    wide = ellipse_mask(567.5, 150, 13, 4.5) & top
    core = ellipse_mask(567.5, 150.5, 7, 2.5)
    for x, y in wide:
        if (x, y) in core or bayer(x, y) < 0.5:
            px(x, y, L[3])


def counter_runner(xa, xb, y0, y1):
    rect(xa, y0 + 1, xb, y0 + 5, L[2])
    hline(xa, xb, y0 + 1, L[3])
    for y in range(y0 + 1, y1 - 1):
        k = max(0, y - (y1 - 6))
        if y > y0 + 5:
            hline(xa + k, xb - k, y, L[1])
            px(xb - k, y, L[0])
        px(xa + 1 + k, y, G[2])
        px(xb - 1 - k, y, G[2] if y <= y0 + 5 else G[1])
    mx = (xa + xb) // 2
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
        px(mx + dx, y0 + 9 + dy, S[5])
    px(mx, y0 + 9, G[3])
    px(mx, y1 - 1, G[2])
    px(mx + 1, y1 - 1, G[1])


def reception():
    x0, x1, y0, y1 = 256, 383, 80, 95
    stone_counter(x0, x1, y0, y1, 480)
    hline(x0 + 1, x1 - 1, y0 + 2, S[5])
    counter_runner(x0 + 50, x0 + 65, y0, y1)
    gb = rect_mask(x0 + 26, y0, x0 + 45, y0 + 4)
    fill(gb, S[5])
    vline(x0 + 35, y0, y0 + 4, S[3])
    for y in (y0 + 1, y0 + 3):
        hline(x0 + 28, x0 + 33, y, S[2])
        hline(x0 + 37, x0 + 43 - (y % 2), y, S[2])
    outline(gb, B[1])
    hline(x0 + 25, x0 + 46, y0 + 5, R[0])
    bell = ellipse_mask(x0 + 76, y0 + 1, 3, 3)
    bell = {(x, y) for (x, y) in bell if y <= y0 + 2}
    fill(bell, G[2])
    px(x0 + 75, y0 - 1, G[3])
    outline(bell, G[0])
    hline(x0 + 72, x0 + 79, y0 + 3, S[2])
    px(x0 + 76, y0 - 3, G[0])
    vase(x0 + 106, y0 + 2)
    cnd = rect_mask(x0 + 9, y0 - 4, x0 + 10, y0 + 2)
    fill(cnd, S[5])
    vline(x0 + 10, y0 - 4, y0 + 2, S[4])
    px(x0 + 9, y0 - 5, G[3])
    px(x0 + 9, y0 - 6, G[2])
    hline(x0 + 7, x0 + 12, y0 + 3, S[2])
    cloth = rect_mask(x0 + 90, y0 + 1, x0 + 98, y0 + 4)
    fill(cloth, L[1])
    hline(x0 + 90, x0 + 98, y0 + 1, L[2])
    outline(cloth, L[0])


def vase(x, ybot):
    m = set()
    for y in range(ybot - 6, ybot + 1):
        w = 1 if y < ybot - 4 else 2
        for xx in range(x - w, x + w + 1):
            m.add((xx, y))
    fill(m, L[1])
    for xx, y in m:
        if xx > x:
            px(xx, y, L[0])
    px(x - 1, ybot - 2, L[3])
    outline(m, K)
    for dx, dy, c in ((-3, -9, L[2]), (0, -11, S[5]), (2, -10, L[2]), (3, -8, L[3]), (-1, -8, M[2]), (1, -8, M[2]), (0, -9, M[1]), (-2, -10, M[3]), (2, -12, M[2])):
        px(x + dx, ybot + dy, c)


def stone_counter(x0, x1, y0, y1, seed):
    body = rect_mask(x0, y0, x1, y1)
    rect(x0, y0, x1, y0 + 5, S[4])
    hline(x0, x1, y0 + 1, S[5])
    for x in range(x0, x1 + 1):
        if hsh(x, 0, seed) < 0.2:
            px(x, y0 + 3, S[5])
        if hsh(x, 1, seed + 1) < 0.2:
            px(x, y0 + 4, S[3])
    hline(x0, x1, y0 + 5, S[3])
    front = rect_mask(x0 + 1, y0 + 6, x1 - 1, y1 - 1)
    stones(front, x0 + 1, y0 + 6, 12, 5, seed + 2, tones=(S[3], F[1], S[3], F[0]))
    hline(x0, x1, y0 + 6, S[2])
    outline(body, K)
    for x in range(x0 + 2, x1 - 1):
        n = vnoise(x, 0, 5, seed + 3)
        if n > 0.55:
            px(x, y1 - 1, M[2])
            px(x, y1 - 2, M[3] if n > 0.62 else M[2])
            if n > 0.7:
                px(x, y1 - 3, M[2])
            if hsh(x, 5, seed + 4) < 0.1:
                px(x, y1 - 3, L[2] if hsh(x, 6, seed + 5) < 0.7 else S[5])
    for x in range(x0 + 6, x1 - 6, 23):
        k = int(hsh(x, 7, seed + 6) * 8)
        for j in range(4):
            px(x + k + (j % 2), y0 + 7 + j, M[2] if j < 3 else M[3])
    claim(body)
    cast(body, 3)


def rug_main():
    x0, x1, y0, y1 = 258, 381, 98, 157
    rmask = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            cx = min(max(x, x0 + 5), x1 - 5)
            cy = min(max(y, y0 + 5), y1 - 5)
            if (x - cx) ** 2 + (y - cy) ** 2 <= 25:
                rmask.add((x, y))
    fill(rmask, L[1])
    for x, y in rmask:
        if (x + y) % 4 == 0 and (x // 2 + y) % 2 == 0:
            px(x, y, L[2])
    for x, y in rmask:
        dx = min(x - x0, x1 - x)
        dy = min(y - y0, y1 - y)
        d = min(dx, dy)
        if d < 2:
            px(x, y, L[0])
        elif d < 5:
            px(x, y, S[4])
            if d == 3 and (x + y) % 6 < 2:
                px(x, y, L[2])
        elif d == 5:
            px(x, y, L[0])
        elif d == 7:
            px(x, y, S[4] if (x + y) % 4 else G[2])
    cx, cy = 320, 127
    for y in range(cy - 14, cy + 15):
        for x in range(cx - 26, cx + 27):
            dd = abs(x - cx) / 26.0 + abs(y - cy) / 14.0
            if dd <= 1.0:
                if dd > 0.86:
                    px(x, y, L[0])
                elif dd > 0.72:
                    px(x, y, S[4] if (x + y) % 3 else S[5])
                elif dd > 0.62:
                    px(x, y, L[0])
                else:
                    px(x, y, L[2] if (x + y) % 2 else L[1])
    for ang in range(8):
        a = ang * math.pi / 4
        for k in range(2, 9):
            x = cx + round(math.cos(a) * k * 1.6)
            y = cy + round(math.sin(a) * k * 0.85)
            px(x, y, S[5] if k < 6 else S[4])
    px(cx, cy, G[3])
    px(cx + 1, cy, G[2])
    for qx, qy in ((x0 + 16, y0 + 15), (x1 - 16, y0 + 15), (x0 + 16, y1 - 15), (x1 - 16, y1 - 15)):
        for k in (-2, -1, 0, 1, 2):
            px(qx + k, qy, S[4])
            px(qx, qy + k, S[4])
        px(qx, qy, G[2])
    for x, y in rmask:
        if vnoise(x, y, 6, 490) > 0.72 and bayer(x, y) < 0.4:
            lighten(x, y)
    for y in range(y0 + 6, y1 - 5, 2):
        px(x0 - 1, y, S[4])
        px(x0 - 2, y, S[5] if y % 4 == 0 else S[4])
        px(x1 + 1, y, S[4])
        px(x1 + 2, y, S[5] if y % 4 == 0 else S[4])
    for x, y in side_edges(rmask, 0, 1) | side_edges(rmask, 1, 0):
        px(x, y, L[0])
    for x, y in ((x0 + 2, y1 + 1), (x0 + 3, y1 + 1), (x1 - 4, y0 - 1)):
        px(x, y, M[2])
    px(x0 + 3, y1, L[2])


def rug_round():
    cx, cy = 87.5, 255.5
    m = ellipse_mask(cx, cy, 38.5, 30.5)
    for x, y in m:
        d = math.hypot((x + 0.5 - cx) / 38.5, (y + 0.5 - cy) / 30.5)
        band = int(d * 9)
        c = (M[3], S[4], M[3], M[2], S[4], L[1], M[3], S[4], M[2])[min(band, 8)]
        px(x, y, c)
        if c == M[3] and (x + 2 * y) % 5 == 0:
            px(x, y, M[2])
        if c == S[4] and (x + y) % 4 == 0:
            px(x, y, S[5])
    for x, y in side_edges(m, 0, 1) | side_edges(m, 1, 0):
        px(x, y, M[1])
    for x, y in side_edges(m, 0, -1) | side_edges(m, -1, 0):
        px(x, y, M[2])
    for a in range(0, 360, 20):
        x = cx + math.cos(math.radians(a)) * 34
        y = cy + math.sin(math.radians(a)) * 27
        px(int(x), int(y), L[2] if a % 40 == 0 else S[5])


def round_table(tx, ty, items):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 24
    topm = ellipse_mask(cx, y0 + 11, 22.5, 8.5)
    side = rect_mask(x0 + 2, y0 + 11, x0 + 45, y0 + 14) | ellipse_mask(cx, y0 + 14, 22, 5)
    side = {(x, y) for (x, y) in side if y >= y0 + 11}
    ped = rect_mask(cx - 5, y0 + 18, cx + 4, y0 + 28)
    feet = set()
    for d in (-1, 1):
        for k in range(5):
            for x in range(cx - 2 + d * (4 + k * 2), cx + 2 + d * (4 + k * 2)):
                feet.add((x, y0 + 26 + k // 2 + (k > 2)))
    feet |= rect_mask(cx - 7, y0 + 27, cx + 6, y0 + 30)
    feet = {(x, y) for (x, y) in feet if x0 <= x < x0 + 48 and y <= y0 + 31}
    base = ped | feet
    fill(base, B[2])
    for x, y in base:
        if (x - 1, y) not in base:
            px(x, y, B[3])
        elif (x + 1, y) not in base:
            px(x, y, B[1])
        elif (x + y) % 5 == 0:
            px(x, y, B[1])
    outline(base, B[0])
    fill(side, B[2])
    for x, y in side:
        if x < cx - 12:
            px(x, y, B[3] if (x % 4) else B[2])
        elif x % 5 == 0:
            px(x, y, B[1])
    fill(topm, B[3])
    for x, y in topm:
        d = math.hypot((x + 0.5 - cx) / 22.5, (y + 0.5 - y0 - 11) / 8.5)
        ring = int(d * 5 + vnoise(x, y, 5, 500 + tx) * 0.5)
        if ring % 2 == 0:
            px(x, y, S[4] if d < 0.5 else B[3])
        if d < 0.15:
            px(x, y, S[4])
    for x, y in topm:
        if (x, y - 1) not in topm and x < cx + 6:
            px(x, y, S[4])
    outline(topm | side, B[0])
    for k in range(6):
        x = x0 + 4 + k * 7
        if hsh(x, y0, 501) < 0.6:
            px(x, y0 + 16 + (k % 2), M[2])
            px(x + 1, y0 + 17, M[3] if k % 2 else M[1])
    for kind, dx, dy in items:
        draw_item(kind, cx + dx, y0 + 11 + dy)
    allm = topm | side | base
    claim(allm)
    cast(side | base, 3)


def draw_item(kind, x, y):
    if kind == "cup":
        rect(x - 1, y - 2, x + 1, y, S[5])
        px(x + 1, y - 1, S[4])
        hline(x - 1, x + 1, y - 2, B[2])
        px(x + 2, y - 1, S[3])
        hline(x - 2, x + 2, y + 1, B[1])
    elif kind == "teapot":
        m = ellipse_mask(x, y - 1, 4, 3.2)
        fill(m, S[5])
        for p in m:
            if p[0] > x + 1:
                px(p[0], p[1], S[4])
        hline(x - 3, x + 3, y - 1, L[1])
        px(x - 2, y - 3, S[5])
        outline(m, S[1])
        px(x + 4, y - 2, S[1])
        px(x + 5, y - 3, S[1])
        px(x - 5, y - 1, S[1])
        px(x - 5, y - 2, S[1])
        px(x, y - 5, L[0])
        hline(x - 3, x + 4, y + 2, B[1])
    elif kind == "candle":
        rect(x, y - 4, x + 1, y, S[5])
        px(x + 1, y - 3, S[4])
        px(x, y - 5, B[1])
        px(x, y - 6, G[3])
        px(x, y - 7, G[2])
        hline(x - 1, x + 2, y + 1, B[1])
    elif kind == "map":
        m = rect_mask(x - 6, y - 3, x + 6, y + 2)
        fill(m, S[4])
        for p in m:
            if hsh(p[0], p[1], 510) < 0.14:
                px(p[0], p[1], M[3])
        hline(x - 4, x + 3, y - 1, B[2])
        px(x + 2, y, R[0])
        vline(x - 2, y - 2, y + 1, L[1])
        outline(m, B[1])
        vline(x - 7, y - 3, y + 2, B[3])
        vline(x + 7, y - 3, y + 2, B[3])
    elif kind == "vase":
        vase(x, y + 1)
    elif kind == "bread":
        m = ellipse_mask(x, y - 1, 4, 2.2)
        fill(m, G[1])
        for p in m:
            if (p[0], p[1] - 1) not in m:
                px(p[0], p[1], G[2])
        for k in (-2, 0, 2):
            px(x + k, y - 1, B[3])
        outline(m, B[1])
        hline(x - 3, x + 4, y + 2, B[1])
    elif kind == "book":
        m = rect_mask(x - 5, y - 2, x + 5, y + 1)
        fill(m, L[1])
        hline(x - 5, x + 5, y - 2, S[5])
        hline(x - 5, x + 5, y - 1, S[4])
        vline(x + 5, y - 2, y + 1, L[0])
        hline(x - 4, x + 4, y, G[1])
        outline(m, K)
    elif kind == "letter":
        m = rect_mask(x - 3, y - 2, x + 3, y + 1)
        fill(m, S[5])
        hline(x - 2, x + 2, y - 1, S[3])
        px(x, y, R[0])
        outline(m, S[2])


def pantry():
    x0, x1, y0, y1 = 400, 559, 192, 239
    body = rect_mask(x0, y0, x1, y1)
    fill(body, B[1])
    for x in range(x0, x1 + 1):
        for y in range(y0 + 6, y1):
            if bayer(x, y) < 0.25:
                px(x, y, B[0])
            if vnoise(x, y, 3, 520) > 0.74:
                px(x, y, B[2])
    rect(x0, y0, x1, y0 + 5, B[3])
    hline(x0, x1, y0 + 1, S[5])
    hline(x0, x1, y0 + 5, B[1])
    for x in range(x0, x1 + 1):
        if hsh(x, 0, 521) < 0.25:
            px(x, y0 + 3, S[4])
        if abs(x - 480) < 16:
            px(x, y0 + 1, G[3] if abs(x - 480) < 9 else G[2])
    for ya, yb in ((215, 217), (235, 239)):
        rect(x0, ya, x1, yb, B[3])
        hline(x0, x1, ya, S[4])
        hline(x0, x1, yb, B[1])
        if yb - ya > 2:
            hline(x0, x1, yb - 1, B[2])
            for x in range(x0 + 8, x1 - 4, 26):
                rect(x, ya + 1, x + 10, yb - 1, B[2])
                px(x + 5, ya + 2, G[2])
    posts = [x0, x0 + 52, x0 + 105, x1 - 4]
    for pp in posts:
        for y in range(y0 + 6, y1):
            wob = 1 if math.sin(y * 0.4 + pp) > 0.7 else 0
            px(pp + wob, y, B[3])
            px(pp + 1 + wob, y, B[2])
            px(pp + 2 + wob, y, B[2])
            px(pp + 3 + wob, y, B[1])
    outline(body, B[0])
    rr = random.Random(17)
    hues = [(L[2], L[1], K), (R[1], R[0], B[0]), (M[3], M[2], M[0]), (L[1], L[0], K), (S[5], S[4], S[1])]
    bays = ((x0 + 5, x0 + 50), (x0 + 57, x0 + 103), (x0 + 110, x1 - 6))
    for bi, (sa, sb) in enumerate(bays):
        for floor_y in (214, 234):
            x = sa + rr.randint(0, 2)
            if bi == 1 and floor_y == 234:
                linens(x, floor_y, sb)
                continue
            while x < sb - 3:
                kind = rr.choice(("jar", "tin", "bottle", "jar", "tin", "bottle", "vial"))
                c1, c2, ink = rr.choice(hues)
                if kind == "jar":
                    c1, c2, ink = rr.choice(((G[2], G[1], G[0]), (R[1], R[0], B[0]), (M[3], M[2], M[0])))
                    if x + 8 > sb:
                        break
                    m = rect_mask(x, floor_y - 7, x + 7, floor_y)
                    m -= {(x, floor_y - 7), (x + 7, floor_y - 7), (x, floor_y), (x + 7, floor_y)}
                    fill(m, c1)
                    for p in m:
                        if p[0] >= x + 5:
                            px(p[0], p[1], c2)
                    px(x + 2, floor_y - 5, S[5])
                    px(x + 2, floor_y - 4, S[5])
                    outline(m, ink)
                    rect(x + 1, floor_y - 9, x + 6, floor_y - 8, S[4])
                    hline(x + 1, x + 6, floor_y - 9, S[5])
                    px(x + 1, floor_y - 8, R[0])
                    px(x + 6, floor_y - 8, R[0])
                    x += 9
                elif kind == "tin":
                    if x + 7 > sb:
                        break
                    m = rect_mask(x, floor_y - 8, x + 5, floor_y)
                    fill(m, c1)
                    vline(x + 5, floor_y - 8, floor_y, c2)
                    hline(x, x + 5, floor_y - 8, S[4])
                    hline(x, x + 5, floor_y - 4, S[5])
                    outline(m, K)
                    x += 7
                elif kind == "bottle":
                    if x + 6 > sb:
                        break
                    m = rect_mask(x, floor_y - 7, x + 4, floor_y)
                    fill(m, c1)
                    vline(x + 3, floor_y - 7, floor_y, c2)
                    outline(m, K)
                    rect(x + 1, floor_y - 11, x + 3, floor_y - 8, c2)
                    vline(x + 2, floor_y - 11, floor_y - 8, c1)
                    hline(x + 1, x + 3, floor_y - 12, B[2])
                    px(x + 1, floor_y - 5, S[5])
                    hline(x + 1, x + 3, floor_y - 3, S[4])
                    x += 6
                else:
                    if x + 4 > sb:
                        break
                    m = rect_mask(x, floor_y - 5, x + 2, floor_y)
                    fill(m, c1)
                    outline(m, ink)
                    px(x + 1, floor_y - 6, B[2])
                    px(x + 1, floor_y - 3, S[5])
                    x += 4
                x += rr.randint(0, 2)
    for bx, c1, c2, ln in ((x0 + 22, R[1], B[2], 8), (x0 + 78, L[1], L[0], 10), (x0 + 132, G[1], B[2], 7), (x0 + 145, S[4], S[3], 9)):
        dried_bundle(bx, y0 + 5, c1, c2, ln)
    for x in range(x0 + 2, x1 - 1):
        if vnoise(x, 1, 5, 522) > 0.62:
            px(x, y0 + 2, M[2])
            px(x, y0 + 1, M[3])
            if hsh(x, 2, 523) < 0.15:
                px(x, y0, L[2])
    claim(body)
    cast(rect_mask(x0, y1 - 3, x1, y1), 3)
    shelf_lamp(480, y0)


def shelf_lamp(cx, base):
    glass = rect_mask(cx - 2, base - 6, cx + 2, base - 1)
    fill(glass, G[2])
    rect(cx - 1, base - 4, cx, base - 2, G[3])
    vline(cx + 1, base - 5, base - 2, G[1])
    outline(glass, K)
    px(cx, base - 4, G[3])
    px(cx, base - 3, G[3])
    hline(cx - 1, cx + 1, base - 7, S[2])
    px(cx, base - 8, K)
    claim(glass)


def linens(x, floor_y, end):
    for i, c in enumerate((S[5], L[2], S[4], R[1], S[5])):
        y = floor_y - i * 2
        m = rect_mask(x + (i % 2), y - 1, end - 8 - (i % 2), y)
        fill(m, c)
        hline(x + (i % 2), end - 8 - (i % 2), y - 1, UP[c] if c != S[5] else S[5])
        px(end - 8 - (i % 2), y, DOWN[c] if c != S[5] else S[4])
    hline(x, end - 8, floor_y - 10, K)
    cup = rect_mask(end - 6, floor_y - 4, end - 2, floor_y)
    fill(cup, S[5])
    vline(end - 2, floor_y - 4, floor_y, S[4])
    hline(end - 6, end - 2, floor_y - 2, L[1])
    outline(cup, S[1])


def bar_counter():
    x0, x1, y0, y1 = 384, 575, 256, 271
    stone_counter(x0, x1, y0, y1, 530)
    for kind, x in (("cup", 398), ("teapot", 420), ("cup", 434), ("bread", 470), ("vase", 500), ("cup", 528), ("letter", 548), ("candle", 566)):
        draw_item(kind, x, y0 + 3)


def stool(tx, ty):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 8
    leg = rect_mask(cx - 3, y0 + 7, cx + 2, y0 + 13)
    feet = {(cx - 4, y0 + 13), (cx + 3, y0 + 13), (cx - 4, y0 + 14), (cx + 3, y0 + 14)} | rect_mask(cx - 3, y0 + 13, cx + 2, y0 + 14)
    base = leg | feet
    fill(base, B[2])
    for x, y in base:
        if x == cx - 3:
            px(x, y, B[3])
        if x == cx + 2:
            px(x, y, B[1])
    outline(base, B[0])
    seat = ellipse_mask(cx, y0 + 6, 6.5, 3.5)
    rim = ellipse_mask(cx, y0 + 7, 6.5, 3.5)
    fill(rim - seat, B[2])
    fill(seat, L[1])
    for x, y in seat:
        d = math.hypot((x + 0.5 - cx + 1.5) / 6.5, (y + 0.5 - y0 - 5) / 3.5)
        if d < 0.55:
            px(x, y, L[2])
        if d < 0.2:
            px(x, y, L[3])
    px(cx, y0 + 6, L[0])
    outline(seat | rim, B[0])
    claim(seat | rim | base)
    cast(base | rim, 2)


def luggage(tx, ty, kind):
    x0, y0 = tx * 16, ty * 16
    if kind == "case":
        body = rect_mask(x0 + 1, y0 + 1, x0 + 14, y0 + 15)
        fill(body, B[2])
        rect(x0 + 1, y0 + 1, x0 + 14, y0 + 4, B[3])
        hline(x0 + 2, x0 + 13, y0 + 2, S[4])
        hline(x0 + 1, x0 + 14, y0 + 5, B[1])
        vline(x0 + 13, y0 + 6, y0 + 14, B[1])
        vline(x0 + 2, y0 + 6, y0 + 14, B[3])
        for sx in (x0 + 4, x0 + 11):
            vline(sx, y0 + 1, y0 + 15, B[0])
            px(sx, y0 + 9, G[1])
        rect(x0 + 7, y0 + 6, x0 + 8, y0 + 7, G[2])
        px(x0 + 8, y0 + 7, G[1])
        for cx, cy in ((x0 + 1, y0 + 15), (x0 + 14, y0 + 15), (x0 + 1, y0 + 1), (x0 + 14, y0 + 1)):
            px(cx, cy, G[1])
        outline(body, B[0])
        handle = {(x0 + 6, y0), (x0 + 6, y0 - 1), (x0 + 7, y0 - 2), (x0 + 8, y0 - 2), (x0 + 9, y0 - 1), (x0 + 9, y0)}
        fill(handle, B[0])
        px(x0 + 12, y0 + 12, R[1])
        px(x0 + 12, y0 + 13, S[5])
        allm = body | handle
    elif kind == "crate":
        body = rect_mask(x0 + 1, y0 + 2, x0 + 14, y0 + 15)
        fill(body, B[3])
        for y in (y0 + 6, y0 + 10):
            hline(x0 + 1, x0 + 14, y, B[1])
            hline(x0 + 1, x0 + 14, y + 1, B[2])
        vline(x0 + 13, y0 + 2, y0 + 15, B[2])
        vline(x0 + 2, y0 + 3, y0 + 14, S[4])
        for k in range(12):
            px(x0 + 2 + k, y0 + 14 - k, B[1])
        rect(x0 + 1, y0 + 2, x0 + 14, y0 + 4, B[1])
        outline(body, B[0])
        tops = set()
        for i in range(7):
            fx = x0 + 2 + i * 2
            h = 2 + int(hsh(fx, y0, 540) * 4)
            for k in range(h):
                tops.add((fx + (k % 2 if i % 2 else 0), y0 + 3 - k))
        fill(tops, M[2])
        for x, y in tops:
            if (x, y - 1) not in tops:
                c = L[2] if hsh(x, y, 541) < 0.6 else S[5]
                px(x, y - 1, c)
        allm = body | tops
    else:
        body = rect_mask(x0 + 2, y0 + 6, x0 + 13, y0 + 15)
        fill(body, B[2])
        hline(x0 + 2, x0 + 13, y0 + 6, B[3])
        vline(x0 + 13, y0 + 7, y0 + 15, B[1])
        px(x0 + 7, y0 + 10, G[2])
        outline(body, B[0])
        roll = set()
        for y in range(y0, y0 + 7):
            for x in range(x0 + 1, x0 + 15):
                roll.add((x, y))
        roll -= {(x0 + 1, y0), (x0 + 14, y0), (x0 + 1, y0 + 6), (x0 + 14, y0 + 6)}
        fill(roll, L[1])
        for x, y in roll:
            if y == y0 + 1:
                px(x, y, L[2])
            if y == y0 + 5:
                px(x, y, L[0])
        for y in range(y0 + 1, y0 + 6):
            px(x0 + 2, y, S[4])
        px(x0 + 2, y0 + 3, S[3])
        for sx in (x0 + 5, x0 + 11):
            vline(sx, y0, y0 + 6, R[0])
        outline(roll, K)
        allm = body | roll
    claim(allm)
    cast(allm, 3)


def lamp(tx, ty):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 8
    foot = rect_mask(cx - 5, y0 + 12, cx + 4, y0 + 15)
    stones(foot, cx - 5, y0 + 12, 5, 2, 550 + tx, tones=(S[4], S[3]))
    outline(foot, K)
    shaft = rect_mask(cx - 2, y0 + 3, cx + 1, y0 + 11)
    fill(shaft, S[3])
    vline(cx - 2, y0 + 3, y0 + 11, S[5])
    vline(cx + 1, y0 + 3, y0 + 11, S[2])
    for y in (y0 + 6, y0 + 9):
        hline(cx - 1, cx, y, S[2])
    outline(shaft, K)
    head = rect_mask(cx - 3, y0 - 3, cx + 2, y0 + 3)
    fill(head, G[2])
    for x, y in head:
        if abs(x + 0.5 - cx) < 1.5 and y0 - 2 <= y <= y0 + 1:
            px(x, y, G[3])
    vline(cx + 2, y0 - 3, y0 + 3, G[1])
    outline(head, K)
    hline(cx - 4, cx + 3, y0 + 3, S[4])
    hline(cx - 4, cx + 3, y0 + 4, K)
    cap = set()
    for k in range(3):
        for x in range(cx - 4 + k, cx + 4 - k):
            cap.add((x, y0 - 4 - k))
    fill(cap, S[4])
    for x, y in cap:
        if x >= cx + 1:
            px(x, y, S[3])
    outline_outer(cap, K, x0, y0 - 8, x0 + 15, y0 - 3)
    px(cx - 1, y0 - 8, K)
    px(cx, y0 - 8, K)
    px(cx - 6, y0 + 14, M[2])
    px(cx - 6, y0 + 13, M[3])
    px(cx + 5, y0 + 13, L[2])
    allm = foot | shaft | head | cap
    claim(allm)
    cast(foot | shaft, 2)


MAP_REGIONS = {
    (False, False): (G[1], G[2]),
    (True, False): (M[2], M[3]),
    (False, True): (V[0], V[1]),
    (True, True): (L[1], L[2]),
}


def map_regions(xa, ya, xb, yb):
    region = {}
    for y in range(ya + 1, yb):
        for x in range(xa + 1, xb):
            dx = x + 0.5 - ((xa + xb + 1) / 2 + math.sin((y - ya) * 0.9) * 1.3)
            dy = y + 0.5 - ((ya + yb + 1) / 2 + math.sin((x - xa) * 0.8 + 1) * 1.3)
            if abs(dx) < 0.6 or abs(dy) < 0.6:
                continue
            region[(x, y)] = (dx > 0, dy > 0)
    for (x, y), key in region.items():
        lo, hi = MAP_REGIONS[key]
        px(x, y, hi if region.get((x, y - 1)) != key else lo)


def world_map():
    x0, y0, x1, y1 = 288, 350, 301, 365
    board = rect_mask(x0, y0, x1, y1)
    fill(board, S[5])
    hline(x0 + 1, x1 - 1, y0 + 1, B[3])
    hline(x0 + 1, x1 - 1, y1 - 1, B[2])
    map_regions(x0 + 1, y0 + 2, x1 - 1, y1 - 2)
    outline(board, B[0])
    legs = rect_mask(x0 + 1, y1 + 1, x0 + 2, y1 + 2) | rect_mask(x1 - 2, y1 + 1, x1 - 1, y1 + 2)
    fill(legs, B[0])
    px(x0 + 1, y1 + 1, B[3])
    px(x1 - 2, y1 + 1, B[3])
    px(x0 + 2, y0 - 1, M[2])
    px(x0 + 3, y0 - 1, L[2])
    claim(board | legs)
    cast(board | legs, 2)


def doorstep():
    slab = rect_mask(306, 361, 333, 366)
    stones(slab, 306, 361, 10, 3, 562, tones=(S[4], S[5], S[4]))
    hline(307, 332, 362, S[5])
    outline(slab, S[2])


def door_leaves():
    x0, x1, y0, y1 = 304, 335, 368, 383
    leaves = rect_mask(x0, y0, x1, y1)
    fill(leaves, L[1])
    for x, y in leaves:
        if (x - x0) % 5 == 0:
            px(x, y, L[0])
        elif (x - x0) % 5 == 1:
            px(x, y, L[2])
    hline(x0 + 1, x1 - 1, y0 + 1, L[3])
    for ry in (y0 + 4, y0 + 11):
        hline(x0 + 1, x1 - 1, ry, L[2])
        hline(x0 + 1, x1 - 1, ry + 1, L[0])
        for hx in (x0 + 1, x1 - 4):
            rect(hx, ry, hx + 3, ry + 1, K)
    vline(319, y0 + 1, y1, L[0])
    vline(320, y0 + 1, y1, K)
    vline(321, y0 + 2, y1, L[2])
    for kx in (316, 323):
        rect(kx, y0 + 7, kx + 1, y0 + 8, G[2])
        px(kx, y0 + 7, G[3])
        px(kx + 1, y0 + 9, L[0])
    outline(leaves, K)
    claim(leaves)


def door_post(ex):
    post = rect_mask(ex - 3, 365, ex + 3, 383)
    stones(post, ex - 3, 365, 7, 5, 563 + ex, tones=(S[4], S[5], F[1]))
    hline(ex - 2, ex + 2, 366, S[5])
    outline(post, K)
    side = 4 if ex > 320 else -4
    for k in range(6):
        px(ex + side + (k % 2), 370 + k, M[2] if k % 3 else M[3])
    px(ex + side, 369, L[2] if ex < 320 else S[5])
    claim(post)


def door():
    doorstep()
    world_map()
    door_leaves()
    for ex in (300, 339):
        door_post(ex)


def light_shaft(wx, wy, slope, half, length, strength):
    for y in range(wy, wy + length):
        t = (y - wy) / float(length)
        cxs = wx + (y - wy) * slope
        hw = half + t * 5
        for x in range(int(cxs - hw) - 1, int(cxs + hw) + 2):
            if not inside(x, y) or not floor[y][x]:
                continue
            d = abs(x + 0.5 - cxs) / hw
            if d >= 1:
                continue
            fade = 1.0 if t < 0.75 else (1 - t) / 0.25
            if t < 0.08:
                fade *= t / 0.08
            thr = 0.5 if d < 0.6 else 0.25
            if bayer(x, y) < thr * fade * strength * 2:
                lighten(x, y, 1, COOL)


def cool_corners():
    for y in range(48, 368):
        for x in range(16, 624):
            if not floor[y][x]:
                continue
            dx = (x - 320) / 320.0
            dy = (y - 200) / 200.0
            v = dx * dx + dy * dy
            if v > 1.05 + bayer(x, y) * 0.35:
                darken(x, y)


def stove_nook():
    x0, x1 = 496, 623
    counter = rect_mask(x0 + 1, 56, x1 - 1, 79)
    rect(x0 + 1, 56, x1 - 1, 61, S[4])
    hline(x0 + 2, x1 - 2, 56, S[5])
    hline(x0 + 2, x1 - 2, 57, S[5])
    hline(x0 + 1, x1 - 1, 61, S[3])
    for x in range(x0 + 2, x1 - 1):
        if hsh(x, 58, 570) < 0.15:
            px(x, 59, S[5])
    front = rect_mask(x0 + 2, 62, x1 - 2, 78)
    stones(front, x0 + 2, 62, 14, 6, 571, tones=(S[3], F[1], S[3]))
    hline(x0 + 1, x1 - 1, 62, S[2])
    outline(counter, K)
    for x in range(x0 + 3, x1 - 2):
        n = vnoise(x, 0, 5, 572)
        if n > 0.55:
            px(x, 78, M[2])
            px(x, 77, M[3] if n > 0.62 else M[2])
            if hsh(x, 1, 573) < 0.12:
                px(x, 76, L[2])
    pipe = rect_mask(523, 10, 527, 36)
    fill(pipe, S[2])
    vline(523, 10, 36, S[3])
    vline(527, 10, 36, S[1])
    outline(pipe, K)
    for y in (16, 28):
        hline(522, 528, y, K)
        hline(522, 528, y + 1, S[3])
    stove = rect_mask(503, 36, 532, 60)
    fill(stove, S[2])
    for x, y in stove:
        if x < 507:
            px(x, y, S[3])
        if x > 528:
            px(x, y, S[1])
    rect(502, 36, 533, 39, S[3])
    hline(503, 532, 36, S[4])
    outline(rect_mask(502, 36, 533, 39), K)
    door_mask = rect_mask(509, 44, 526, 55)
    fill(door_mask, G[1])
    for x, y in door_mask:
        d = math.hypot((x + 0.5 - 517.5) / 9, (y + 0.5 - 52) / 6)
        if d < 0.5:
            px(x, y, G[3])
        elif d < 0.85:
            px(x, y, G[2])
    for x in range(511, 526, 3):
        vline(x, 44, 55, K)
    outline(door_mask, K)
    hline(508, 527, 43, S[2])
    outline(stove, K)
    for fx in (505, 529):
        rect(fx, 61, fx + 1, 63, K)
    kettle(511, 35)
    sink = ellipse_mask(560, 58, 14, 4.5)
    fill(sink, S[5])
    water = ellipse_mask(560, 58.5, 11, 3)
    fill(water, L[2])
    for x, y in water:
        if (x, y - 1) not in water:
            px(x, y, L[1])
        if hsh(x, y, 574) < 0.1:
            px(x, y, L[3])
    outline(sink, S[2])
    jug = set()
    for y in range(46, 59):
        w = 2 if y < 49 else (4 if y < 57 else 3)
        for x in range(584 - w, 585 + w):
            jug.add((x, y))
    fill(jug, L[1])
    for x, y in jug:
        if x > 585:
            px(x, y, L[0])
    px(582, 50, L[3])
    px(582, 51, L[2])
    hline(581, 587, 53, S[5])
    outline(jug, K)
    vline(590, 49, 54, K)
    px(589, 48, K)
    px(589, 55, K)
    board = rect_mask(595, 53, 617, 58)
    fill(board, B[3])
    hline(595, 617, 53, S[4])
    hline(595, 617, 58, B[1])
    outline(board, B[0])
    loaf = ellipse_mask(604, 52, 6, 3)
    fill(loaf, G[1])
    for x, y in loaf:
        if (x, y - 1) not in loaf:
            px(x, y, G[2])
    for k in (-3, 0, 3):
        px(604 + k, 51, B[3])
    outline(loaf, B[1])
    rect(613, 50, 614, 54, B[2])
    px(612, 49, S[4])
    hline(533, 559, 26, B[0])
    hline(533, 559, 27, B[3])
    hline(533, 559, 28, B[1])
    for bx in (536, 556):
        vline(bx, 29, 31, B[0])
    for i, (jx, c) in enumerate(((537, L[2]), (543, G[2]), (549, R[1]), (555, M[3]))):
        h = 6 + (i % 2) * 2
        m = rect_mask(jx - 2, 26 - h, jx + 2, 25)
        fill(m, c)
        vline(jx + 2, 26 - h, 25, DOWN[c])
        px(jx - 1, 27 - h, S[5])
        hline(jx - 1, jx + 1, 25 - h, B[2])
        outline(m, K)
    rack = set()
    for vx in (595, 618):
        for y in range(14, 44):
            rack.add((vx, y))
            rack.add((vx + 1, y))
    for x in range(594, 622):
        rack.add((x, 16))
        rack.add((x, 17))
    for x, y in rack:
        px(x, y, B[3] if (x - 1, y) not in rack or (x, y - 1) not in rack else B[2])
    outline_outer(rack, B[0], 592, 10, 623, 47)
    for hx, c1, c2, ln in ((600, R[1], R[0], 10), (605, L[2], L[1], 8), (610, S[5], S[4], 11), (614, G[2], G[1], 8)):
        dried_bundle(hx, 17, c1, c2, ln)
    claim(rect_mask(x0, 48, x1, 79))
    cast(counter, 3)


def build():
    wall_face()
    floor_flags()
    floor_meadow()
    mark_floor()
    back_shadow()
    side_walls()
    bottom_wall()
    door()
    window(48, sill_bottle)
    window(128, sill_cup)
    banner(208, L[1], L[2], L[0], star_motif, (230, 40))
    banner(400, R[1], S[4], R[0], flower_motif, None)
    banner(560, M[2], M[3], M[1], road_motif, (215 + 352, 31))
    quest_board()
    lantern(240, 16)
    lantern(368, 16)
    rug_main()
    rug_round()
    fireplace()
    bookshelves()
    stove_nook()
    plant(1, 3, "stonepot")
    plant(13, 3, "tub")
    plant(38, 6, "jar")
    reception()
    desk()
    starglass_table()
    plant(1, 13, "wild")
    plant(38, 14, "stonepot")
    round_table(14, 13, [("teapot", -6, -1), ("cup", 4, -2), ("cup", 9, 1)])
    pantry()
    round_table(4, 15, [("book", -8, 0), ("vase", 4, -1), ("cup", 12, 1)])
    bar_counter()
    for tx in (25, 27, 29, 31, 33, 35):
        stool(tx, 17)
    round_table(10, 18, [("map", -3, 0), ("candle", 10, -1), ("letter", -12, 1)])
    luggage(1, 20, "case")
    luggage(37, 20, "crate")
    luggage(38, 20, "roll")
    luggage(1, 21, "crate")
    luggage(2, 21, "case")
    luggage(38, 21, "case")
    plant(22, 21, "wild")
    lamp(17, 22)
    lamp(22, 22)
    apply_shadows()
    cool_corners()
    glow(464, 62, 66, 0.85, floor_only=True)
    glow(464, 30, 40, 0.45, wall_only=True)
    glow(517, 64, 40, 0.55, floor_only=True)
    glow(248, 26, 18, 0.7, wall_only=True)
    glow(376, 26, 18, 0.7, wall_only=True)
    glow(280, 352, 28, 0.65, floor_only=True)
    glow(360, 352, 28, 0.65, floor_only=True)
    glow(567, 140, 30, 0.6, table=COOL, floor_only=True)
    glow(313, 70, 24, 0.5, floor_only=True)
    glow(480, 247, 32, 0.55, floor_only=True)
    glow(480, 186, 14, 0.5, floor_only=True)
    light_shaft(64, 33, 0.55, 10, 190, 0.8)
    light_shaft(144, 33, 0.55, 10, 175, 0.75)


def save():
    img = Image.new("RGB", (W, H))
    img.putdata([PAL[cv[y][x]] for y in range(H) for x in range(W)])
    img.save(OUT)
    img.resize((W * 3, H * 3), Image.NEAREST).save(PREVIEW)
    used = {cv[y][x] for y in range(H) for x in range(W)}
    print("colours used", len(used), "of", len(PAL))


def check_spots():
    layout = json.load(open(LAYOUT))
    spots = [s for group in layout["characterSpots"].values() for s in group] + list(layout["npcSpots"].values())
    bad = []
    for s in spots:
        tx, ty = s["x"], s["y"]
        blocked = 0
        for y in range(ty * 16, ty * 16 + 16):
            for x in range(tx * 16, tx * 16 + 16):
                if not floor[y][x]:
                    blocked += 1
        if blocked:
            bad.append((tx, ty, blocked))
    print("spot pixels covered by props", bad)


if __name__ == "__main__":
    build()
    save()
    check_spots()
