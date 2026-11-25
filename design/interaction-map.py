import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(sys.argv[1])
SCALE = 3
TILE = 16 * SCALE
MARGIN = 96
TOP = 168
ROOM_W, ROOM_H = 640 * SCALE, 384 * SCALE
LEGEND_GAP = 72
LEGEND_ROW = 112
WIDTH = ROOM_W + MARGIN * 2
HEIGHT = TOP + ROOM_H + LEGEND_GAP + LEGEND_ROW * 2 + 72

GROUND = (26, 20, 17)
INK = (241, 227, 196)
MUTED = (160, 142, 116)
AMBER = (242, 179, 61)
SHADOW = (38, 24, 16)

HOTSPOTS = [
    (1, "QUEST BOARD", "cards, waiting lane, release round", [(17, 0, 6, 3)], False),
    (2, "RECEPTION", "session roster, who waits for you", [(16, 3.4, 8, 2.7)], False),
    (3, "WINDOWS", "day and night", [(3, 0.45, 2, 1.45), (8, 0.45, 2, 1.45)], False),
    (4, "DOOR", "tavern, grove, keep, meadow", [(18.6, 21.6, 2.8, 2.4)], False),
    (5, "CRYSTAL ORB", "context load of every session", [(33.4, 8.6, 2.2, 1.9)], False),
    (6, "BAR SHELF", "finished sessions, MRs to verify", [(24.9, 11.5, 10.3, 3.6)], False),
    (7, "HEARTH", "server and Orca health", [(27, 0, 4, 3.4)], False),
    (8, "ARCHIVE", "loop history (new, optional)", [(1.9, 2.05, 10.2, 3.05)], True),
]


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def room_box(rect):
    x, y, w, h = rect
    left = MARGIN + round(x * TILE)
    top = TOP + round(y * TILE)
    return left, top, left + round(w * TILE), top + round(h * TILE)


def bracket(draw, box, dashed):
    left, top, right, bottom = box
    arm = 30
    weight = 6
    for dx, dy, colour in ((3, 3, SHADOW), (0, 0, AMBER)):
        l, t, r, b = left + dx, top + dy, right + dx, bottom + dy
        corners = [
            (l, t, l + arm, t + weight), (l, t, l + weight, t + arm),
            (r - arm, t, r, t + weight), (r - weight, t, r, t + arm),
            (l, b - weight, l + arm, b), (l, b - arm, l + weight, b),
            (r - arm, b - weight, r, b), (r - weight, b - arm, r, b),
        ]
        for corner in corners:
            draw.rectangle(corner, fill=colour)
        if dashed:
            continue
        step = 18
        for x in range(l + arm + step, r - arm - step + 1, step * 2):
            draw.rectangle((x, t, x + 6, t + 2), fill=colour)
            draw.rectangle((x, b - 2, x + 6, b), fill=colour)


def badge(draw, x, y, number, face):
    size = 42
    draw.rectangle((x + 3, y + 3, x + size + 3, y + size + 3), fill=SHADOW)
    draw.rectangle((x, y, x + size, y + size), fill=AMBER)
    draw.text((x + size / 2 + 1, y + size / 2 - 1), str(number), font=face, fill=SHADOW, anchor="mm")


def main():
    room = Image.open(ROOT / "web/public/assets/rooms/tavern.png").convert("RGB")
    room = room.resize((ROOM_W, ROOM_H), Image.NEAREST)
    dimmed = ImageEnhance.Brightness(ImageEnhance.Color(room).enhance(0.55)).enhance(0.42)

    canvas = Image.new("RGB", (WIDTH, HEIGHT), GROUND)
    canvas.paste(dimmed, (MARGIN, TOP))
    for _, _, _, rects, _ in HOTSPOTS:
        for rect in rects:
            left, top, right, bottom = room_box(rect)
            crop = room.crop((left - MARGIN, top - TOP, right - MARGIN, bottom - TOP))
            canvas.paste(crop, (left, top))

    draw = ImageDraw.Draw(canvas)
    title = font("PixelifySans-Medium.ttf", 54)
    name = font("Silkscreen-Regular.ttf", 26)
    note = font("GeistMono-Regular.ttf", 18)
    digit = font("Silkscreen-Regular.ttf", 26)

    draw.text((MARGIN, 84), "Isekai Office", font=title, fill=INK, anchor="lm")
    draw.text((WIDTH - MARGIN, 76), "INTERACTION MAP", font=name, fill=AMBER, anchor="rm")
    draw.text((WIDTH - MARGIN, 108), "no navbar. the room is the menu.", font=note, fill=MUTED, anchor="rm")
    draw.rectangle((MARGIN, TOP - 24, WIDTH - MARGIN, TOP - 22), fill=(64, 50, 40))

    for number, _, _, rects, dashed in HOTSPOTS:
        for rect in rects:
            box = room_box(rect)
            bracket(draw, box, dashed)
            badge(draw, box[2] - 28 if dashed else box[0] - 14, box[1] - 14, number, digit)

    legend_top = TOP + ROOM_H + LEGEND_GAP
    column = ROOM_W // 4
    for index, (number, label, text, _, dashed) in enumerate(HOTSPOTS):
        x = MARGIN + (index % 4) * column
        y = legend_top + (index // 4) * LEGEND_ROW
        badge(draw, x, y, number, digit)
        draw.text((x + 62, y + 12), label, font=name, fill=MUTED if dashed else INK, anchor="lm")
        draw.text((x + 62, y + 46), text, font=note, fill=MUTED, anchor="lm")

    canvas.save(ROOT / "design/interaction-map.png")


main()
