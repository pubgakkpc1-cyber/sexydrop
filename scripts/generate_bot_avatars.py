"""Генератор аватарок ботов Ракетки: public/avatars/bot_NN.svg.

Как у обычных пользователей Telegram — случайные картинки без лиц и людей:
горы, закаты, планеты, лес, город, абстракции, цветы, неоновые кольца и т.д.
Лёгкие SVG (≈1–2 КБ), детерминированно. Запуск:  python scripts/generate_bot_avatars.py
"""
from __future__ import annotations

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "avatars"
COUNT = 48

SKIES = [
    ("#1e1b4b", "#f97316"), ("#0c4a6e", "#fde68a"), ("#312e81", "#f472b6"), ("#0f172a", "#38bdf8"),
    ("#7c2d12", "#fbbf24"), ("#134e4a", "#a7f3d0"), ("#4c1d95", "#fb7185"), ("#1e3a8a", "#93c5fd"),
]
PAL = ["#f97316", "#22c55e", "#0ea5e9", "#a855f7", "#ec4899", "#eab308", "#14b8a6", "#ef4444", "#6366f1", "#84cc16"]


def head(i: int, c1: str, c2: str, vertical: bool = True) -> str:
    x2, y2 = ("0", "1") if vertical else ("1", "1")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">'
        f'<defs><linearGradient id="g{i}" x1="0" y1="0" x2="{x2}" y2="{y2}">'
        f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
        f'<rect width="96" height="96" fill="url(#g{i})"/>'
    )


def mountains(i: int, r: random.Random) -> str:
    c1, c2 = r.choice(SKIES)
    g = [head(i, c1, c2)]
    sx, sy = r.randint(20, 76), r.randint(22, 44)
    g.append(f'<circle cx="{sx}" cy="{sy}" r="{r.randint(8, 13)}" fill="#fff7d6" opacity=".92"/>')
    for layer, col in enumerate(["#1f2a44", "#162036", "#0d1426"]):
        pts = [f"0,96"]
        x = 0
        base = 52 + layer * 12
        while x <= 96:
            pts.append(f"{x},{base - r.randint(0, 22) + layer * 2}")
            x += r.randint(14, 24)
        pts += ["96,96"]
        g.append(f'<polygon points="{" ".join(pts)}" fill="{col}"/>')
    g.append("</svg>")
    return "".join(g)


def sunset_sea(i: int, r: random.Random) -> str:
    c1, c2 = r.choice(SKIES)
    g = [head(i, c1, c2)]
    g.append(f'<circle cx="48" cy="52" r="{r.randint(14, 20)}" fill="#fff1b8" opacity=".95"/>')
    g.append('<rect y="52" width="96" height="44" fill="#0b2545"/>')
    for k in range(5):
        y = 58 + k * 8
        g.append(f'<path d="M0 {y} Q12 {y-4} 24 {y} T48 {y} T72 {y} T96 {y}" stroke="#7dd3fc" stroke-opacity="{0.5 - k*0.08:.2f}" stroke-width="2" fill="none"/>')
    g.append("</svg>")
    return "".join(g)


def planet(i: int, r: random.Random) -> str:
    g = [head(i, "#05060f", r.choice(["#1e1b4b", "#0f172a", "#2e1065"]))]
    for _ in range(26):
        g.append(f'<circle cx="{r.randint(2, 94)}" cy="{r.randint(2, 94)}" r="{r.random()*1.2+0.3:.1f}" fill="#fff" opacity="{r.random()*0.6+0.3:.2f}"/>')
    c = r.choice(PAL)
    g.append(f'<circle cx="48" cy="50" r="{r.randint(20, 27)}" fill="{c}"/>')
    g.append(f'<circle cx="40" cy="42" r="{r.randint(22, 27)}" fill="#ffffff" opacity=".12"/>')
    g.append(f'<ellipse cx="48" cy="52" rx="38" ry="9" fill="none" stroke="#fde68a" stroke-width="3" opacity=".8" transform="rotate({r.randint(-25, 25)} 48 52)"/>')
    g.append("</svg>")
    return "".join(g)


def blobs(i: int, r: random.Random) -> str:
    a, b = r.sample(PAL, 2)
    g = [head(i, a, b, False)]
    for _ in range(5):
        c = r.choice(PAL)
        g.append(f'<circle cx="{r.randint(0, 96)}" cy="{r.randint(0, 96)}" r="{r.randint(14, 34)}" fill="{c}" opacity="{r.random()*0.35+0.25:.2f}"/>')
    g.append("</svg>")
    return "".join(g)


