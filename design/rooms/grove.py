from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import math
import random

from PIL import Image

W, H = 640, 384
OUT = str(ROOT / "web/public/assets/rooms/grove.png")
PREVIEW = str(ROOT / "design/preview-grove.png")

PAL = []


def hexrgb(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def register(colors):
    indexes = []
    for c in colors:
        PAL.append(hexrgb(c))
        indexes.append(len(PAL) - 1)
    return indexes


B = register(["#271b1a", "#47302a", "#6b4b37", "#8f6646", "#b48a5c"])
S = register(["#262f2f", "#46534f", "#627069", "#818e86", "#a8b1a3"])
M = register(["#1d3527", "#2f522f", "#4a7637", "#71a143", "#a9cb5e"])
T = register(["#16353a", "#245957", "#3e8575", "#75bda1", "#c5eed5"])
C = register(["#b7a57d", "#d9cba2", "#f4edd3"])
G = register(["#a55e27", "#dd9f3f", "#f4cf6c", "#fff3c1"])
P = register(["#b6537a", "#efa0b6"])
L = register(["#4b77c3", "#9fcbf1"])
F = register(["#5c5139", "#786b4b", "#8e815c"])
V = register(["#5d4a8c", "#9a82cc"])

UP = {}
DOWN = {}


def link_ramp(ramp, below=None, above=None):
    for i, c in enumerate(ramp):
        UP[c] = ramp[i + 1] if i + 1 < len(ramp) else (above if above is not None else c)
        DOWN[c] = ramp[i - 1] if i > 0 else (below if below is not None else c)


link_ramp(B)
link_ramp(S)
link_ramp(M)
link_ramp(T, above=C[2])
link_ramp(C, below=B[4])
link_ramp(G, below=B[3])
link_ramp(P, below=B[1])
link_ramp(L, below=T[1])
link_ramp(F, below=B[1], above=C[0])
link_ramp(V, below=B[1])

LIFT = {B[0]: B[1], B[1]: B[2], B[2]: B[3], B[3]: B[4], B[4]: C[0], C[0]: C[1], C[1]: C[2]}

WARM = dict(UP)
WARM[B[3]] = G[0]
WARM[B[2]] = B[3]
WARM[F[2]] = C[0]
WARM[C[0]] = G[2]

cv = [[B[2]] * W for _ in range(H)]
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


rng = random.Random(7)


def wall_face():
    for y in range(0, 48):
        for x in range(W):
            u = x / 6.5 + (vnoise(x, y, 9, 1) - 0.5) * 1.8 + (vnoise(x, y, 23, 2) - 0.5) * 1.2
            f = u - math.floor(u)
            plate = int(math.floor(u))
            c = B[2]
            if f < 0.13:
                c = B[1] if hsh(plate, y // 3, 3) > 0.1 else B[2]
                if f < 0.05 and hsh(x, y, 4) < 0.5:
                    c = B[0]
            elif f < 0.27:
                c = B[3]
            elif f > 0.88:
                c = B[1] if bayer(x, y) < 0.5 else B[2]
            if hsh(plate, y, 5) < 0.035 and f > 0.13:
                c = B[1]
            if hsh(plate, y - 1, 5) < 0.035 and f > 0.27:
                c = B[3]
            px(x, y, c)
    for rx, ph, w in ((33, 0.5, 7), (104, 2.1, 9), (184, 1.2, 8), (391, 0.3, 5), (532, 2.6, 9), (606, 1.7, 7)):
        root_column(rx, ph, w)
    for x in range(W):
        top = 35 + int(vnoise(x, 0, 9, 21) * 9)
        for y in range(top, 46):
            n = vnoise(x, y, 4, 22) + (y - top) * 0.03
            if n > 0.6:
                px(x, y, M[2] if n > 0.74 else M[1])
            elif n > 0.5 and bayer(x, y) < 0.5:
                px(x, y, M[1])
        if hsh(x, 45, 30) < 0.22:
            px(x, 44, M[3])
    for x in range(W):
        px(x, 46, B[1] if hsh(x, 46, 31) < 0.7 else M[1])
        px(x, 47, B[0])
    canopy()


def fungus(x, y, flip=False):
    s = -1 if flip else 1
    for i, w in enumerate((7, 5, 3)):
        yy = y + i * 4
        cap = set()
        for k in range(w + 1):
            hgt = 2 if k < w - 1 else 1
            for j in range(hgt):
                cap.add((x + s * k, yy + j))
        fill(cap, T[3])
        for cx, cy in cap:
            if (cx, cy - 1) not in cap:
                px(cx, cy, T[4])
        hline(min(x, x + s * w), max(x, x + s * w), yy + 2, T[1])
        px(x + s * (w + 1), yy + 1, T[0])
        px(x + s * w, yy + 2, T[0])
        px(x, yy, T[1])
    for dx, dy in ((3, -2), (9, 3), (-2, 8), (7, 11)):
        if hsh(x + dx, y + dy, 13) < 0.8:
            px(x + s * dx, y + dy, T[4] if dy % 2 else G[2])


def mushrooms(x, y):
    for dx, h, w, c in ((0, 4, 2, T[3]), (5, 2, 1, T[4]), (9, 5, 2, G[2])):
        vline(x + dx, y - h + 1, y, C[1])
        cap = set()
        for k in range(-w, w + 1):
            cap.add((x + dx + k, y - h))
        for k in range(-w + 1, w):
            cap.add((x + dx + k, y - h - 1))
        fill(cap, c)
        px(x + dx - w + 1, y - h - 1, UP[c])
        px(x + dx + w, y - h, DOWN[c])
    px(x + 3, y - 7, T[4])
    px(x + 12, y - 9, G[3])


def side_walls():
    for x0, inner_dir in ((0, 1), (624, -1)):
        for y in range(0, H):
            for x in range(x0, x0 + 16):
                local = x - x0 if inner_dir == 1 else x0 + 15 - x
                if local < 11:
                    n = vnoise(x, y, 5, 40)
                    c = B[1] if n < 0.55 else B[2]
                    if (x * 7 + int(math.sin(y * 0.11 + x) * 2)) % 5 == 0:
                        c = B[0]
                    px(x, y, c)
                    mn = vnoise(x, y, 6, 41)
                    if mn > 0.68:
                        px(x, y, M[2] if mn > 0.78 else M[1])
                    if mn > 0.84:
                        px(x, y, M[3])
                elif local < 13:
                    px(x, y, B[0])
                else:
                    px(x, y, B[1] if inner_dir == 1 else B[3])
        lip = x0 + 11 if inner_dir == 1 else x0 + 4
        for y in range(0, H):
            px(lip, y, B[0])
        edge_x = x0 + 15 if inner_dir == 1 else x0
        for y in range(48, H):
            px(edge_x, y, B[0])
            if inner_dir == -1 and hsh(edge_x, y, 42) < 0.1:
                px(edge_x + 1, y, C[0])


def bottom_wall():
    for x in range(0, W):
        if 304 <= x <= 335:
            continue
        for y in range(368, H):
            g = vnoise(x, y * 4, 9, 50)
            c = B[2]
            if y in (369, 370):
                c = B[4] if hsh(x, y, 51) < 0.6 or y == 369 else B[3]
            elif y < 373:
                c = B[3]
            elif y > 379:
                c = B[1]
            if 372 < y < 380:
                if g > 0.66:
                    c = B[1]
                elif g < 0.3:
                    c = B[3]
            px(x, y, c)
        px(x, 368, B[0])
    for jx in (70, 150, 232, 410, 488, 560):
        for y in range(369, H):
            px(jx, y, B[0])
            px(jx + 1, y, B[1])
            px(jx - 1, y, B[3] if y < 374 else B[2])
        px(jx + 1, 369, B[3])
    for x in range(0, W):
        if 296 <= x <= 343:
            continue
        n = vnoise(x, 0, 6, 52)
        if n > 0.55:
            top = 369 + (1 if n < 0.62 else 0)
            depth = 2 + int((n - 0.55) * 14)
            for y in range(top, min(H, top + depth)):
                px(x, y, M[2] if y < top + depth - 1 else M[1])
            px(x, top, M[3])
            if hsh(x, 1, 53) < 0.08:
                px(x, top, P[1] if hsh(x, 2, 53) < 0.5 else L[1])
    for y in range(0, H):
        pass


def in_flag(x, y):
    n = (vnoise(x, y, 14, 60) - 0.5) * 0.6 + (vnoise(x, y, 6, 61) - 0.5) * 0.35
    a = ((x - 528) / 120.0) ** 2 + ((y - 56) / 46.0) ** 2
    b = ((x - 320) / 46.0) ** 2 + ((y - 384) / 70.0) ** 2
    c = ((x - 24) / 70.0) ** 2 + ((y - 360) / 48.0) ** 2
    d = ((x - 616) / 46.0) ** 2 + ((y - 356) / 44.0) ** 2
    return min(a, b, c, d) + n < 1.0


def plank_floor():
    y = 48
    heights = [9, 8, 10, 8, 9, 7, 9, 8, 10, 9]
    row = 0
    while y < 368:
        h = heights[row % len(heights)]
        x = 16 - rng.randint(0, 70)
        while x < 624:
            ln = rng.randint(46, 112)
            tone = rng.random()
            for yy in range(y, min(y + h, 368)):
                for xx in range(max(x, 16), min(x + ln, 624)):
                    c = F[1]
                    if yy == y or xx == x:
                        c = F[0]
                    elif yy == y + 1 and bayer(xx, yy) < 0.5:
                        c = F[2]
                    elif tone < 0.2 and yy == y + 2 and bayer(xx, yy) < 0.5:
                        c = F[2]
                    px(xx, yy, c)
            for _ in range(rng.randint(1, 2)):
                sx = x + rng.randint(4, max(5, ln - 30))
                sy = y + rng.randint(3, h - 2)
                sl = rng.randint(14, 34)
                ph = rng.uniform(0, 6.28)
                col = F[2] if rng.random() < 0.7 else F[0]
                for k in range(sl):
                    xx = sx + k
                    yy = sy + int(round(math.sin(k * 0.22 + ph) * 1.1))
                    if 16 <= xx < min(624, x + ln) and y + 2 <= yy < y + h and yy < 368:
                        if k % 9 != 8:
                            px(xx, yy, col)
            if rng.random() < 0.12:
                kx = x + rng.randint(10, max(11, ln - 10))
                ky = y + h // 2
                if 18 <= kx < 620 and ky < 366:
                    ring = ellipse_mask(kx + 1, ky, 2.6, 1.6)
                    for p in edge(ring):
                        px(p[0], p[1], F[0])
                    px(kx, ky, F[0])
                    px(kx - 2, ky - 1, F[2])
            if x >= 16 and y + h - 2 < 368:
                px(x + 2, y + 2, F[0])
                px(x + 2, y + h - 2, F[0])
            x += ln
        y += h
        row += 1


def flag_floor():
    seeds = {}
    sx, sy = 21, 14
    for gy in range(-1, H // sy + 2):
        for gx in range(-1, W // sx + 2):
            jx = hsh(gx, gy, 70) * sx * 0.8
            jy = hsh(gx, gy, 71) * sy * 0.8
            seeds[(gx, gy)] = (gx * sx + jx, gy * sy + jy, hsh(gx, gy, 72))
    region = set()
    for y in range(48, H):
        for x in range(16, 624):
            if y >= 368 and not (304 <= x <= 335):
                continue
            if in_flag(x, y):
                region.add((x, y))
    info = {}
    for x, y in region:
        gx, gy = x // sx, y // sy
        best = []
        for oy in (-1, 0, 1):
            for ox in (-1, 0, 1):
                s = seeds[(gx + ox, gy + oy)]
                d = math.hypot((x - s[0]), (y - s[1]) * 1.3)
                best.append((d, s[2]))
        best.sort()
        info[(x, y)] = (best[1][0] - best[0][0], best[0][1])
    mortar = {p for p, v in info.items() if v[0] < 1.7}
    for p in region:
        x, y = p
        if p in mortar:
            px(x, y, M[1] if hsh(x, y, 73) < 0.7 else S[0])
            continue
        tone = info[p][1]
        base = S[2] if tone < 0.78 else S[3]
        c = base
        if (x, y - 1) in mortar:
            c = UP[base]
        elif (x - 1, y) in mortar and bayer(x, y) < 0.5:
            c = UP[base]
        if (x, y + 1) in mortar:
            c = S[1]
        px(x, y, c)
        mn = vnoise(x, y, 7, 76)
        if mn > 0.74:
            px(x, y, M[2] if mn > 0.8 else M[1])
        if mn > 0.86 and (x, y - 1) in region and vnoise(x, y - 1, 7, 76) <= 0.86:
            px(x, y, M[3])
    border = {(x, y) for (x, y) in region if any((x + dx, y + dy) not in region and 16 <= x + dx < 624 and 48 <= y + dy < H for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    for x, y in border:
        px(x, y, M[1])
        if hsh(x, y, 77) < 0.4:
            px(x, y - 1, M[2])
        if hsh(x, y, 78) < 0.15:
            px(x, y - 2, M[3])
        if hsh(x, y, 79) < 0.03:
            px(x, y - 3, P[1] if hsh(x, y, 80) < 0.5 else C[2])


def floor_moss():
    for y in range(48, 368):
        for x in range(16, 624):
            edge_d = min(x - 16, 623 - x, (y - 48) * 1.5, (367 - y) * 1.5)
            n = vnoise(x, y, 7, 80) * 0.8 + vnoise(x, y, 3, 81) * 0.2 - edge_d / 26.0 + 0.08
            if n > 0.5:
                cur = cv[y][x]
                if cur in (F[0], F[1], F[2]):
                    px(x, y, M[1] if n < 0.62 else M[2])
                    if n > 0.72 and bayer(x, y) < 0.5:
                        px(x, y, M[3])
                    if n > 0.62 and hsh(x, y, 82) < 0.01:
                        px(x, y, P[1] if hsh(x, y, 83) < 0.5 else C[2])
            elif n > 0.44 and bayer(x, y) < 0.25 and cv[y][x] in (F[1], F[2]):
                px(x, y, M[1])


def floor_flowers():
    rr = random.Random(21)
    for _ in range(26):
        x = rr.randint(40, 600)
        y = rr.randint(60, 360)
        if cv[y][x] not in (F[1], F[2]):
            continue
        c = (M[3], G[1], M[2], B[3])[rr.randint(0, 3)]
        px(x, y, c)
        px(x + 1, y, DOWN[c])
        px(x + 1, y - 1, c)


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


def window(x0):
    frame = set()
    for y in range(1, 32):
        for x in range(x0, x0 + 32):
            dx = (x + 0.5 - (x0 + 16)) / 15.5
            dy = (y + 0.5 - 15) / 14.5
            if y < 15:
                if dx * dx + dy * dy <= 1.0:
                    frame.add((x, y))
            elif x0 + 1 <= x <= x0 + 30:
                frame.add((x, y))
    opening = set()
    for x, y in frame:
        dx = (x + 0.5 - (x0 + 16)) / 11.5
        dy = (y + 0.5 - 15) / 10.5
        if y < 15:
            if dx * dx + dy * dy <= 1.0:
                opening.add((x, y))
        elif x0 + 5 <= x <= x0 + 26 and y <= 26:
            opening.add((x, y))
    rim = frame - opening
    fill(rim, C[1])
    for x, y in rim:
        if x < x0 + 16 and (x - 1, y) not in frame:
            px(x, y, C[2])
        if (x, y - 1) not in frame:
            px(x, y, C[2])
        if x > x0 + 16 and (x + 1, y) not in frame:
            px(x, y, C[0])
        if hsh(x, y, 90) < 0.15:
            px(x, y, C[0])
    for x, y in opening:
        if (x, y - 1) not in opening or (x - 1, y) not in opening:
            continue
    outline(frame, B[0])
    for x, y in opening:
        yy = y - 4
        if yy < 9:
            c = T[4] if bayer(x, y) < 0.7 else L[1]
        elif yy < 15:
            c = L[1] if bayer(x, y) < 0.35 else T[4]
        else:
            c = T[3]
        px(x, y, c)
    for x, y in opening:
        n = vnoise(x, y, 4, 91 + x0)
        if n > 0.6 or (y > 20 and n > 0.4):
            px(x, y, M[3] if n < 0.75 else M[4])
        if y > 22 and n > 0.3:
            px(x, y, M[2])
    vline(x0 + 9, 9, 26, T[1])
    vline(x0 + 22, 9, 26, T[1])
    for x, y in opening:
        if (x, y - 1) not in opening:
            px(x, y, C[0])
    inner = edge(opening)
    for x, y in inner:
        if x > x0 + 16 or y > 24:
            px(x, y, B[1])
    for x in range(x0 + 6, x0 + 26):
        y = 15 + int(round(math.sin((x - x0) * 0.4) * 1.2))
        px(x, y, B[1])
        if hsh(x, y, 92) < 0.3:
            px(x, y - 1, M[3])
    rect(x0 + 2, 27, x0 + 29, 28, C[2])
    rect(x0 + 2, 29, x0 + 29, 30, C[0])
    hline(x0 + 2, x0 + 29, 31, B[0])
    px(x0 + 1, 27, B[0])
    px(x0 + 30, 27, B[0])
    for i, x in enumerate(range(x0 + 4, x0 + 28, 3)):
        h = 2 + (i * 5) % 3
        vline(x, 27 - h, 26, M[2])
        px(x, 26 - h, P[1] if i % 2 == 0 else M[4])
    for i in range(6):
        vx = x0 + 3 + i * 5
        ln = 2 + (i * 3) % 4
        for k in range(ln):
            px(vx + (k % 2), 31 + k, M[2] if k < ln - 1 else M[3])


def banner(x0, base, hi, lo, motif):
    for x in range(x0, x0 + 32):
        px(x, 4, B[3])
        px(x, 5, B[2])
        px(x, 6, B[1])
    px(x0, 4, B[0])
    px(x0 + 31, 5, B[0])
    for x, y in ((x0 + 1, 3), (x0 + 2, 2), (x0 + 30, 3), (x0 + 29, 2), (x0 + 28, 3)):
        px(x, y, M[3])
    cloth = set()
    for y in range(7, 47):
        if y < 39:
            for x in range(x0 + 4, x0 + 28):
                cloth.add((x, y))
        else:
            k = y - 39
            for x in range(x0 + 4 + k * 2 - (1 if k < 2 else 0), x0 + 28 - k * 2 + (1 if k < 2 else 0)):
                cloth.add((x, y))
    fill(cloth, base)
    for x, y in cloth:
        f = (x - x0 - 4) % 6
        if f == 0:
            px(x, y, hi)
        elif f == 4:
            px(x, y, lo)
    for x, y in cloth:
        if x in (x0 + 6, x0 + 25) and 9 <= y <= 38:
            px(x, y, G[1])
        if y in (9, 38) and x0 + 6 <= x <= x0 + 25:
            px(x, y, G[1])
    motif(x0 + 16, 23)
    for x, y in cloth:
        if (x, y - 1) not in cloth:
            continue
        if (x + 1, y) not in cloth:
            px(x, y, DOWN[base])
    outline(cloth, B[0])
    tip = max(y for _, y in cloth)
    px(x0 + 15, tip + 1, G[2])
    px(x0 + 16, tip + 1, G[1])


def leaf_motif(cx, cy):
    for y in range(-9, 10):
        w = int(round(math.cos(y / 10.0 * 1.5) * 5))
        for x in range(-w, w + 1):
            px(cx + x, cy + y, C[1] if x < 0 else C[0])
    vline(cx, cy - 9, cy + 11, B[2])
    for k in range(-6, 7, 3):
        px(cx - 1, cy + k, B[2])
        px(cx - 2, cy + k - 1, B[2])
        px(cx + 1, cy + k, B[2])
        px(cx + 2, cy + k - 1, B[2])


def moon_motif(cx, cy):
    m = ellipse_mask(cx, cy, 7, 7) - ellipse_mask(cx + 3, cy - 2, 6, 6)
    fill(m, C[1])
    for x, y in m:
        if (x + 1, y) not in m and x > cx:
            px(x, y, C[0])
    for x, y in ((cx + 5, cy + 4), (cx + 7, cy - 6), (cx + 2, cy + 7)):
        px(x, y, G[2])


def sprig_motif(cx, cy):
    vline(cx, cy - 6, cy + 9, B[3])
    for i, (dx, dy) in enumerate(((-4, -7), (4, -4), (-4, 0), (4, 3), (-3, 6))):
        m = ellipse_mask(cx + dx, cy + dy, 3, 2)
        fill(m, M[3] if i % 2 == 0 else M[4])
        for x, y in m:
            if (x, y + 1) not in m:
                px(x, y, M[2])
    for x, y in ((cx, cy - 9), (cx - 1, cy - 8), (cx + 1, cy - 8)):
        px(x, y, P[1])


def quest_board():
    x0, y0, x1, y1 = 273, 5, 366, 44
    vline(282, 0, 6, B[1])
    vline(357, 0, 6, B[1])
    px(283, 2, M[3])
    px(356, 3, M[3])
    board = rect_mask(x0, y0, x1, y1)
    fill(board, B[3])
    rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3, B[2])
    for x in range(x0 + 3, x1 - 2):
        if (x - x0) % 11 == 0:
            vline(x, y0 + 3, y1 - 3, B[1])
    for x in range(x0, x1 + 1):
        px(x, y0, B[4] if hsh(x, 1, 100) < 0.6 else B[3])
        px(x, y1 - 1, B[2])
        if hsh(x, 2, 101) < 0.2:
            px(x, y0 + 1, B[4])
    for y in range(y0, y1 + 1):
        px(x0, y, B[4] if hsh(1, y, 102) < 0.5 else B[3])
        px(x1 - 1, y, B[2])
    for x in range(x0 + 3, x1 - 2):
        px(x, y0 + 3, B[1])
    for y in range(y0 + 3, y1 - 2):
        px(x0 + 3, y, B[1])
    outline(board, B[0])
    notes = [
        (281, 11, 12, 13, "p"), (296, 9, 10, 10, "p"), (309, 12, 13, 11, "leaf"),
        (326, 9, 9, 13, "p"), (338, 11, 14, 10, "p"), (285, 27, 11, 11, "leaf"),
        (300, 24, 14, 13, "p"), (318, 26, 10, 12, "p"), (332, 24, 11, 12, "leaf"), (346, 25, 9, 13, "p"),
    ]
    pins = [P[0], L[0], G[1], T[2], P[0], G[1], L[0], P[0], G[1], T[2]]
    for i, (nx, ny, nw, nh, kind) in enumerate(notes):
        if kind == "leaf":
            m = set()
            for yy in range(nh):
                w = int(round(math.sin((yy + 0.5) / nh * math.pi) * nw / 2))
                for xx in range(-w, w + 1):
                    m.add((nx + nw // 2 + xx, ny + yy))
            for x, y in m:
                if (x + 1, y + 1) not in m:
                    px(x + 1, y + 1, B[1])
            fill(m, M[3])
            for x, y in m:
                if x < nx + nw // 2:
                    px(x, y, M[4] if (x - 1, y) not in m else M[3])
                elif (x + 1, y) not in m:
                    px(x, y, M[2])
            vline(nx + nw // 2, ny + 1, ny + nh - 2, M[2])
            for yy in range(ny + 3, ny + nh - 2, 3):
                px(nx + nw // 2 + 1, yy, B[2])
                px(nx + nw // 2 + 3, yy + (i % 2), B[2])
        else:
            rect(nx + 1, ny + 1, nx + nw, ny + nh, B[1])
            rect(nx, ny, nx + nw - 1, ny + nh - 1, C[1])
            hline(nx, nx + nw - 1, ny, C[2])
            vline(nx, ny, ny + nh - 1, C[2])
            vline(nx + nw - 1, ny + 1, ny + nh - 1, C[0])
            hline(nx + 1, nx + nw - 1, ny + nh - 1, C[0])
            for li, yy in enumerate(range(ny + 3, ny + nh - 2, 2)):
                xx = nx + 2
                end = nx + nw - 3 - (3 if li % 3 == 2 else 0)
                while xx <= end:
                    seg = 1 + int(hsh(xx, yy, 103 + i) * 3)
                    for k in range(seg):
                        if xx + k <= end:
                            px(xx + k, yy, B[2] if hsh(xx + k, yy, 104) < 0.85 else B[3])
                    xx += seg + 1
            if i % 4 == 1:
                px(nx + nw - 1, ny + nh - 1, B[1])
                px(nx + nw - 2, ny + nh - 1, C[0])
                px(nx + nw - 1, ny + nh - 2, C[0])
            if i % 3 == 0:
                px(nx + nw - 4, ny + nh - 4, P[0])
                px(nx + nw - 3, ny + nh - 4, P[0])
                px(nx + nw - 4, ny + nh - 3, P[0])
        cx = nx + nw // 2
        px(cx, ny + 1, pins[i])
        px(cx - 1, ny, UP[pins[i]])
        px(cx, ny, pins[i])
        px(cx + 1, ny + 2, B[1])
    for x, y in ((x0 + 1, y0 - 1), (x0 + 2, y0 - 2), (x0 - 1, y0 + 2), (x1, y0 - 1), (x1 - 1, y0 - 2), (x1 + 1, y0 + 3), (x0 + 1, y1 + 1), (x1 - 2, y1 + 1)):
        px(x, y, M[3])
    for x, y in ((x0 + 3, y0 - 1), (x1 - 3, y0 - 1)):
        px(x, y, M[4])
    px(x0 + 2, y0 - 3, P[1])
    px(x1 - 2, y0 - 3, L[1])


def lantern(x0, y0):
    cx = x0 + 8
    for y in range(0, y0 + 4):
        px(cx + (1 if (y // 5) % 2 else 0), y, B[1])
    px(cx - 1, 6, M[3])
    px(cx + 2, 11, M[3])
    px(cx - 1, y0 - 1, M[2])
    orb = ellipse_mask(cx + 0.5, y0 + 10, 5.5, 5.5)
    fill(orb, G[1])
    for x, y in orb:
        d = math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - y0 - 10.5)
        if d < 2.5:
            px(x, y, G[3])
        elif d < 4.2:
            px(x, y, G[2])
    for x, y in side_edges(orb, 1, 0) | side_edges(orb, 0, 1):
        px(x, y, G[0])
    outline(orb, T[1])
    px(cx - 2, y0 + 7, C[2])
    px(cx - 3, y0 + 8, C[2])
    px(cx + 2, y0 + 9, C[2])
    px(cx - 1, y0 + 12, C[2])
    rect(cx - 2, y0 + 3, cx + 3, y0 + 4, B[1])
    hline(cx - 1, cx + 2, y0 + 3, B[3])
    px(cx - 3, y0 + 4, M[3])
    px(cx + 4, y0 + 4, M[2])
    px(cx, y0 + 16, B[1])
    px(cx + 1, y0 + 17, G[1])


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


def fireplace():
    x0, x1 = 432, 495
    chim = rect_mask(439, 0, 488, 24)
    stones(chim, 440, 0, 9, 6, 110)
    for y in range(0, 25):
        px(439, y, S[0])
        px(488, y, S[0])
    beam = rect_mask(x0 + 1, 21, x1 - 1, 27)
    fill(beam, B[2])
    hline(x0 + 2, x1 - 2, 22, B[4])
    hline(x0 + 2, x1 - 2, 23, B[3])
    hline(x0 + 2, x1 - 2, 26, B[1])
    for x in range(x0 + 4, x1 - 3, 7):
        px(x, 24, B[1])
        px(x + 1, 25, B[1])
    outline(beam, B[0])
    px(x0 + 1, 21, B[2])
    px(x1 - 1, 21, B[2])
    rect(445, 18, 448, 20, C[1])
    hline(445, 448, 18, C[2])
    px(446, 16, G[3])
    px(446, 17, G[2])
    outline(rect_mask(445, 18, 448, 20), B[0])
    jar = ellipse_mask(479, 18, 3.2, 3)
    fill(jar, T[3])
    px(478, 16, T[4])
    outline(jar, T[0])
    hline(478, 480, 15, B[3])
    for i, x in enumerate(range(x0 + 3, x1 - 2, 5)):
        ln = 2 + (i * 7) % 5
        for k in range(ln):
            px(x + (k % 2), 28 + k, M[2] if k < ln - 1 else M[3])
    surround = rect_mask(436, 28, 491, 54)
    stones(surround, 436, 28, 8, 6, 111)
    for y in range(28, 55):
        px(436, y, S[0])
        px(491, y, S[0])
    box = rect_mask(448, 33, 479, 54)
    fill(box, S[0])
    for x, y in box:
        if y > 46:
            v = (y - 46) / 8.0
            if v > bayer(x, y):
                px(x, y, B[1])
            if v > 0.7 and v - 0.35 > bayer(x, y):
                px(x, y, G[0])
    for x, y in edge(box):
        px(x, y, S[1] if y > 34 else S[0])
    hline(447, 480, 32, S[4])
    hline(447, 480, 31, S[3])
    for x in (447, 458, 469, 480):
        px(x, 31, S[1])
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
    for y in range(34, 52):
        h = (51 - y) / 17.0
        w = 10 * (1 - h) ** 0.7
        sway = math.sin(y * 0.6) * 1.5 * h
        for x in range(447, 481):
            if abs(x + 0.5 - 464 - sway) <= w:
                fl.add((x, y))
    tongues = [(455, 40, 4), (473, 38, 5), (461, 35, 3), (468, 36, 3)]
    for tx, ty, tl in tongues:
        for k in range(tl):
            fl.add((tx + (k % 2), ty + k))
    fill(fl, M[3])
    for x, y in fl:
        d = abs(x + 0.5 - 464) / 10.0 + (51 - y) / 30.0
        if d < 0.45:
            px(x, y, G[3])
        elif d < 0.65:
            px(x, y, G[2])
        elif d < 0.85:
            px(x, y, M[4])
    for x, y in edge(fl):
        if cv[y][x] == M[3]:
            px(x, y, M[2])
    for x, y in ((458, 36), (471, 35), (452, 40), (476, 42)):
        px(x, y, G[2])
    hearth = rect_mask(x0 + 1, 55, x1 - 1, 63)
    fill(hearth, S[2])
    for y in range(55, 59):
        for x in range(x0 + 1, x1):
            px(x, y, S[3] if hsh(x, y, 112) < 0.85 else S[4])
    hline(x0 + 2, x1 - 2, 55, S[4])
    hline(x0 + 1, x1 - 1, 59, S[1])
    for x in range(x0 + 6, x1 - 2, 12):
        vline(x, 60, 62, S[1])
        px(x + 1, 60, S[3])
    for x in range(x0 + 2, x1 - 1):
        if vnoise(x, 62, 5, 113) > 0.55:
            px(x, 62, M[2])
            if hsh(x, 61, 114) < 0.4:
                px(x, 61, M[3])
    outline(hearth, S[0])
    for x in range(447, 481):
        px(x, 55, G[0] if bayer(x, 55) < 0.6 else S[3])
    claim(rect_mask(x0, 48, x1, 63))
    cast(hearth, 3)


def stones(mask, ox, oy, sw, sh, seed):
    row = 0
    for y in range(oy, oy + 200, sh):
        shift = (row % 2) * (sw // 2) + int(hsh(row, 0, seed) * 3)
        x = ox - shift
        while x < ox + 200:
            w = sw + int(hsh(x, y, seed) * 4) - 1
            blk = {(xx, yy) for xx in range(x, x + w) for yy in range(y, y + sh) if (xx, yy) in mask}
            if blk:
                tone = hsh(x, y, seed + 1)
                base = S[2] if tone < 0.6 else (S[3] if tone < 0.85 else S[1])
                fill(blk, base)
                for xx, yy in blk:
                    if (xx, yy - 1) not in blk or (xx - 1, yy) not in blk:
                        px(xx, yy, UP[base])
                    if (xx, yy + 1) not in blk or (xx + 1, yy) not in blk:
                        px(xx, yy, S[0] if ((xx, yy + 1) not in blk) else DOWN[base])
                    n = vnoise(xx, yy, 5, seed + 2)
                    if n > 0.7:
                        px(xx, yy, M[2] if n > 0.78 else M[1])
            x += w
        row += 1


def plant(tx, ty, kind):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 8
    if kind in ("fern", "bloom"):
        pot = set()
        for y in range(y0 + 8, y0 + 16):
            w = 5 if y < y0 + 14 else 4
            if y == y0 + 8:
                w = 6
            for x in range(cx - w, cx + w):
                pot.add((x, y))
        solid(pot, B[3], B[4], B[2], B[0])
        hline(cx - 5, cx + 4, y0 + 9, B[1])
        for x in range(cx - 4, cx + 4, 3):
            px(x, y0 + 12, B[2])
            px(x + 1, y0 + 13, B[4])
    else:
        pot = set()
        for y in range(y0 + 9, y0 + 16):
            w = 6 if y > y0 + 9 else 5
            for x in range(cx - w, cx + w):
                pot.add((x, y))
        stones(pot, cx - 6, y0 + 9, 4, 3, 120 + tx)
        outline(pot, S[0])
    leaves = set()
    rr = random.Random(tx * 31 + ty)
    fronds = 7 if kind == "fern" else 6
    for i in range(fronds):
        ang = -math.pi / 2 + (i - (fronds - 1) / 2) * (2.4 / fronds) + rr.uniform(-0.12, 0.12)
        ln = rr.uniform(9, 14) if kind != "sapling" else rr.uniform(6, 9)
        for k in range(int(ln)):
            t = k / ln
            x = cx - 0.5 + math.cos(ang) * k + math.cos(ang) * t * t * 2
            y = y0 + 9 + math.sin(ang) * k + t * t * 4
            leaves.add((int(round(x)), int(round(y))))
            if 0.2 < t < 0.85:
                leaves.add((int(round(x + math.sin(ang))), int(round(y - math.cos(ang) * 0.5))))
                if k % 2 == 0:
                    leaves.add((int(round(x - math.sin(ang) * 1.6)), int(round(y))))
    if kind == "sapling":
        vline(cx, y0 - 2, y0 + 9, B[2])
        vline(cx - 1, y0 + 2, y0 + 9, B[3])
        leaves |= ellipse_mask(cx, y0 - 2, 6.5, 5.5)
        leaves |= ellipse_mask(cx - 3, y0 + 2, 4, 3)
        leaves |= ellipse_mask(cx + 4, y0 + 1, 3.5, 3)
    leaves = {(x, y) for (x, y) in leaves if x0 <= x < x0 + 16 and y0 - 10 <= y < y0 + 12}
    base = M[2]
    fill(leaves, base)
    for x, y in leaves:
        if (x, y - 1) not in leaves or (x - 1, y) not in leaves:
            px(x, y, M[3])
        elif (x, y + 1) not in leaves or (x + 1, y) not in leaves:
            px(x, y, M[1])
    for x, y in leaves:
        if kind != "sapling" and (x, y - 1) not in leaves and hsh(x, y, 121) < 0.35:
            px(x, y, M[4])
        if kind == "sapling" and hsh(x, y, 122) < 0.1 and (x, y - 1) in leaves:
            px(x, y, M[4] if hsh(x, y, 123) < 0.6 else G[2])
    outline_outer(leaves, M[0], x0, y0 - 10, x0 + 15, y0 + 15)
    if kind == "bloom":
        for dx, dy, c in ((-4, -2, P[1]), (3, -5, P[1]), (0, -7, L[1]), (5, 0, P[1]), (-2, 2, C[2])):
            px(cx + dx, y0 + dy, c)
            px(cx + dx + 1, y0 + dy, DOWN[c] if c != C[2] else C[1])
    if kind == "blue":
        for dx, dy in ((-3, -3), (2, -6), (4, -1), (-5, 1)):
            px(cx + dx, y0 + dy, L[1])
            px(cx + dx, y0 + dy + 1, L[0])
    claim(pot | leaves)
    cast(pot, 3)


def outline_outer(mask, c, xa, ya, xb, yb):
    ring = set()
    for x, y in mask:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p not in mask and xa <= p[0] <= xb and ya <= p[1] <= yb:
                ring.add(p)
    for x, y in ring:
        if get(x, y) is not None and get(x, y) not in (B[0], S[0]):
            px(x, y, c)
    return ring


def book(x, ybot, h, w, main, dark, band=None, lean=0):
    for i in range(w):
        for k in range(h):
            xx = x + i + (lean * k // h if lean else 0)
            px(xx, ybot - k, main if i < w - 1 else dark)
        px(x + i + (lean if lean else 0), ybot - h + 1, UP.get(main, main) if i == 0 else main)
    if band is not None and h > 5:
        for i in range(w):
            px(x + i, ybot - h + 3, band)


BOOKS = [
    (T[2], T[1]), (M[2], M[1]), (B[3], B[2]), (P[0], B[1]), (C[1], C[0]),
    (T[3], T[2]), (L[0], T[1]), (G[1], G[0]), (M[3], M[2]), (B[4], B[3]),
]


def bookshelves():
    x0, x1, ytop, ybot = 32, 191, 36, 79
    body = rect_mask(x0, ytop, x1, ybot)
    fill(body, B[2])
    rect(x0, ytop, x1, ytop + 5, B[3])
    hline(x0, x1, ytop + 1, B[4])
    for x in range(x0, x1 + 1):
        if hsh(x, 0, 130) < 0.25:
            px(x, ytop + 2, B[4])
        if hsh(x, 1, 131) < 0.3:
            px(x, ytop + 4, B[2])
    hline(x0, x1, ytop + 5, B[1])
    rr = random.Random(5)
    rows = [(43, 53), (56, 65), (68, 76)]
    cols = [(x0 + 4, x0 + 30), (x0 + 35, x0 + 62), (x0 + 67, x0 + 93), (x0 + 98, x0 + 124), (x0 + 129, x1 - 4)]
    for (cx0, cx1) in cols:
        for (ry0, ry1) in rows:
            rect(cx0, ry0, cx1, ry1, B[0])
            hline(cx0, cx1, ry0, B[0])
            for x in range(cx0, cx1 + 1):
                if bayer(x, ry0 + 1) < 0.5:
                    px(x, ry0 + 1, B[0])
            for x in range(cx0, cx1 + 1):
                for y in range(ry0 + 2, ry1 + 1):
                    if bayer(x, y) < 0.35:
                        px(x, y, B[1])
            x = cx0 + rr.randint(0, 2)
            while x < cx1 - 1:
                r = rr.random()
                if r < 0.08 and x < cx1 - 7:
                    jar = ellipse_mask(x + 3, ry1 - 3, 3, 3.2)
                    fill(jar, T[3] if rr.random() < 0.5 else G[2])
                    for p in jar:
                        if (p[0] + 1, p[1]) not in jar:
                            px(p[0], p[1], DOWN[cv[p[1]][p[0]]])
                    px(x + 2, ry1 - 4, C[2])
                    hline(x + 2, x + 4, ry1 - 6, B[3])
                    x += 8
                    continue
                if r < 0.15 and x < cx1 - 7:
                    for k in range(3):
                        sc = ellipse_mask(x + 3, ry1 - 1 - k * 2, 3, 1.3)
                        fill(sc, C[1])
                        px(x + 1, ry1 - 1 - k * 2, C[2])
                        px(x + 5, ry1 - 1 - k * 2, C[0])
                    x += 8
                    continue
                if r < 0.22:
                    x += rr.randint(2, 4)
                    continue
                w = rr.choice((2, 3, 3, 4))
                h = rr.randint(ry1 - ry0 - 5, ry1 - ry0 - 1)
                main, dark = rr.choice(BOOKS)
                if x + w > cx1:
                    break
                lean = 2 if (rr.random() < 0.1 and x + w + 2 < cx1) else 0
                book(x, ry1, h, w, main, dark, G[1] if rr.random() < 0.3 else None, lean)
                x += w + (2 if lean else 0) + (1 if rr.random() < 0.15 else 0)
        for (ry0, ry1) in rows:
            hline(cx0, cx1, ry1 + 1, B[3])
            hline(cx0, cx1, ry1 + 2, B[1])
    for cx in [x0, x0 + 31, x0 + 63, x0 + 94, x0 + 125, x1 - 3]:
        for y in range(ytop + 6, ybot):
            wob = 1 if math.sin(y * 0.35 + cx) > 0.6 else 0
            px(cx + wob, y, B[3])
            px(cx + 1 + wob, y, B[2])
            px(cx + 2 + wob, y, B[2])
            px(cx + 3 + wob, y, B[1])
        rect(cx - 1, ytop - 2, cx + 4, ytop + 1, B[3])
        hline(cx, cx + 3, ytop - 3, B[4])
        px(cx + 4, ytop - 1, B[2])
    hline(x0, x1, ybot - 1, B[1])
    hline(x0, x1, ybot - 2, B[2])
    knobs = set()
    for cx in [x0, x0 + 31, x0 + 63, x0 + 94, x0 + 125, x1 - 3]:
        knobs |= rect_mask(cx - 1, ytop - 3, cx + 4, ytop)
    shape = body | knobs
    outline(shape, B[0])
    for cx in [x0, x0 + 31, x0 + 63, x0 + 94, x0 + 125, x1 - 3]:
        hline(cx, cx + 3, ytop - 3, B[0])
        px(cx, ytop - 2, B[4])
        px(cx + 1, ytop - 2, B[4])
    vines = [(x0 + 12, 9), (x0 + 47, 14), (x0 + 82, 6), (x0 + 110, 12), (x0 + 148, 10)]
    for vx, ln in vines:
        for k in range(ln):
            xx = vx + int(round(math.sin(k * 0.7) * 1.5))
            px(xx, ytop + 4 + k, M[2])
            if k % 3 == 1:
                px(xx + 1, ytop + 4 + k, M[3])
                px(xx - 1, ytop + 5 + k, M[1])
        px(vx, ytop + 4 + ln, M[3])
    for x in range(x0 + 2, x1 - 1):
        if vnoise(x, 0, 5, 132) > 0.58:
            px(x, ytop + 3, M[2])
            px(x, ytop + 2, M[3])
            if hsh(x, 3, 133) < 0.15:
                px(x, ytop + 1, P[1])
    claim(rect_mask(x0, 48, x1, ybot))
    cast(rect_mask(x0, ybot - 2, x1, ybot), 3)


def forge():
    x0, x1 = 496, 623
    plinth = rect_mask(x0 + 1, 58, x1 - 1, 79)
    stones(plinth, x0 + 1, 64, 15, 8, 140)
    for x in range(x0 + 2, x1 - 1):
        for y in range(58, 64):
            px(x, y, S[3] if hsh(x, y, 141) < 0.85 else S[2])
        px(x, 58, S[4])
        px(x, 63, S[1])
    outline(plinth, S[0])
    rack = set()
    for vx in (590, 616):
        for y in range(26, 60):
            rack.add((vx + (1 if math.sin(y * 0.3) > 0.7 else 0), y))
            rack.add((vx + 1 + (1 if math.sin(y * 0.3) > 0.7 else 0), y))
    for x in range(588, 620):
        rack.add((x, 30 + (1 if 597 < x < 610 else 0)))
        rack.add((x, 31 + (1 if 597 < x < 610 else 0)))
    shelf = rect_mask(588, 46, 619, 48)
    for x, y in rack:
        px(x, y, B[3] if (x - 1, y) not in rack or (x, y - 1) not in rack else B[2])
    outline_outer(rack, B[0], 584, 22, 623, 60)
    solid(shelf, B[3], B[4], B[2], B[0])
    herbs = [(593, M[3], M[2], 9), (598, P[1], P[0], 7), (603, M[4], M[3], 10), (608, G[2], G[1], 7), (613, T[3], T[2], 8)]
    for hx, c1, c2, ln in herbs:
        px(hx, 32 + (1 if 597 < hx < 610 else 0), B[1])
        for k in range(ln):
            w = 1 + (k > 2) + (k > 5)
            for i in range(-w + 1, w):
                px(hx + i, 33 + k + (1 if 597 < hx < 610 else 0), c1 if i <= 0 else c2)
        px(hx, 33 + ln + (1 if 597 < hx < 610 else 0), M[2])
    jars = [(593, T[3]), (599, G[2]), (605, P[1]), (612, L[1])]
    for jx, c in jars:
        m = rect_mask(jx - 2, 40, jx + 2, 45)
        fill(m, c)
        vline(jx + 2, 40, 45, DOWN[c])
        px(jx - 1, 41, C[2])
        hline(jx - 1, jx + 1, 39, B[3])
        outline(m, B[0] if c != L[1] else T[0])
    bowl = ellipse_mask(520, 60, 19, 8) | rect_mask(503, 60, 537, 72)
    bowl |= ellipse_mask(520, 72, 16, 5)
    bowl = {(x, y) for (x, y) in bowl if y >= 52 and y <= 77}
    fill(bowl, S[1])
    for x, y in bowl:
        if x < 514:
            px(x, y, S[2])
        if x < 507 and (x, y) in bowl:
            px(x, y, S[3])
        if x > 530:
            px(x, y, S[0] if (x + y) % 3 == 0 else S[1])
    roots = [(503, 64, 0.5), (508, 60, 0.9), (526, 58, 1.2), (534, 63, 0.7)]
    for rx, ry, sl in roots:
        for k in range(16):
            x = rx + int(round(math.sin(k * 0.35 + sl) * 3)) + (k // 4 if rx > 520 else -k // 5)
            y = ry + k
            if (x, y) in bowl:
                px(x, y, B[3])
                px(x + 1, y, B[2])
                px(x + 2, y, B[1])
    outline(bowl, S[0])
    rim = ellipse_mask(520, 56, 17, 5.5)
    fill(rim, S[3])
    for x, y in rim:
        if y > 56:
            px(x, y, S[2])
    outline(rim, S[0])
    liquid = ellipse_mask(520, 56, 13, 3.6)
    fill(liquid, M[4])
    for x, y in liquid:
        d = math.hypot((x + 0.5 - 520) / 13, (y + 0.5 - 56) / 3.6)
        if d < 0.45:
            px(x, y, G[3])
        elif d < 0.75:
            px(x, y, G[2])
    for x, y in side_edges(liquid, 0, -1):
        px(x, y, M[3])
    for x, y in ((514, 55), (524, 57), (519, 54), (527, 55)):
        px(x, y, C[2])
    for x, y, c in ((516, 49, M[4]), (522, 46, G[2]), (518, 42, M[4]), (525, 39, T[4]), (514, 36, M[4]), (521, 31, G[2]), (517, 51, G[2])):
        px(x, y, c)
    anvil = set()
    for y in range(44, 76):
        w = 12 if y < 50 else (8 if y < 70 else 10)
        for x in range(560 - w, 560 + w):
            anvil.add((x, y))
    top = {(x, y) for (x, y) in anvil if y < 50}
    fill(anvil, S[2])
    for x, y in anvil - top:
        lx = x - 552
        if lx < 3:
            px(x, y, S[3])
        elif lx > 12:
            px(x, y, S[1])
        mn = vnoise(x, y, 4, 143)
        if mn > 0.66 and y > 58:
            px(x, y, M[2] if mn > 0.74 else M[1])
        if hsh(x, y, 144) < 0.04:
            px(x, y, S[1])
    fill(top, S[3])
    for x, y in top:
        if y == 44:
            px(x, y, S[4])
    for x in range(549, 572):
        px(x, 49, S[1])
    outline(anvil, S[0])
    hline(552, 566, 46, B[3])
    hline(552, 566, 47, B[2])
    rect(565, 44, 569, 48, B[3])
    hline(565, 569, 44, B[4])
    outline(rect_mask(552, 45, 569, 48), B[0])
    for x, y in ((550, 42), (551, 41), (553, 43)):
        px(x, y, M[3])
    mortar = ellipse_mask(578, 62, 5, 3) | rect_mask(574, 62, 582, 67)
    fill(mortar, S[3])
    for x, y in mortar:
        if x > 579:
            px(x, y, S[2])
    outline(mortar, S[0])
    hline(575, 581, 61, S[1])
    for k in range(7):
        px(579 + k // 2, 60 - k, B[3])
    claim(rect_mask(x0, 48, x1, 79))
    cast(plinth, 3)


def desk():
    x0, x1 = 32, 159
    top = set()
    for y in range(130, 148):
        for x in range(x0 + 1, x1):
            top.add((x, y))
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
        vn = vnoise(x, 0, 3, 150)
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
        cx = px0 + 12
        for y in range(154, 162):
            dx = int(round(math.sin((y - 154) / 7.0 * math.pi) * 4))
            px(cx - dx, y, B[2])
            px(cx + dx, y, B[2])
        vline(cx, 155, 161, B[2])
    fill(legs, B[2])
    for x, y in legs:
        if (x - 1, y) not in legs:
            px(x, y, B[3])
        if (x + 1, y) not in legs:
            px(x, y, B[1])
    fill(top, B[3])
    for y in range(131, 147):
        for x in range(x0 + 2, x1 - 1):
            if vnoise(x * 0.3, y, 2, 151) > 0.68:
                px(x, y, B[4])
            elif vnoise(x * 0.3, y, 2, 152) > 0.75:
                px(x, y, B[2])
    hline(x0 + 2, x1 - 2, 131, B[4])
    hline(x0 + 1, x1 - 1, 147, B[1])
    hline(x0 + 1, x1 - 1, 146, B[2])
    outline(allm, B[0])
    for y in range(148, 169):
        px(x0 + 2, y, B[0])
        px(x1 - 2, y, B[0])
    for k in range(40):
        x = x0 + 3 + k * 3 + int(math.sin(k * 0.9) * 1)
        y = 148 + int(round(math.sin(k * 0.55) * 1.5)) + 1
        if x >= x1 - 2:
            break
        px(x, y, M[2])
        px(x + 1, y, M[1])
        if k % 2 == 0:
            px(x, y - 1, M[3])
        if k % 7 == 3:
            px(x + 1, y + 1, P[1])
    for k in range(18):
        px(x0 + 4 + (k % 3 == 0), 150 + k, M[2])
        if k % 3 == 1:
            px(x0 + 5, 150 + k, M[3])
    items_book = [(x0 + 12, 135), (x0 + 74, 136)]
    for bx, by in items_book:
        page = rect_mask(bx, by, bx + 17, by + 7)
        fill(page, C[2])
        for x, y in page:
            if x > bx + 8:
                px(x, y, C[1])
        vline(bx + 8, by, by + 7, C[0])
        for y in range(by + 2, by + 7, 2):
            hline(bx + 2, bx + 6, y, C[0])
            hline(bx + 10, bx + 15 - (y % 3), y, B[3])
        outline(page, B[1])
        hline(bx + 1, bx + 16, by + 8, B[1])
    ink = ellipse_mask(x0 + 37, 140, 2.6, 2.6)
    fill(ink, T[1])
    px(x0 + 36, 139, T[3])
    outline(ink, T[0])
    for k in range(7):
        px(x0 + 38 + k // 2, 138 - k, C[2] if k > 1 else C[1])
    px(x0 + 42, 131, C[1])
    stack = [(x0 + 46, 143, 12, T[2], T[1]), (x0 + 47, 140, 10, P[0], B[1]), (x0 + 45, 137, 11, M[2], M[1])]
    for sx, sy, sw, c1, c2 in stack:
        rect(sx, sy, sx + sw, sy + 2, c1)
        hline(sx, sx + sw, sy + 2, c2)
        hline(sx + 1, sx + sw - 1, sy, UP[c1])
        vline(sx + sw, sy, sy + 2, C[1])
        outline(rect_mask(sx, sy, sx + sw, sy + 2), B[0])
    cnd = rect_mask(x0 + 64, 132, x0 + 66, 139)
    fill(cnd, C[2])
    vline(x0 + 66, 132, 139, C[1])
    outline(cnd, C[0])
    px(x0 + 65, 131, B[1])
    px(x0 + 65, 129, G[2])
    px(x0 + 65, 130, G[3])
    px(x0 + 65, 128, G[1])
    hline(x0 + 62, x0 + 68, 140, B[1])
    scroll = rect_mask(x0 + 98, 138, x0 + 112, 141)
    fill(scroll, C[1])
    hline(x0 + 98, x0 + 112, 138, C[2])
    outline(scroll, B[1])
    for x in (x0 + 98, x0 + 112):
        vline(x, 137, 142, B[3])
    pot = rect_mask(x0 + 118, 137, x0 + 123, 142)
    solid(pot, S[3], S[4], S[2], S[0])
    for x, y in ((x0 + 119, 135), (x0 + 120, 134), (x0 + 121, 133), (x0 + 122, 135), (x0 + 118, 136), (x0 + 123, 136)):
        px(x, y, M[3])
    px(x0 + 120, 133, M[4])
    px(x0 + 121, 132, P[1])
    gem = {(x0 + 104, 131), (x0 + 103, 132), (x0 + 104, 132), (x0 + 105, 132), (x0 + 104, 133)}
    fill(gem, T[4])
    px(x0 + 105, 132, T[2])
    claim(allm)
    cast(front | legs, 3)


def stump_table():
    x0, x1 = 496, 607
    cx = 551.5
    topm = ellipse_mask(cx, 155, 53, 9.5)
    side = rect_mask(499, 155, 604, 168) | ellipse_mask(cx, 168, 52.5, 4.5)
    roots = set()
    for rx, d in ((499, -1), (604, 1), (520, -1), (583, 1)):
        for y in range(166, 176):
            k = y - 166
            for x in range(rx - 2 + (d * k // 2 if d > 0 else d * k // 2), rx + 3 + (d * k // 2 if d > 0 else d * k // 2)):
                if x0 <= x <= x1:
                    roots.add((x, y))
    side = {(x, y) for (x, y) in side if y <= 173}
    body = topm | side | roots
    fill(side | roots, B[2])
    for x in range(x0, x1 + 1):
        vn = vnoise(x, 0, 2.5, 160)
        for y in range(156, 176):
            if (x, y) in side or (x, y) in roots:
                if vn > 0.62:
                    px(x, y, B[1])
                elif vn < 0.3 and (x, y) not in roots:
                    px(x, y, B[3])
                mn = vnoise(x, y, 5, 161)
                if y > 164 and mn > 0.6:
                    px(x, y, M[2] if mn > 0.7 else M[1])
    fill(topm, B[3])
    for x, y in topm:
        d = math.hypot((x + 0.5 - cx) / 53, (y + 0.5 - 155) / 9.5)
        ring = int(d * 7 + vnoise(x, y, 6, 162) * 0.6)
        if ring % 2 == 1 and d > 0.15:
            px(x, y, B[4] if d < 0.5 else B[3])
        else:
            px(x, y, C[0] if d < 0.5 else B[4])
        if d > 0.9:
            px(x, y, B[1] if y > 153 else B[2])
        if d < 0.12:
            px(x, y, C[1])
    for x, y in topm:
        if (x, y - 1) not in topm and x < cx:
            px(x, y, C[1])
    crack = [(560, 157), (564, 158), (569, 158), (573, 159)]
    for x, y in crack:
        px(x, y, B[2])
        px(x + 1, y, B[2])
    outline(body, B[0])
    for x, y in ((503, 170), (506, 171), (590, 169)):
        mushroomlet(x, y)
    for k in range(10):
        cx2 = 512 + k * 4
        px(cx2, 156 + (k % 3), M[0] if False else cv[156 + (k % 3)][cx2])
    cards = [(514, 151, 6, 4), (521, 152, 6, 4), (528, 150, 6, 4)]
    for i, (x, y, w, h) in enumerate(cards):
        m = rect_mask(x, y, x + w, y + h)
        fill(m, C[2])
        vline(x + w, y, y + h, C[1])
        px(x + 3, y + 2, (P[0], T[2], G[1])[i])
        outline(m, B[1])
    for i, (x, y) in enumerate(((538, 149), (543, 152))):
        rect(x, y, x + 1, y + 4 - i, C[2])
        px(x + 1, y + 2, C[1])
        px(x, y - 1, G[3])
        px(x, y - 2, G[2])
        hline(x - 1, x + 2, y + 5 - i, B[1])
    bowl = ellipse_mask(509, 158, 4, 2.4)
    fill(bowl, S[3])
    outline(bowl, S[0])
    for x, y, c in ((508, 157, T[4]), (510, 157, P[1]), (509, 156, L[1])):
        px(x, y, c)
    claw = set()
    for y in range(146, 158):
        w = 3 if y > 152 else 2
        for x in range(567 - w, 568 + w):
            claw.add((x, y))
    fill(claw, B[3])
    for x, y in claw:
        if x > 567:
            px(x, y, B[2])
    outline(claw, B[0])
    hline(562, 573, 157, B[1])
    ball = ellipse_mask(567.5, 140, 7.5, 7.5)
    fill(ball, T[3])
    for x, y in ball:
        dx = x + 0.5 - 565.5
        dy = y + 0.5 - 137.5
        d = math.hypot(dx, dy)
        if d < 3:
            px(x, y, T[4])
        if x + y > 567 + 140 + 4:
            px(x, y, T[2])
    swirl = [(565, 141), (566, 142), (568, 142), (569, 141), (570, 139), (569, 137), (567, 136)]
    for x, y in swirl:
        px(x, y, L[1])
    px(564, 136, C[2])
    px(563, 137, C[2])
    px(565, 135, C[2])
    outline(ball, T[0])
    for x, y in ((560, 131), (575, 134), (572, 129), (561, 146)):
        px(x, y, T[4])
    claim(body | ball | claw)
    cast(side | roots, 3)


def mushroomlet(x, y):
    vline(x, y - 2, y, C[1])
    hline(x - 1, x + 1, y - 3, T[3])
    px(x, y - 4, T[4])
    px(x + 1, y - 3, T[1])


def reception():
    x0, x1, y0, y1 = 256, 383, 80, 95
    body = rect_mask(x0, y0, x1, y1)
    fill(body, B[2])
    rect(x0, y0, x1, y0 + 5, C[1])
    hline(x0, x1, y0 + 1, C[2])
    for x in range(x0, x1 + 1):
        if hsh(x, 0, 170) < 0.2:
            px(x, y0 + 3, C[2])
        if hsh(x, 1, 171) < 0.25:
            px(x, y0 + 4, C[0])
    hline(x0, x1, y0 + 5, C[0])
    hline(x0, x1, y0 + 6, B[1])
    for x in range(x0 + 1, x1):
        vn = vnoise(x, 0, 2.5, 172)
        if vn > 0.64:
            vline(x, y0 + 7, y1 - 2, B[1])
        elif vn < 0.3:
            vline(x, y0 + 7, y1 - 2, B[3])
    hline(x0, x1, y1 - 1, B[1])
    outline(body, B[0])
    for k in range(64):
        x = x0 + 2 + k * 2
        if x > x1 - 2:
            break
        y = y0 + 9 + int(round(math.sin(k * 0.45) * 2.5))
        px(x, y, M[2])
        px(x + 1, y, M[2])
        if k % 3 == 0:
            px(x, y - 1, M[3])
        if k % 3 == 1:
            px(x + 1, y + 1, M[1])
        if k % 9 == 4:
            px(x, y - 1, P[1])
            px(x + 1, y - 1, P[0])
        if k % 13 == 8:
            px(x, y - 1, L[1])
    led = rect_mask(x0 + 22, y0 + 1, x0 + 37, y0 + 4)
    fill(led, T[2])
    hline(x0 + 23, x0 + 36, y0 + 1, C[2])
    hline(x0 + 23, x0 + 36, y0 + 2, C[1])
    vline(x0 + 30, y0 + 1, y0 + 3, C[0])
    outline(led, T[0])
    bell = ellipse_mask(x0 + 76, y0 + 1, 3, 3)
    bell = {(x, y) for (x, y) in bell if y <= y0 + 2}
    fill(bell, G[2])
    px(x0 + 75, y0 - 1, G[3])
    outline(bell, G[0])
    hline(x0 + 72, x0 + 79, y0 + 3, B[1])
    px(x0 + 76, y0 - 3, G[0])
    vase = rect_mask(x0 + 105, y0 - 2, x0 + 109, y0 + 3)
    fill(vase, T[3])
    vline(x0 + 109, y0 - 2, y0 + 3, T[2])
    px(x0 + 106, y0 - 1, T[4])
    outline(vase, T[0])
    for x, y, c in ((x0 + 105, y0 - 5, P[1]), (x0 + 107, y0 - 7, L[1]), (x0 + 109, y0 - 5, P[1]), (x0 + 106, y0 - 4, M[3]), (x0 + 108, y0 - 4, M[3]), (x0 + 107, y0 - 3, M[2]), (x0 + 107, y0 - 6, M[2])):
        px(x, y, c)
    for i, x in enumerate((x0 + 8, x0 + 10)):
        rect(x, y0 - 2 - i * 2, x, y0 + 3, C[2])
    px(x0 + 9, y0 + 3, B[1])
    claim(body)
    cast(body, 3)


def rug_leaf():
    x0, x1, y0, y1 = 258, 381, 98, 157
    rmask = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            cx = min(max(x, x0 + 7), x1 - 7)
            cy = min(max(y, y0 + 7), y1 - 7)
            if (x - cx) ** 2 + (y - cy) ** 2 <= 49:
                rmask.add((x, y))
    fill(rmask, M[2])
    for x, y in rmask:
        if (x // 2 + y) % 4 == 0 and (x + y) % 2 == 0:
            px(x, y, M[1])
    for x, y in rmask:
        dx = min(x - x0, x1 - x)
        dy = min(y - y0, y1 - y)
        d = min(dx, dy)
        if d < 5:
            px(x, y, T[2] if d > 0 else T[1])
            if d == 2 and (x + y) % 6 < 2:
                px(x, y, T[3])
            if d == 4:
                px(x, y, T[1])
        elif d == 6:
            px(x, y, C[0] if (x + y) % 4 else G[1])
    cx, cy = 320, 127
    leaf = set()
    for y in range(cy - 10, cy + 11):
        w = int(round(math.cos((y - cy) / 11.0 * 1.45) * 22))
        for x in range(cx - w, cx + w + 1):
            leaf.add((x, y))
    fill(leaf, M[3])
    for x, y in leaf:
        if y < cy:
            px(x, y, M[3])
        else:
            px(x, y, M[2] if (x + y) % 2 else M[3])
    hline(cx - 20, cx + 20, cy, C[0])
    for k in range(-16, 17, 6):
        for j in range(5):
            px(cx + k + j, cy - 1 - j, C[0])
            px(cx + k + j, cy + 1 + j, M[1])
    outline(leaf, T[1])
    for x in range(y0 + 6, y1 - 5, 2):
        pass
    for y in range(y0 + 8, y1 - 7, 2):
        px(x0 - 1, y, C[0])
        px(x0 - 2, y, C[1] if y % 4 == 0 else C[0])
        px(x1 + 1, y, C[0])
        px(x1 + 2, y, C[1] if y % 4 == 0 else C[0])
    for x, y in side_edges(rmask, 0, 1) | side_edges(rmask, 1, 0):
        px(x, y, T[0])
    for x, y in side_edges(rmask, 0, -1) | side_edges(rmask, -1, 0):
        px(x, y, T[1])


def rug_round():
    cx, cy = 87.5, 255.5
    m = ellipse_mask(cx, cy, 38.5, 30.5)
    for x, y in m:
        d = math.hypot((x + 0.5 - cx) / 38.5, (y + 0.5 - cy) / 30.5)
        band = int(d * 9)
        c = (T[2], M[2], M[2], T[1], M[2], C[0], M[2], T[2], T[1])[min(band, 8)]
        px(x, y, c)
        if c == M[2] and (x + 2 * y) % 5 == 0:
            px(x, y, M[1])
        if c == T[2] and (x + y) % 4 == 0:
            px(x, y, T[3])
    for x, y in side_edges(m, 0, 1) | side_edges(m, 1, 0):
        px(x, y, T[0])
    for x, y in side_edges(m, 0, -1) | side_edges(m, -1, 0):
        px(x, y, T[1])
    for a in range(0, 360, 20):
        x = cx + math.cos(math.radians(a)) * 34
        y = cy + math.sin(math.radians(a)) * 27
        px(int(x), int(y), P[1] if a % 40 == 0 else C[1])


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
        ring = int(d * 5 + vnoise(x, y, 5, 180 + tx) * 0.5)
        if ring % 2 == 0:
            px(x, y, B[4])
        if d < 0.15:
            px(x, y, C[0])
    for x, y in topm:
        if (x, y - 1) not in topm and x < cx + 6:
            px(x, y, C[0])
    outline(topm | side, B[0])
    for k in range(6):
        x = x0 + 4 + k * 7
        px(x, y0 + 16 + (k % 2), M[2])
        px(x + 1, y0 + 17, M[3] if k % 2 else M[1])
    for kind, dx, dy in items:
        draw_item(kind, cx + dx, y0 + 11 + dy)
    allm = topm | side | base
    claim(allm)
    cast(side | base, 3)


def draw_item(kind, x, y):
    if kind == "mug":
        m = rect_mask(x - 2, y - 3, x + 2, y + 1)
        fill(m, B[3])
        vline(x + 2, y - 3, y + 1, B[2])
        hline(x - 1, x + 1, y - 3, C[2])
        px(x - 1, y - 2, B[4])
        hline(x - 2, x + 2, y - 1, G[0])
        outline(m, B[0])
        px(x + 3, y - 2, B[0])
        px(x + 3, y - 1, B[0])
        hline(x - 2, x + 3, y + 2, B[1])
    elif kind == "fruit":
        bowl = ellipse_mask(x, y, 5, 2.5)
        fill(bowl, S[3])
        for p in side_edges(bowl, 0, 1):
            px(p[0], p[1], S[2])
        outline(bowl, S[0])
        for dx, dy, c in ((-2, -1, P[0]), (0, -2, G[2]), (2, -1, P[1]), (1, 0, M[3]), (-1, 0, G[1])):
            px(x + dx, y + dy, c)
        px(x - 2, y - 2, P[1])
        px(x + 1, y - 3, G[3])
    elif kind == "candle":
        rect(x, y - 4, x + 1, y, C[2])
        px(x + 1, y - 3, C[1])
        px(x, y - 5, B[1])
        px(x, y - 6, G[3])
        px(x, y - 7, G[2])
        hline(x - 1, x + 2, y + 1, S[1])
    elif kind == "map":
        m = rect_mask(x - 6, y - 3, x + 6, y + 2)
        fill(m, C[1])
        for p in m:
            if hsh(p[0], p[1], 190) < 0.12:
                px(p[0], p[1], M[2])
        hline(x - 4, x + 3, y - 1, B[3])
        px(x + 2, y, P[0])
        vline(x - 2, y - 2, y + 1, T[2])
        outline(m, B[1])
        vline(x - 7, y - 3, y + 2, B[3])
        vline(x + 7, y - 3, y + 2, B[3])
    elif kind == "teapot":
        m = ellipse_mask(x, y - 1, 4, 3.2)
        fill(m, T[3])
        for p in m:
            if p[0] > x + 1:
                px(p[0], p[1], T[2])
        px(x - 2, y - 3, T[4])
        outline(m, T[0])
        px(x + 4, y - 2, T[0])
        px(x + 5, y - 3, T[0])
        px(x - 5, y - 1, T[0])
        px(x - 5, y - 2, T[0])
        px(x, y - 5, B[3])
    elif kind == "cup":
        rect(x - 1, y - 2, x + 1, y, C[2])
        px(x + 1, y - 1, C[1])
        hline(x - 1, x + 1, y - 2, T[2])
        hline(x - 2, x + 2, y + 1, B[1])
    elif kind == "leafplate":
        m = ellipse_mask(x, y, 5, 2.2)
        fill(m, M[3])
        hline(x - 3, x + 3, y, M[2])
        outline(m, M[1])
        px(x - 1, y - 1, G[2])
        px(x + 1, y - 1, C[2])


def bar_shelf():
    x0, x1, y0, y1 = 400, 559, 192, 239
    body = rect_mask(x0, y0, x1, y1)
    fill(body, B[1])
    for x in range(x0, x1 + 1):
        for y in range(y0 + 6, y1):
            if bayer(x, y) < 0.3:
                px(x, y, B[0])
            if vnoise(x, y, 3, 200) > 0.72:
                px(x, y, B[2])
    rect(x0, y0, x1, y0 + 5, B[3])
    hline(x0, x1, y0 + 1, B[4])
    hline(x0, x1, y0 + 5, B[1])
    for x in range(x0, x1 + 1):
        if hsh(x, 0, 201) < 0.25:
            px(x, y0 + 3, B[4])
    boards = [(215, 217), (235, 239)]
    for ya, yb in boards:
        rect(x0, ya, x1, yb, B[3])
        hline(x0, x1, ya, B[4])
        hline(x0, x1, yb, B[1])
        hline(x0, x1, ya + 1, B[3])
        if yb - ya > 2:
            hline(x0, x1, yb - 1, B[2])
    posts = [x0, x0 + 52, x0 + 105, x1 - 4]
    for pxp in posts:
        for y in range(y0 + 6, y1):
            wob = 1 if math.sin(y * 0.4 + pxp) > 0.7 else 0
            px(pxp + wob, y, B[3])
            px(pxp + 1 + wob, y, B[2])
            px(pxp + 2 + wob, y, B[2])
            px(pxp + 3 + wob, y, B[1])
    outline(body, B[0])
    rr = random.Random(11)
    hues = [(T[3], T[2], T[0]), (P[1], P[0], B[1]), (L[1], L[0], T[0]), (M[3], M[2], M[0]), (G[2], G[1], G[0])]
    for (sa, sb) in ((x0 + 5, x0 + 50), (x0 + 57, x0 + 103), (x0 + 110, x1 - 6)):
        for floor_y in (214, 234):
            x = sa + rr.randint(0, 2)
            while x < sb - 3:
                kind = rr.choice(("flask", "tall", "jar", "vial", "flask", "jar"))
                c1, c2, ink = rr.choice(hues)
                if kind == "jar":
                    c1, c2, ink = G[2], G[1], G[0]
                    if x + 8 > sb:
                        break
                    m = rect_mask(x, floor_y - 7, x + 7, floor_y)
                    m -= {(x, floor_y - 7), (x + 7, floor_y - 7), (x, floor_y), (x + 7, floor_y)}
                    fill(m, c1)
                    for p in m:
                        if p[0] >= x + 5:
                            px(p[0], p[1], c2)
                    px(x + 2, floor_y - 5, G[3])
                    px(x + 2, floor_y - 4, G[3])
                    outline(m, ink)
                    rect(x + 1, floor_y - 9, x + 6, floor_y - 8, C[1])
                    hline(x + 1, x + 6, floor_y - 9, C[2])
                    px(x + 1, floor_y - 8, B[1])
                    px(x + 6, floor_y - 8, B[1])
                    x += 9
                elif kind == "flask":
                    if x + 8 > sb:
                        break
                    m = ellipse_mask(x + 4, floor_y - 3.5, 4, 4)
                    fill(m, c1)
                    for p in m:
                        if p[0] + p[1] > x + 4 + floor_y - 3:
                            px(p[0], p[1], c2)
                    outline(m, ink)
                    rect(x + 3, floor_y - 10, x + 4, floor_y - 8, C[1])
                    vline(x + 2, floor_y - 10, floor_y - 8, ink)
                    vline(x + 5, floor_y - 10, floor_y - 8, ink)
                    hline(x + 3, x + 4, floor_y - 11, B[3])
                    px(x + 2, floor_y - 5, C[2])
                    x += 9
                elif kind == "tall":
                    if x + 5 > sb:
                        break
                    m = rect_mask(x, floor_y - 9, x + 4, floor_y)
                    fill(m, c1)
                    vline(x + 3, floor_y - 9, floor_y, c2)
                    outline(m, ink)
                    rect(x + 1, floor_y - 13, x + 3, floor_y - 10, c2)
                    vline(x + 2, floor_y - 13, floor_y - 10, c1)
                    hline(x + 1, x + 3, floor_y - 14, B[3])
                    px(x + 1, floor_y - 7, C[2])
                    px(x + 1, floor_y - 6, C[2])
                    hline(x + 1, x + 3, floor_y - 4, C[1])
                    x += 6
                else:
                    if x + 4 > sb:
                        break
                    m = rect_mask(x, floor_y - 5, x + 2, floor_y)
                    fill(m, c1)
                    outline(m, ink)
                    px(x + 1, floor_y - 6, B[3])
                    px(x + 1, floor_y - 3, C[2])
                    x += 4
                x += rr.randint(0, 2)
    for vx, ln in ((x0 + 20, 8), (x0 + 70, 12), (x0 + 128, 7), (x0 + 150, 10)):
        for k in range(ln):
            xx = vx + int(round(math.sin(k * 0.8) * 1.4))
            px(xx, y0 + 4 + k, M[2])
            if k % 3 == 1:
                px(xx + 1, y0 + 4 + k, M[3])
        px(vx, y0 + 4 + ln, P[1] if vx % 2 else M[3])
    for x in range(x0 + 2, x1 - 1):
        if vnoise(x, 1, 5, 202) > 0.6:
            px(x, y0 + 2, M[2])
            px(x, y0 + 1, M[3])
    claim(body)
    cast(rect_mask(x0, y1 - 3, x1, y1), 3)


def bar_counter():
    x0, x1, y0, y1 = 384, 575, 256, 271
    body = rect_mask(x0, y0, x1, y1)
    fill(body, B[2])
    rect(x0, y0, x1, y0 + 5, B[3])
    hline(x0, x1, y0 + 1, B[4])
    for x in range(x0, x1 + 1):
        if vnoise(x, 0, 6, 210) > 0.62:
            px(x, y0 + 3, B[2])
        if hsh(x, 2, 211) < 0.18:
            px(x, y0 + 2, B[4])
    hline(x0, x1, y0 + 5, B[2])
    hline(x0, x1, y0 + 6, B[1])
    for x in range(x0 + 1, x1):
        vn = vnoise(x, 0, 2.5, 212)
        if vn > 0.64:
            vline(x, y0 + 7, y1 - 2, B[1])
        elif vn < 0.3:
            vline(x, y0 + 7, y1 - 2, B[3])
    hline(x0, x1, y1 - 1, B[1])
    outline(body, B[0])
    for k in range(96):
        x = x0 + 2 + k * 2
        if x > x1 - 2:
            break
        y = y0 + 10 + int(round(math.sin(k * 0.5) * 2))
        px(x, y, M[2])
        px(x + 1, y, M[2])
        if k % 2 == 0:
            px(x, y - 1, M[3])
        else:
            px(x + 1, y + 1, M[1])
        if k % 11 == 5:
            px(x, y - 1, G[2])
        if k % 11 == 9:
            px(x, y - 1, P[1])
    for kind, x in (("mug", 398), ("mug", 418), ("bottle", 446), ("leafplate", 500), ("mug", 530), ("cup", 552), ("candle", 566)):
        if kind == "bottle":
            m = rect_mask(x - 2, y0 - 3, x + 2, y0 + 3)
            fill(m, T[2])
            vline(x + 1, y0 - 3, y0 + 3, T[1])
            px(x - 1, y0 - 2, T[4])
            outline(m, T[0])
            rect(x - 1, y0 - 7, x, y0 - 4, T[1])
            px(x - 1, y0 - 8, B[3])
            px(x, y0 - 8, B[3])
        else:
            draw_item(kind, x, y0 + 3)
    claim(body)
    cast(body, 3)


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
    fill(seat, B[4])
    for x, y in seat:
        d = math.hypot((x + 0.5 - cx) / 6.5, (y + 0.5 - y0 - 6) / 3.5)
        if 0.45 < d < 0.7:
            px(x, y, B[3])
        if d < 0.2:
            px(x, y, C[0])
    outline(seat | rim, B[0])
    claim(seat | rim | base)
    cast(base | rim, 2)


def barrel(tx, ty, top_kind):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 8
    body = set()
    for y in range(y0 - 2, y0 + 16):
        bulge = int(round(math.sin((y - y0 + 2) / 17.0 * math.pi) * 1.4))
        for x in range(x0 + 2 - bulge, x0 + 14 + bulge):
            body.add((x, y))
    fill(body, B[3])
    for x, y in body:
        lx = x - x0
        if lx in (5, 9, 13):
            px(x, y, B[2])
        if lx <= 3:
            px(x, y, B[4] if y < y0 + 8 else B[3])
        if lx >= 12:
            px(x, y, B[2])
        if lx >= 14:
            px(x, y, B[1])
    for hy in (y0 + 4, y0 + 11):
        for x in range(x0, x0 + 16):
            if (x, hy) in body:
                px(x, hy, M[2])
                if (x, hy + 1) in body:
                    px(x, hy + 1, M[1])
                if x < x0 + 6 and (x, hy - 1) in body:
                    px(x, hy - 1, M[3])
    outline(body, B[0])
    top = ellipse_mask(cx, y0 + 0.5, 6.5, 2.6)
    if top_kind == "lid":
        fill(top, B[3])
        for x, y in top:
            if y <= y0 - 1:
                px(x, y, B[4])
        hline(cx - 4, cx + 3, y0, B[2])
        outline(top, B[0])
        px(cx, y0 - 1, B[1])
    elif top_kind == "apples":
        fill(top, B[1])
        for dx, dy, c in ((-3, 0, P[0]), (-1, -1, P[1]), (1, 0, P[0]), (3, -1, G[2]), (0, 1, P[0]), (2, 1, M[3])):
            px(cx + dx, y0 + dy, c)
        outline(top, B[0])
    else:
        fill(top, G[1])
        for x, y in top:
            if y <= y0 - 1:
                px(x, y, G[2])
        px(cx - 2, y0 - 1, G[3])
        outline(top, B[0])
    claim(body)
    cast(body, 3)


def lamp(tx, ty):
    x0, y0 = tx * 16, ty * 16
    cx = x0 + 8
    foot = set()
    for y in range(y0 + 12, y0 + 16):
        w = 2 + (y - y0 - 12)
        for x in range(cx - w, cx + w):
            foot.add((x, y))
    fill(foot, B[2])
    for x, y in foot:
        if x < cx - 1:
            px(x, y, B[3])
    post = set()
    for y in range(y0 + 4, y0 + 13):
        o = 1 if (y // 3) % 2 else 0
        post.add((cx - 1 + o, y))
        post.add((cx + o, y))
    for x, y in post:
        px(x, y, B[3] if x == min(xx for xx, yy in post if yy == y) else B[2])
    outline(foot, B[0])
    outline_outer(post, B[0], x0, y0 - 4, x0 + 15, y0 + 15)
    for x, y in post:
        px(x, y, B[3] if x == min(xx for xx, yy in post if yy == y) else B[2])
    orb = ellipse_mask(cx, y0 + 1, 4.5, 4.5)
    fill(orb, G[2])
    for x, y in orb:
        if math.hypot(x + 0.5 - cx + 1, y + 0.5 - y0 - 0.5) < 2:
            px(x, y, G[3])
    for x, y in side_edges(orb, 1, 0) | side_edges(orb, 0, 1):
        px(x, y, G[1])
    outline(orb, T[1])
    px(cx - 2, y0 - 1, C[2])
    hline(cx - 2, cx + 1, y0 - 4, M[2])
    px(cx - 3, y0 - 3, M[3])
    px(cx + 2, y0 - 3, M[2])
    px(cx + 1, y0 + 2, G[3])
    px(cx - 1, y0 + 3, C[2])
    allm = foot | post | orb
    claim(allm)
    cast(foot, 2)


def door():
    x0, x1 = 304, 335
    for y in range(368, H):
        for x in range(x0, x1 + 1):
            n = vnoise(x, y, 4, 220)
            px(x, y, M[3] if n > 0.45 else M[2])
            if n > 0.72 and bayer(x, y) < 0.5:
                px(x, y, M[4])
    for y in range(372, H):
        for x in range(x0, x1 + 1):
            v = (y - 371) / 10.0
            if v > bayer(x, y):
                lighten(x, y)
    for x, y in ((x0 + 12, 381), (x0 + 19, 377), (x0 + 22, 382)):
        px(x, y, C[2] if x % 2 else P[1])
    slab = rect_mask(x0, 366, x1, 369)
    stones(slab, x0, 366, 11, 4, 221)
    hline(x0 + 1, x1 - 1, 366, S[4])
    outline(slab, S[0])
    door_leaf(x0, 1)
    door_leaf(x1 - 6, -1)
    door_mat(x0 + 5, 354, x1 - 5, 364)


def door_leaf(xa, inward):
    leaf = rect_mask(xa, 370, xa + 6, H - 1)
    fill(leaf, B[3])
    for y in range(371, H):
        px(xa + 1, y, B[4])
        px(xa + 3, y, B[2])
        px(xa + 5, y, B[2] if inward == 1 else B[4])
    hline(xa + 1, xa + 5, 370, C[0])
    for band in (373, 380):
        hline(xa + 1, xa + 5, band, S[1])
        hline(xa + 1, xa + 5, band - 1, S[3])
        px(xa + 3, band - 1, S[4])
    outline(leaf, B[0])
    hx = xa + 6 if inward == 1 else xa
    px(hx, 376, G[2])
    px(hx, 377, G[1])
    px(hx + inward, 376, G[3])
    px(hx + inward, 377, G[0])


def door_mat(xa, ya, xb, yb):
    mat = rect_mask(xa, ya, xb, yb)
    fill(mat, C[0])
    for x, y in mat:
        if (x + y) % 2 == 0:
            px(x, y, B[4])
        if (x - xa) % 4 == 3 and y % 2 == 0:
            px(x, y, B[3])
    for x, y in edge(mat):
        px(x, y, G[1] if (x + y) % 3 else G[0])
    hline(xa + 1, xb - 1, ya + 1, C[1])
    cx, cy = (xa + xb) // 2, (ya + yb) // 2
    for dy in range(-2, 3):
        w = 5 - abs(dy) * 2
        hline(cx - w, cx + w, cy + dy, M[2] if dy > 0 else M[3])
    hline(cx - 5, cx + 5, cy, G[2])
    for x in range(xa + 1, xb, 2):
        px(x, ya - 1, C[0])
        px(x, yb + 1, B[3])


def door_spill():
    for y in range(338, 368):
        t = (y - 338) / 30.0
        half = 13 + (367 - y) * 0.4
        for x in range(int(320 - half), int(320 + half) + 1):
            if not floor[y][x]:
                continue
            d = abs(x + 0.5 - 320) / half
            if (1 - d * d) * t * 0.6 > bayer(x, y):
                lighten(x, y)


MAP_ROWS = (
    "aaaaa.gggggg",
    "aaaaaa.ggggg",
    "aaaaaa.ggggg",
    "aaaaa..ggggg",
    "aaaa.gggggg.",
    ".....ggggg.b",
    "vvvv.....bbb",
    "vvvvvv.bbbbb",
    "vvvvvv.bbbbb",
    "vvvvvvv.bbbb",
    "vvvvvv.bbbbb",
    "vvvvv.bbbbbb",
)


def map_region(key, row, col):
    if row >= len(MAP_ROWS) or col >= 12 or row < 0:
        return False
    return MAP_ROWS[row][col] == key


def map_sheet(xa, ya):
    tones = {"a": (G[2], G[1], G[0]), "g": (M[4], M[3], M[2]), "v": (V[1], V[1], V[0]), "b": (C[2], L[1], L[0])}
    for row, line in enumerate(MAP_ROWS):
        for col, key in enumerate(line):
            if key == ".":
                px(xa + col, ya + row, C[2])
                continue
            hi, mid, lo = tones[key]
            c = mid
            if not map_region(key, row - 1, col):
                c = hi
            elif not map_region(key, row + 1, col):
                c = lo
            px(xa + col, ya + row, c)


def world_map():
    board = rect_mask(288, 350, 303, 365)
    legs = rect_mask(289, 366, 290, 371) | rect_mask(301, 366, 302, 371)
    for x, y in legs:
        px(x, y, B[3] if x in (289, 301) else B[1])
    solid(board, B[3], B[4], B[2], B[0])
    hline(289, 302, 351, C[0])
    px(303, 351, B[0])
    px(288, 351, B[0])
    map_sheet(290, 352)
    hline(290, 301, 364, B[1])
    px(297, 353, P[0])
    px(297, 352, C[2])
    for x, y, c in ((288, 349, M[3]), (289, 349, M[2]), (290, 348, M[3]), (302, 349, M[2]), (303, 349, P[1])):
        px(x, y, c)
    claim({(x, y) for (x, y) in board | legs if y < 368})
    cast(board, 2)


def rim_light(x0, x1, y, colour, seed, level):
    for x in range(x0, x1 + 1):
        if vnoise(x, y, 5, seed) < level:
            px(x, y, colour)


def pool(cx, cy, rx, ry, strength, only):
    for x, y in ellipse_mask(cx, cy, rx, ry):
        if not inside(x, y) or cv[y][x] not in only:
            continue
        d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
        if (1 - d) * strength > bayer(x, y):
            lighten(x, y, 1, LIFT)


def glow_bud(cx, cy):
    bud = ellipse_mask(cx + 0.5, cy + 0.5, 2.6, 2.6)
    fill(bud, G[2])
    px(cx, cy, G[3])
    px(cx - 1, cy - 1, C[2])
    outline(bud, T[1])
    px(cx, cy, G[3])
    px(cx, cy - 4, B[0])
    pool(cx + 0.5, cy + 3, 12, 9, 0.7, {B[0], B[1]})


def accents():
    hline(274, 365, 6, B[4])
    rim_light(275, 364, 6, C[0], 240, 0.5)
    rim_light(33, 190, 37, C[0], 241, 0.5)
    rim_light(401, 558, 193, C[0], 242, 0.5)
    rim_light(434, 493, 22, C[0], 243, 0.5)
    glow_bud(453, 201)
    glow_bud(506, 201)
    pool(332, 83, 30, 3.5, 1.0, {C[1], C[0]})
    for x0 in (48, 128):
        pool(x0 + 16, 15, 27, 17, 0.5, {B[1], B[2], B[3]})
    pool(567.5, 154, 24, 7, 0.9, {B[2], B[3], B[4], C[0]})
    hline(565, 570, 147, G[1])
    px(566, 147, G[2])


def light_shaft(wx, wy, slope, half, length, strength):
    for y in range(wy, wy + length):
        t = (y - wy) / float(length)
        cxs = wx + (y - wy) * slope
        hw = half + t * 5
        for x in range(int(cxs - hw) - 1, int(cxs + hw) + 2):
            if not inside(x, y):
                continue
            d = abs(x + 0.5 - cxs) / hw
            if d >= 1:
                continue
            fade = 1.0 if t < 0.75 else (1 - t) / 0.25
            if t < 0.08:
                fade *= t / 0.08
            thr = 0.5 if d < 0.6 else 0.25
            if bayer(x, y) < thr * fade * strength * 2:
                lighten(x, y)


def glints():
    for x, y in ((112, 96), (150, 112), (95, 125), (200, 132), (176, 186)):
        if floor[y][x]:
            px(x, y, C[1])


def root_column(rx, ph, w):
    for y in range(0, 48):
        flare = max(0, y - 34) * 0.45
        cx = rx + math.sin(y * 0.09 + ph) * 2.2
        half = w / 2.0 + flare
        x0 = int(round(cx - half))
        x1 = int(round(cx + half))
        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1, x1 - x0)
            if t < 0.18:
                c = B[4]
            elif t < 0.55:
                c = B[3]
            elif t < 0.85:
                c = B[2]
            else:
                c = B[1]
            if 0.3 < t < 0.8 and hsh(int(t * 6), y // 2 + int(ph * 9), 7) < 0.18:
                c = B[2]
            px(x, y, c)
        px(x0 - 1, y, B[1])
        px(x1 + 1, y, B[0])
        if hsh(rx, y, 8) < 0.1:
            px(x0 + 1, y, M[2])
            px(x0 + 2, y, M[3])


def canopy():
    for x in range(W):
        depth = 5 + int(vnoise(x, 0, 7, 11) * 5)
        for y in range(0, depth):
            px(x, y, B[0])
        px(x, depth, B[1])
    rr = random.Random(3)
    x = 2
    while x < W:
        cx = x + rr.randint(0, 6)
        cy = rr.randint(4, 8)
        rx = rr.uniform(3.5, 6.5)
        ry = rr.uniform(2.2, 3.4)
        m = ellipse_mask(cx, cy, rx, ry)
        fill(m, M[1])
        for p in m:
            if (p[0], p[1] - 1) not in m or (p[0] - 1, p[1]) not in m:
                px(p[0], p[1], M[2])
            if hsh(p[0], p[1], 12) < 0.12:
                px(p[0], p[1], M[3])
        for p in side_edges(m, 0, 1):
            px(p[0], p[1] + 1, M[0])
        x += rr.randint(7, 13)
    x = 9
    while x < W:
        ln = rr.randint(6, 30)
        vx = x
        for k in range(ln):
            xx = vx + int(round(math.sin(k * 0.45 + x) * 1.2))
            px(xx, 8 + k, M[1] if k % 4 else M[2])
            if k % 4 == 2:
                px(xx + (1 if k % 8 == 2 else -1), 8 + k, M[3])
                px(xx + (2 if k % 8 == 2 else -2), 8 + k - 1, M[2])
        px(vx, 8 + ln, M[3])
        if ln > 20 and rr.random() < 0.5:
            px(vx + 1, 9 + ln, P[1] if rr.random() < 0.5 else L[1])
        x += rr.randint(18, 40)


def floor_root(points, w0, w1):
    body = set()
    total = len(points) - 1
    samples = []
    for i in range(total):
        ax, ay = points[i]
        bx, by = points[i + 1]
        n = int(max(abs(bx - ax), abs(by - ay))) + 1
        for k in range(n):
            t = k / float(n)
            samples.append((ax + (bx - ax) * t, ay + (by - ay) * t, (i + t) / total))
    for sx, sy, t in samples:
        r = w0 + (w1 - w0) * t
        for y in range(int(sy - r) - 1, int(sy + r) + 2):
            for x in range(int(sx - r) - 1, int(sx + r) + 2):
                if (x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2 <= r * r:
                    body.add((x, y))
    body = {(x, y) for (x, y) in body if 16 <= x < 624 and 48 <= y < 368}
    fill(body, F[2])
    for x, y in body:
        if (x, y - 1) not in body:
            px(x, y, C[0] if bayer(x, y) < 0.6 else F[2])
        elif (x, y + 1) not in body:
            px(x, y, F[1])
        elif hsh(x // 3, y, 230) < 0.12:
            px(x, y, F[1])
    for x, y in body:
        for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            p = (x + dx, y + dy)
            if p not in body and 16 <= p[0] < 624 and 48 <= p[1] < 368:
                px(p[0], p[1], F[0])
    for x, y in body:
        if (x, y + 2) not in body and (x, y + 1) not in body and inside(x, y + 2):
            if bayer(x, y + 2) < 0.5 and y + 2 < 368:
                darken(x, y + 2)


def floor_roots():
    floor_root([(16, 196), (40, 199), (66, 207), (92, 210), (118, 218)], 4.4, 0.8)
    floor_root([(16, 300), (30, 296), (46, 300)], 3.4, 0.8)
    floor_root([(450, 367), (446, 352), (451, 338), (447, 326)], 4.0, 0.8)
    floor_root([(623, 116), (600, 122), (580, 120), (566, 126)], 3.8, 0.8)


def build():
    wall_face()
    for x, y, f in ((24, 22, False), (196, 14, True), (262, 28, False), (392, 12, True), (526, 10, False), (612, 20, True), (104, 14, False), (172, 30, True), (394, 32, False)):
        fungus(x, y, f)
    for x, y in ((86, 45), (164, 45), (250, 45), (420, 45), (540, 45), (600, 45)):
        mushrooms(x, y)
    plank_floor()
    flag_floor()
    floor_roots()
    floor_moss()
    floor_flowers()
    mark_floor()
    back_shadow()
    side_walls()
    bottom_wall()
    door()
    for x0 in (48, 128):
        window(x0)
    banner(208, T[2], T[3], T[1], leaf_motif)
    banner(400, M[2], M[3], M[1], moon_motif)
    banner(560, T[2], T[3], T[1], sprig_motif)
    quest_board()
    lantern(240, 16)
    lantern(368, 16)
    rug_leaf()
    rug_round()
    fireplace()
    bookshelves()
    forge()
    plant(1, 3, "fern")
    plant(13, 3, "bloom")
    plant(38, 6, "blue")
    reception()
    desk()
    stump_table()
    plant(1, 13, "fern")
    plant(38, 14, "sapling")
    round_table(14, 13, [("teapot", -6, -1), ("cup", 4, -2), ("cup", 9, 1)])
    bar_shelf()
    round_table(4, 15, [("mug", -8, 0), ("fruit", 3, -1), ("mug", 11, 1)])
    bar_counter()
    for tx in (25, 27, 29, 31, 33, 35):
        stool(tx, 17)
    round_table(10, 18, [("map", -3, 0), ("candle", 10, -1)])
    barrel(1, 20, "lid")
    barrel(37, 20, "apples")
    barrel(38, 20, "lid")
    barrel(1, 21, "honey")
    barrel(2, 21, "apples")
    barrel(38, 21, "honey")
    plant(22, 21, "bloom")
    lamp(17, 22)
    lamp(22, 22)
    world_map()
    apply_shadows()
    glow(464, 62, 70, 0.9, floor_only=True)
    glow(464, 30, 40, 0.5, wall_only=True)
    glow(520, 66, 44, 0.6, floor_only=True)
    glow(248, 30, 18, 0.7, wall_only=True)
    glow(376, 30, 18, 0.7, wall_only=True)
    glow(280, 354, 30, 0.7, floor_only=True)
    glow(360, 354, 30, 0.7, floor_only=True)
    glow(567, 140, 26, 0.5, table=UP, floor_only=True)
    glow(97, 140, 22, 0.35, floor_only=True)
    light_shaft(64, 22, 0.55, 10, 200, 0.8)
    light_shaft(144, 22, 0.55, 10, 185, 0.75)
    glints()
    door_spill()
    accents()


def save():
    img = Image.new("RGB", (W, H))
    img.putdata([PAL[cv[y][x]] for y in range(H) for x in range(W)])
    img.save(OUT)
    img.resize((W * 3, H * 3), Image.NEAREST).save(PREVIEW)
    used = {cv[y][x] for y in range(H) for x in range(W)}
    print("colours used", len(used), "of", len(PAL))


def check_spots():
    import json
    layout = json.load(open(str(ROOT / "design/room-layout.json")))
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
