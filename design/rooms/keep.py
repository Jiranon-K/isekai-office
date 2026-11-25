from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import json
import math
import random

from PIL import Image

W, H = 640, 384
LAYOUT = str(ROOT / "design/room-layout.json")
OUT = str(ROOT / "web/public/assets/rooms/keep.png")
PREVIEW = str(ROOT / "design/preview-keep.png")

PAL = {
    "W0": "120c1a", "W1": "1f1630", "W2": "2d2045", "W3": "3e2d5c", "W4": "574379",
    "F0": "1f141c", "F1": "30202c", "F2": "3e2b3a", "F3": "4c3648", "F4": "5c4257",
    "FW1": "5c3442", "FW2": "7a4446",
    "R1": "5e2f8a", "R2": "9a52d0", "R3": "e0a0ff",
    "M1": "7a1a55", "M2": "c83a86", "M3": "ff86c4",
    "C0": "2e0c18", "C1": "5c1426", "C2": "8e1f30", "C3": "c03a3a",
    "E1": "d0501c", "E2": "f39234", "E3": "ffe08c",
    "G1": "5e4a24", "G2": "9a7c3a", "G3": "d4b868",
    "B1": "7d6f68", "B2": "b8aa98", "B3": "e6dcc6",
    "N1": "3f7a4a", "N2": "6fb86a", "S1": "7fa8c8", "S2": "bfe0f0",
}

RAMPS = [
    ["W0", "W1", "W2", "W3", "W4"],
    ["F0", "F1", "F2", "F3", "F4"],
    ["R1", "R2", "R3"], ["M1", "M2", "M3"], ["C0", "C1", "C2", "C3"],
    ["E1", "E2", "E3"], ["G1", "G2", "G3"], ["B1", "B2", "B3"], ["FW1", "FW2"],
    ["N1", "N2"], ["S1", "S2"],
]
DARK_FLOOR = {"W0": "W0", "F0": "F0", "R1": "W1", "M1": "C0", "C0": "W0", "E1": "C2", "G1": "W1", "B1": "F2", "FW1": "F2", "N1": "W1", "S1": "W3"}

DARKER = {}
LIGHTER = {}
for ramp in RAMPS:
    for index, name in enumerate(ramp):
        DARKER[name] = ramp[index - 1] if index > 0 else DARK_FLOOR[name]
        LIGHTER[name] = ramp[index + 1] if index < len(ramp) - 1 else name

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

rng = random.Random(1347)
C = [["F2"] * W for _ in range(H)]


def p(x, y, c):
    if c and 0 <= x < W and 0 <= y < H:
        C[y][x] = c


def get(x, y):
    if 0 <= x < W and 0 <= y < H:
        return C[y][x]
    return None