def mosaic(i: int, r: random.Random) -> str:
    cols = r.sample(PAL, 4)
    g = [head(i, "#0f172a", "#0f172a")]
    n = 4
    s = 96 // n
    for y in range(n):
        for x in range(n):
            c = r.choice(cols)
            if r.random() < 0.5:
                g.append(f'<polygon points="{x*s},{y*s} {(x+1)*s},{y*s} {x*s},{(y+1)*s}" fill="{c}"/>')
                g.append(f'<polygon points="{(x+1)*s},{y*s} {(x+1)*s},{(y+1)*s} {x*s},{(y+1)*s}" fill="{r.choice(cols)}"/>')
            else:
                g.append(f'<polygon points="{x*s},{y*s} {(x+1)*s},{y*s} {(x+1)*s},{(y+1)*s}" fill="{c}"/>')
                g.append(f'<polygon points="{x*s},{y*s} {(x+1)*s},{(y+1)*s} {x*s},{(y+1)*s}" fill="{r.choice(cols)}"/>')
    g.append("</svg>")
    return "".join(g)


def forest(i: int, r: random.Random) -> str:
    c1, c2 = r.choice(SKIES)
    g = [head(i, c1, c2)]
    g.append('<rect y="70" width="96" height="26" fill="#0b1f14"/>')
    for k in range(9):
        x = k * 11 + r.randint(-3, 3)
        h = r.randint(26, 46)
        w = r.randint(9, 14)
        col = r.choice(["#14532d", "#166534", "#0f3d22"])
        g.append(f'<polygon points="{x},{74} {x+w/2:.0f},{74-h} {x+w},{74}" fill="{col}"/>')
    g.append("</svg>")
    return "".join(g)


def neon_rings(i: int, r: random.Random) -> str:
    g = [head(i, "#05030f", "#12062b")]
    for k in range(4):
        c = r.choice(PAL)
        g.append(f'<circle cx="48" cy="48" r="{10 + k*10}" fill="none" stroke="{c}" stroke-width="3" opacity="{0.95 - k*0.15:.2f}"/>')
    g.append("</svg>")
    return "".join(g)


def city(i: int, r: random.Random) -> str:
    c1, c2 = r.choice(SKIES)
    g = [head(i, c1, c2)]
    x = 0
    while x < 96:
        w = r.randint(9, 16)
        h = r.randint(22, 58)
        g.append(f'<rect x="{x}" y="{96-h}" width="{w}" height="{h}" fill="#0b1226"/>')
        for wy in range(96 - h + 4, 92, 7):
            for wx in range(x + 2, x + w - 2, 4):
                if r.random() < 0.45:
                    g.append(f'<rect x="{wx}" y="{wy}" width="2" height="3" fill="#fde68a"/>')
        x += w + 1
    g.append("</svg>")
    return "".join(g)


def flower(i: int, r: random.Random) -> str:
    bg = r.choice(["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#1e1b4b"])
    g = [head(i, bg, bg)]
    c = r.choice(PAL)
    for k in range(8):
        a = math.radians(k * 45)
        g.append(f'<ellipse cx="{48 + math.cos(a)*18:.1f}" cy="{48 + math.sin(a)*18:.1f}" rx="11" ry="7" fill="{c}" transform="rotate({k*45} {48 + math.cos(a)*18:.1f} {48 + math.sin(a)*18:.1f})"/>')
    g.append('<circle cx="48" cy="48" r="9" fill="#facc15"/>')
    g.append("</svg>")
    return "".join(g)


def waves(i: int, r: random.Random) -> str:
    a, b = r.sample(PAL, 2)
    g = [head(i, a, b, False)]
    for k in range(6):
        y = 14 + k * 14
        g.append(f'<path d="M0 {y} Q16 {y-10} 32 {y} T64 {y} T96 {y} V96 H0Z" fill="#fff" opacity="0.10"/>')
    g.append("</svg>")
    return "".join(g)


def coin(i: int, r: random.Random) -> str:
    g = [head(i, "#0f172a", r.choice(["#1e293b", "#312e81", "#134e4a"]))]
    c = r.choice(["#fbbf24", "#38bdf8", "#a78bfa", "#34d399"])
    g.append(f'<circle cx="48" cy="48" r="26" fill="{c}"/>')
    g.append('<circle cx="48" cy="48" r="20" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 3"/>')
    g.append('<path d="M40 38h16l-8 20z" fill="#ffffff" fill-opacity=".85"/>')
    g.append("</svg>")
    return "".join(g)


def stripes(i: int, r: random.Random) -> str:
    cols = r.sample(PAL, 3)
    g = [head(i, cols[0], cols[1])]
    for k in range(-2, 8):
        g.append(f'<rect x="{k*16}" y="-10" width="7" height="120" fill="{cols[2]}" opacity=".55" transform="rotate(25 48 48)"/>')
    g.append("</svg>")
    return "".join(g)


TYPES = [mountains, sunset_sea, planet, blobs, mosaic, forest, neon_rings, city, flower, waves, coin, stripes]

OUT.mkdir(parents=True, exist_ok=True)
for n in range(1, COUNT + 1):
    r = random.Random(9100 + n * 17)
    fn = TYPES[(n - 1) % len(TYPES)]
    (OUT / f"bot_{n:02d}.svg").write_text(fn(n, r), encoding="utf-8")
print(f"generated {COUNT} avatars -> {OUT}")
