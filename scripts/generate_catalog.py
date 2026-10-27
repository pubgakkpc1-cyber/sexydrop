"""Генератор каталога TMA: веса кейсов через EV-солвер + SVG-арт.

Веса НЕ подбираются «на глаз»: для каждого кейса с фиксированной ценой P солвер
ищет целочисленные веса при строгом ограничении EV <= P * RTP, максимизируя вес
дорогих предметов. Ограничение на долю топ-предмета (<= 40%) не даёт
распределению выродиться в «почти всегда один предмет».
"""
from fractions import Fraction
from pathlib import Path
import json

RTP = Fraction(98, 100)
TOP_CHANCE_CAP = Fraction(45, 100)
PER_ITEM_CAP = 300

# minor = 0.01 GRAM (1 GRAM = 100 minor)
GIFTS = {
    "fresh-socks": ("Fresh Socks", 5, "common"),
    "scared-cat": ("Scared Cat", 15, "common"),
    "instant-ramen": ("Instant Ramen", 20, "common"),
    "chill-flame": ("Chill Flame", 30, "common"),
    "xmas-stocking": ("Xmas Stocking", 50, "common"),
    "holiday-gift": ("Holiday Gift", 60, "common"),
    "heart-locket": ("Heart Locket", 100, "rare"),
    "magic-potion": ("Magic Potion", 150, "rare"),
    "resistance-dog": ("Resistance Dog", 200, "rare"),
    "cyber-helmet": ("Cyber Helmet", 350, "rare"),
    "astral-shard": ("Astral Shard", 500, "epic"),
    "durovs-cap": ("Durov's Cap", 800, "epic"),
    "diamond-ring": ("Diamond Ring", 1200, "epic"),
    "neon-dream": ("Neon Dream", 1800, "legendary"),
    "plush-pepe": ("Plush Pepe", 2500, "legendary"),
    "crystal-ball": ("Crystal Ball", 4000, "legendary"),
    "golden-trophy": ("Golden Trophy", 6000, "legendary"),
    "astral-crown": ("Astral Crown", 10000, "legendary"),
    "golden-pepe": ("Golden Plush Pepe", 20000, "legendary"),
}

# (id, название, цена minor, окно предметов по возрастанию цены).
# Окна — скользящие по лестнице цен подарков: мелкие «якоря» + топ ~2-3×P.
CASES = [
    ("farm", "Farm", 10, ["fresh-socks", "scared-cat", "instant-ramen", "chill-flame"]),
    ("autumn", "Autumn", 350, ["chill-flame", "xmas-stocking", "holiday-gift", "heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap"]),
    ("movie", "Movie", 400, ["holiday-gift", "heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
    ("telegram", "Telegram", 500, ["holiday-gift", "heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
    ("space", "Space", 600, ["heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
    ("magic", "Magic", 500, ["holiday-gift", "heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
    ("kitty", "Kitty", 500, ["holiday-gift", "heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
    ("adult18", "18+", 700, ["heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
    ("money", "Money", 800, ["magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream"]),
    ("onyx-black", "Onyx Black", 800, ["magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream"]),
    ("snoop", "Snoop", 777, ["magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream"]),
    ("peach", "Peach", 800, ["magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream"]),
    ("gem", "Gem", 800, ["magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream"]),
    ("pepe", "Pepe", 1500, ["cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream", "plush-pepe", "crystal-ball"]),
    ("cap", "Cap", 1500, ["cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream", "plush-pepe", "crystal-ball"]),
    ("ring", "Ring", 1500, ["cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring", "neon-dream", "plush-pepe", "crystal-ball"]),
    ("black", "Black", 2000, ["astral-shard", "durovs-cap", "diamond-ring", "neon-dream", "plush-pepe", "crystal-ball", "golden-trophy"]),
    ("epic", "Epic", 4000, ["durovs-cap", "diamond-ring", "neon-dream", "plush-pepe", "crystal-ball", "golden-trophy", "astral-crown"]),
    ("vip", "VIP", 5000, ["diamond-ring", "neon-dream", "plush-pepe", "crystal-ball", "golden-trophy", "astral-crown"]),
    ("elite", "Elite", 12500, ["neon-dream", "plush-pepe", "crystal-ball", "golden-trophy", "astral-crown", "golden-pepe"]),
    # бесплатные: «цена» — целевой EV содержимого (0.5 и 5 GRAM), RTP тот же
    ("free", "FREE", 50, ["fresh-socks", "scared-cat", "instant-ramen", "chill-flame", "xmas-stocking", "holiday-gift", "heart-locket"]),
    ("free24", "FREE 24", 500, ["holiday-gift", "heart-locket", "magic-potion", "resistance-dog", "cyber-helmet", "astral-shard", "durovs-cap", "diamond-ring"]),
]


def ev(weights, values):
    total = sum(weights)
    return sum(Fraction(w) * Fraction(v) for w, v in zip(weights, values)) / total


def solve(values, price_minor):
    target = Fraction(price_minor) * RTP
    n = len(values)
    w = [1] * n
    # 1) поднимаем вес самого дешёвого, пока EV > target
    while ev(w, values) > target and w[0] < 100_000:
        w[0] += 1
    # 2) перекладываем «интересность» на дорогие: вес дорогого растёт только если
    #    EV строго растёт, остаётся <= target, а доля предмета <= 40%
    for i in range(n - 1, 0, -1):
        while w[i] < PER_ITEM_CAP:
            cand = w.copy()
            cand[i] += 1
            new_ev = ev(cand, values)
            total = sum(cand)
            if new_ev <= target and new_ev > ev(w, values) and Fraction(cand[i], total) <= TOP_CHANCE_CAP:
                w = cand
            else:
                break
    return w, ev(w, values)


result = {}
report = []
for case_id, name, price, pool in CASES:
    values = [GIFTS[g][1] for g in pool]
    weights, e = solve(values, price)
    result[case_id] = [[g, wt] for g, wt in zip(pool, weights)]
    top_share = max(weights) / sum(weights)
    report.append(
        f"{case_id:<11} P={price:>6}  EV={float(e):>9.2f}  RTP={float(e / price):.3f}  "
        f"top={top_share:.0%}  weights={weights}"
    )

out = Path(__file__).resolve().parents[1] / "scripts" / "case_weights.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")

# Генерируем TS-файл с весами — единый источник правды для catalog.ts.
ts_lines = [
    "/**",
    " * СГЕНЕРИРОВАНО скриптом `scripts/generate_catalog.py` — не редактировать вручную.",
    " * Веса решены EV-солвером: EV <= price * RTP (0.98), доля топ-предмета <= 45%.",
    " */",
    "export const caseWeights: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {",
]
for case_id, entries in result.items():
    items = ", ".join(f"['{g}', {w}]" for g, w in entries)
    ts_lines.append(f"  '{case_id}': [{items}],")
ts_lines.append("}")
ts_out = Path(__file__).resolve().parents[1] / "src" / "data" / "caseWeights.generated.ts"
ts_out.write_text("\n".join(ts_lines) + "\n", encoding="utf-8")

print("\n".join(report))
print(f"\nsaved -> {out}")
print(f"saved -> {ts_out}")
