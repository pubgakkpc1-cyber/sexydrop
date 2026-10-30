"""Значок SEXY DROP: капля + мультяшный Plush Pepe + бриллиант TON.

Запуск из корня проекта:  python scripts/make_brand_icon.py
Пишет public/brand/icon-512.png (аватарка бота, Telegram обрезает её кругом, поэтому всё важное в центре).
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 2048  # рисуем крупно, в конце уменьшаем (сглаживание)
OUT = Path(__file__).resolve().parents[1] / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        c = lerp(top, bottom, y / (h - 1))
        for x in range(w):
            px[x, y] = c
    return img


# --- фон: глубокий фиолетово-синий с мягким свечением ---
bg = gradient((S, S), hexc("#1a0b3b"), hexc("#3b1d8f")).convert("RGBA")
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((S * 0.12, S * 0.22, S * 0.88, S * 0.98), fill=(124, 92, 255, 120))
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.07))
bg.alpha_composite(glow)

# --- капля ---
cx, cy = S / 2, S * 0.56
R = S * 0.27
h = R * 1.95
gam = math.acos(R / h)
pts = [(cx, cy - h)]
n = 220
t0, t1 = gam, 2 * math.pi - gam
for i in range(n + 1):
    t = t0 + (t1 - t0) * i / n
    pts.append((cx + R * math.sin(t), cy - R * math.cos(t)))
# к апексу вернёмся замыканием


def drop_mask(scale=1.0, dx=0, dy=0):
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    poly = [((x - cx) * scale + cx + dx, (y - cy) * scale + cy + dy) for x, y in pts]
    d.polygon(poly, fill=255)
    return m


# тень
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
shadow.paste((10, 4, 40, 150), mask=drop_mask(1.02, 0, S * 0.025))
shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.025))
bg.alpha_composite(shadow)

# обводка (светлая) и тело (градиент розовый → фиолетовый → синий)
bg.paste((255, 255, 255, 235), mask=drop_mask(1.035))
body = gradient((S, S), hexc("#ff7ad9"), hexc("#6d4cff")).convert("RGBA")
bg.paste(body, mask=drop_mask(1.0))

d = ImageDraw.Draw(bg)

# глянцевый блик слева
gloss = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gl = ImageDraw.Draw(gloss)
gl.ellipse((cx - R * 0.86, cy - R * 0.95, cx - R * 0.38, cy - R * 0.1), fill=(255, 255, 255, 120))
gloss = gloss.filter(ImageFilter.GaussianBlur(S * 0.008))
gmask = drop_mask(0.97)
gloss.putalpha(Image.composite(gloss.getchannel("A"), Image.new("L", (S, S), 0), gmask))
bg.alpha_composite(gloss)

# --- Plush Pepe: голова ---
OUTL = hexc("#173f16")
hx, hy = cx, cy + R * 0.18
rw, rh = R * 0.74, R * 0.58
d.ellipse((hx - rw - 14, hy - rh - 14, hx + rw + 14, hy + rh + 14), fill=OUTL)
head = gradient((S, S), hexc("#97f06f"), hexc("#3fa937")).convert("RGBA")
hm = Image.new("L", (S, S), 0)
ImageDraw.Draw(hm).ellipse((hx - rw, hy - rh, hx + rw, hy + rh), fill=255)
bg.paste(head, mask=hm)

# щёки
for sx in (-1, 1):
    d.ellipse((hx + sx * rw * 0.62 - R * 0.13, hy + rh * 0.12, hx + sx * rw * 0.62 + R * 0.13, hy + rh * 0.12 + R * 0.17), fill=(255, 128, 140, 150))

# глаза (выпуклые)
er = R * 0.2
for sx in (-1, 1):
    ex, ey = hx + sx * rw * 0.42, hy - rh * 0.62
    d.ellipse((ex - er - 12, ey - er - 12, ex + er + 12, ey + er + 12), fill=OUTL)
    d.ellipse((ex - er, ey - er, ex + er, ey + er), fill=(255, 255, 255))
    pr = er * 0.5
    d.ellipse((ex - pr + er * 0.18, ey - pr + er * 0.1, ex + pr + er * 0.18, ey + pr + er * 0.1), fill=(17, 24, 39))
    d.ellipse((ex + er * 0.12, ey - er * 0.22, ex + er * 0.4, ey + er * 0.06), fill=(255, 255, 255))

# улыбка с красной губой
sm = [(hx - rw * 0.62, hy + rh * 0.18)]
for i in range(1, 41):
    t = i / 40
    x = hx - rw * 0.62 + rw * 1.24 * t
    y = hy + rh * 0.18 + math.sin(math.pi * t) * rh * 0.5
    sm.append((x, y))
d.line(sm, fill=OUTL, width=int(S * 0.012), joint="curve")
lip = (hx - rw * 0.34, hy + rh * 0.5, hx + rw * 0.34, hy + rh * 0.78)
d.ellipse(lip, fill=hexc("#e0605a"), outline=OUTL, width=int(S * 0.006))

# --- бриллиант TON справа сверху ---
dx0, dy0, ds = cx + R * 1.0, cy - R * 1.35, R * 0.46
diamond = [(dx0, dy0 - ds), (dx0 + ds * 0.9, dy0 - ds * 0.1), (dx0, dy0 + ds), (dx0 - ds * 0.9, dy0 - ds * 0.1)]
d.polygon([(x + 10, y + 14) for x, y in diamond], fill=(10, 20, 60, 140))
d.polygon(diamond, fill=hexc("#1fb5ff"), outline=(255, 255, 255), width=int(S * 0.008))
d.polygon([diamond[0], diamond[3], (dx0, dy0 - ds * 0.1)], fill=hexc("#8fe3ff"))
d.polygon([diamond[0], diamond[1], (dx0, dy0 - ds * 0.1)], fill=hexc("#38c8ff"))

# искры
def sparkle(x, y, r, col=(255, 255, 255, 255)):
    d.polygon([(x, y - r), (x + r * 0.28, y - r * 0.28), (x + r, y), (x + r * 0.28, y + r * 0.28), (x, y + r), (x - r * 0.28, y + r * 0.28), (x - r, y), (x - r * 0.28, y - r * 0.28)], fill=col)


sparkle(cx - R * 1.25, cy - R * 0.85, R * 0.22)
sparkle(cx + R * 1.3, cy + R * 0.55, R * 0.16)
sparkle(cx - R * 1.05, cy + R * 0.95, R * 0.12)

icon = bg.convert("RGB").resize((512, 512), Image.LANCZOS)
icon.save(OUT / "icon-512.png", optimize=True)
icon.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png", optimize=True)
print("saved", OUT / "icon-512.png")
