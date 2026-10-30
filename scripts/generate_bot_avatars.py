"""Генератор аватарок для симулируемых игроков Ракетки: public/avatars/bot_NN.svg.

Лёгкие SVG (≈1 КБ): градиентный фон + мультяшное лицо с причёской/аксессуаром.
Детерминированно (seed), без внешних загрузок. Запуск:  python scripts/generate_bot_avatars.py
"""
from __future__ import annotations

import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "avatars"
COUNT = 48

BG = [
    ("#6d28d9", "#1e1b4b"), ("#0ea5e9", "#1e3a8a"), ("#f97316", "#7c2d12"), ("#22c55e", "#14532d"),
    ("#ec4899", "#581c87"), ("#eab308", "#713f12"), ("#14b8a6", "#134e4a"), ("#ef4444", "#7f1d1d"),
    ("#8b5cf6", "#312e81"), ("#06b6d4", "#164e63"), ("#a3e635", "#365314"), ("#fb7185", "#881337"),
]
SKIN = ["#f5d0b5", "#e8b896", "#d29b78", "#b57a56", "#8d5a3b", "#6b4228"]
HAIR = ["#1f1f23", "#3b2417", "#7a4a21", "#c58b3a", "#e9d38a", "#b32d2d", "#5b21b6", "#0f766e", "#e5e7eb"]
CLOTH = ["#0f172a", "#1d4ed8", "#be123c", "#15803d", "#a16207", "#6d28d9", "#334155", "#111827"]


def avatar(i: int) -> str:
    r = random.Random(7000 + i * 31)
    bg1, bg2 = r.choice(BG)
    skin, hair, cloth = r.choice(SKIN), r.choice(HAIR), r.choice(CLOTH)
    style = r.choice(["short", "long", "cap", "hood", "bald", "mohawk", "bun"])
    glasses = r.random() < 0.3
    beard = r.random() < 0.28 and style != "long"
    mood = r.choice(["smile", "smirk", "flat", "open"])
    g = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">',
        f'<defs><linearGradient id="b{i}" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient></defs>',
        f'<rect width="96" height="96" fill="url(#b{i})"/>',
    ]
    if style == "long":
        g.append(f'<path d="M24 50 Q22 18 48 17 Q74 18 72 50 L74 84 L22 84 Z" fill="{hair}"/>')
    if style == "hood":
        g.append(f'<path d="M14 96 Q14 52 48 46 Q82 52 82 96 Z" fill="{cloth}"/>')
        g.append(f'<ellipse cx="48" cy="44" rx="27" ry="29" fill="{cloth}"/>')
    # плечи
    if style != "hood":
        g.append(f'<path d="M12 96 Q14 70 48 68 Q82 70 84 96 Z" fill="{cloth}"/>')
    g.append(f'<rect x="41" y="58" width="14" height="14" rx="5" fill="{skin}"/>')
    g.append(f'<ellipse cx="48" cy="44" rx="20" ry="23" fill="{skin}"/>')
    # причёска
    if style == "short":
        g.append(f'<path d="M27 40 Q26 20 48 20 Q70 20 69 40 Q60 30 48 31 Q36 30 27 40Z" fill="{hair}"/>')
    elif style == "cap":
        g.append(f'<path d="M26 38 Q28 17 48 17 Q68 17 70 38 Z" fill="{cloth}"/>')
        g.append(f'<rect x="24" y="36" width="52" height="6" rx="3" fill="{hair}"/>')
    elif style == "mohawk":
        g.append(f'<path d="M42 24 Q48 6 54 24 Z" fill="{hair}"/>')
    elif style == "bun":
        g.append(f'<circle cx="48" cy="17" r="8" fill="{hair}"/>')
        g.append(f'<path d="M28 38 Q30 21 48 21 Q66 21 68 38 Q58 29 48 30 Q38 29 28 38Z" fill="{hair}"/>')
    elif style == "long":
        g.append(f'<path d="M27 40 Q28 21 48 21 Q68 21 69 40 Q58 31 48 32 Q38 31 27 40Z" fill="{hair}"/>')
    elif style == "hood":
        g.append(f'<ellipse cx="48" cy="44" rx="20" ry="23" fill="{skin}"/>')
    # борода
    if beard:
        g.append(f'<path d="M30 48 Q34 68 48 68 Q62 68 66 48 Q58 58 48 58 Q38 58 30 48Z" fill="{hair}"/>')
    # глаза
    for cx in (40, 56):
        g.append(f'<circle cx="{cx}" cy="43" r="2.6" fill="#0b0b10"/>')
    if glasses:
        g.append('<g fill="none" stroke="#0b0b10" stroke-width="1.8"><circle cx="40" cy="43" r="6.5"/>'
                 '<circle cx="56" cy="43" r="6.5"/><path d="M46.5 43h3"/></g>')
    # рот
    if mood == "smile":
        g.append('<path d="M41 54 Q48 60 55 54" fill="none" stroke="#0b0b10" stroke-width="2" stroke-linecap="round"/>')
    elif mood == "smirk":
        g.append('<path d="M42 55 Q49 58 56 52" fill="none" stroke="#0b0b10" stroke-width="2" stroke-linecap="round"/>')
    elif mood == "flat":
        g.append('<path d="M42 55 H54" stroke="#0b0b10" stroke-width="2" stroke-linecap="round"/>')
    else:
        g.append('<path d="M42 53 Q48 63 54 53 Z" fill="#7f1d1d"/>')
    g.append("</svg>")
    return "".join(g)


OUT.mkdir(parents=True, exist_ok=True)
for n in range(1, COUNT + 1):
    (OUT / f"bot_{n:02d}.svg").write_text(avatar(n), encoding="utf-8")
print(f"generated {COUNT} avatars -> {OUT}")
