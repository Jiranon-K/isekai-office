from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import json
import math
import random
import numpy as np
from PIL import Image

LAYOUT = str(ROOT / "design/room-layout.json")
OUT = str(ROOT / "web/public/assets/rooms/tavern.png")
PREVIEW = str(ROOT / "design/preview-tavern.png")

W, H, T = 640, 384, 16

PAL = {
    "ol": (48, 28, 34),
    "w0": (84, 46, 38),
    "w1": (122, 70, 46),
    "w2": (162, 102, 60),
    "w3": (200, 140, 80),
    "w4": (232, 184, 114),
    "f0": (126, 82, 54),
    "f1": (148, 100, 64),
    "f2": (164, 115, 74),
    "f3": (180, 130, 85),
    "p0": (158, 132, 110),
    "p1": (202, 180, 150),
    "p2": (230, 214, 182),
    "s0": (56, 54, 68),
    "s1": (86, 86, 102),
    "s2": (120, 120, 134),
    "s3": (158, 156, 164),
    "r0": (90, 30, 38),
    "r1": (138, 42, 46),
    "r2": (182, 68, 56),
    "a0": (226, 128, 50),
    "a1": (248, 192, 86),
    "a2": (255, 238, 170),
    "g0": (40, 68, 52),
    "g1": (64, 106, 64),
    "g2": (110, 150, 76),
    "c0": (66, 90, 134),
    "c1": (116, 166, 200),
    "c2": (208, 236, 240),
    "v0": (70, 44, 84),
    "v1": (112, 66, 120),
}
NAMES = list(PAL)
IDX = {n: i for i, n in enumerate(NAMES)}
RGB = np.array([PAL[n] for n in NAMES], dtype=np.uint8)

DARK = {
    "f3": "f1", "f2": "f0", "f1": "f0", "f0": "w1",
    "w4": "w3", "w3": "w2", "w2": "w1", "w1": "w0", "w0": "ol",
    "p2": "p1", "p1": "p0", "p0": "w1",
    "s3": "s2", "s2": "s1", "s1": "s0", "s0": "ol",
    "r2": "r1", "r1": "r0", "r0": "ol",
    "a2": "a1", "a1": "a0", "a0": "r2",
    "g2": "g1", "g1": "g0", "g0": "ol",
    "c2": "c1", "c1": "c0", "c0": "s0",
    "v1": "v0", "v0": "ol", "ol": "ol",
}
LIGHT = {
    "f0": "f1", "f1": "f2", "f2": "f3", "f3": "w4",
    "w0": "w1", "w1": "w2", "w2": "w3", "w3": "w4", "w4": "a2",
    "p0": "p1", "p1": "p2", "p2": "a2",
    "s0": "s1", "s1": "s2", "s2": "s3", "s3": "p1",
    "r0": "r1", "r1": "r2", "r2": "a0",
    "ol": "w0",
}
DARK_IDX = np.array([IDX[DARK.get(n, n)] for n in NAMES], dtype=np.uint8)
LIGHT_IDX = np.array([IDX[LIGHT.get(n, n)] for n in NAMES], dtype=np.uint8)

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

FLOOR, WALL, PROP = 0, 1, 2
canvas = np.zeros((H, W), dtype=np.uint8)
layer = np.zeros((H, W), dtype=np.uint8)
state = {"layer": PROP}


def set_layer(value):
    state["layer"] = value