def rect(x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            p(xx, yy, c)


def hl(x0, x1, y, c):
    for xx in range(x0, x1 + 1):
        p(xx, y, c)


def vl(x, y0, y1, c):
    for yy in range(y0, y1 + 1):
        p(x, yy, c)


def darken(x, y):
    c = get(x, y)
    if c:
        p(x, y, DARKER[c])


def lighten(x, y):
    c = get(x, y)
    if c:
        p(x, y, LIGHTER[c])


def sprite(x, y, rows, key):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in key:
                p(x + dx, y + dy, key[ch])


def ellipse(cx, cy, rx, ry, c):
    for yy in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for xx in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((xx - cx) / (rx + 0.35)) ** 2 + ((yy - cy) / (ry + 0.35)) ** 2 <= 1:
                p(xx, yy, c)


def ellipse_ring(cx, cy, rx, ry, c):
    inside = set()
    for yy in range(int(cy - ry) - 2, int(cy + ry) + 3):
        for xx in range(int(cx - rx) - 2, int(cx + rx) + 3):
            if ((xx - cx) / (rx + 0.35)) ** 2 + ((yy - cy) / (ry + 0.35)) ** 2 <= 1:
                inside.add((xx, yy))
    for (xx, yy) in inside:
        if any((xx + a, yy + b) not in inside for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            p(xx, yy, c)


def shadow(x, y, w, h):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if (xx + yy) % 2 == 0 or yy == y:
                darken(xx, yy)


def cast(x, y, w, h, depth=3):
    shadow(x + w, y + 4, depth, h - 4)
    shadow(x + 3, y + h, w, depth)
    hl(x + 1, x + w - 1, y + h, None)


def flame(x, y, size):
    shapes = {
        1: ([".a.", ".b.", "aca", ".a."]),
        2: (["..a..", "..a..", ".aba.", ".bcb.", "abcba", ".bcb.", "..b.."]),
        3: (["...a...", "..aa...", "..aba..", ".abba..", ".abcba.", "abccba.", "abcccba", ".bcccb.", "..bbb.."]),
    }
    sprite(x, y, shapes[size], {"a": "R2", "b": "M3", "c": "B3"})


def candle(x, y, h, size=1):
    vl(x, y, y + h - 1, "B2")
    vl(x + 1, y, y + h - 1, "B1")
    p(x, y, "B3")
    p(x - 1, y + h - 1, "W0")
    p(x + 2, y + h - 1, "W0")
    flame(x - 1, y - 4, 1) if size == 1 else flame(x - 2, y - 7, 2)


def floor_stone(x, y, w, h):
    roll = rng.random()
    if roll < 0.12:
        base, hi, lo = "F1", "F2", "F0"
    else:
        base, hi, lo = "F2", "F3", "F1"
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not (16 <= xx < 624 and 48 <= yy < 368):
                continue
            if xx == x + w - 1 or yy == y + h - 1:
                c = "F0"
            elif yy == y and xx < x + w - 2:
                c = hi
            elif xx == x and yy < y + h - 3:
                c = hi
            elif yy == y + h - 2 and xx > x + 1:
                c = lo
            elif xx == x + w - 2 and yy > y + 1:
                c = lo
            else:
                c = base
            C[yy][xx] = c
    if rng.random() < 0.35 and 16 <= x < 624 and y >= 48:
        p(x, y, "F0")
    for _ in range(rng.randint(0, 2)):
        if w < 7 or h < 7:
            break
        sx = rng.randint(x + 2, x + w - 4)
        sy = rng.randint(y + 2, y + h - 4)
        if 16 <= sx < 623 and 48 <= sy < 367:
            p(sx, sy, lo)
            if rng.random() < 0.5:
                p(sx + 1, sy + 1, hi)
    if rng.random() < 0.18 and w > 12:
        cx = rng.randint(x + 3, x + w - 6)
        cy = y + 1
        for _ in range(rng.randint(3, 7)):
            if 16 <= cx < 623 and 48 <= cy < 367 and cy < y + h - 2:
                p(cx, cy, "F0" if base == "F2" else "W0")
                p(cx + 1, cy, lo)
            cy += 1
            cx += rng.choice([0, 1, 1, -1])


GLYPHS = [
    ["..#..", ".#.#.", "#...#", ".#.#.", "..#.."],
    [".###.", "#...#", "#.#.#", "#...#", ".###."],
    ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
]


def place_glyph(x, y, w, h):
    glyph = rng.choice(GLYPHS)
    gx, gy = x + w // 2 - 2, y + (h - 5) // 2
    for dy, row in enumerate(glyph):
        for dx, ch in enumerate(row):
            if ch == "#":
                p(gx + dx, gy + dy, "R1")


def paint_floor():
    y = 40
    while y < 368:
        x = 16 - rng.randint(0, 22)
        while x < 624:
            w = rng.choice([16, 20, 24, 24, 28, 32])
            roll = rng.random()
            if roll < 0.22:
                top = rng.choice([7, 8, 9])
                floor_stone(x, y, w, top)
                floor_stone(x, y + top, w, 16 - top)
            elif roll < 0.38 and w >= 24:
                left = rng.choice([w // 2 - 2, w // 2, w // 2 + 2])
                floor_stone(x, y, left, 16)
                floor_stone(x + left, y, w - left, 16)
            else:
                floor_stone(x, y, w, 16)
                if rng.random() < 0.04 and 20 < x < 600 and y > 60:
                    place_glyph(x, y, w, 16)
            x += w
        y += 16


def paint_rune_circle(cx, cy, rx, ry):
    ellipse_ring(cx, cy, rx, ry, "R1")
    for i in range(360):
        a = 2 * math.pi * i / 360
        x = round(cx + (rx - 7) * math.cos(a))
        y = round(cy + (ry - 5) * math.sin(a))
        if (i // 6) % 2 == 0:
            p(x, y, "R1")
    for k in range(6):
        a = 2 * math.pi * k / 6 - math.pi / 2
        x = round(cx + (rx - 3.5) * math.cos(a))
        y = round(cy + (ry - 2.5) * math.sin(a))
        sprite(x - 2, y - 2, ["..a..", ".aba.", "abcba", ".aba.", "..a.."], {"a": "F0", "b": "R1", "c": "R2"})
    sprite(cx - 3, cy - 3, ["...a...", "..a.a..", ".a...a.", "a..b..a", ".a...a.", "..a.a..", "...a..."], {"a": "R1", "b": "R2"})
    for yy in range(cy + ry + 4, 364):
        if (yy - cy) % 6 < 3:
            p(cx, yy, "R1")
        if (yy - cy) % 24 == 0:
            sprite(cx - 1, yy - 1, [".a.", "aba", ".a."], {"a": "R1", "b": "R2"})


def wall_block(x, y, w, h):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not (0 <= xx < W):
                continue
            if xx == x + w - 1 or yy == y + h - 1:
                c = "W0" if rng.random() < 0.85 else "W1"
            elif yy == y and xx < x + w - 2:
                c = "W3"
            elif xx == x and yy < y + 3:
                c = "W3"
            elif yy == y + h - 2 and xx > x + 1:
                c = "W1"
            else:
                c = "W2"
            C[yy][xx] = c
    if rng.random() < 0.3:
        p(x + 1, y, "W4")
    if h < 6:
        return
    for _ in range(rng.randint(0, 2)):
        sx, sy = rng.randint(x + 2, x + w - 3), rng.randint(y + 2, y + h - 3)
        p(sx, sy, "W1")
        if rng.random() < 0.5:
            p(sx + 1, sy, "W1")
    if rng.random() < 0.25:
        sx = rng.randint(x + 3, x + w - 5)
        for k in range(3):
            if (sx + k) % 2 == 0:
                p(sx + k, y + h - 3, "W1")


def paint_back_wall():
    rect(0, 0, W, 48, "W2")
    hl(0, W - 1, 0, "W0")
    hl(0, W - 1, 1, "W1")
    hl(0, W - 1, 2, "W3")
    hl(0, W - 1, 3, "W2")
    hl(0, W - 1, 4, "W1")
    hl(0, W - 1, 5, "W0")
    for xx in range(0, W, 6):
        p(xx, 3, "W1")
        p(xx + 1, 3, "W3")
    y = 6
    row = 0
    while y < 40:
        h = 8 if y + 8 <= 40 else 40 - y
        x = -rng.randint(0, 16) if row % 2 else -rng.randint(4, 10)
        while x < W:
            w = rng.choice([14, 16, 18, 20, 22, 24, 26])
            wall_block(x, y, w, h)
            x += w
        y += h
        row += 1
    hl(0, W - 1, 40, "W4")
    rect(0, 41, W, 6, "W2")
    hl(0, W - 1, 41, "W3")
    hl(0, W - 1, 46, "W1")
    hl(0, W - 1, 47, "W0")
    for xx in range(8, W, 32):
        vl(xx, 41, 46, "W1")
        vl(xx + 1, 42, 45, "W3")
    pilasters = [24, 104, 184, 260, 388, 528, 604]
    for px in pilasters:
        pilaster(px)
    for a, b in zip(pilasters, pilasters[1:]):
        arch(a + 10, b - 1)


def pilaster(x):
    rect(x, 8, 10, 32, "W2")
    vl(x, 8, 39, "W0")
    vl(x + 9, 8, 39, "W0")
    vl(x + 1, 10, 37, "W4")
    vl(x + 2, 10, 37, "W3")
    vl(x + 7, 10, 37, "W1")
    vl(x + 8, 10, 37, "W1")
    for yy in range(12, 36, 7):
        p(x + 5, yy, "W1")
    rect(x - 2, 6, 14, 4, "W3")
    hl(x - 2, x + 11, 6, "W4")
    hl(x - 2, x + 11, 9, "W0")
    p(x - 2, 9, "W1")
    p(x + 11, 9, "W1")
    rect(x - 1, 37, 12, 3, "W3")
    hl(x - 1, x + 10, 37, "W4")
    hl(x - 1, x + 10, 39, "W1")
    vl(x + 10, 37, 39, "W0")
    vl(x + 11, 8, 39, "W1")


def arch(x0, x1):
    span = x1 - x0
    mid = (x0 + x1) / 2
    for xx in range(x0, x1 + 1):
        t = abs(xx - mid) / (span / 2)
        yy = round(10 + 12 * (t ** 1.6))
        p(xx, yy, "W0")
        p(xx, yy + 1, "W3")
        if yy - 1 > 6:
            p(xx, yy - 1, "W1")


def paint_side_walls():
    for side_x in (0, 624):
        rect(side_x, 0, 16, H, "W1")
        y = 0
        while y < H:
            h = rng.choice([14, 16, 18, 20])
            rect(side_x + 1, y, 14, h - 1, "W2")
            hl(side_x + 1, side_x + 13, y, "W3")
            vl(side_x + 1, y, y + h - 2, "W3")
            hl(side_x + 2, side_x + 14, y + h - 2, "W1")
            split = rng.choice([6, 7, 8, 9])
            if rng.random() < 0.5:
                vl(side_x + split, y, y + h - 2, "W0")
                vl(side_x + split + 1, y + 1, y + h - 2, "W3")
            if rng.random() < 0.4:
                p(side_x + rng.randint(3, 12), y + rng.randint(2, max(3, h - 4)), "W1")
            y += h
        vl(side_x, 0, H - 1, "W0")
        vl(side_x + 15, 0, H - 1, "W0")
    vl(14, 48, 367, "W1")
    vl(625, 48, 367, "W3")
    rect(0, 368, W, 16, "W1")
    x = -6
    while x < W:
        w = rng.choice([18, 22, 26, 30])
        rect(x + 1, 370, w - 1, 13, "W2")
        hl(x + 1, x + w - 2, 370, "W3")
        vl(x + 1, 370, 381, "W3")
        hl(x + 2, x + w - 1, 381, "W1")
        x += w
    hl(0, W - 1, 368, "W0")
    hl(0, W - 1, 369, "W4")
    hl(0, W - 1, 383, "W0")
    for yy in range(0, 48):
        p(15, yy, "W0")
        p(624, yy, "W0")


def paint_ambient_occlusion():
    for xx in range(16, 624):
        darken(xx, 48)
        if xx % 2 == 0:
            darken(xx, 49)
    for yy in range(48, 368):
        darken(16, yy)
        if yy % 2 == 0:
            darken(17, yy)
    for xx in range(16, 624):
        if xx % 2 == 1:
            darken(xx, 367)


def door_threshold(x0, x1):
    for yy in range(362, 368):
        reach = (yy - 362) * 3
        for xx in range(x0 + 12 - reach, x1 - 11 + reach):
            if x0 <= xx <= x1 and (yy >= 366 or (xx + yy) % 2 == 0):
                lighten(xx, yy)
    for xx in range(x0 + 4, x1 - 2, 6):
        p(xx, 366, "R1")
    p(x0 + 15, 365, "R2")
    p(x0 + 16, 365, "R2")


def door_leaf(xa, xb, ring_x, hinge_x):
    for xx in range(xa, xb + 1):
        col = (xx - xa) % 5
        for yy in range(371, 382):
            c = "C2"
            if col == 4:
                c = "C1"
            elif yy == 371:
                c = "C3"
            elif yy >= 380:
                c = "C1"
            p(xx, yy, c)
    for by in (374, 379):
        hl(hinge_x, hinge_x + 4, by, "W4")
        hl(hinge_x, hinge_x + 4, by + 1, "W0")
    sprite(ring_x, 376, ["33", "g2", "oo"], {"3": "G3", "g": "G3", "2": "G2", "o": "C0"})


def door_arch(x0, x1):
    for (dx, yy) in ((1, 371), (2, 371), (3, 371), (1, 372), (1, 373)):
        p(x0 + dx, yy, "W0")
        p(x1 - dx, yy, "W0")
    p(x0 + 4, 371, "W3")
    p(x0 + 2, 372, "W3")
    p(x1 - 4, 371, "W1")
    p(x1 - 2, 372, "W1")


def paint_door():
    x0, x1 = 304, 335
    door_threshold(x0, x1)
    rect(x0, 368, 32, 16, "W0")
    hl(x0, x1, 369, "W4")
    hl(x0, x1, 370, "W2")
    for xx in range(x0 + 3, x1 - 1, 5):
        p(xx, 369, "G2")
    p(x0 + 15, 369, "R3")
    p(x0 + 16, 369, "R3")
    door_leaf(x0 + 1, x0 + 15, x0 + 12, x0 + 1)
    door_leaf(x0 + 16, x1 - 1, x0 + 18, x1 - 5)
    vl(x0 + 15, 371, 382, "C0")
    vl(x0 + 16, 371, 382, "W0")
    door_arch(x0, x1)
    hl(x0, x1, 382, "C0")
    hl(x0, x1, 383, "W0")
    for jx in (x0 - 8, x1 + 1):
        rect(jx, 364, 8, 20, "W2")
        rect(jx, 364, 8, 3, "W4")
        hl(jx, jx + 7, 367, "W3")
        vl(jx, 364, 383, "W0")
        vl(jx + 7, 364, 383, "W0")
        hl(jx, jx + 7, 363, "W0")
        vl(jx + 1, 367, 382, "W3")
        vl(jx + 6, 367, 382, "W1")
        p(jx + 3, 372, "R2")
        p(jx + 3, 373, "R3")
        p(jx + 4, 373, "R2")
        p(jx + 3, 374, "R2")
        p(jx + 4, 374, "R1")


def world_map():
    x0, y0 = 289, 350
    for lx in (x0 + 1, x0 + 11):
        vl(lx, y0 + 13, 367, "W3")
        vl(lx + 1, y0 + 13, 367, "W0")
    shadow(x0 + 3, 366, 9, 2)
    rect(x0, y0, 14, 13, "W0")
    rect(x0 + 1, y0 + 1, 12, 11, "G1")
    hl(x0 + 1, x0 + 12, y0 + 1, "G2")
    hl(x0 + 1, x0 + 6, y0 + 1, "G3")
    vl(x0 + 1, y0 + 1, y0 + 10, "G2")
    sprite(x0 + 2, y0 + 2, [
        "AaaaabGggg",
        "aaaaabgggg",
        "aaaabggggg",
        "aaabbbgggn",
        "bbbbbbbbbb",
        "Vvvvbsssss",
        "vvmvbSssss",
        "vvvbbsssss",
        "vvrbssssst",
    ], {"A": "E3", "a": "E2", "G": "N2", "g": "N2", "n": "N1", "b": "B3", "V": "R3", "v": "R2", "r": "R1",
        "m": "M3", "S": "S2", "s": "S2", "t": "S1"})
    p(x0 + 6, y0, "G3")
    p(x0 + 7, y0, "G2")


def window(tx, ty):
    x, y = tx * 16, ty * 16
    cx = x + 16
    half = [1, 2, 3, 4, 5, 5, 6, 6, 6]
    top, bottom = 4, 28
    def hw(yy):
        i = yy - top
        return half[i] if i < len(half) else 6
    for yy in range(top - 2, bottom + 1):
        i = yy - (top - 2)
        w2 = (half[i] if i < len(half) else 6) + 2
        for xx in range(cx - w2, cx + w2):
            p(xx, yy, "W3")
        p(cx - w2 - 1, yy, "W0")
        p(cx + w2, yy, "W0")
    p(cx - 1, top - 3, "W0")
    p(cx, top - 3, "W0")
    for yy in range(top - 2, bottom + 1):
        i = yy - (top - 2)
        w2 = (half[i] if i < len(half) else 6) + 2
        p(cx - w2, yy, "W4")
        p(cx + w2 - 1, yy, "W1")
    for yy in range(top, bottom):
        h2 = hw(yy)
        for xx in range(cx - h2, cx + h2):
            lx = xx - (cx - h2)
            band = (yy - top) % 6
            if xx in (cx - 1,):
                c = "W0"
            elif band == 5:
                c = "W0"
            elif (xx + yy) % 6 == 0 and yy > top + 6:
                c = "W1"
            else:
                c = "M2"
                if band == 0 or lx == 0:
                    c = "M3"
                elif yy > bottom - 8 and (xx + yy) % 2 == 0:
                    c = "M1"
                elif xx >= cx + h2 - 1:
                    c = "M1"
            p(xx, yy, c)
        p(cx - h2 - 1, yy, "W0")
        p(cx + h2, yy, "W0")
    sprite(cx - 3, top + 6, ["..a...", ".aba..", "abcba.", ".aba..", "..a..."], {"a": "R1", "b": "R3", "c": "B3"})
    for yy in range(top + 2, top + 12, 6):
        p(cx - hw(yy) + 1, yy + 1, "B3")
    rect(cx - 10, bottom + 1, 20, 3, "W3")
    hl(cx - 10, cx + 9, bottom + 1, "W4")
    hl(cx - 6, cx + 5, bottom + 1, "M3")
    hl(cx - 4, cx + 3, bottom + 2, "M1")
    hl(cx - 10, cx + 9, bottom + 3, "W0")
    p(cx - 11, bottom + 2, "W0")
    p(cx + 10, bottom + 2, "W0")
    vl(cx + 9, bottom + 2, bottom + 2, "W1")
    for k in range(6):
        if k % 2 == 0:
            p(cx - 5 + k * 2, bottom + 4, "M1")


def banner(tx):
    x = tx * 16
    for yy in range(5, 46):
        for xx in range(x + 27, x + 29):
            if (xx + yy) % 2 == 0:
                darken(xx, yy + 1)
    for yy in range(5, 46):
        notch = max(0, yy - 37)
        for xx in range(x + 5, x + 27):
            dx = xx - (x + 15.5)
            if notch and abs(dx) < notch:
                continue
            col = xx - (x + 5)
            c = "C2"
            if col <= 1:
                c = "C3"
            elif col >= 19:
                c = "C1"
            elif col in (6, 15):
                c = "C1"
            elif col in (5, 14):
                c = "C3" if yy % 3 else "C2"
            p(xx, yy, c)
    for yy in range(5, 46):
        notch = max(0, yy - 37)
        p(x + 4, yy, "C0")
        p(x + 27, yy, "C0")
        if notch:
            p(round(x + 15.5 - notch), yy, "C0")
            p(round(x + 15.5 + notch - 1), yy, "C0")
    hl(x + 4, x + 27, 45, None)
    for xx in range(x + 5, x + 27):
        dx = abs(xx - (x + 15.5))
        if dx >= 8:
            p(xx, 45, "C0")
    for xx in range(x + 5, x + 27):
        p(xx, 6, "G1")
        p(xx, 8, "G1")
        if xx % 2 == 0:
            p(xx, 7, "G2")
        p(xx, 35, "G1" if xx % 2 else "G2")
    hl(x + 1, x + 30, 4, "G2")
    hl(x + 1, x + 30, 3, "G3")
    hl(x + 1, x + 30, 5, "W0")
    sprite(x, 2, ["oo", "33", "oo"], {"o": "W0", "3": "G3"})
    sprite(x + 30, 2, ["oo", "33", "oo"], {"o": "W0", "3": "G2"})
    sigil(x + 16, 20)


def sigil(cx, cy):
    rows = [
        "o.........o",
        "3o.......o2",
        ".3o.....o2.",
        ".32o...o21.",
        "..3ooooo2..",
        "..o33322o..",
        ".o3o...o2o.",
        ".o2.....1o.",
        ".o2..r..1o.",
        ".o2.....1o.",
        "..o2...1o..",
        "...o222o...",
        "....o2o....",
        ".....o.....",
    ]
    sprite(cx - 6, cy - 8, rows, {"o": "C0", "3": "G3", "2": "G2", "1": "G1", "r": "M3"})


def lantern(tx, ty):
    x, y = tx * 16, ty * 16
    rect(x + 2, y + 1, 3, 8, "W3")
    vl(x + 2, y + 1, y + 8, "W4")
    vl(x + 4, y + 1, y + 8, "W1")
    p(x + 3, y + 4, "G2")
    hl(x + 4, x + 9, y + 3, "W3")
    hl(x + 4, x + 9, y + 2, "W0")
    hl(x + 4, x + 9, y + 4, "W0")
    sprite(x + 5, y + 4, [
        "..oo..",
        ".o44o.",
        "o3333o",
        "o1ab1o",
        "o1bc1o",
        "oabcbo",
        "obccbo",
        "o1bb1o",
        "o3333o",
        ".o11o.",
        "..oo..",
        "...o..",
    ], {"o": "W0", "4": "W4", "3": "W3", "1": "W1", "a": "R2", "b": "M3", "c": "B3"})


NOTICES = [
    (281, 10, 15, 14, 0), (299, 10, 13, 19, 1), (315, 11, 18, 12, 2), (336, 10, 12, 16, 3),
    (350, 12, 11, 13, 0), (282, 25, 16, 12, 2), (317, 25, 13, 13, 4), (333, 27, 17, 10, 0),
]


def quest_board():
    x0, y0, x1, y1 = 275, 6, 364, 41
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "F3")
    for yy in range(y0 + 3, y1 - 2):
        band = (yy - y0) % 7
        for xx in range(x0 + 3, x1 - 2):
            c = "F3"
            if band == 0:
                c = "F0"
            elif band == 1:
                c = "FW1"
            elif band == 6:
                c = "F2"
            elif (xx * 7 + yy * 3) % 23 == 0:
                c = "F2"
            p(xx, yy, c)
    rect(x0, y0, x1 - x0 + 1, 3, "W3")
    rect(x0, y1 - 2, x1 - x0 + 1, 3, "W2")
    rect(x0, y0, 3, y1 - y0 + 1, "W3")
    rect(x1 - 2, y0, 3, y1 - y0 + 1, "W2")
    hl(x0, x1, y0, "W4")
    vl(x0, y0, y1, "W4")
    hl(x0 + 2, x1 - 2, y0 + 2, "G1")
    hl(x0 + 2, x0 + 44, y0 + 2, "G2")
    vl(x0 + 2, y0 + 2, y1 - 2, "G1")
    hl(x0 + 3, x1 - 3, y0 + 3, "F0")
    vl(x0 + 3, y0 + 3, y1 - 3, "F0")
    hl(x0 - 1, x1 + 1, y0 - 1, "W0")
    hl(x0 - 1, x1 + 1, y1 + 1, "W0")
    vl(x0 - 1, y0, y1, "W0")
    vl(x1 + 1, y0, y1, "W0")
    hl(x0 + 1, x1 + 1, y1 + 2, "W1")
    for (cx, cy) in ((x0 + 1, y0 + 1), (x1 - 1, y0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
        p(cx, cy, "G3")
        p(cx + 1, cy, "G1")
    sprite(312, 1, ["....oooooooo....", "...o44333333o...", "..o4331bb1332o..", ".o33111ab1113oo.", "oooooooooooooooo"],
           {"o": "W0", "4": "W4", "3": "W3", "1": "W1", "a": "R3", "b": "R2"})
    for (nx, ny, nw, nh, kind) in NOTICES:
        notice(nx, ny, nw, nh, kind)


def notice(x, y, w, h, kind):
    for yy in range(y + 1, y + h + 1):
        p(x + w, yy, "F0")
    hl(x + 1, x + w, y + h, "F0")
    rect(x, y, w, h, "B2")
    hl(x, x + w - 2, y, "B3")
    hl(x, x + w - 3, y + 1, "B3")
    vl(x, y, y + h - 2, "B3")
    vl(x + w - 1, y + 1, y + h - 1, "B1")
    hl(x + 1, x + w - 1, y + h - 1, "B1")
    p(x + w - 1, y + h - 1, "F2")
    p(x + w - 2, y + h - 2, "B1")
    if kind == 1:
        for xx in range(x, x + w, 3):
            p(xx, y + h - 1, "F2")
    ink = "F1" if kind != 3 else "C1"
    start = y + 3
    if kind == 2:
        sprite(x + w // 2 - 3, y + 2, ["..o.o..", ".o.o.o.", "o.ooo.o", ".o...o.", "..ooo.."], {"o": "C1"})
        start = y + 8
    if kind == 4:
        ellipse(x + w - 4, y + h - 4, 1.5, 1.5, "C2")
        p(x + w - 5, y + h - 5, "C3")
    for yy in range(start, y + h - 2, 2):
        xx = x + 2
        while xx < x + w - 3:
            seg = rng.randint(1, 4)
            for k in range(seg):
                if xx + k < x + w - 3:
                    p(xx + k, yy, ink if rng.random() < 0.85 else "B1")
            xx += seg + rng.randint(1, 2)
    px = x + w // 2
    p(px, y, "C3")
    p(px, y + 1, "C0")


def fireplace():
    x0, y0 = 432, 0
    rect(442, 0, 44, 16, "W2")
    for yy in range(0, 16):
        inset = 10 - yy // 3
        rect(x0 + inset, yy, 64 - 2 * inset, 1, "W2")
        p(x0 + inset, yy, "W0")
        p(x0 + inset + 1, yy, "W4")
        p(x0 + 63 - inset, yy, "W0")
        p(x0 + 62 - inset, yy, "W1")
    for yy in range(2, 16, 5):
        hl(x0 + 12, x0 + 51, yy, "W1")
        for xx in range(x0 + 12 + (yy % 10), x0 + 52, 12):
            p(xx, yy + 1, "W1")
            p(xx, yy + 2, "W1")
    sprite(458, 4, [".oooooooooooo.", "o3r2111111r23o", "o32r21aa12r23o", ".o32r1bb1r23o.", "..oo3r22r3oo..", "....oooooo...."],
           {"o": "W0", "3": "W3", "2": "W2", "1": "W1", "r": "C2", "a": "R3", "b": "R2"})
    rect(x0, 16, 64, 5, "W3")
    hl(x0, x0 + 63, 16, "W4")
    hl(x0, x0 + 63, 17, "W4")
    hl(x0, x0 + 63, 20, "W1")
    hl(x0 + 1, x0 + 62, 19, "G1")
    hl(x0 + 1, x0 + 30, 19, "G2")
    hl(x0, x0 + 63, 21, "W0")
    vl(x0, 16, 21, "W0")
    vl(x0 + 63, 16, 21, "W0")
    hl(x0 + 1, x0 + 62, 15, "W0")
    rect(x0 + 2, 22, 60, 34, "W2")
    for yy in range(22, 56):
        p(x0 + 2, yy, "W0")
        p(x0 + 3, yy, "W4")
        p(x0 + 4, yy, "W3")
        p(x0 + 61, yy, "W0")
        p(x0 + 60, yy, "W1")
    for (by, bh) in ((22, 9), (31, 8), (39, 9), (48, 8)):
        hl(x0 + 4, x0 + 59, by, "W3")
        hl(x0 + 5, x0 + 60, by + bh - 1, "W1")
        for bx in (x0 + 9 + (by % 2) * 4, x0 + 50 - (by % 2) * 4):
            vl(bx, by, by + bh - 1, "W0")
            vl(bx + 1, by + 1, by + bh - 2, "W3")
    half = [15] * 30
    top, bottom = 28, 55
    cx = 464
    for yy in range(top, bottom + 1):
        i = yy - top
        hw = half[i] if i < len(half) else 16
        for xx in range(cx - hw, cx + hw):
            p(xx, yy, "W0")
        p(cx - hw - 1, yy, "W3")
        p(cx - hw - 2, yy, "W0")
        p(cx + hw, yy, "W1")
        p(cx + hw + 1, yy, "W0")
    hl(cx - 16, cx + 15, top - 1, "W0")
    hl(cx - 15, cx + 14, top - 2, "W4")
    sprite(cx - 3, top - 5, ["oooooo", "o4332o", "o3ab2o", "oo22oo"], {"o": "W0", "4": "W4", "3": "W3", "2": "W2", "a": "E3", "b": "E1"})
    for yy in range(top + 6, bottom + 1):
        i = yy - top
        hw = half[i] if i < len(half) else 16
        if yy > 38:
            for xx in range(cx - hw, cx + hw):
                if (xx + yy) % 2 == 0 or yy > 46:
                    p(xx, yy, "C0")
        p(cx - hw, yy, "C1" if yy > 36 else "W0")
        p(cx + hw - 1, yy, "C0")
    tongues = [(452, 14, 5), (458, 20, 6), (464, 24, 7), (470, 19, 6), (476, 13, 5)]
    base = 53
    for yy in range(base - 26, base + 1):
        for xx in range(cx - 15, cx + 15):
            best = 0
            for (tx, th, tw) in tongues:
                up = base - yy
                if up < 0 or up > th:
                    continue
                allowed = tw * (1 - up / th) ** 0.7
                d = abs(xx + 0.5 - tx)
                if d <= allowed:
                    v = (1 - up / th) * 0.65 + (1 - d / (allowed + 0.01)) * 0.35
                    best = max(best, v)
            if best <= 0:
                continue
            t = BAYER[yy % 4][xx % 4] / 16 * 0.08
            v = best + t
            if v > 0.82:
                c = "E3"
            elif v > 0.62:
                c = "E2"
            elif v > 0.44:
                c = "E1"
            elif v > 0.28:
                c = "C3"
            else:
                c = "M2"
            p(xx, yy, c)
    for xx in range(cx - 14, cx + 14):
        p(xx, 54, "C1" if xx % 3 else "E1")
        p(xx, 55, "C0" if xx % 2 else "C1")
    for xx in (cx - 12, cx - 7, cx + 3, cx + 9):
        p(xx, 53, "E2")
    sprite(cx - 15, 47, ["o..", "3o.", "23o", "o2o", ".oo"], {"o": "W0", "3": "G3", "2": "G2"})
    sprite(cx + 12, 47, ["..o", ".o3", "o32", "o2o", "oo."], {"o": "W0", "3": "G2", "2": "G1"})
    for yy in range(top + 8, bottom):
        p(cx - 16, yy, "E1" if yy % 3 else "C2")
    for (sx, sy) in ((456, 33), (471, 31), (461, 30)):
        p(sx, sy, "E3")
    rect(x0, 56, 64, 8, "W3")
    hl(x0, x0 + 63, 56, "W4")
    hl(x0, x0 + 63, 57, "W4")
    hl(x0, x0 + 63, 59, "W2")
    rect(x0, 60, 64, 3, "W2")
    hl(x0 + 1, x0 + 63, 62, "W1")
    hl(x0, x0 + 63, 63, "W0")
    vl(x0, 56, 63, "W0")
    vl(x0 + 63, 56, 63, "W0")
    hl(x0, x0 + 63, 55, "W0")
    for xx in range(x0 + 6, x0 + 60, 14):
        vl(xx, 60, 62, "W0")
    for xx in range(cx - 12, cx + 12):
        if xx % 2 == 0:
            p(xx, 56, "E1")
    horn(x0 - 1, 1, False)
    horn(x0 + 55, 1, True)


def horn(x, y, flip):
    rows = [
        "o.......",
        "3o......",
        "32o.....",
        "322o....",
        "o322o...",
        ".o3221o.",
        "..o32221o",
        "...o3221o",
        "....oooo.",
    ]
    if flip:
        rows = [r[::-1] for r in rows]
        rows = [r.rjust(9) for r in rows]
    sprite(x, y + 6, rows, {"o": "W0", "3": "B3", "2": "B2", "1": "B1"})


def crystal_shard(cx, by, w, h, lean=0):
    left = []
    for i in range(h):
        frac = i / max(1, h - 1)
        if i < w // 2 + 1:
            half = i + 0.5
        else:
            half = w / 2
        offset = round(lean * (1 - frac))
        left.append((cx + offset, half, by - h + 1 + i))
    for (x, half, yy) in left:
        x0 = math.floor(x - half)
        x1 = math.ceil(x + half) - 1
        for xx in range(x0, x1 + 1):
            if xx < x:
                c = "R2"
            else:
                c = "R1"
            p(xx, yy, c)
        p(x0 - 1, yy, "W0")
        p(x1 + 1, yy, "W0")
        p(x0, yy, "R3" if yy % 4 else "R2")
    top_x, _, top_y = left[0]
    p(top_x, top_y - 1, "W0")
    p(top_x - 1, top_y - 1, "W0")
    hl(math.floor(left[-1][0] - w / 2) - 1, math.ceil(left[-1][0] + w / 2), by + 1, "W0")


def crystal_cluster(tx, ty):
    x, y = tx * 16, ty * 16
    ellipse(x + 8, y + 12, 7, 3, "W2")
    hl(x + 3, x + 11, y + 10, "W3")
    ellipse_ring(x + 8, y + 12, 7, 3, "W0")
    crystal_shard(x + 8, y + 11, 5, 15 if ty < 5 else 11)
    crystal_shard(x + 4, y + 12, 3, 9, -1)
    crystal_shard(x + 12, y + 12, 3, 10, 1)
    crystal_shard(x + 6, y + 13, 3, 6)
    crystal_shard(x + 10, y + 14, 3, 5)
    p(x + 2, y + 14, "R1")
    p(x + 13, y + 14, "R2")


def thorn_plant(tx, ty):
    x, y = tx * 16, ty * 16
    stems = [
        [(8, 8), (8, 6), (7, 4), (7, 2), (6, 0), (6, -2), (5, -4)],
        [(8, 8), (9, 6), (10, 4), (11, 3), (12, 1), (13, 0)],
        [(7, 8), (6, 6), (4, 5), (3, 3), (2, 2)],
        [(9, 8), (9, 5), (10, 2), (10, 0), (11, -2)],
    ]
    for stem in stems:
        for i, (sx, sy) in enumerate(stem):
            p(x + sx - 1, y + sy, "W0")
            p(x + sx, y + sy, "W3")
            p(x + sx + 1, y + sy, "W1")
            p(x + sx + 2, y + sy, "W0")
            if i < len(stem) - 1:
                nx, ny = stem[i + 1]
                if abs(ny - sy) > 1:
                    p(x + sx - 1, y + sy - 1, "W0")
                    p(x + sx, y + sy - 1, "W3")
                    p(x + sx + 1, y + sy - 1, "W1")
                    p(x + sx + 2, y + sy - 1, "W0")
            if i % 2 == 1:
                p(x + sx - 2, y + sy - 1, "W4")
        ex, ey = stem[-1]
        sprite(x + ex - 1, y + ey - 2, [".a.", "abo", ".o."], {"a": "M3", "b": "M2", "o": "C0"})
    for (lx, ly) in ((3, 6), (12, 5), (5, 2), (11, 1)):
        p(x + lx, y + ly, "R1")
    ellipse(x + 8, y + 10, 5, 2, "W3")
    ellipse(x + 8, y + 10, 3, 1, "F0")
    for yy in range(y + 11, y + 16):
        k = (yy - y - 11) // 2
        for xx in range(x + 3 + k, x + 13 - k):
            c = "W2"
            if xx <= x + 4 + k:
                c = "W3"
            elif xx >= x + 11 - k:
                c = "W1"
            p(xx, yy, c)
        p(x + 2 + k, yy, "W0")
        p(x + 13 - k, yy, "W0")
    ellipse_ring(x + 8, y + 10, 5, 2, "W0")
    hl(x + 5, x + 10, y + 15, "W0")
    p(x + 7, y + 13, "C2")
    p(x + 8, y + 13, "C2")


def bookshelves():
    x0, x1, top, bottom = 33, 190, 32, 79
    rect(x0, top, x1 - x0 + 1, bottom - top + 1, "W1")
    rect(x0, top + 1, x1 - x0 + 1, 5, "W3")
    hl(x0, x1, top + 1, "W4")
    hl(x0, x1, top + 5, "G1")
    hl(x0, x0 + 70, top + 5, "G2")
    hl(x0, x1, top + 6, "W2")
    hl(x0, x1, top + 7, "W0")
    for xx in range(x0 + 4, x1, 9):
        p(xx, top + 3, "W2")
        p(xx + 1, top + 3, "W4")
    bays = [(x0 + 2 + i * 31, 25) for i in range(5)]
    for i in range(6):
        px = x0 + i * 31 - (1 if i == 5 else 0)
        rect(px, top + 8, 3, bottom - top - 9, "W2")
        vl(px, top + 8, bottom - 2, "W3")
        vl(px + 2, top + 8, bottom - 2, "W1")
    shelves = [(top + 8, top + 18), (top + 21, top + 31), (top + 34, top + 44)]
    for bi, (bx, bw) in enumerate(bays):
        for si, (sy0, sy1) in enumerate(shelves):
            rect(bx, sy0, bw + 3, sy1 - sy0 + 1, "W0")
            hl(bx, bx + bw + 2, sy0, "W0")
            fill_shelf(bx + 1, sy0 + 1, bx + bw + 1, sy1, bi * 3 + si)
            rect(bx, sy1 + 1, bw + 3, 2, "W3")
            hl(bx, bx + bw + 2, sy1 + 1, "W4")
            hl(bx, bx + bw + 2, sy1 + 2, "W2")
    hl(x0, x1, bottom - 1, "W1")
    hl(x0, x1, bottom, "W0")
    vl(x0 - 1, top, bottom, "W0")
    vl(x1 + 1, top, bottom, "W0")
    hl(x0, x1, top, "W0")
    candle(88, 26, 7, 2)
    candle(168, 27, 6, 1)
    for wx in (64, 144):
        hl(wx - 5, wx + 4, top + 1, "R3")
        for xx in range(wx - 8, wx + 8, 2):
            p(xx, top + 2, "W4")
    sprite(112, 27, [".oooo.", "o3223o", "o2112o", "oooooo"], {"o": "W0", "3": "G3", "2": "G2", "1": "G1"})


TOMES = [("W2", "W3", "W0"), ("C1", "C2", "C0"), ("C2", "C3", "C0"), ("R1", "R2", "W0"), ("R1", "R2", "W0"), ("M1", "M2", "C0"),
         ("G1", "G2", "W0"), ("F3", "F4", "F0"), ("W3", "W4", "W0"), ("B1", "B2", "F0")]


def fill_shelf(x0, y0, x1, y1, seed):
    local = random.Random(seed * 31 + 7)
    x = x0
    mode = local.choice(["books", "books", "books", "scrolls", "mixed"])
    while x <= x1:
        if mode in ("scrolls",) or (mode == "mixed" and local.random() < 0.3):
            if x + 8 > x1:
                break
            scroll_stack(x, y1, local)
            x += 9
            mode = "books" if mode == "mixed" else mode
            continue
        bw = local.choice([2, 3, 3, 4])
        bh = local.randint(6, y1 - y0 + 1)
        if x + bw - 1 > x1:
            break
        base, light, dark = local.choice(TOMES)
        lean = local.random() < 0.1 and x + bw + 2 <= x1
        for yy in range(y1 - bh + 1, y1 + 1):
            shift = 1 if lean and yy < y1 - bh // 2 else 0
            for xx in range(x, x + bw):
                c = base
                if xx == x:
                    c = light
                if xx == x + bw - 1 and bw > 2:
                    c = dark
                p(xx + shift, yy, c)
        p(x, y1 - bh + 1, LIGHTER[light])
        if local.random() < 0.5:
            hl(x, x + bw - 1, y1 - bh + 3, "G1")
            if bw > 2:
                p(x + 1, y1 - bh + 3, "G2")
        if local.random() < 0.25 and bh > 7:
            hl(x, x + bw - 1, y1 - 2, "G1")
        x += bw + (2 if lean else 0)
        if local.random() < 0.15:
            x += local.randint(1, 3)


def scroll_stack(x, ybot, local):
    count = local.choice([2, 3, 3])
    for i in range(count):
        sy = ybot - 2 - i * 3
        sx = x + local.choice([0, 0, 1])
        sprite(sx, sy, ["o3333332o", "o2222221o", ".ooooooo."], {"o": "W0", "3": "B3", "2": "B2", "1": "B1"})
        p(sx, sy, "B1")
        p(sx, sy + 1, "B1")
        if local.random() < 0.4:
            p(sx + 4, sy + 1, "C2")


def forge():
    rect(508, 24, 24, 17, "W2")
    for yy in range(24, 41):
        p(507, yy, "W0")
        p(508, yy, "W4")
        p(509, yy, "W3")
        p(530, yy, "W1")
        p(531, yy, "W0")
    for yy in (29, 35):
        hl(510, 529, yy, "W1")
    for (bx, yy) in ((518, 25), (522, 30), (514, 36)):
        vl(bx, yy, yy + 3, "W0")
    rect(505, 22, 30, 3, "W3")
    hl(505, 534, 22, "W4")
    hl(504, 535, 21, "W0")
    hl(505, 534, 25, "W0")
    p(504, 23, "W0")
    p(535, 23, "W0")
    for xx in range(511, 529, 4):
        p(xx, 23, "W1")
    furnace()
    anvil()
    lava_trough()


def furnace():
    x0, x1 = 498, 541
    rect(x0, 40, x1 - x0 + 1, 40, "W2")
    rect(x0, 40, x1 - x0 + 1, 6, "W3")
    hl(x0, x1, 40, "W4")
    hl(x0, x1, 45, "W1")
    hl(x0 - 1, x1 + 1, 39, "W0")
    hl(x0 - 1, x1 + 1, 46, "W0")
    vl(x0 - 1, 39, 79, "W0")
    vl(x1 + 1, 39, 79, "W0")
    vl(x0, 47, 78, "W3")
    vl(x1, 47, 78, "W1")
    for (by, off) in ((47, 0), (55, 6), (63, 2), (71, 8)):
        hl(x0 + 1, x1 - 1, by + 7, "W0")
        hl(x0 + 1, x1 - 1, by, "W3")
        for bx in range(x0 + 6 + off, x1 - 2, 14):
            vl(bx, by, by + 6, "W0")
            vl(bx + 1, by + 1, by + 6, "W3")
    hl(x0, x1, 79, "W0")
    half = [3, 6, 8, 9, 10, 10]
    top, bottom = 52, 70
    cx = 520
    for yy in range(top, bottom + 1):
        i = yy - top
        hw = half[i] if i < len(half) else 10
        for xx in range(cx - hw, cx + hw):
            d = abs(xx + 0.5 - cx) / hw
            depth = (yy - top) / (bottom - top)
            v = (1 - d) * 0.6 + depth * 0.5 + BAYER[yy % 4][xx % 4] / 16 * 0.12
            if v > 0.95:
                c = "E3"
            elif v > 0.75:
                c = "E2"
            elif v > 0.55:
                c = "E1"
            elif v > 0.4:
                c = "C3"
            else:
                c = "C2"
            p(xx, yy, c)
        p(cx - hw - 1, yy, "W0")
        p(cx + hw, yy, "W0")
        p(cx - hw - 2, yy, "E1" if yy > top + 3 else "W3")
    hl(cx - 3, cx + 2, top - 1, "W0")
    for xx in range(cx - 9, cx + 9, 3):
        vl(xx, top + 3, bottom, "W0")
    rect(cx - 13, bottom + 1, 26, 3, "W3")
    hl(cx - 13, cx + 12, bottom + 1, "W4")
    hl(cx - 13, cx + 12, bottom + 3, "W0")
    for xx in range(cx - 10, cx + 10, 2):
        p(xx, bottom + 2, "E1")
    for (sx, sy) in ((x0 + 4, 60), (x1 - 5, 66), (x0 + 3, 74)):
        p(sx, sy, "E1")
        p(sx + 1, sy, "C2")
    for (sx, sy) in ((514, 47), (526, 44), (520, 42)):
        p(sx, sy, "E2")


def anvil():
    rect(551, 66, 18, 14, "W2")
    rect(551, 66, 18, 3, "W3")
    hl(551, 568, 66, "W4")
    vl(551, 69, 78, "W3")
    vl(568, 69, 78, "W1")
    hl(550, 569, 65, "W0")
    vl(550, 65, 79, "W0")
    vl(569, 65, 79, "W0")
    hl(550, 569, 79, "W0")
    for yy in (72, 76):
        hl(553, 566, yy, "W1")
    rows = [
        "......oooooooooooooooooooo.",
        "..oooo44444444444444444443o",
        ".o4433333333333333333333332o",
        "o33222222222222222222222221o",
        ".oo1222222222222222222211oo.",
        "...oooo11222222222221oooo...",
        "......o11222222222211o......",
        "......o1112222222221o.......",
        ".....oo111111111111oo.......",
        ".....oooooooooooooooo.......",
    ]
    sprite(546, 56, rows, {"o": "W0", "4": "W4", "3": "W3", "2": "W2", "1": "W1"})
    hl(556, 569, 56, "C3")
    hl(557, 568, 57, "E2")
    p(560, 57, "E3")
    p(564, 57, "E3")
    p(570, 57, "E1")
    p(555, 57, "C2")
    for (sx, sy) in ((562, 52), (566, 50), (559, 53)):
        p(sx, sy, "E2")
    sprite(573, 59, ["o3o", "o2o", ".f.", ".f.", ".f.", ".f.", ".fo", ".fo"], {"o": "W0", "3": "W4", "2": "W3", "f": "F3"})


def lava_trough():
    x0, x1, y0, y1 = 579, 621, 58, 79
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "W2")
    rect(x0, y0, x1 - x0 + 1, 4, "W3")
    hl(x0, x1, y0, "W4")
    hl(x0 - 1, x1 + 1, y0 - 1, "W0")
    vl(x0 - 1, y0, y1, "W0")
    vl(x1 + 1, y0, y1, "W0")
    hl(x0, x1, y1, "W0")
    lx0, lx1, ly0, ly1 = x0 + 3, x1 - 3, y0 + 2, y0 + 9
    rect(lx0, ly0, lx1 - lx0 + 1, ly1 - ly0 + 1, "E1")
    hl(lx0, lx1, ly0, "C1")
    hl(lx0 - 1, lx1 + 1, ly0 - 1, "W0")
    vl(lx0 - 1, ly0, ly1, "W0")
    vl(lx1 + 1, ly0, ly1, "W0")
    local = random.Random(99)
    for _ in range(9):
        cx = local.randint(lx0 + 2, lx1 - 2)
        cy = local.randint(ly0 + 1, ly1 - 1)
        w = local.randint(2, 4)
        hl(cx - w // 2, cx + w // 2, cy, "C1")
        p(cx - w // 2 - 1, cy, "C2")
        if local.random() < 0.5:
            p(cx, cy - 1, "C2")
    for _ in range(14):
        p(local.randint(lx0, lx1), local.randint(ly0 + 1, ly1), "E2")
    for _ in range(5):
        p(local.randint(lx0 + 1, lx1 - 1), local.randint(ly0 + 2, ly1 - 1), "E3")
    hl(lx0, lx1, ly1, "E2")
    hl(x0 + 1, x1 - 1, ly1 + 2, "W4")
    hl(x0 + 1, x1 - 1, ly1 + 3, "W3")
    for (by, off) in ((ly1 + 4, 0), (ly1 + 9, 7)):
        hl(x0 + 1, x1 - 1, by, "W0" if by > ly1 + 4 else "W1")
        for bx in range(x0 + 5 + off, x1 - 2, 12):
            vl(bx, by + 1, min(by + 4, y1 - 1), "W0")
            vl(bx + 1, by + 1, min(by + 4, y1 - 1), "W3")
    vl(x0, y0 + 4, y1 - 1, "W3")
    vl(x1, y0 + 4, y1 - 1, "W1")
    for (sx, sy) in ((588, 54), (603, 52), (612, 55), (596, 50)):
        p(sx, sy, "E2" if sx % 2 else "E3")


def desk():
    x0, x1, y0 = 32, 159, 144
    rect(x0, y0 + 1, x1 - x0 + 1, 16, "W2")
    for yy in range(y0 + 3, y0 + 15):
        for xx in range(x0 + 2, x1 - 4):
            if (xx * 3 + yy * 11) % 37 == 0:
                hl(xx, xx + 3, yy, "W3")
            elif (xx * 5 + yy * 7) % 53 == 0:
                hl(xx, xx + 2, yy, "W1")
    hl(x0 + 1, x1 - 1, y0 + 1, "W4")
    hl(x0 + 1, x1 - 1, y0 + 2, "W3")
    vl(x0 + 1, y0 + 1, y0 + 15, "W4")
    vl(x1 - 1, y0 + 2, y0 + 15, "W1")
    hl(x0 + 1, x1 - 1, y0 + 15, "W1")
    hl(x0 + 1, x1 - 1, y0 + 16, "G1")
    hl(x0 + 1, x1 - 1, y0, "W0")
    vl(x0, y0 + 1, y0 + 25, "W0")
    vl(x1, y0 + 1, y0 + 25, "W0")
    rect(x0 + 1, y0 + 17, x1 - x0 - 1, 8, "W2")
    hl(x0 + 1, x1 - 1, y0 + 17, "W3")
    for i in range(4):
        dx = x0 + 4 + i * 32
        rect(dx, y0 + 19, 24, 5, "W1")
        hl(dx, dx + 23, y0 + 19, "W0")
        vl(dx, y0 + 19, y0 + 23, "W0")
        hl(dx + 1, dx + 23, y0 + 24, "W3")
        vl(dx + 24, y0 + 19, y0 + 24, "W3")
        p(dx + 11, y0 + 21, "G3")
        p(dx + 12, y0 + 21, "G2")
        p(dx + 12, y0 + 22, "G1")
    hl(x0, x1, y0 + 25, "W0")
    for lx in (x0 + 1, x0 + 62, x1 - 4):
        rect(lx, y0 + 26, 4, 5, "W2")
        vl(lx, y0 + 26, y0 + 30, "W3")
        vl(lx + 3, y0 + 26, y0 + 30, "W0")
        hl(lx - 1, lx + 4, y0 + 31, "W0")
        p(lx - 1, y0 + 30, "W0")
    open_book(38, 147)
    sheet(68, 148, 9, 8)
    inkpot(80, 150)
    quill(83, 145)
    candelabra(96, 139)
    open_book(108, 148)
    sheet(124, 150, 8, 6)
    scroll_roll(124, 146)
    hourglass(146, 141)
    tome_stack(136, 147)


def open_book(x, y):
    rows = [
        ".oooooo.oooooo.",
        "o3333331333332o",
        "o3aaa3313aa332o",
        "o3333331333332o",
        "o3aa3aa13aaa32o",
        "o3333331333222o",
        "roooooo1oooooor",
        ".rrrrrrrrrrrrr.",
    ]
    sprite(x, y, rows, {"o": "B1", "3": "B3", "2": "B2", "1": "B1", "a": "F2", "r": "C1"})


def sheet(x, y, w, h):
    rect(x, y, w, h, "B2")
    hl(x, x + w - 1, y, "B3")
    vl(x + w - 1, y, y + h - 1, "B1")
    hl(x, x + w - 1, y + h, "W0")
    for yy in range(y + 2, y + h - 1, 2):
        hl(x + 1, x + w - 3 - (yy % 3), yy, "F2")


def inkpot(x, y):
    sprite(x, y, [".oo.", "o21o", "o11o", "oooo"], {"o": "W0", "2": "R2", "1": "W1"})


def quill(x, y):
    sprite(x, y, ["....3", "...32", "..32.", ".32..", "o2..."], {"3": "B3", "2": "B2", "o": "W0"})


def candelabra(x, y):
    sprite(x, y, [
        "..........",
        "..........",
        ".c..c..c..",
        ".b..b..b..",
        ".b..b..b..",
        ".2..3..2..",
        ".g223322g.",
        "....3.....",
        "....2.....",
        "...g32g...",
        "..oooooo..",
    ], {"c": "B3", "b": "B2", "2": "G2", "3": "G3", "g": "G1", "o": "W0"})
    for fx in (x, x + 3, x + 6):
        flame(fx, y - 2, 1)


def scroll_roll(x, y):
    sprite(x, y, ["o3333333o", "o2222221o", ".ooooooo."], {"o": "B1", "3": "B3", "2": "B2", "1": "B1"})


def hourglass(x, y):
    sprite(x, y, ["ggggggg", ".o333o.", ".o232o.", "..o3o..", "..o2o..", ".o222o.", ".o333o.", "ggggggg", ".ooooo."],
           {"g": "G2", "o": "W0", "3": "B3", "2": "E2"})


def tome_stack(x, y):
    sprite(x, y, ["ooooooooo", "o2222221o", "occccccco", "o3333331o", "orrrrrrro", "ooooooooo"],
           {"o": "W0", "2": "W3", "1": "W2", "c": "G2", "3": "C2", "r": "C1"})


def crystal_table():
    x0, x1, y0 = 496, 607, 144
    rect(x0 + 1, y0 + 1, x1 - x0 - 1, 17, "W3")
    for yy in range(y0 + 5, y0 + 9):
        for xx in range(x0 + 6, x0 + 22):
            if (xx + yy) % 2 == 0 and (xx - x0) + (yy - y0) * 3 < 30:
                p(xx, yy, "W4")
    hl(x0 + 1, x1 - 1, y0 + 1, "W4")
    vl(x0 + 1, y0 + 1, y0 + 17, "W4")
    vl(x1 - 1, y0 + 2, y0 + 16, "W2")
    hl(x0 + 3, x1 - 3, y0 + 3, "G1")
    hl(x0 + 3, x1 - 3, y0 + 15, "G1")
    vl(x0 + 3, y0 + 3, y0 + 15, "G1")
    vl(x1 - 3, y0 + 3, y0 + 15, "G1")
    hl(x0 + 1, x1 - 1, y0 + 17, "G2")
    hl(x0 + 1, x0 + 50, y0 + 17, "G3")
    hl(x0 + 1, x1 - 1, y0, "W0")
    p(x0 + 1, y0 + 1, "W0")
    p(x1 - 1, y0 + 1, "W0")
    vl(x0, y0 + 1, y0 + 24, "W0")
    vl(x1, y0 + 1, y0 + 24, "W0")
    rect(x0 + 1, y0 + 18, x1 - x0 - 1, 6, "W1")
    hl(x0 + 1, x1 - 1, y0 + 18, "W2")
    for xx in range(x0 + 8, x1 - 4, 12):
        sprite(xx - 1, y0 + 19, [".o.", "o3o", ".o."], {"o": "W0", "3": "B2"})
    hl(x0, x1, y0 + 24, "W0")
    for lx in (x0 + 1, x0 + 54, x1 - 6):
        sprite(lx, y0 + 25, ["o3o2o", "o32o.", ".o32o", "o32o.", "o332o", "ooooo"], {"o": "W0", "3": "B3", "2": "B2"})
    for (gx, gy) in ((540, 150), (564, 150), (544, 156), (560, 156), (552, 146), (536, 154), (568, 154)):
        p(gx, gy, "R1")
    for (gx, gy) in ((546, 148), (558, 148)):
        p(gx, gy, "R2")
    rect(545, 155, 15, 3, "G2")
    hl(545, 559, 155, "G3")
    hl(544, 560, 158, "W0")
    p(544, 156, "W0")
    p(544, 157, "W0")
    p(560, 156, "W0")
    p(560, 157, "W0")
    for xx in (546, 550, 554, 558):
        p(xx, 154, "G2")
        p(xx, 153, "G1")
    orb_pool(552, 152)
    cx, cy, r = 552, 149, 6
    for yy in range(cy - r - 1, cy + r + 2):
        for xx in range(cx - r - 1, cx + r + 2):
            d = math.hypot(xx + 0.5 - cx - 0.5, yy + 0.5 - cy - 0.5)
            if d <= r + 0.4:
                lit = math.hypot(xx - (cx - 2), yy - (cy - 2))
                if d > r - 0.6:
                    c = "W0"
                elif lit < 2.6:
                    c = "R3"
                elif lit < 5.6:
                    c = "R2"
                else:
                    c = "R1"
                p(xx, yy, c)
    p(cx - 3, cy - 3, "B3")
    p(cx - 2, cy - 3, "B3")
    p(cx - 3, cy - 2, "B3")
    p(cx + 2, cy + 2, "M3")
    p(cx + 3, cy + 1, "M3")
    p(cx + 1, cy + 3, "M2")
    p(cx - 1, cy + 4, "M2")
    open_book_magic(508, 148)
    cards(580, 148)
    rune_stones(588, 158)
    candle(526, 149, 6, 1)
    candle(597, 147, 7, 1)


def orb_pool(cx, cy):
    for yy in range(cy - 6, cy + 8):
        for xx in range(cx - 20, cx + 21):
            d = math.hypot((xx - cx) / 20, (yy - cy) / 7)
            if d < 1 and get(xx, yy) == "W3" and BAYER[yy % 4][xx % 4] / 16 > d * d:
                p(xx, yy, "W4")
    for (dx, dy) in ((-11, 2), (11, 2), (-14, -1), (14, -1), (-9, 6), (9, 6)):
        p(cx + dx, cy + dy, "R2")


def open_book_magic(x, y):
    rows = [
        ".oooooo.oooooo.",
        "o3333331333333o",
        "o33aa331333a32o",
        "o3a33a31b3aaa2o",
        "o33aa331333a32o",
        "o3333331332222o",
        "rooooooooooooor",
        ".rrrrrrrrrrrrr.",
    ]
    sprite(x, y, rows, {"o": "B1", "3": "B3", "2": "B2", "1": "F1", "a": "R1", "b": "R2", "r": "C0"})


def cards(x, y):
    for i, dx in enumerate((0, 5, 9)):
        sprite(x + dx, y + (i % 2), ["oooo", "o22o", "o32o", "o22o", "oooo"], {"o": "C0", "2": "C2", "3": "G2"})


def rune_stones(x, y):
    for (dx, dy) in ((0, 0), (5, 1), (9, -1)):
        sprite(x + dx, y + dy, [".oo.", "o3ao", ".oo."], {"o": "W0", "3": "B2", "a": "R2"})


def reception_counter():
    x0, x1, y0 = 256, 383, 80
    rect(x0, y0, x1 - x0 + 1, 7, "W3")
    for xx in range(x0 + 4, x1 - 2, 11):
        hl(xx, xx + 3, y0 + 3, "W4")
    hl(x0 + 1, x1 - 1, y0 + 5, "W2")
    hl(x0, x1, y0, "W0")
    hl(x0 + 1, x1 - 1, y0 + 1, "W4")
    hl(x0 + 1, x1 - 1, y0 + 6, "G1")
    hl(x0 + 1, x1 - 1, y0 + 7, "G2")
    hl(x0 + 1, x0 + 64, y0 + 7, "G3")
    rect(x0 + 1, y0 + 8, x1 - x0 - 1, 7, "W1")
    for i in range(4):
        px = x0 + 3 + i * 32
        rect(px, y0 + 9, 28, 5, "W2")
        hl(px, px + 27, y0 + 9, "W0")
        vl(px, y0 + 9, y0 + 13, "W0")
        hl(px + 1, px + 27, y0 + 13, "W3")
        vl(px + 27, y0 + 10, y0 + 13, "W3")
        sprite(px + 11, y0 + 10, ["..r..", ".r3r.", "..r.."], {"r": "C3", "3": "M3"})
        hl(px + 1, px + 8, y0 + 10, "W3")
    vl(x0, y0, y0 + 15, "W0")
    vl(x1, y0, y0 + 15, "W0")
    hl(x0, x1, y0 + 15, "W0")
    sprite(296, 80, [
        ".oooooooo.oooooooo.",
        "o33333333133333333o",
        "o3aa3aaa313aaa3a32o",
        "o333a33a3133aa3332o",
        "o3aa333aa13a33aa22o",
        "roooooooooooooooooor",
    ], {"o": "B1", "3": "B3", "2": "B2", "1": "C1", "a": "F2", "r": "C2"})
    inkpot(318, 80)
    quill(320, 76)
    sprite(272, 80, [".oo.", "o32o", "o22o", "oooo"], {"o": "W0", "3": "G3", "2": "G2"})
    p(273, 79, "G2")
    for (cx, cy) in ((338, 83), (341, 83), (339, 82)):
        sprite(cx, cy, ["32"], {"3": "G3", "2": "G1"})
    candle(364, 77, 6, 2)
    candle(264, 78, 5, 1)
    scroll_roll(346, 81)


def rug_runner():
    x0, y0, x1, y1 = 258, 98, 381, 157
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "C1")
    for yy in range(y0 + 6, y1 - 5):
        for xx in range(x0 + 6, x1 - 5):
            u = (xx - x0) % 12
            v = (yy - y0) % 12
            if abs(u - 6) + abs(v - 6) == 5:
                p(xx, yy, "C2")
            if u == 6 and v == 6:
                p(xx, yy, "C0")
    for i in range(3):
        hl(x0 + i, x1 - i, y0 + i, ["C0", "G2", "G1"][i])
        hl(x0 + i, x1 - i, y1 - i, ["C0", "G1", "G1"][i])
        vl(x0 + i, y0 + i, y1 - i, ["C0", "G2", "G1"][i])
        vl(x1 - i, y0 + i, y1 - i, ["C0", "G1", "G1"][i])
    for xx in range(x0 + 4, x1 - 3, 4):
        p(xx, y0 + 3, "C3")
        p(xx, y1 - 3, "C2")
    for yy in range(y0 + 4, y1 - 3, 4):
        p(x0 + 3, yy, "C3")
        p(x1 - 3, yy, "C2")
    hl(x0 + 4, x1 - 4, y0 + 4, "C0")
    hl(x0 + 4, x1 - 4, y1 - 4, "C0")
    vl(x0 + 4, y0 + 4, y1 - 4, "C0")
    vl(x1 - 4, y0 + 4, y1 - 4, "C0")
    cx, cy = 320, 128
    ellipse(cx, cy, 13, 10, "C0")
    ellipse(cx, cy, 11, 8, "C2")
    for xx in range(cx - 11, cx - 2):
        for yy in range(cy - 8, cy - 2):
            if C[yy][xx] == "C2" and (xx + yy) % 2 == 0:
                p(xx, yy, "C3")
    sigil(cx + 1, cy + 1)
    for yy in range(y0 + 1, y1, 2):
        p(x0 - 2, yy, "B1")
        p(x0 - 1, yy, "B2")
        p(x1 + 1, yy, "B2")
        p(x1 + 2, yy, "B1")


def rug_rune():
    x0, y0, x1, y1 = 50, 226, 125, 285
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "W3")
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            if (xx - yy) % 8 == 0 or (xx + yy) % 8 == 0:
                p(xx, yy, "W2")
    for i, c in enumerate(["W0", "R1", "R2", "R1", "W1"]):
        hl(x0 + i, x1 - i, y0 + i, c)
        hl(x0 + i, x1 - i, y1 - i, c if i != 2 else "R1")
        vl(x0 + i, y0 + i, y1 - i, c)
        vl(x1 - i, y0 + i, y1 - i, c if i != 2 else "R1")
    for xx in range(x0 + 5, x1 - 4, 6):
        p(xx, y0 + 2, "R3")
    for (cx, cy) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        sprite(cx - 2, cy - 2, [".o.", "o2o", ".o."], {"o": "C0", "2": "C3"})
    ellipse_ring(88, 256, 30, 24, "R1")
    ellipse_ring(88, 256, 27, 21, "W1")


def table(tx, ty, items):
    x0, y0 = tx * 16, ty * 16
    x1 = x0 + 47
    top, front, legs = y0 + 3, y0 + 20, y0 + 25
    for yy in range(top, front):
        inset = 2 if yy in (top, front - 1) else (1 if yy in (top + 1, front - 2) else 0)
        for xx in range(x0 + 1 + inset, x1 - inset):
            p(xx, yy, "W3" if xx - x0 < 40 else "W2")
        p(x0 + inset, yy, "W0")
        p(x1 - inset, yy, "W0")
        p(x0 + 1 + inset, yy, "W4")
        p(x1 - 1 - inset, yy, "W2")
    hl(x0 + 2, x1 - 2, top - 1, "W0")
    hl(x0 + 3, x1 - 3, top, "W4")
    for xx in range(x0 + 6, x0 + 16):
        for yy in range(top + 4, top + 8):
            if (xx + yy) % 2 == 0 and xx - x0 + (yy - top) * 2 < 20:
                p(xx, yy, "W4")
    for xx in range(x0 + 30, x1 - 5):
        for yy in range(front - 7, front - 4):
            if (xx + yy) % 2 == 0 and xx - x0 - (yy - front + 7) * 3 > 30:
                p(xx, yy, "W2")
    for xx in range(x0 + 4, x1 - 3):
        p(xx, top + 2, "G1")
        p(xx, front - 3, "G1")
    for yy in range(top + 2, front - 2):
        p(x0 + 4, yy, "G1")
        p(x1 - 4, yy, "G1")
    rect(x0 + 1, front, 46, 4, "W2")
    hl(x0 + 1, x1 - 1, front + 3, "W1")
    hl(x0 + 1, x1 - 1, front, "G1")
    vl(x0, front - 1, front + 4, "W0")
    vl(x1, front - 1, front + 4, "W0")
    hl(x0 + 1, x1 - 1, front + 4, "W0")
    for lx in (x0 + 3, x1 - 7):
        sprite(lx, legs - 1, ["o32o.", "o32o.", ".o32o", ".o32o", "o332o", "ooooo"], {"o": "W0", "3": "B3", "2": "B2"})
    for item in items:
        item()


def goblet(x, y):
    sprite(x, y, ["o333o", "o2c2o", ".o2o.", "..2..", ".o2o.", "ooooo"][0:6], {"o": "W0", "3": "G3", "2": "G2", "c": "C2"})


def platter(x, y):
    sprite(x, y, [".ooooo.", "o2cc22o", "o2cdc2o", ".ooooo."], {"o": "B1", "2": "B2", "c": "C2", "d": "C3"})


def dice(x, y):
    sprite(x, y, ["oo", "33"], {"o": "B3", "3": "B1"})


def bottle_dark(x, y):
    sprite(x, y, [".b.", "oro", "o1o", "o1o", "o1o", "ooo"], {"o": "W0", "b": "B1", "r": "R2", "1": "W1"})


def bar_shelf():
    x0, x1, y0, y1 = 401, 558, 194, 239
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "W1")
    rect(x0, y0, x1 - x0 + 1, 4, "W3")
    hl(x0, x1, y0, "W4")
    hl(x0, x1, y0 + 3, "G1")
    hl(x0, x0 + 72, y0 + 3, "G2")
    hl(x0, x1, y0 + 4, "W0")
    hl(x0 - 1, x1 + 1, y0 - 1, "W0")
    vl(x0 - 1, y0, y1, "W0")
    vl(x1 + 1, y0, y1, "W0")
    horn(x0 - 1, y0 - 8, False)
    horn(x1 - 8, y0 - 8, True)
    for xx in range(x0 + 6, x1, 10):
        p(xx, y0 + 1, "W2")
        p(xx + 1, y0 + 2, "W4")
    for px in (x0, 478, x1 - 3):
        rect(px, y0 + 5, 4, 24, "W2")
        vl(px, y0 + 5, y0 + 28, "W3")
        vl(px + 3, y0 + 5, y0 + 28, "W0")
    shelf_rows = [(y0 + 5, y0 + 15), (y0 + 18, y0 + 28)]
    bays = [(x0 + 4, 477), (482, x1 - 4)]
    for si, (sy0, sy1) in enumerate(shelf_rows):
        for bi, (bx0, bx1) in enumerate(bays):
            rect(bx0, sy0, bx1 - bx0 + 1, sy1 - sy0 + 1, "W0")
            for xx in range(bx0, bx1 + 1):
                if (xx + sy0) % 7 == 0:
                    vl(xx, sy0 + 1, sy1 - 3, "W1")
            fill_bottles(bx0 + 1, bx1 - 1, sy1, si * 2 + bi)
        rect(x0, sy1 + 1, x1 - x0 + 1, 2, "W3")
        hl(x0, x1, sy1 + 1, "W4")
        hl(x0, x1, sy1 + 2, "W2")
    candle(414, y0 - 6, 6, 1)
    candle(544, y0 - 7, 7, 1)
    base_top = y0 + 31
    rect(x0, base_top, x1 - x0 + 1, y1 - base_top + 1, "W2")
    hl(x0, x1, base_top, "W3")
    for i in range(5):
        dx = x0 + 4 + i * 31
        rect(dx, base_top + 2, 27, y1 - base_top - 3, "W1")
        hl(dx, dx + 26, base_top + 2, "W0")
        vl(dx, base_top + 2, y1 - 2, "W0")
        hl(dx + 1, dx + 26, y1 - 2, "W3")
        vl(dx + 26, base_top + 3, y1 - 2, "W3")
        p(dx + 13, base_top + 5, "G3")
        p(dx + 13, base_top + 6, "G1")
    hl(x0, x1, y1, "W0")


LIQUIDS = [("M1", "M2", "M3"), ("R1", "R2", "R3"), ("C1", "C2", "C3"), ("E1", "E2", "E3"), ("G1", "G2", "G3"), ("M1", "M2", "M3"), ("R1", "R2", "R3")]


def fill_bottles(x0, x1, ybot, seed):
    local = random.Random(seed * 13 + 5)
    x = x0 + local.randint(0, 2)
    while x < x1 - 4:
        kind = local.choice(["flask", "tall", "vial", "flask", "tall", "gap"])
        dark, mid, light = local.choice(LIQUIDS)
        if kind == "gap":
            x += 3
            continue
        if kind == "flask" and x + 7 <= x1:
            sprite(x, ybot - 8, ["..bb...", "..oo...", "..oo...", ".o22o..", "o2322o.", "o2222o.", "o1221o.", ".oooo..", "......."],
                {"o": "W0", "b": "B1", "2": mid, "3": light, "1": dark})
            p(x + 2, ybot, light)
            x += 7
        elif kind == "tall" and x + 5 <= x1:
            sprite(x, ybot - 9, [".b..", ".o..", "oooo", "o32o", "o22o", "o22o", "o21o", "o11o", "oooo"],
                   {"o": "W0", "b": "B1", "2": mid, "3": light, "1": dark})
            p(x + 1, ybot, light)
            x += 5
        elif kind == "vial" and x + 4 <= x1:
            sprite(x, ybot - 5, ["b.", "o3", "o2", "o2", "oo"], {"o": "W0", "b": "B2", "2": mid, "3": light})
            x += 4
        else:
            x += 2
        x += local.randint(0, 2)


def bar_counter():
    x0, x1, y0 = 384, 575, 256
    rect(x0 + 1, y0, x1 - x0 - 1, 6, "W2")
    for xx in range(x0 + 6, x1 - 3, 9):
        hl(xx, xx + 2, y0 + 2 + (xx // 9) % 2, "W3")
    hl(x0, x1, y0, "W0")
    hl(x0 + 1, x1 - 1, y0 + 1, "W4")
    hl(x0 + 1, x1 - 1, y0 + 5, "W1")
    hl(x0 + 1, x1 - 1, y0 + 6, "G1")
    rect(x0 + 1, y0 + 7, x1 - x0 - 1, 8, "C1")
    hl(x0 + 1, x1 - 1, y0 + 7, "C2")
    for i in range(12):
        px = x0 + 1 + i * 16
        vl(px + 15, y0 + 7, y0 + 14, "W2")
        vl(px + 14, y0 + 7, y0 + 14, "C0")
        p(px + 15, y0 + 9, "G2")
        p(px + 15, y0 + 12, "G2")
        for yy in range(y0 + 8, y0 + 14):
            if (yy + i) % 3 == 0:
                p(px + 3, yy, "C2")
                p(px + 9, yy, "C0")
    vl(x0, y0, y0 + 15, "W0")
    vl(x1, y0, y0 + 15, "W0")
    hl(x0, x1, y0 + 15, "W0")
    goblet(402, y0)
    goblet(434, y0 + 1)
    bottle_dark(460, y0 - 3)
    goblet(498, y0)
    platter(520, y0 + 1)
    goblet(562, y0)
    goblet(470, y0 + 1)


def stool(tx, ty):
    x, y = tx * 16, ty * 16
    shadow(x + 4, y + 13, 10, 2)
    vl(x + 7, y + 7, y + 13, "W3")
    vl(x + 8, y + 7, y + 13, "W1")
    vl(x + 6, y + 8, y + 13, "W0")
    vl(x + 9, y + 8, y + 13, "W0")
    hl(x + 4, x + 11, y + 12, "W2")
    hl(x + 4, x + 11, y + 13, "W0")
    p(x + 3, y + 12, "W0")
    p(x + 12, y + 12, "W0")
    ellipse(x + 8, y + 5, 5, 3, "W0")
    ellipse(x + 8, y + 5, 4, 2, "C2")
    hl(x + 5, x + 9, y + 3, "C3")
    hl(x + 5, x + 11, y + 7, "C1")
    p(x + 8, y + 5, "C1")


def barrel(tx, ty):
    x, y = tx * 16, ty * 16
    for yy in range(y + 3, y + 16):
        bulge = 1 if y + 6 <= yy <= y + 12 else 0
        for xx in range(x + 2 - bulge, x + 14 + bulge):
            col = xx - x
            c = "C1"
            if col <= 4:
                c = "C2"
            elif col >= 11:
                c = "C0"
            if col in (5, 9):
                c = "C0"
            if col == 3 and yy % 4 == 0:
                c = "C3"
            p(xx, yy, c)
        p(x + 1 - bulge, yy, "W0")
        p(x + 14 + bulge, yy, "W0")
    for by in (y + 6, y + 12):
        hl(x + 1, x + 14, by, "W3")
        p(x + 2, by, "W4")
        p(x + 3, by, "W4")
        hl(x + 2, x + 14, by + 1, "W1")
    hl(x + 2, x + 13, y + 15, "W0")
    ellipse(x + 8, y + 3, 6, 2, "C2")
    ellipse_ring(x + 8, y + 3, 6, 2, "W0")
    hl(x + 5, x + 11, y + 4, "C1")
    hl(x + 4, x + 8, y + 2, "C3")
    p(x + 8, y + 3, "G2")
    p(x + 9, y + 3, "G1")


def brazier(tx, ty):
    x, y = tx * 16, ty * 16
    vl(x + 4, y + 9, y + 14, "W2")
    vl(x + 11, y + 9, y + 14, "W1")
    vl(x + 3, y + 12, y + 15, "W0")
    vl(x + 12, y + 12, y + 15, "W0")
    vl(x + 7, y + 9, y + 15, "W3")
    vl(x + 8, y + 9, y + 15, "W1")
    p(x + 3, y + 15, "W2")
    p(x + 12, y + 15, "W1")
    for yy in range(y + 5, y + 9):
        k = yy - (y + 5)
        for xx in range(x + 2 + k, x + 14 - k):
            p(xx, yy, "W2" if xx > x + 5 + k else "W3")
        p(x + 1 + k, yy, "W0")
        p(x + 14 - k, yy, "W0")
    hl(x + 5, x + 10, y + 9, "W0")
    ellipse(x + 8, y + 4, 6, 1.5, "W4")
    ellipse(x + 8, y + 4, 4, 1, "E1")
    ellipse_ring(x + 8, y + 4, 6, 1.5, "W0")
    p(x + 6, y + 4, "E2")
    p(x + 9, y + 4, "E3")
    sprite(x + 4, y - 4, [
        "...a....",
        "...aa...",
        "..aba...",
        "..abba..",
        ".abcba..",
        ".abccba.",
        "abcccba.",
        ".bcccb..",
    ], {"a": "R2", "b": "M3", "c": "B3"})
    p(x + 10, y - 3, "M3")
    p(x + 3, y - 1, "R2")


def paint_lighting(lights):
    warm_set = {0, 1}
    for y in range(0, 368):
        for x in range(0, W):
            c = C[y][x]
            if c not in DARKER or c in ("W0", "F0"):
                continue
            lw = lv = 0.0
            for i, (lx, ly, r) in enumerate(lights):
                d = math.hypot(x - lx, (y - ly) * 1.25)
                if d < r:
                    v = (1 - d / r) ** 1.5
                    if i in warm_set:
                        lw += v
                    else:
                        lv += v
            total = lw + lv
            t = BAYER[y % 4][x % 4] / 16
            shift = 0
            if total > 0.2 + t * 0.14:
                shift = 1
            if total > 0.78 + t * 0.2:
                shift = 2
            if shift == 0 and total < 0.03:
                dx = (x - 320) / 320
                dy = (y - 210) / 190
                if dx * dx + dy * dy > 0.62 + t * 0.5:
                    shift = -1
            for _ in range(abs(shift)):
                c = LIGHTER[c] if shift > 0 else DARKER[c]
            if shift > 0 and lw > lv and y >= 48 and lw > 0.3 + t * 0.35:
                c = {"F3": "FW1", "F4": "FW2"}.get(c, c)
            C[y][x] = c


def main():
    layout = json.load(open(LAYOUT))
    paint_floor()
    paint_rune_circle(320, 248, 44, 30)
    paint_back_wall()
    rug_runner()
    rug_rune()
    paint_ambient_occlusion()
    lights = [(l["x"], l["y"], l["radius"]) for l in layout["lights"]]
    paint_lighting(lights)
    paint_side_walls()
    world_map()
    paint_door()
    window(3, 0)
    window(8, 0)
    for tx in (13, 25, 35):
        banner(tx)
    quest_board()
    lantern(15, 1)
    lantern(23, 1)
    cast(432, 0, 64, 64)
    cast(32, 48, 160, 32)
    cast(496, 48, 128, 32)
    cast(256, 80, 128, 16, 2)
    cast(32, 144, 128, 32)
    cast(496, 144, 112, 32)
    cast(400, 208, 160, 32)
    cast(384, 256, 192, 16, 2)
    for (tx, ty) in ((4, 15), (10, 18), (14, 13)):
        cast(tx * 16, ty * 16, 48, 32)
    for (tx, ty) in ((1, 20), (1, 21), (2, 21), (37, 20), (38, 20), (38, 21), (1, 3), (13, 3), (38, 6), (1, 13), (38, 14), (22, 21), (17, 22), (22, 22)):
        cast(tx * 16 + 2, ty * 16 + 2, 13, 13, 2)
    fireplace()
    crystal_cluster(1, 3)
    bookshelves()
    crystal_cluster(13, 3)
    forge()
    reception_counter()
    crystal_cluster(38, 6)
    desk()
    crystal_table()
    thorn_plant(1, 13)
    table(14, 13, [lambda: goblet(232, 214), lambda: candle(254, 215, 6, 2), lambda: dice(242, 222)])
    bar_shelf()
    thorn_plant(38, 14)
    table(4, 15, [lambda: platter(70, 248), lambda: candle(88, 247, 7, 2), lambda: goblet(98, 249)])
    bar_counter()
    for tx in (25, 27, 29, 31, 33, 35):
        stool(tx, 17)
    table(10, 18, [lambda: bottle_dark(168, 294), lambda: candle(184, 295, 7, 2), lambda: goblet(193, 298), lambda: goblet(174, 300)])
    barrel(37, 20)
    barrel(38, 20)
    barrel(1, 20)
    barrel(1, 21)
    barrel(2, 21)
    barrel(38, 21)
    thorn_plant(22, 21)
    brazier(17, 22)
    brazier(22, 22)
    img = Image.new("RGB", (W, H))
    px = img.load()
    rgb = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for k, v in PAL.items()}
    for y in range(H):
        for x in range(W):
            px[x, y] = rgb[C[y][x]]
    img.save(OUT)
    img.resize((W * 3, H * 3), Image.NEAREST).save(PREVIEW)
    used = {C[y][x] for y in range(H) for x in range(W)}
    print("colours", len(used))


if __name__ == "__main__":
    main()