def px(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        canvas[y, x] = IDX[c]
        layer[y, x] = state["layer"]


def rect(x, y, w, h, c):
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0:
        return
    canvas[y0:y1, x0:x1] = IDX[c]
    layer[y0:y1, x0:x1] = state["layer"]


def hline(x0, x1, y, c):
    rect(x0, y, x1 - x0 + 1, 1, c)


def vline(x, y0, y1, c):
    rect(x, y0, 1, y1 - y0 + 1, c)


def frame(x, y, w, h, c):
    hline(x, x + w - 1, y, c)
    hline(x, x + w - 1, y + h - 1, c)
    vline(x, y, y + h - 1, c)
    vline(x + w - 1, y, y + h - 1, c)


def rounded_frame(x, y, w, h, c):
    hline(x + 1, x + w - 2, y, c)
    hline(x + 1, x + w - 2, y + h - 1, c)
    vline(x, y + 1, y + h - 2, c)
    vline(x + w - 1, y + 1, y + h - 2, c)


def ellipse(cx, cy, rx, ry, c):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                px(x, y, c)


def dither(x, y, t):
    return t > BAYER[y % 4, x % 4]


def get(x, y):
    return NAMES[canvas[y, x]]


def remap_pixel(x, y, table):
    canvas[y, x] = table[canvas[y, x]]


def glints(y, spans, c="a2"):
    for x0, x1 in spans:
        hline(x0, x1, y, c)


def shadow(x, y, w, h, dx=3, dy=3):
    for yy in range(y + dy, y + h + dy):
        for xx in range(x + dx, x + w + dx):
            if not (0 <= xx < W and 0 <= yy < H):
                continue
            if layer[yy, xx] != FLOOR:
                continue
            edge = xx >= x + w + dx - 1 or yy >= y + h + dy - 1
            if edge and not dither(xx, yy, 0.5):
                continue
            remap_pixel(xx, yy, DARK_IDX)


def plank_row(rng, y, h):
    x = 16 - rng.randint(0, 60)
    while x < 624:
        length = rng.choice([44, 52, 60, 68, 76, 84, 96])
        plank(rng, x, y, length, h)
        x += length


def plank(rng, x, y, length, h):
    tone = rng.random()
    base, seam, grain, high = "f2", "f1", "f1", "f3"
    if tone < 0.12:
        base, seam, grain, high = "f1", "f0", "f0", "f2"
    elif tone > 0.8:
        base, seam, grain, high = "f3", "f1", "f2", "w4"
    rect(max(x, 16), y, min(x + length, 624) - max(x, 16), h, base)
    hline(max(x, 16), min(x + length - 1, 623), y, seam)
    if 16 <= x < 624:
        vline(x, y, y + h - 1, "f0")
        if x + 1 < 624:
            px(x + 1, y + 1, high)
    for _ in range(rng.randint(1, 3)):
        gx = x + rng.randint(4, max(5, length - 12))
        gy = y + rng.randint(2, h - 2)
        gl = rng.randint(3, 9)
        for i in range(gl):
            if 16 <= gx + i < 624 and gx + i < x + length - 2:
                px(gx + i, gy, grain)
    if rng.random() < 0.35:
        hx = x + rng.randint(4, max(5, length - 8))
        hy = y + rng.randint(2, h - 2)
        for i in range(rng.randint(2, 5)):
            if 16 <= hx + i < 624 and hx + i < x + length - 2:
                px(hx + i, hy, high)
    if rng.random() < 0.12:
        kx = x + rng.randint(6, max(7, length - 8))
        ky = y + rng.randint(3, h - 3)
        if 17 <= kx < 622:
            px(kx, ky, "f0")
            px(kx + 1, ky, "f1")
            px(kx - 1, ky, "f1")
            px(kx, ky - 1, "f3")
    if rng.random() < 0.5 and 16 <= x + 2 < 624:
        px(x + 2, y + 2, "f0")
        px(x + 2, y + h - 2, "f0")


def floor():
    set_layer(FLOOR)
    rng = random.Random(11)
    y = 48
    while y < 368:
        plank_row(rng, y, 8)
        y += 8
    worn_lane(random.Random(13))
    flagstones(random.Random(5), 416, 48, 624, 128)


def worn_lane(rng):
    for _ in range(70):
        t = rng.random()
        cx = 320 + int(math.sin(t * 5) * 18) + rng.randint(-26, 26)
        cy = int(360 - t * 190)
        if get(cx, cy) not in ("f2", "f1"):
            continue
        length = rng.randint(2, 6)
        for i in range(length):
            if get(cx + i, cy) in ("f2", "f1"):
                px(cx + i, cy, "f3" if get(cx + i, cy) == "f2" else "f2")


def flagstone(rng, x, y, w, h):
    tone = rng.random()
    base, high, low = "s2", "s3", "s1"
    if tone > 0.8:
        base, high, low = "s3", "p1", "s2"
    rect(x, y, w, h, base)
    hline(x, x + w - 1, y + h - 1, "s0")
    vline(x + w - 1, y, y + h - 1, "s0")
    hline(x + 1, x + w - 3, y, high)
    vline(x, y + 1, y + h - 3, high)
    hline(x + 1, x + w - 2, y + h - 2, low)
    vline(x + w - 2, y + 1, y + h - 2, low)
    if rng.random() < 0.4 and w > 8 and h > 8:
        cx = x + rng.randint(3, w - 4)
        cy = y + 1
        for _ in range(rng.randint(3, 7)):
            px(cx, cy, "s1")
            if rng.random() < 0.6:
                px(cx + 1, cy, "s3") if rng.random() < 0.3 else None
            cy += 1
            cx += rng.choice([-1, 0, 0, 1])
            if cy >= y + h - 2 or cx <= x or cx >= x + w - 2:
                break
    for _ in range(rng.randint(0, 2)):
        px(x + rng.randint(2, w - 3), y + rng.randint(2, h - 3), "s1")


def flagstones(rng, x0, y0, x1, y1):
    y = y0
    heights = [13, 15, 12, 16, 14, 13]
    row = 0
    while y < y1:
        h = min(heights[row % len(heights)], y1 - y)
        x = x0 - rng.randint(0, 10)
        while x < x1:
            w = rng.randint(15, 28)
            xs = max(x, x0)
            we = min(x + w, x1) - xs
            if we > 2:
                flagstone(rng, xs, y, we, h)
            x += w
        y += h
        row += 1
    vline(x0 - 1, y0, y1 - 1, "f0")
    vline(x0 - 2, y0, y1 - 1, "w1")
    hline(x0 - 2, x1 - 1, y1, "w1")
    hline(x0 - 2, x1 - 1, y1 + 1, "f0")


POSTS = [22, 104, 192, 262, 390, 504, 604]


def wall():
    set_layer(WALL)
    rng = random.Random(3)
    rect(0, 0, W, 48, "p1")
    for y in range(8, 34):
        for x in range(16, 624):
            n = (x * 7 + y * 13) % 29
            if n == 0 and y > 12 and (x * 3 + y) % 5 == 0:
                px(x, y, "p0")
    for _ in range(10):
        sx, sy = rng.randint(20, 600), rng.randint(12, 26)
        w = rng.randint(8, 18)
        hline(sx + 1, sx + w - 2, sy, "p2")
        hline(sx, sx + w - 1, sy + 1, "p2")
        hline(sx + 2, sx + w - 4, sy + 2, "p2")
    for _ in range(8):
        sx, sy = rng.randint(20, 620), rng.randint(14, 30)
        for i in range(rng.randint(3, 6)):
            px(sx + i, sy + (i // 2), "p0")
    hline(0, W - 1, 8, "p0")
    hline(0, W - 1, 9, "p0")
    for x in range(0, W):
        if dither(x, 10, 0.5):
            px(x, 10, "p0")
    beam()
    for x in POSTS:
        post(x)
    wainscot()
    for x in range(16, 624):
        set_layer(FLOOR)
        for y in (48, 49):
            remap_pixel(x, y, DARK_IDX)
        if dither(x, 50, 0.5):
            remap_pixel(x, 50, DARK_IDX)
    set_layer(WALL)


def beam():
    rect(0, 0, W, 7, "w1")
    hline(0, W - 1, 0, "ol")
    hline(0, W - 1, 1, "w0")
    hline(0, W - 1, 2, "w2")
    hline(0, W - 1, 6, "w0")
    hline(0, W - 1, 7, "ol")
    rng = random.Random(9)
    for x in range(0, W, 3):
        if rng.random() < 0.3:
            hline(x, x + rng.randint(2, 6), rng.choice([3, 4, 5]), "w0")
    for x in range(8, W, 64):
        rect(x, 2, 10, 8, "w2")
        hline(x, x + 9, 2, "w3")
        vline(x, 3, 9, "w3")
        vline(x + 9, 2, 9, "w0")
        hline(x, x + 9, 10, "ol")
        px(x + 4, 5, "w0")
        px(x + 5, 6, "w1")


def post(x):
    rect(x, 8, 6, 28, "w1")
    vline(x, 8, 35, "w0")
    vline(x + 1, 8, 35, "w2")
    vline(x + 5, 8, 35, "w0")
    px(x + 3, 14, "w0")
    px(x + 3, 15, "w0")
    px(x + 2, 24, "w2")
    for y in range(8, 36):
        if dither(x + 6, y, 0.5):
            px(x + 6, y, "p0")


def wainscot():
    rect(16, 34, 608, 12, "w2")
    hline(16, 623, 34, "w3")
    hline(16, 623, 35, "w4")
    hline(16, 623, 36, "w1")
    hline(16, 623, 44, "w1")
    hline(16, 623, 45, "w0")
    hline(16, 623, 46, "w0")
    hline(16, 623, 47, "ol")
    for x in range(20, 620, 24):
        rect(x + 2, 38, 19, 5, "w1")
        hline(x + 2, x + 20, 38, "w0")
        vline(x + 2, 38, 42, "w0")
        hline(x + 3, x + 20, 42, "w3")
        vline(x + 20, 39, 42, "w3")
        px(x + 10, 40, "w2")


def side_walls():
    set_layer(WALL)
    stone_cap(0, 0, 12, 368, vertical=True)
    rect(12, 0, 4, 368, "s0")
    vline(12, 0, 367, "s1")
    vline(15, 11, 367, "ol")
    stone_cap(628, 0, 12, 368, vertical=True)
    rect(624, 0, 4, 368, "s2")
    vline(624, 11, 367, "ol")
    vline(625, 11, 367, "s3")
    stone_cap(0, 368, 640, 16, vertical=False)
    set_layer(FLOOR)
    for y in range(51, 368):
        for x in (16, 17, 18):
            if x == 18 and not dither(x, y, 0.5):
                continue
            remap_pixel(x, y, DARK_IDX)
    for x in range(16, 624):
        if dither(x, 367, 0.5):
            remap_pixel(x, 367, DARK_IDX)
    set_layer(WALL)


def stone_cap(x, y, w, h, vertical):
    rect(x, y, w, h, "s1")
    rng = random.Random(x * 31 + y)
    if vertical:
        yy = y
        while yy < y + h:
            bh = rng.randint(10, 18)
            rect(x + 1, yy + 1, w - 2, bh - 2, "s2")
            hline(x + 1, x + w - 3, yy + 1, "s3")
            hline(x, x + w - 1, yy + bh - 1, "s0")
            if rng.random() < 0.3:
                px(x + rng.randint(2, w - 3), yy + rng.randint(3, max(4, bh - 3)), "s1")
            yy += bh
        vline(x, y, y + h - 1, "ol")
        vline(x + w - 1, y, y + h - 1, "ol")
        return
    xx = x
    while xx < x + w:
        bw = rng.randint(14, 26)
        rect(xx + 1, y + 1, bw - 2, h - 5, "s2")
        hline(xx + 1, xx + bw - 3, y + 1, "s3")
        vline(xx + bw - 1, y, y + h - 1, "s0")
        if rng.random() < 0.3:
            px(xx + rng.randint(2, max(3, bw - 3)), y + rng.randint(3, 8), "s1")
        xx += bw
    hline(x, x + w - 1, y, "ol")
    rect(x, y + h - 4, w, 3, "s0")
    hline(x, x + w - 1, y + h - 1, "ol")


def door_leaf(x0, x1, hinge_x):
    rect(x0, 369, x1 - x0 + 1, 15, "w2")
    for x in range(x0, x1 + 1, 4):
        vline(x, 370, 383, "w3")
        vline(x + 3, 370, 383, "w1")
    hline(x0, x1, 369, "w4")
    for y in (372, 379):
        hline(x0, x1, y, "s2")
        hline(x0, x1, y + 1, "s0")
        px(hinge_x, y, "s3")
        px(hinge_x, y + 1, "s1")
    for x in range(x0 + 2, x1, 5):
        px(x, 372, "s3")
        px(x, 379, "s3")


def door_leaves():
    door_leaf(306, 318, 306)
    door_leaf(321, 333, 333)
    vline(319, 369, 383, "a2")
    vline(320, 369, 383, "a1")
    vline(318, 369, 383, "w0")
    vline(321, 369, 383, "w0")
    for x in (316, 323):
        rect(x, 375, 2, 2, "a1")
        px(x, 375, "a2")
        px(x, 377, "a0")
        px(x + 1, 377, "a0")
    glints(369, [(308, 312), (326, 331)])
    hline(304, 335, 368, "ol")


def door_mat():
    rect(304, 352, 32, 15, "r1")
    for y in range(354, 365):
        for x in range(306, 334):
            if (x + y) % 4 == 0:
                px(x, y, "r0")
    frame(304, 352, 32, 15, "r0")
    frame(306, 354, 28, 11, "a0")
    hline(305, 334, 353, "r2")
    for x in range(305, 335, 2):
        px(x, 367, "p1")
    for y in range(357, 362):
        span = 2 - abs(y - 359)
        hline(319 - span * 2, 320 + span * 2, y, "a0")
    hline(319, 320, 359, "a2")


def map_regions(x, y):
    rect(x, y, 6, 6, "a1")
    px(x + 5, y + 5, "p2")
    px(x + 5, y, "p2")
    hline(x + 1, x + 2, y + 1, "a2")
    px(x + 4, y + 3, "a0")
    px(x + 1, y + 4, "a0")
    rect(x + 2, y + 2, 2, 2, "r2")
    rect(x + 7, y, 5, 7, "g2")
    px(x + 7, y + 6, "p2")
    px(x + 9, y + 2, "g1")
    px(x + 10, y + 2, "g1")
    px(x + 8, y + 4, "g1")
    px(x + 10, y + 5, "g0")
    rect(x, y + 7, 5, 7, "v1")
    px(x + 4, y + 7, "p2")
    px(x + 1, y + 9, "v0")
    px(x + 3, y + 11, "v0")
    px(x + 2, y + 12, "v0")
    rect(x + 6, y + 8, 6, 6, "c1")
    px(x + 6, y + 8, "p2")
    hline(x + 8, x + 10, y + 10, "c2")
    px(x + 9, y + 9, "c2")
    px(x + 7, y + 12, "c0")
    px(x + 10, y + 12, "c0")


def world_map():
    set_layer(PROP)
    rect(288, 350, 16, 18, "w2")
    rect(290, 352, 12, 14, "p2")
    map_regions(290, 352)
    hline(289, 302, 351, "w4")
    vline(289, 352, 366, "w3")
    vline(302, 352, 366, "w1")
    hline(289, 302, 366, "w1")
    frame(288, 350, 16, 18, "ol")
    glints(351, [(290, 294), (298, 300)])


def door():
    set_layer(PROP)
    rect(300, 368, 40, 16, "s1")
    door_leaves()
    for x in (298, 334):
        rect(x, 368, 8, 16, "w2")
        vline(x, 368, 383, "ol")
        vline(x + 7, 368, 383, "ol")
        vline(x + 1, 369, 383, "w3")
        vline(x + 6, 369, 383, "w1")
        hline(x, x + 7, 368, "ol")
        hline(x + 1, x + 6, 369, "w4")
        px(x + 3, 375, "w1")
        px(x + 4, 379, "w1")
    set_layer(FLOOR)
    door_mat()


def window(x, y):
    set_layer(PROP)
    rect(x + 2, 9, 28, 22, "w0")
    rect(x + 4, 11, 24, 18, "c1")
    for yy in range(11, 29):
        for xx in range(x + 4, x + 28):
            if yy < 19 and dither(xx, yy, 0.85 - (yy - 11) * 0.1):
                px(xx, yy, "c2")
    for xx in range(x + 4, x + 28):
        top = 24 + int(2 * math.sin((xx - x) * 0.7))
        for yy in range(top, 29):
            px(xx, yy, "g1" if (xx + yy) % 3 else "g2")
    for xx in range(x + 6, x + 18):
        px(xx, 26 - ((xx - x) % 4 == 0), "r2")
    rect(x + 6, 27, 12, 2, "r1")
    vline(x + 15, 11, 28, "w1")
    vline(x + 16, 11, 28, "w2")
    hline(x + 4, x + 27, 19, "w2")
    hline(x + 4, x + 27, 20, "w1")
    for i in range(4):
        px(x + 6 + i, 15 - i, "c2")
        px(x + 19 + i, 14 - i, "c2")
    hline(x + 4, x + 27, 11, "c0")
    vline(x + 4, 11, 28, "c0")
    rect(x, 29, 32, 4, "w2")
    hline(x, x + 31, 29, "w4")
    hline(x, x + 31, 30, "w3")
    hline(x, x + 31, 32, "w0")
    hline(x + 1, x + 30, 33, "ol")
    frame(x + 2, 9, 28, 21, "ol")
    hline(x + 3, x + 28, 10, "w3")
    glints(29, [(x + 3, x + 12), (x + 17, x + 21), (x + 25, x + 27)])
    glints(10, [(x + 5, x + 9), (x + 18, x + 20)], "w4")
    for yy in range(34, 37):
        for xx in range(x + 2, x + 30):
            if dither(xx, yy, 0.6 - (yy - 34) * 0.2):
                canvas[yy, xx] = DARK_IDX[canvas[yy, xx]]


def banner(x, y):
    set_layer(PROP)
    hline(x + 2, x + 29, 7, "w0")
    hline(x + 2, x + 29, 8, "w2")
    hline(x + 3, x + 28, 9, "w0")
    for kx in (x + 1, x + 29):
        rect(kx, 6, 3, 4, "a0")
        px(kx, 6, "a1")
        frame(kx - 1, 5, 5, 6, "w0")
    left, right = x + 7, x + 24
    tip = 40
    for yy in range(10, tip + 1):
        for xx in range(left, right + 1):
            mid = (left + right) / 2
            if yy > tip - 5 and abs(xx - mid) < (yy - (tip - 5)) * 1.6:
                continue
            c = "r1"
            if xx <= left + 1:
                c = "r2"
            elif xx >= right - 1:
                c = "r0"
            px(xx, yy, c)
    for yy in range(10, tip + 1):
        for xx in (left + 6, left + 11):
            if get(xx, yy) == "r1" and (yy // 3) % 2 == 0:
                px(xx, yy, "r0" if xx == left + 11 else "r1")
    hline(left, right, 12, "a0")
    hline(left, right, 13, "r0")
    cx, cy = (left + right) // 2, 23
    for dy in range(-5, 6):
        span = 5 - abs(dy)
        for dx in range(-span, span + 1):
            px(cx + dx, cy + dy, "a0")
    for dy in range(-3, 4):
        span = 3 - abs(dy)
        for dx in range(-span, span + 1):
            px(cx + dx, cy + dy, "a1")
    px(cx, cy, "r1")
    px(cx - 1, cy - 2, "a2")
    vline(cx, cy - 8, cy - 7, "a1")
    vline(cx, cy + 7, cy + 8, "a1")
    hline(left, right, 32, "a0")
    outline_shape(left - 1, 9, right + 1, tip + 1, {"r0", "r1", "r2", "a0", "a1", "a2"}, "ol")


def outline_shape(x0, y0, x1, y1, inside, c):
    marks = []
    ids = {IDX[n] for n in inside}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if canvas[y, x] in ids:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if x0 < nx < x1 and y0 < ny < y1 and canvas[ny, nx] in ids:
                    marks.append((x, y))
                    break
    for x, y in marks:
        px(x, y, c)


def quest_board(x, y):
    set_layer(PROP)
    rng = random.Random(21)
    bx0, bx1, by0, by1 = x + 3, x + 92, 11, 44
    rect(bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1, "w2")
    for yy in range(by0 + 3, by1 - 2):
        for xx in range(bx0 + 3, bx1 - 2):
            c = "w3" if (yy // 6) % 2 == 0 else "w2"
            if dither(xx, yy, 0.15):
                c = "w2" if c == "w3" else "w1"
            px(xx, yy, c)
        if (yy - by0 - 3) % 6 == 0:
            hline(bx0 + 3, bx1 - 3, yy, "w1")
    frame(bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1, "ol")
    rect(bx0 + 1, by0 + 1, bx1 - bx0 - 1, 2, "w1")
    hline(bx0 + 1, bx1 - 1, by0 + 1, "w4")
    rect(bx0 + 1, by1 - 2, bx1 - bx0 - 1, 2, "w0")
    vline(bx0 + 1, by0 + 1, by1 - 1, "w3")
    vline(bx0 + 2, by0 + 3, by1 - 3, "w1")
    vline(bx1 - 1, by0 + 1, by1 - 1, "w0")
    rect(x, 7, 96, 4, "w1")
    hline(x, x + 95, 7, "w3")
    hline(x, x + 95, 8, "w2")
    hline(x, x + 95, 10, "w0")
    frame(x - 1, 6, 98, 6, "ol")
    papers = [
        (x + 8, 15, 12, 14, "p2"), (x + 23, 17, 10, 12, "p1"), (x + 36, 14, 14, 10, "p2"),
        (x + 38, 27, 11, 12, "a2"), (x + 53, 16, 12, 15, "p2"), (x + 68, 14, 9, 11, "p2"),
        (x + 79, 18, 9, 13, "p2"), (x + 67, 28, 13, 11, "p1"), (x + 10, 31, 15, 9, "p1"),
        (x + 26, 32, 9, 8, "p2"),
    ]
    for i, (px0, py0, pw, ph, pc) in enumerate(papers):
        paper(rng, px0, py0, pw, ph, pc, i)
    glints(7, [(x + 4, x + 26), (x + 34, x + 47), (x + 60, x + 71), (x + 82, x + 90)], "w4")
    glints(7, [(x + 9, x + 17), (x + 38, x + 42), (x + 63, x + 66)])
    glints(by0 + 1, [(bx0 + 6, bx0 + 14), (bx0 + 40, bx0 + 44)])


def paper(rng, x, y, w, h, c, i):
    rect(x + 1, y + 1, w, h, "w0")
    rect(x, y, w, h, c)
    shade = "p1" if c == "p2" else "p0"
    vline(x + w - 1, y + 1, y + h - 1, shade)
    hline(x + 1, x + w - 1, y + h - 1, shade)
    px(x + w - 1, y + h - 1, "p0")
    if i % 3 == 0:
        px(x, y + h - 1, "w2")
        px(x + 1, y + h - 1, shade)
    for ly in range(y + 3, y + h - 2, 2):
        lx = x + 2
        while lx < x + w - 3:
            seg = rng.randint(1, 4)
            hline(lx, min(lx + seg - 1, x + w - 3), ly, "s1" if rng.random() < 0.8 else "p0")
            lx += seg + rng.randint(1, 2)
    if i % 4 == 1:
        rect(x + w // 2 - 2, y + h - 5, 4, 3, "r1")
        px(x + w // 2 - 2, y + h - 5, "r2")
    pin = "r2" if i % 2 else "c1"
    px(x + w // 2, y + 1, pin)
    px(x + w // 2 + 1, y + 1, "r1" if i % 2 else "c0")
    px(x + w // 2, y, "a0" if i % 2 else "c2")


def lantern(x, y):
    set_layer(PROP)
    hline(x + 2, x + 9, 15, "s0")
    vline(x + 2, 13, 17, "s0")
    px(x + 8, 16, "s0")
    cx = x + 8
    rect(cx - 2, 16, 5, 2, "s1")
    hline(cx - 1, cx + 1, 15, "s0")
    rect(cx - 4, 18, 9, 2, "s1")
    hline(cx - 4, cx + 4, 18, "s2")
    rect(cx - 3, 20, 7, 8, "a1")
    vline(cx - 3, 20, 27, "s0")
    vline(cx + 3, 20, 27, "s0")
    vline(cx, 20, 27, "s1")
    px(cx - 1, 22, "a2")
    px(cx - 2, 23, "a2")
    px(cx - 1, 23, "a2")
    px(cx + 1, 25, "a0")
    px(cx + 2, 26, "a0")
    rect(cx - 4, 28, 9, 2, "s1")
    hline(cx - 4, cx + 4, 29, "s0")
    px(cx, 30, "s0")
    frame(cx - 5, 17, 11, 14, "ol")
    px(cx - 5, 17, "p1")
    px(cx + 5, 17, "p1")


def fireplace(x, y):
    set_layer(PROP)
    rng = random.Random(4)
    x0, x1 = x + 2, x + 61
    rect(x0, 0, x1 - x0 + 1, 52, "s1")
    yy = 0
    row = 0
    while yy < 52:
        bh = 6 if row % 2 else 7
        xx = x0 - (5 if row % 2 else 0)
        while xx <= x1:
            bw = rng.randint(9, 15)
            sx0, sx1 = max(xx, x0), min(xx + bw - 1, x1)
            if sx1 - sx0 >= 2:
                tone = rng.choice(["s2", "s2", "s3", "s1"])
                rect(sx0, yy, sx1 - sx0 + 1, bh - 1, tone)
                hline(sx0, sx1 - 1, yy, "s3" if tone != "s3" else "p1")
                vline(sx1, yy, yy + bh - 2, "s0")
                if rng.random() < 0.3:
                    px(rng.randint(sx0 + 1, max(sx0 + 1, sx1 - 1)), yy + 2, "s1")
            xx += bw
        hline(x0, x1, yy + bh - 1, "s0")
        yy += bh
        row += 1
    vline(x0, 0, 52, "ol")
    vline(x1, 0, 52, "ol")
    vline(x0 + 1, 0, 52, "s3")
    vline(x1 - 1, 0, 52, "s0")
    rect(x0 - 3, 21, x1 - x0 + 7, 6, "w2")
    hline(x0 - 3, x1 + 3, 21, "w4")
    hline(x0 - 3, x1 + 3, 22, "w3")
    hline(x0 - 3, x1 + 3, 25, "w1")
    hline(x0 - 3, x1 + 3, 26, "w0")
    frame(x0 - 4, 20, x1 - x0 + 9, 8, "ol")
    for kx in range(x0 + 2, x1 - 2, 13):
        px(kx, 24, "w1")
    mantel_items(x0, x1)
    fx0, fx1, fy0, fy1 = x + 14, x + 49, 31, 52
    rect(fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1, "ol")
    for yy in range(fy0, fy0 + 4):
        inset = 4 - (yy - fy0)
        hline(fx0, fx0 + inset, yy, "s1")
        hline(fx1 - inset, fx1, yy, "s1")
    rect(fx0 + 2, fy0 + 3, fx1 - fx0 - 3, fy1 - fy0 - 3, "r0")
    for yy in range(fy0 + 3, fy1):
        for xx in range(fx0 + 2, fx1 - 1):
            if dither(xx, yy, 0.35 - (fy1 - yy) * 0.02):
                px(xx, yy, "ol")
    flames(fx0, fx1, fy1)
    rect(x0 - 2, 52, x1 - x0 + 5, 12, "s2")
    hline(x0 - 2, x1 + 2, 52, "s3")
    hline(x0 - 2, x1 + 2, 53, "s3")
    for kx in range(x0 + 10, x1, 16):
        vline(kx, 53, 59, "s1")
    rect(x0 - 2, 60, x1 - x0 + 5, 4, "s1")
    hline(x0 - 2, x1 + 2, 63, "s0")
    vline(x0 - 3, 52, 63, "ol")
    vline(x1 + 3, 52, 63, "ol")
    hearth_glow(x0, x1, fx0, fx1, fy0, fy1)
    tools(x1 - 8)
    logs_pile(x0 + 2)


def flames(fx0, fx1, fy1):
    cx = (fx0 + fx1) // 2
    rect(fx0 + 5, fy1 - 4, fx1 - fx0 - 9, 3, "w1")
    hline(fx0 + 5, fx1 - 5, fy1 - 4, "w2")
    for xx in range(fx0 + 6, fx1 - 5, 5):
        px(xx, fy1 - 3, "w0")
    hline(fx0 + 4, fx1 - 4, fy1 - 1, "r2")
    for xx in range(fx0 + 4, fx1 - 4):
        if dither(xx, fy1 - 1, 0.5):
            px(xx, fy1 - 1, "a0")
    shapes = [(cx - 9, 9, "a0"), (cx - 3, 14, "a0"), (cx + 5, 12, "a0"), (cx + 10, 7, "a0")]
    for fx, fh, c in shapes:
        for i in range(fh):
            yy = fy1 - 5 - i
            half = max(0, int((fh - i) * 0.35))
            sway = int(round(math.sin(i * 0.6 + fx) * 1.2))
            hline(fx - half + sway, fx + half + sway, yy, "r2" if i > fh - 3 else c)
            if half >= 2:
                hline(fx - half + 1 + sway, fx + half - 1 + sway, yy, "a1")
            if half >= 3:
                hline(fx - 1 + sway, fx + sway, yy, "a2")
    for sx, sy in ((cx - 8, fy1 - 16), (cx + 2, fy1 - 17), (cx + 9, fy1 - 14)):
        px(sx, sy, "a1")


def hearth_glow(x0, x1, fx0, fx1, fy0, fy1):
    glints(21, [(x0, x0 + 13), (x0 + 22, x0 + 38), (x0 + 46, x0 + 50)])
    hline(fx0 + 2, fx1 - 2, 52, "p2")
    hline(fx0 + 8, fx1 - 8, 52, "a2")
    hline(fx0 + 4, fx1 - 4, 53, "p1")
    for yy in range(fy0 + 5, fy1):
        if dither(fx0 + 2, yy, 0.25 + (yy - fy0) * 0.03):
            px(fx0 + 2, yy, "r1")
        if dither(fx1 - 2, yy, 0.25 + (yy - fy0) * 0.03):
            px(fx1 - 2, yy, "r1")
    for kx in (fx0 - 3, fx1 + 3):
        px(kx, 33, "p1")
        px(kx, 40, "p1")


def mantel_items(x0, x1):
    for i, cx in enumerate((x0 + 6, x0 + 52)):
        rect(cx, 14, 3, 6, "p2")
        vline(cx + 2, 14, 19, "p1")
        px(cx + 1, 13, "w0")
        px(cx + 1, 12, "a1")
        px(cx + 1, 11, "a2")
        hline(cx - 1, cx + 3, 20, "s1")
    rect(x0 + 18, 13, 6, 7, "w1")
    vline(x0 + 18, 13, 19, "w2")
    hline(x0 + 18, x0 + 23, 13, "p2")
    vline(x0 + 24, 14, 17, "w1")
    px(x0 + 25, 15, "w1")
    frame(x0 + 17, 12, 8, 9, "w0")
    rect(x0 + 30, 15, 12, 5, "c0")
    hline(x0 + 30, x0 + 41, 15, "c1")
    px(x0 + 32, 16, "c2")
    rect(x0 + 34, 12, 4, 3, "c1")
    px(x0 + 35, 11, "w2")
    frame(x0 + 29, 14, 14, 7, "s0")


def tools(x):
    vline(x, 34, 51, "s0")
    vline(x + 1, 34, 51, "s2")
    rect(x - 1, 33, 4, 2, "s1")
    vline(x + 4, 38, 51, "w1")
    rect(x + 3, 36, 3, 3, "s1")


def logs_pile(x):
    for i, (lx, ly) in enumerate(((x - 2, 45), (x + 4, 45), (x + 1, 41))):
        ellipse(lx + 3, ly + 3, 3.5, 3.5, "w0")
        ellipse(lx + 3, ly + 3, 2.5, 2.5, "w3")
        px(lx + 3, ly + 3, "w2")
        px(lx + 2, ly + 2, "w4")


def bookshelves(x, y):
    set_layer(PROP)
    rng = random.Random(17)
    x0, x1 = x, x + 159
    top = 30
    rect(x0, top, 160, 50, "w1")
    rect(x0, top, 160, 4, "w3")
    hline(x0, x1, top, "w4")
    hline(x0, x1, top + 3, "w2")
    hline(x0, x1, top + 4, "w0")
    cabinets = [(x0, x0 + 53), (x0 + 53, x0 + 106), (x0 + 106, x1 + 1)]
    for ci, (c0, c1) in enumerate(cabinets):
        rows = [(top + 6, top + 21), (top + 24, top + 38)]
        for (r0_, r1_) in rows:
            rect(c0 + 3, r0_, c1 - c0 - 6, r1_ - r0_ + 1, "w0")
            books_row(rng, c0 + 3, c1 - 4, r0_, r1_)
            hline(c0 + 3, c1 - 4, r1_ + 1, "w4")
            hline(c0 + 3, c1 - 4, r1_ + 2, "w2")
        rect(c0 + 3, top + 41, c1 - c0 - 6, 8, "w2")
        hline(c0 + 3, c1 - 4, top + 41, "w1")
        hline(c0 + 3, c1 - 4, top + 48, "w1")
        for dx0 in (c0 + 5, (c0 + c1) // 2 + 1):
            dw = (c1 - c0) // 2 - 6
            frame(dx0, top + 42, dw, 6, "w1")
            hline(dx0 + 1, dx0 + dw - 2, top + 43, "w3")
            px(dx0 + dw // 2, top + 45, "a1")
            px(dx0 + dw // 2, top + 46, "a0")
        vline(c0, top + 4, top + 49, "w2")
        vline(c0 + 1, top + 4, top + 49, "w3")
        vline(c0 + 2, top + 5, top + 49, "w1")
    vline(x1 - 1, top + 4, top + 49, "w1")
    vline(x1 - 2, top + 4, top + 49, "w2")
    for c0, c1 in cabinets[1:]:
        vline(c0 - 1, top + 5, top + 49, "w0")
    frame(x0 - 1, top - 1, 162, 51, "ol")
    hline(x0, x1, top + 49, "w0")
    glints(top, [(x0 + 3, x0 + 9), (x0 + 24, x0 + 50), (x0 + 80, x0 + 88), (x0 + 106, x0 + 124), (x0 + 140, x0 + 152)])
    shelf_top_items(x0, top)


def books_row(rng, x0, x1, y0, y1):
    ramps = [("r0", "r1", "r2"), ("g0", "g1", "g2"), ("c0", "c0", "c1"), ("w0", "w2", "w3"),
             ("s0", "s1", "s2"), ("v0", "v1", "v1"), ("p0", "p1", "p2"), ("r1", "r2", "a0"),
             ("w1", "w3", "w4")]
    x = x0 + rng.randint(0, 2)
    lean_used = False
    while x < x1 - 1:
        roll = rng.random()
        if roll < 0.1:
            x += rng.randint(2, 4)
            continue
        if roll < 0.16 and not lean_used and x < x1 - 8:
            lean_used = True
            lean_book(x, y0, y1, rng.choice(ramps))
            x += 6
            continue
        if roll < 0.2 and x < x1 - 7:
            jar_or_scroll(rng, x, y1)
            x += 7
            continue
        bw = rng.choice([2, 3, 3, 3, 4])
        bw = min(bw, x1 - x)
        bh = rng.randint(y1 - y0 - 6, y1 - y0)
        dark, mid, light = rng.choice(ramps)
        by = y1 - bh + 1
        rect(x, by, bw, bh, mid)
        vline(x, by, y1, light)
        if bw > 2:
            vline(x + bw - 1, by, y1, dark)
        hline(x, x + bw - 1, by, light)
        if rng.random() < 0.4 and bh > 7:
            band_y = by + rng.randint(2, 3)
            hline(x, x + bw - 1, band_y, "a1" if rng.random() < 0.6 else "p1")
            if rng.random() < 0.5:
                hline(x, x + bw - 1, y1 - 2, "a0")
        x += bw


def lean_book(x, y0, y1, ramp):
    dark, mid, light = ramp
    h = y1 - y0 - 2
    for i in range(h):
        off = i // 3
        yy = y1 - i
        px(x + off, yy, light)
        px(x + off + 1, yy, mid)
        px(x + off + 2, yy, mid)
        px(x + off + 3, yy, dark)


def jar_or_scroll(rng, x, y1):
    if rng.random() < 0.5:
        rect(x + 1, y1 - 6, 5, 7, "c1")
        vline(x + 1, y1 - 6, y1, "c2")
        vline(x + 5, y1 - 6, y1, "c0")
        rect(x + 2, y1 - 3, 3, 3, "g2")
        hline(x + 1, x + 5, y1 - 7, "w2")
        hline(x + 2, x + 4, y1 - 8, "w3")
        return
    for k in range(2):
        ellipse(x + 3.5, y1 - 1.5 - k * 3, 3.5, 1.6, "p1")
        hline(x + 1, x + 5, y1 - 2 - k * 3, "p2")
        px(x + 6, y1 - 2 - k * 3, "p0")


def shelf_top_items(x0, top):
    for cx in (x0 + 12, x0 + 128):
        rect(cx, top - 5, 7, 6, "r2")
        vline(cx, top - 5, top, "a0")
        vline(cx + 6, top - 5, top, "r1")
        hline(cx - 1, cx + 7, top - 6, "r1")
        hline(cx, cx + 6, top - 7, "g0")
        for lx, ly in ((cx - 1, top - 9), (cx + 2, top - 11), (cx + 5, top - 10), (cx + 7, top - 8), (cx + 3, top - 8)):
            px(lx, ly, "g2")
            px(lx, ly + 1, "g1")
            px(lx + 1, ly + 1, "g1")
    rect(x0 + 60, top - 4, 16, 4, "r1")
    hline(x0 + 60, x0 + 75, top - 4, "r2")
    rect(x0 + 62, top - 7, 13, 3, "c0")
    hline(x0 + 62, x0 + 74, top - 7, "c1")
    rect(x0 + 63, top - 9, 10, 2, "w3")
    hline(x0 + 63, x0 + 72, top - 9, "w4")
    frame(x0 + 59, top - 10, 18, 11, "ol")
    ellipse(x0 + 96, top - 3, 5, 3, "s1")
    hline(x0 + 92, x0 + 99, top - 5, "s2")
    hline(x0 + 92, x0 + 100, top - 1, "s0")
    vline(x0 + 101, top - 4, top - 2, "s1")


def plant(x, y, low=False):
    set_layer(PROP)
    cx = x + 8
    rect(cx - 4, y + 6, 9, 9, "r2")
    vline(cx - 4, y + 6, y + 14, "a0")
    vline(cx + 3, y + 6, y + 14, "r1")
    vline(cx + 4, y + 6, y + 14, "r1")
    hline(cx - 5, cx + 5, y + 5, "r2")
    hline(cx - 5, cx + 5, y + 6, "r1")
    hline(cx - 4, cx + 4, y + 10, "r1")
    frame(cx - 6, y + 4, 13, 12, "r0")
    hline(cx - 5, cx + 5, y + 15, "ol")
    leaves = [(-5, -4, 3), (4, -5, 3), (0, -8, 4), (-3, 0, 3), (3, -1, 3), (-1, -4, 3), (6, 1, 2), (-6, 2, 2)]
    if low:
        leaves = [(lx, max(ly, -1) + 1, min(r, 3)) for lx, ly, r in leaves]
    for lx, ly, r in leaves:
        ellipse(cx + lx, y + 4 + ly, r + 1, r * 0.8 + 1, "g0")
    for lx, ly, r in leaves:
        ellipse(cx + lx, y + 4 + ly, r, r * 0.8, "g1")
    for lx, ly, r in leaves:
        px(cx + lx - 1, y + 3 + ly - int(r * 0.4), "g2")
        px(cx + lx, y + 3 + ly - int(r * 0.4), "g2")
        px(cx + lx + 1, y + 5 + ly, "g0")


def forge(x, y):
    set_layer(PROP)
    furnace(x + 2)
    anvil(x + 50)
    alchemy_bench(x + 82)


def furnace(x):
    rng = random.Random(8)
    rect(x + 12, 24, 14, 16, "s1")
    vline(x + 12, 24, 39, "s2")
    vline(x + 25, 24, 39, "s0")
    hline(x + 11, x + 26, 24, "s3")
    for yy in range(28, 40, 4):
        hline(x + 12, x + 25, yy, "s0")
    frame(x + 11, 23, 16, 17, "ol")
    rect(x, 40, 38, 38, "r1")
    yy = 40
    row = 0
    while yy < 74:
        xx = x + (0 if row % 2 else 4) - 4
        while xx < x + 38:
            bw = 8
            sx0, sx1 = max(xx, x), min(xx + bw - 2, x + 37)
            tone = rng.choice(["r1", "r2", "r1", "r0"])
            if sx1 >= sx0:
                rect(sx0, yy, sx1 - sx0 + 1, 3, tone)
                hline(sx0, sx1, yy, "r2" if tone != "r2" else "a0")
            xx += bw
        hline(x, x + 37, yy + 3, "w0")
        yy += 4
        row += 1
    rect(x - 1, 38, 40, 5, "s2")
    hline(x - 1, x + 38, 38, "s3")
    hline(x - 1, x + 38, 42, "s0")
    rect(x - 1, 73, 40, 5, "s1")
    hline(x - 1, x + 38, 73, "s2")
    hline(x - 1, x + 38, 77, "s0")
    mx0, mx1, my0, my1 = x + 9, x + 28, 50, 70
    rect(mx0, my0 + 3, mx1 - mx0 + 1, my1 - my0 - 2, "ol")
    hline(mx0 + 2, mx1 - 2, my0 + 1, "ol")
    hline(mx0 + 1, mx1 - 1, my0 + 2, "ol")
    hline(mx0 + 3, mx1 - 3, my0, "ol")
    for yy in range(my0 + 8, my1 + 1):
        for xx in range(mx0 + 2, mx1 - 1):
            d = yy - (my0 + 8)
            if dither(xx, yy, 0.15 + d * 0.07):
                px(xx, yy, "r1")
    for xx in range(mx0 + 2, mx1 - 1):
        h = 3 + ((xx * 5) % 4)
        for k in range(h):
            yy = my1 - k
            c = "a1" if k < 2 else "a0"
            if k == h - 1:
                c = "r2"
            px(xx, yy, c)
    for xx, yy in ((mx0 + 6, my1 - 2), (mx0 + 11, my1 - 3), (mx0 + 15, my1 - 1)):
        px(xx, yy, "a2")
    for xx, yy in ((mx0 + 8, my0 + 5), (mx0 + 13, my0 + 2), (mx0 + 4, my0 - 3)):
        px(xx, yy, "a1")
    frame(x - 2, 37, 42, 42, "ol")
    rect(x + 38, 60, 6, 9, "w1")
    hline(x + 38, x + 43, 60, "w3")
    vline(x + 43, 60, 68, "w0")
    rect(x + 39, 69, 4, 9, "s1")
    vline(x + 39, 69, 77, "s2")
    frame(x + 37, 59, 8, 20, "ol")


def anvil(x):
    ellipse(x + 13, 66, 10, 4, "w0")
    rect(x + 4, 66, 19, 11, "w1")
    vline(x + 4, 66, 76, "w2")
    vline(x + 5, 66, 76, "w2")
    vline(x + 21, 66, 76, "w0")
    vline(x + 22, 66, 76, "w0")
    vline(x + 10, 68, 75, "w0")
    vline(x + 16, 69, 76, "w0")
    ellipse(x + 13, 65, 9.5, 3.5, "w3")
    ellipse(x + 13, 65, 6, 2, "w2")
    ellipse(x + 13, 65, 3, 1, "w3")
    hline(x + 4, x + 22, 77, "ol")
    vline(x + 3, 65, 76, "ol")
    vline(x + 23, 65, 76, "ol")
    rect(x + 9, 58, 9, 5, "s1")
    vline(x + 9, 58, 62, "s2")
    vline(x + 17, 58, 62, "s0")
    rect(x + 2, 52, 22, 6, "s2")
    hline(x + 2, x + 23, 52, "p1")
    hline(x + 2, x + 23, 53, "s3")
    hline(x + 2, x + 23, 56, "s1")
    hline(x + 2, x + 23, 57, "s0")
    for i in range(4):
        hline(x - 5 + i, x + 1, 53 + (i // 2), "s3" if i == 0 else "s2")
    px(x - 6, 53, "s2")
    rect(x + 5, 61, 17, 3, "s1")
    hline(x + 5, x + 21, 61, "s2")
    px(x + 20, 53, "a1")
    outline_shape(x - 7, 50, x + 26, 65, {"s0", "s1", "s2", "s3"}, "ol")
    rect(x + 14, 48, 6, 3, "s1")
    hline(x + 14, x + 19, 48, "s3")
    vline(x + 17, 51, 51, "w2")
    frame(x + 13, 47, 8, 5, "ol")
    vline(x + 26, 50, 70, "w2")
    vline(x + 27, 50, 70, "w1")
    rect(x + 24, 46, 6, 5, "s1")
    hline(x + 24, x + 29, 46, "s3")
    frame(x + 23, 45, 8, 7, "ol")
    vline(x + 25, 52, 70, "ol")
    vline(x + 28, 52, 70, "ol")


def alchemy_bench(x):
    rect(x, 50, 42, 10, "w3")
    hline(x, x + 41, 50, "w4")
    hline(x, x + 41, 56, "w2")
    rect(x, 60, 42, 6, "w1")
    hline(x, x + 41, 60, "w2")
    hline(x, x + 41, 65, "w0")
    for lx in (x + 1, x + 37):
        rect(lx, 66, 4, 12, "w1")
        vline(lx, 66, 77, "w2")
        vline(lx + 3, 66, 77, "w0")
    hline(x + 4, x + 36, 72, "w1")
    hline(x + 4, x + 36, 73, "w0")
    frame(x - 1, 49, 44, 18, "ol")
    vline(x, 66, 78, "ol")
    vline(x + 5, 66, 78, "ol")
    vline(x + 36, 66, 78, "ol")
    vline(x + 41, 66, 78, "ol")
    ellipse(x + 9, 47, 5, 5, "c0")
    ellipse(x + 9, 47, 4, 4, "c1")
    rect(x + 6, 47, 7, 4, "g2")
    hline(x + 6, x + 12, 47, "g1")
    px(x + 7, 44, "c2")
    px(x + 8, 43, "c2")
    rect(x + 8, 39, 3, 4, "c1")
    hline(x + 7, x + 11, 38, "w1")
    px(x + 9, 36, "c2")
    px(x + 11, 34, "c2")
    rect(x + 6, 53, 7, 3, "s1")
    hline(x + 6, x + 12, 53, "s2")
    px(x + 8, 52, "a1")
    px(x + 9, 51, "a2")
    px(x + 10, 52, "a1")
    rect(x + 18, 41, 3, 10, "r2")
    vline(x + 18, 41, 50, "a0")
    vline(x + 20, 41, 50, "r1")
    rect(x + 18, 39, 3, 2, "c1")
    hline(x + 17, x + 21, 38, "w2")
    frame(x + 17, 40, 5, 12, "r0")
    ellipse(x + 30, 50, 5, 3, "s1")
    ellipse(x + 30, 49, 4, 1.5, "s0")
    hline(x + 26, x + 34, 52, "s0")
    vline(x + 33, 42, 48, "w2")
    px(x + 34, 41, "w3")
    rect(x + 25, 52, 6, 3, "p2")
    hline(x + 25, x + 30, 54, "p1")
    for i in range(4):
        px(x + 36 + (i % 2), 51 + i, "g1")
    px(x + 37, 50, "g2")


def reception_counter(x, y):
    set_layer(PROP)
    x0, x1 = x, x + 127
    rect(x0, y, 128, 16, "w2")
    rect(x0, y, 128, 7, "w3")
    hline(x0, x1, y, "w4")
    hline(x0, x1, y + 1, "w4")
    for i in range(5):
        hline(x0 + 6 + i * 26, x0 + 18 + i * 26, y + 3 + (i % 2), "w2")
    hline(x0, x1, y + 6, "w2")
    hline(x0, x1, y + 7, "w0")
    rect(x0, y + 8, 128, 8, "w1")
    for px0 in range(x0 + 3, x1 - 6, 16):
        rect(px0, y + 9, 13, 5, "w2")
        hline(px0, px0 + 12, y + 9, "w3")
        vline(px0 + 12, y + 9, y + 13, "w0")
        hline(px0, px0 + 12, y + 13, "w1")
    rect(x0 + 52, y + 7, 24, 9, "r1")
    vline(x0 + 52, y + 7, y + 15, "r2")
    vline(x0 + 75, y + 7, y + 15, "r0")
    hline(x0 + 52, x0 + 75, y + 7, "a1")
    hline(x0 + 53, x0 + 74, y + 8, "r2")
    hline(x0 + 52, x0 + 75, y + 14, "a0")
    for kx in range(x0 + 53, x0 + 75, 2):
        px(kx, y + 15, "a1")
    px(x0 + 63, y + 10, "a1")
    px(x0 + 64, y + 10, "a1")
    px(x0 + 63, y + 11, "a0")
    px(x0 + 64, y + 11, "a0")
    hline(x0, x1, y + 15, "w0")
    frame(x0 - 1, y, 130, 16, "ol")
    hline(x0, x1, y + 1, "w4")
    vline(x0, y + 8, y + 15, "w2")
    glints(y + 1, [(x0 + 2, x0 + 5), (x0 + 36, x0 + 46), (x0 + 50, x0 + 78), (x0 + 97, x0 + 101), (x0 + 124, x0 + 126)])
    counter_items(x0, y)


def counter_items(x0, y):
    ellipse(x0 + 30, y + 3, 4, 2, "s1")
    ellipse(x0 + 30, y + 1, 3, 3, "a0")
    ellipse(x0 + 30, y + 1, 2, 2, "a1")
    px(x0 + 29, y, "a2")
    px(x0 + 30, y - 3, "a0")
    rect(x0 + 8, y + 1, 14, 5, "p2")
    vline(x0 + 15, y + 1, y + 5, "w1")
    for lx in range(x0 + 9, x0 + 14, 2):
        px(lx, y + 3, "s2")
    for lx in range(x0 + 17, x0 + 21, 2):
        px(lx, y + 3, "s2")
    hline(x0 + 8, x0 + 21, y + 6, "w1")
    rect(x0 + 82, y - 3, 12, 3, "r1")
    hline(x0 + 82, x0 + 93, y - 3, "r2")
    rect(x0 + 83, y, 11, 3, "c0")
    hline(x0 + 83, x0 + 93, y, "c1")
    rect(x0 + 82, y + 3, 12, 2, "p1")
    frame(x0 + 81, y - 4, 14, 10, "ol")
    rect(x0 + 104, y, 4, 5, "s0")
    hline(x0 + 104, x0 + 107, y, "s1")
    vline(x0 + 107, y - 7, y - 1, "p2")
    px(x0 + 108, y - 6, "p2")
    px(x0 + 108, y - 5, "p1")
    px(x0 + 106, y - 2, "p1")
    for i, sx in enumerate((x0 + 112, x0 + 116, x0 + 120)):
        rect(sx, y + 1, 4, 4, "p2" if i != 1 else "a2")
        hline(sx, sx + 3, y + 4, "p1")
    px(x0 + 119, y + 2, "r1")


def rug_red(x, y, w, h):
    set_layer(FLOOR)
    x0, y0, x1, y1 = x + 2, y + 2, x + w - 3, y + h - 3
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "r1")
    for yy in range(y0 + 6, y1 - 5):
        for xx in range(x0 + 6, x1 - 5):
            u, v = (xx - x0) % 12, (yy - y0) % 12
            if abs(u - 6) + abs(v - 6) == 5 and dither(xx, yy, 0.6):
                px(xx, yy, "r0")
    frame(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "r0")
    frame(x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1, "r0")
    frame(x0 + 3, y0 + 3, x1 - x0 - 5, y1 - y0 - 5, "a0")
    for xx in range(x0 + 4, x1 - 3, 4):
        px(xx, y0 + 1, "a0")
        px(xx, y1 - 1, "a0")
    for yy in range(y0 + 4, y1 - 3, 4):
        px(x0 + 1, yy, "a0")
        px(x1 - 1, yy, "a0")
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    for dy in range(-8, 9):
        span = (8 - abs(dy)) * 2
        for dx in range(-span, span + 1):
            if abs(dx) / 2 + abs(dy) in (8, 7.5):
                px(cx + dx, cy + dy, "a0")
            elif abs(dx) / 2 + abs(dy) <= 3:
                px(cx + dx, cy + dy, "r2")
    px(cx, cy, "a1")
    hline(x0, x1, y1 + 1, "r0")
    for yy in range(y0 + 1, y1, 3):
        px(x0 - 1, yy, "p1")
        px(x0 - 2, yy, "p0")
        px(x1 + 1, yy, "p1")
        px(x1 + 2, yy, "p0")
    hline(x0 + 1, x1 - 1, y0 + 2, "r2")


def rug_stripe(x, y, w, h):
    set_layer(FLOOR)
    x0, y0, x1, y1 = x + 1, y + 2, x + w - 2, y + h - 3
    for yy in range(y0, y1 + 1):
        band = (yy - y0) % 12
        c = "p1"
        if band in (0, 1):
            c = "r2"
        elif band == 6:
            c = "w2"
        for xx in range(x0, x1 + 1):
            cc = c
            if c == "p1" and dither(xx, yy, 0.12):
                cc = "p0"
            if c == "r2" and (xx + yy) % 4 == 0:
                cc = "r1"
            px(xx, yy, cc)
    frame(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "p0")
    hline(x0, x1, y1 + 1, "w1")
    for xx in range(x0 + 1, x1, 2):
        px(xx, y0 - 1, "p1")
        px(xx, y1 + 2, "p1" if xx % 4 else "p0")


def desk(x, y):
    set_layer(PROP)
    x0, x1 = x, x + 127
    top = y - 10
    rect(x0, top, 128, 22, "w3")
    for yy in range(top + 5, top + 20, 5):
        hline(x0 + 1, x1 - 1, yy, "w2")
    rng = random.Random(30)
    for _ in range(10):
        gx, gy = rng.randint(x0 + 4, x1 - 10), rng.randint(top + 3, top + 19)
        hline(gx, gx + rng.randint(2, 6), gy, "w4" if rng.random() < 0.4 else "w2")
    hline(x0, x1, top, "w4")
    hline(x0, x1, top + 21, "w2")
    rect(x0, top + 22, 128, 7, "w1")
    hline(x0, x1, top + 22, "w2")
    hline(x0, x1, top + 28, "w0")
    for dx in range(x0 + 4, x1 - 6, 32):
        rect(dx + 6, top + 24, 16, 3, "w2")
        hline(dx + 6, dx + 21, top + 24, "w0")
        px(dx + 14, top + 25, "a1")
    for lx in (x0 + 2, x0 + 62, x1 - 5):
        rect(lx, top + 29, 4, 12, "w1")
        vline(lx, top + 29, top + 40, "w2")
        vline(lx + 3, top + 29, top + 40, "w0")
        hline(lx, lx + 3, top + 41, "ol")
        vline(lx - 1, top + 29, top + 41, "ol")
        vline(lx + 4, top + 29, top + 41, "ol")
    frame(x0 - 1, top - 1, 130, 31, "ol")
    vline(x0, top + 22, top + 28, "w2")
    for cx in (x0 + 24, x0 + 56, x0 + 88, x0 + 120):
        ledger(cx - 8, top + 12)
    desk_clutter(x0, top)


def ledger(x, y):
    rect(x, y + 1, 16, 8, "w0")
    rect(x, y, 15, 8, "p2")
    vline(x + 7, y, y + 7, "p0")
    hline(x, x + 6, y + 7, "p1")
    hline(x + 8, x + 14, y + 7, "p1")
    for ly in range(y + 2, y + 6, 2):
        hline(x + 1, x + 5, ly, "s2")
        hline(x + 9, x + 13 - (ly % 3), ly, "s2")
    hline(x - 1, x + 15, y + 8, "r0")
    px(x - 1, y + 7, "r1")


def inkwell(x, y):
    rect(x, y, 4, 4, "s0")
    hline(x, x + 3, y, "s2")
    vline(x + 3, y, y + 3, "ol")
    px(x + 1, y + 1, "ol")
    vline(x + 2, y - 7, y - 1, "p2")
    px(x + 3, y - 6, "p2")
    px(x + 3, y - 5, "p1")
    px(x + 4, y - 7, "p1")


def candle(x, y):
    rect(x - 2, y + 3, 5, 2, "s1")
    hline(x - 2, x + 2, y + 3, "s2")
    rect(x - 1, y - 3, 3, 6, "p2")
    vline(x + 1, y - 3, y + 2, "p1")
    px(x, y - 4, "w0")
    px(x, y - 5, "a1")
    px(x, y - 6, "a2")
    px(x - 1, y - 5, "a0")


def book_stack(x, y, colors):
    for i, c in enumerate(colors):
        yy = y - i * 3
        off = (i * 2) % 3
        rect(x + off, yy, 12, 3, c[1])
        hline(x + off, x + off + 11, yy, c[2])
        vline(x + off + 11, yy, yy + 2, "p1")
        px(x + off, yy + 2, c[0])
    frame(x - 1, y - len(colors) * 3 + 2, 16, len(colors) * 3 + 2, "ol")


def desk_clutter(x0, top):
    inkwell(x0 + 4, top + 6)
    candle(x0 + 41, top + 6)
    inkwell(x0 + 70, top + 5)
    book_stack(x0 + 98, top + 6, [("r0", "r1", "r2"), ("c0", "c0", "c1"), ("g0", "g1", "g2")])
    candle(x0 + 117, top + 5)
    rect(x0 + 12, top + 3, 9, 5, "p1")
    ellipse(x0 + 12, top + 5.5, 1.5, 2.5, "p2")
    ellipse(x0 + 21, top + 5.5, 1.5, 2.5, "p2")
    hline(x0 + 12, x0 + 21, top + 7, "p0")
    hline(x0 + 13, x0 + 20, top + 3, "p2")
    rect(x0 + 49, top + 4, 10, 6, "p2")
    rect(x0 + 51, top + 2, 10, 6, "p1")
    hline(x0 + 51, x0 + 60, top + 2, "p2")
    px(x0 + 55, top + 4, "r1")
    rect(x0 + 80, top + 3, 5, 5, "w1")
    hline(x0 + 80, x0 + 84, top + 3, "a2")
    vline(x0 + 85, top + 4, top + 6, "w1")


def crystal_table(x, y):
    set_layer(PROP)
    x0, x1 = x, x + 111
    top = y + 2
    rect(x0, top, 112, 16, "v1")
    for yy in range(top, top + 16):
        for xx in range(x0, x1 + 1):
            if dither(xx, yy, 0.18) and (xx // 9) % 2 == 0:
                px(xx, yy, "v0")
    hline(x0, x1, top, "r2")
    hline(x0 + 36, x0 + 76, top, "a0")
    hline(x0 + 44, x0 + 68, top, "a1")
    hline(x0, x1, top + 1, "v1")
    rect(x0, top + 16, 112, 10, "v0")
    for fx in range(x0 + 4, x1, 9):
        vline(fx, top + 16, top + 25, "v1")
        vline(fx + 1, top + 17, top + 25, "v1")
        vline(fx + 5, top + 16, top + 25, "ol")
    hline(x0, x1, top + 16, "v1")
    for xx in range(x0, x1 + 1):
        px(xx, top + 26, "a0" if xx % 2 else "a1")
        if xx % 4 == 0:
            px(xx, top + 27, "a0")
    frame(x0 - 1, top - 1, 114, 28, "ol")
    for lx in (x0 + 3, x1 - 6):
        rect(lx, top + 27, 4, 2, "w1")
        vline(lx + 3, top + 27, top + 28, "w0")
        frame(lx - 1, top + 27, 6, 3, "ol")
    cx = x0 + 56
    for yy in range(top + 2, top + 16):
        for xx in range(cx - 18, cx + 19):
            d = math.hypot(xx - cx, (yy - (top + 9)) * 2)
            if d < 18 and dither(xx, yy, 0.6 - d / 30) and get(xx, yy) in ("v1", "v0"):
                px(xx, yy, "c0" if d > 10 else "c1")
    ellipse(cx, top + 14, 7, 2, "a0")
    hline(cx - 6, cx + 5, top + 14, "a1")
    hline(cx - 3, cx - 1, top + 14, "a2")
    hline(cx - 5, cx + 4, top + 15, "w1")
    orb(cx, top + 6)
    for k, ox in enumerate((-30, 34)):
        candle(cx + ox, top + 8)
    for i, ox in enumerate((-46, -40, 18)):
        rect(cx + ox, top + 6 + (i % 2), 5, 7, "p2")
        frame(cx + ox, top + 6 + (i % 2), 5, 7, "p0")
        px(cx + ox + 2, top + 9 + (i % 2), "r1" if i != 1 else "c0")
    for ox, oy, c in ((22, 3, "c1"), (-20, 10, "v1"), (44, 10, "a1")):
        px(cx + ox, top + oy, c)
        px(cx + ox, top + oy - 1, "c2")
        px(cx + ox + 1, top + oy, "c0")


def orb(cx, cy):
    ellipse(cx, cy, 8, 8, "ol")
    ellipse(cx, cy, 7, 7, "c0")
    ellipse(cx - 0.5, cy - 0.5, 6, 6, "c1")
    ellipse(cx - 1.5, cy - 2, 3.5, 3.5, "c2")
    for dx, dy in ((-4, -4), (-3, -4), (-4, -3), (-3, -5)):
        px(cx + dx, cy + dy, "a2")
    for dx, dy in ((3, 3), (4, 2), (2, 4)):
        px(cx + dx, cy + dy, "c0")
    px(cx + 1, cy + 2, "v1")
    px(cx + 2, cy + 1, "v1")
    px(cx - 2, cy + 4, "c2")


def bar_shelf(x, y):
    set_layer(PROP)
    rng = random.Random(44)
    x0, x1 = x, x + 159
    top = y - 15
    rect(x0, top, 160, 47, "w1")
    rect(x0, top, 160, 4, "w3")
    hline(x0, x1, top, "w4")
    hline(x0, x1, top + 3, "w2")
    rows = [(top + 6, top + 19), (top + 23, top + 34)]
    for r0_, r1_ in rows:
        rect(x0 + 3, r0_, 154, r1_ - r0_ + 1, "w0")
        bottles_row(rng, x0 + 4, x1 - 4, r0_, r1_)
        hline(x0 + 3, x1 - 3, r1_ + 1, "w4")
        hline(x0 + 3, x1 - 3, r1_ + 2, "w2")
    rect(x0 + 3, top + 38, 154, 9, "w2")
    for dx in range(x0 + 5, x1 - 10, 25):
        frame(dx, top + 39, 22, 8, "w1")
        hline(dx + 1, dx + 20, top + 40, "w3")
        vline(dx + 20, top + 40, top + 45, "w0")
        px(dx + 11, top + 43, "a1")
    vline(x0 + 1, top + 4, top + 47, "w3")
    vline(x0 + 2, top + 4, top + 47, "w2")
    vline(x1 - 1, top + 4, top + 47, "w0")
    vline(x1 - 2, top + 4, top + 47, "w1")
    vline(x0 + 80, top + 4, top + 37, "w2")
    vline(x0 + 81, top + 4, top + 37, "w0")
    frame(x0 - 1, top - 1, 162, 48, "ol")
    hline(x0, x1, top + 46, "w0")
    glints(top, [(x0 + 2, x0 + 8), (x0 + 30, x0 + 58), (x0 + 100, x0 + 122), (x0 + 142, x0 + 154)])
    cask(x0 + 64, top - 8)
    for mx in (x0 + 12, x0 + 20, x0 + 130):
        mug(mx, top - 1)


def bottles_row(rng, x0, x1, y0, y1):
    ramps = [("g0", "g1", "g2"), ("r0", "r1", "r2"), ("c0", "c1", "c2"), ("a0", "a1", "a2"),
             ("v0", "v1", "c2"), ("g0", "g2", "c2"), ("w0", "w2", "a1")]
    x = x0 + 1
    while x < x1 - 5:
        if x0 + 74 <= x <= x0 + 79:
            x += 1
            continue
        roll = rng.random()
        if roll < 0.12:
            x += rng.randint(2, 4)
            continue
        if roll < 0.24:
            mug(x, y1)
            x += 8
            continue
        dark, mid, light = rng.choice(ramps)
        bw = rng.choice([4, 4, 5])
        bh = rng.randint(6, 8)
        nh = rng.randint(2, 4)
        by = y1 - bh + 1
        rect(x, by, bw, bh, mid)
        vline(x + bw - 1, by, y1, dark)
        vline(x + 1, by + 1, y1 - 2, light)
        nx = x + bw // 2 - (1 if bw == 4 else 0)
        rect(nx, by - nh, 2, nh, dark)
        px(nx, by - nh, "w3")
        hline(x + 1, x + bw - 2, by + bh // 2, "p1" if rng.random() < 0.5 else mid)
        x += bw + 1


def mug(x, y):
    rect(x, y - 5, 5, 6, "w2")
    vline(x, y - 5, y, "w3")
    vline(x + 4, y - 5, y, "w1")
    hline(x, x + 4, y - 3, "s1")
    hline(x, x + 4, y - 5, "p2")
    px(x + 5, y - 3, "w1")
    px(x + 5, y - 2, "w1")
    px(x + 6, y - 3, "w0")
    px(x + 6, y - 2, "w0")


def cask(x, y):
    ellipse(x + 16, y + 6, 15, 6, "w0")
    rect(x + 2, y + 1, 28, 10, "w2")
    hline(x + 2, x + 29, y + 1, "w3")
    hline(x + 2, x + 29, y + 3, "w4")
    hline(x + 2, x + 29, y + 9, "w1")
    for hx in (x + 7, x + 24):
        vline(hx, y + 1, y + 10, "s1")
        vline(hx + 1, y + 1, y + 10, "s2")
    ellipse(x + 2, y + 6, 3, 5, "w1")
    ellipse(x + 2, y + 6, 2, 4, "w3")
    px(x + 2, y + 6, "w1")
    rect(x - 4, y + 7, 5, 2, "s2")
    px(x - 4, y + 9, "s1")
    hline(x + 6, x + 26, y + 11, "w0")
    rect(x + 6, y + 11, 3, 4, "w1")
    rect(x + 23, y + 11, 3, 4, "w1")
    outline_shape(x - 6, y - 2, x + 32, y + 16, {"w0", "w1", "w2", "w3", "w4", "s1", "s2"}, "ol")


def bar_counter(x, y):
    set_layer(PROP)
    x0, x1 = x, x + 191
    rect(x0, y, 192, 8, "w3")
    hline(x0, x1, y, "w4")
    hline(x0, x1, y + 1, "w4")
    for i in range(0, 192, 30):
        hline(x0 + i + 4, x0 + i + 15, y + 4, "w4")
    hline(x0, x1, y + 7, "w2")
    rect(x0, y + 8, 192, 8, "w1")
    for vx in range(x0 + 7, x1, 12):
        vline(vx, y + 9, y + 11, "w0")
        vline(vx + 1, y + 9, y + 11, "w2")
    hline(x0, x1, y + 8, "w0")
    hline(x0, x1, y + 13, "a0")
    hline(x0, x1, y + 12, "s1")
    hline(x0, x1, y + 15, "w0")
    frame(x0 - 1, y, 194, 16, "ol")
    hline(x0, x1, y + 1, "w4")
    for mx, kind in ((x0 + 6, "mug"), (x0 + 28, "mug"), (x0 + 58, "plate"), (x0 + 120, "mug"),
                     (x0 + 100, "bottle"), (x0 + 150, "mug"), (x0 + 168, "plate")):
        if kind == "mug":
            mug(mx, y + 5)
        elif kind == "plate":
            ellipse(mx + 4, y + 4, 5, 2, "s2")
            ellipse(mx + 4, y + 3.5, 3.5, 1.2, "p2")
            rect(mx + 2, y + 2, 4, 2, "w3")
            hline(mx + 2, mx + 5, y + 2, "w4")
        else:
            rect(mx, y - 2, 4, 7, "g1")
            vline(mx + 1, y - 1, y + 3, "g2")
            vline(mx + 3, y - 2, y + 4, "g0")
            rect(mx + 1, y - 5, 2, 3, "g0")
            px(mx + 1, y - 6, "w3")


def stool(x, y):
    set_layer(PROP)
    cx = x + 8
    for lx in (cx - 5, cx + 3):
        rect(lx, y + 7, 2, 8, "w1")
        vline(lx, y + 7, y + 14, "w2")
        vline(lx - 1, y + 7, y + 14, "w0")
        vline(lx + 2, y + 7, y + 14, "w0")
        px(lx, y + 15, "w0")
        px(lx + 1, y + 15, "w0")
    hline(cx - 4, cx + 3, y + 11, "w0")
    ellipse(cx, y + 6, 6.5, 4, "w0")
    ellipse(cx, y + 5, 5.5, 3, "w3")
    hline(cx - 4, cx + 3, y + 7, "w1")
    hline(cx - 3, cx + 1, y + 3, "w4")
    px(cx + 2, y + 5, "w2")


def table(x, y):
    set_layer(PROP)
    x0, x1 = x + 1, x + 46
    top = y - 3
    for lx in (x0 + 2, x1 - 5):
        rect(lx, top + 22, 4, 11, "w1")
        vline(lx, top + 22, top + 32, "w2")
        vline(lx + 3, top + 22, top + 32, "w0")
        frame(lx - 1, top + 22, 6, 12, "ol")
    rect(x0, top, 46, 18, "w3")
    for yy in (top + 5, top + 11):
        hline(x0 + 1, x1 - 1, yy, "w2")
    hline(x0, x1, top, "w4")
    rng = random.Random(x * 3 + y)
    for _ in range(4):
        gx, gy = rng.randint(x0 + 3, x1 - 9), rng.randint(top + 2, top + 16)
        hline(gx, gx + rng.randint(2, 5), gy, "w4" if rng.random() < 0.5 else "w2")
    rect(x0, top + 18, 46, 5, "w1")
    hline(x0, x1, top + 18, "w2")
    hline(x0, x1, top + 22, "w0")
    rounded_frame(x0 - 1, top - 1, 48, 25, "ol")
    mug(x0 + 7, top + 8)
    mug(x0 + 33, top + 13)
    ellipse(x0 + 22, top + 10, 6, 3, "s2")
    ellipse(x0 + 22, top + 9.5, 4.5, 2, "p2")
    rect(x0 + 19, top + 7, 6, 3, "w3")
    hline(x0 + 19, x0 + 24, top + 7, "w4")
    px(x0 + 22, top + 9, "w1")
    candle(x0 + 36, top + 6)


def barrel(x, y):
    set_layer(PROP)
    cx = x + 8
    top = y - 5
    rect(x + 2, top + 3, 12, 17, "w2")
    for yy in range(top + 3, top + 20):
        bulge = 1 if top + 7 <= yy <= top + 15 else 0
        hline(x + 2 - bulge, x + 13 + bulge, yy, "w2")
        px(x + 2 - bulge, yy, "w3")
        px(x + 3 - bulge, yy, "w3")
        px(x + 13 + bulge, yy, "w1")
        px(x + 12 + bulge, yy, "w1")
    for sx in (x + 6, x + 10):
        vline(sx, top + 5, top + 19, "w1")
    for hy in (top + 6, top + 16):
        hline(x + 1, x + 14, hy, "s1")
        hline(x + 2, x + 6, hy, "s2")
    ellipse(cx, top + 3, 6, 2.8, "w1")
    ellipse(cx, top + 3, 4.8, 1.8, "w3")
    hline(cx - 3, cx + 2, top + 3, "w2")
    px(cx - 2, top + 2, "w4")
    outline_shape(x - 1, top - 1, x + 16, top + 21, {"w1", "w2", "w3", "w4", "s1", "s2"}, "w0")


def lamp(x, y):
    set_layer(PROP)
    cx = x + 8
    ellipse(cx, y + 13, 5, 2, "s0")
    ellipse(cx, y + 12.5, 4, 1.5, "s1")
    vline(cx, y - 6, y + 12, "s1")
    vline(cx - 1, y - 6, y + 12, "s0")
    vline(cx + 1, y - 6, y + 12, "s0")
    px(cx, y + 2, "s2")
    rect(cx - 4, y - 18, 9, 2, "s1")
    hline(cx - 3, cx + 3, y - 19, "s2")
    px(cx, y - 20, "s0")
    rect(cx - 3, y - 16, 7, 9, "a1")
    vline(cx - 3, y - 16, y - 8, "s0")
    vline(cx + 3, y - 16, y - 8, "s0")
    px(cx - 1, y - 14, "a2")
    px(cx, y - 13, "a2")
    px(cx - 1, y - 13, "a2")
    px(cx + 1, y - 10, "a0")
    rect(cx - 4, y - 7, 9, 2, "s1")
    hline(cx - 4, cx + 4, y - 6, "s0")
    outline_shape(cx - 6, y - 21, cx + 6, y + 16, {"s0", "s1", "s2", "a0", "a1", "a2"}, "ol")


def wall_decor():
    set_layer(PROP)
    for i, (sx, d) in enumerate(((164, 1), (186, -1))):
        for k in range(20):
            xx = sx + k * d
            yy = 10 + k
            px(xx, yy, "s3")
            px(xx + d, yy, "s1")
        hx = sx + 15 * d
        hline(hx - 3, hx + 3, 25, "a0")
        px(sx + 18 * d, 28, "w1")
        px(sx + 19 * d, 29, "w0")
    rect(170, 14, 11, 12, "r1")
    ellipse(175.5, 19, 7, 7, "w2")
    ellipse(175.5, 19, 5.5, 5.5, "r1")
    ellipse(175.5, 18, 2, 2, "a0")
    px(173, 15, "r2")
    px(172, 16, "r2")
    hline(170, 181, 25, "r0")
    outline_shape(160, 8, 192, 32, {"w2", "r1", "r2", "a0", "r0"}, "w0")
    for i, (tx, ln) in enumerate(((534, 14), (542, 18), (550, 12))):
        vline(tx, 14, 14 + ln, "w1" if i != 1 else "s1")
        vline(tx + 1, 14, 14 + ln, "w0")
        px(tx, 13, "s0")
    rect(532, 12, 22, 2, "w1")
    hline(532, 553, 12, "w3")
    rect(540, 26, 5, 6, "s1")
    hline(540, 544, 26, "s2")
    rect(548, 24, 5, 3, "s1")
    px(548, 24, "s3")


def apply_lights():
    lights = [
        (464, 46, 120, 1.7), (520, 66, 70, 1.3), (248, 26, 46, 1.2), (376, 26, 46, 1.2),
        (280, 342, 36, 1.5), (360, 342, 36, 1.5), (552, 158, 44, 0.9), (64, 22, 34, 0.8),
        (144, 22, 34, 0.8), (320, 358, 26, 0.9),
    ]
    level = np.zeros((H, W))
    yy, xx = np.mgrid[0:H, 0:W]
    for lx, ly, r, s in lights:
        d = np.hypot(xx - lx, (yy - ly) * 1.25)
        level += np.clip(1 - d / r, 0, 1) ** 1.3 * s
    mask = (layer == FLOOR) | (layer == WALL)
    checker = ((xx + yy) % 2) == 0
    for base in (0.0, 1.0):
        lv = level - base
        hit = mask & ((lv > 0.62) | ((lv > 0.32) & checker))
        canvas[hit] = LIGHT_IDX[canvas[hit]]


def spill(x0, x1, y):
    for row, strength in enumerate((0.5, 0.35, 0.2)):
        for x in range(x0, x1 + 1):
            taper = min(1.0, (x - x0 + 1) / 12, (x1 - x + 1) / 12)
            if layer[y + row, x] == FLOOR and dither(x, y + row, strength * taper):
                remap_pixel(x, y + row, LIGHT_IDX)


def apply_ambient():
    yy, xx = np.mgrid[0:H, 0:W]
    dl = np.minimum(xx - 16, 623 - xx)
    db = 367 - yy
    level = np.maximum(np.clip(1 - dl / 22, 0, 1), np.clip(1 - db / 22, 0, 1))
    mask = (layer == FLOOR) & (yy >= 48) & (yy < 368) & (xx >= 16) & (xx < 624)
    checker = ((xx + yy) % 2) == 0
    hit = mask & ((level > 0.75) | ((level > 0.4) & checker))
    canvas[hit] = DARK_IDX[canvas[hit]]


QUIET_IDX = np.arange(len(NAMES), dtype=np.uint8)
QUIET_IDX[IDX["w4"]] = IDX["w3"]
BANKED_IDX = QUIET_IDX.copy()
BANKED_IDX[IDX["a2"]] = IDX["a1"]
BANKED_IDX[IDX["a1"]] = IDX["a0"]
QUIET_KINDS = {"desk", "table", "barCounter", "stool", "barrel", "forge"}


def quiet(prop):
    rise = 28 if prop["kind"] == "forge" else 8
    x0, x1 = prop["x"] * T + 1, (prop["x"] + prop["width"]) * T
    y0, y1 = prop["y"] * T - rise, (prop["y"] + prop["height"] + 1) * T
    region = canvas[y0:y1, x0:x1]
    mine = layer[y0:y1, x0:x1] == PROP
    table = BANKED_IDX if prop["kind"] == "forge" else QUIET_IDX
    region[mine] = table[region[mine]]


PAINTERS = {
    "window": window, "banner": banner, "questBoard": quest_board, "fireplace": fireplace,
    "lantern": lantern, "bookshelves": bookshelves, "forge": forge, "desk": desk,
    "crystalTable": crystal_table, "receptionCounter": reception_counter, "barShelf": bar_shelf,
    "barCounter": bar_counter, "stool": stool, "table": table, "barrel": barrel, "plant": plant,
    "lamp": lamp,
}
NO_SHADOW = {"window", "banner", "questBoard", "lantern", "rug", "door", "fireplace"}


def main():
    layout = json.load(open(LAYOUT))
    floor()
    wall()
    for prop in layout["props"]:
        if prop["kind"] == "rug":
            x, y, w, h = prop["x"] * T, prop["y"] * T, prop["width"] * T, prop["height"] * T
            (rug_red if prop["x"] == 16 else rug_stripe)(x, y, w, h)
    apply_ambient()
    wall_decor()
    props = [p for p in layout["props"] if p["kind"] not in ("rug", "door")]
    for prop in props:
        if prop["kind"] in NO_SHADOW:
            continue
        x, y, w, h = prop["x"] * T, prop["y"] * T, prop["width"] * T, prop["height"] * T
        if prop["kind"] == "stool":
            shadow(x + 3, y + 10, 10, 6, 2, 1)
        elif prop["kind"] in ("plant", "barrel", "lamp"):
            shadow(x + 2, y + 6, 12, 10, 3, 2)
        else:
            shadow(x, y, w, h, 3, 3)
    side_walls()
    for prop in sorted(props, key=lambda p: (p["y"] + p["height"], p["x"])):
        x, y = prop["x"] * T, prop["y"] * T
        if prop["kind"] == "plant" and (prop["x"], prop["y"]) == (38, 6):
            plant(x, y, low=True)
            continue
        PAINTERS[prop["kind"]](x, y)
    for prop in props:
        if prop["kind"] in QUIET_KINDS:
            quiet(prop)
    door()
    world_map()
    apply_lights()
    spill(38, 188, 83)
    spill(262, 378, 99)
    spill(406, 554, 244)
    img = Image.fromarray(RGB[canvas])
    img.save(OUT)
    img.resize((W * 3, H * 3), Image.NEAREST).save(PREVIEW)
    used = len(np.unique(canvas))
    print("colours used", used)
    check(layout)


def check(layout):
    spots = []
    for group in layout["characterSpots"].values():
        spots += [(s["x"], s["y"]) for s in group]
    spots += [(s["x"], s["y"]) for s in layout["npcSpots"].values()]
    for sx, sy in spots:
        tile = layer[sy * T:(sy + 1) * T, sx * T:(sx + 1) * T]
        n = int((tile == PROP).sum())
        if n:
            print("spot", sx, sy, "prop pixels", n)


main()
