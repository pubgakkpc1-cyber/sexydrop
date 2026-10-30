"""Веса кейсов на реальных ценах NFT (public/gifts/nft_manifest.json).

Для каждого кейса с ценой P ищутся целые веса так, чтобы выполнялось строго
EV <= P * 0.98 (проверка в целых minor, без float), а EV как можно ближе к
этому потолку (утилизация RTP >= 90%), доля топ-предмета <= 45%.

Запуск из корня проекта:  python scripts/generate_nft_case_weights.py
Пишет scripts/case_weights.json и src/data/caseWeights.generated.ts.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RTP_PCT = 98
TOP_CAP_PCT = 45
MAX_TOTAL = 6000

manifest = json.loads((ROOT / "public/gifts/nft_manifest.json").read_text(encoding="utf-8"))
# имя подарка -> цена в minor (1 TON = 1000 minor) и id трёх видов
GIFTS = {
    name: (int(round(v[0]["price_ton"] * 1000)), [x["id"] for x in v])
    for name, v in manifest.items()
}
BACKDROP = {x["id"]: x["backdrop"] for v in manifest.values() for x in v}
DARK = {"Black", "Onyx Black"}

# Правило фонов: в обычных кейсах нет чёрных фонов (Black / Onyx Black),
# в кейсе «Black» — только Black, в кейсе «Onyx Black» — только Onyx Black.
SPECIAL_BACKDROP = {"black": "Black", "onyx-black": "Onyx Black"}


def allowed_variants(name: str, case_id: str) -> list[str]:
    ids = GIFTS[name][1]
    want = SPECIAL_BACKDROP.get(case_id)
    if want:
        return [i for i in ids if BACKDROP[i] == want]
    return [i for i in ids if BACKDROP[i] not in DARK]


def ladder_for(case_id: str) -> list[str]:
    names = [n for n in GIFTS if allowed_variants(n, case_id)]
    return sorted(names, key=lambda n: GIFTS[n][0])

# (id, название, цена в minor, коэффициент потолка топ-приза к цене кейса, число предметов)
CASES = [
    ("farm", "Farm", 6000, 4, 6),
    ("autumn", "Autumn", 8000, 6, 7),
    ("movie", "Movie", 9000, 7, 7),
    ("telegram", "Telegram", 10000, 8, 8),
    ("magic", "Magic", 10000, 8, 8),
    ("kitty", "Kitty", 10000, 8, 8),
    ("space", "Space", 12000, 9, 8),
    ("adult18", "18+", 14000, 10, 8),
    ("snoop", "Snoop", 15000, 10, 8),
    ("money", "Money", 16000, 11, 8),
    ("onyx-black", "Onyx Black", 16000, 11, 8),
    ("peach", "Peach", 16000, 11, 8),
    ("gem", "Gem", 16000, 11, 8),
    ("pepe", "Pepe", 30000, 14, 9),
    ("cap", "Cap", 30000, 14, 9),
    ("ring", "Ring", 30000, 14, 9),
    ("black", "Black", 40000, 16, 9),
    ("epic", "Epic", 80000, 20, 10),
    ("vip", "VIP", 120000, 25, 10),
    ("elite", "Elite", 300000, 25, 10),
    # бесплатные: «цена» — целевой EV содержимого
    ("free", "FREE", 8000, 9, 7),
    ("free24", "FREE 24", 16000, 8, 8),
]
# Прямые ограничения на пул: для elite нужен Plush Pepe (джекпот с шансом ~0.1%)
FORCE_TOP = {"elite": "Plush Pepe"}


def pick_pool(price: int, top_mult: int, k: int, case_id: str, skew: float) -> list[str]:
    cap = price * top_mult
    ladder = ladder_for(case_id)
    cands = [n for n in ladder if GIFTS[n][0] <= cap]
    if case_id in FORCE_TOP:
        cands = [n for n in ladder if GIFTS[n][0] <= max(cap, GIFTS[FORCE_TOP[case_id]][0])]
    k = min(k, len(cands))
    # по рангу в лестнице цен со сдвигом к дешёвым (skew>1): много «якорей» у дна, редкий топ
    idx = sorted({round((i / max(1, k - 1)) ** skew * (len(cands) - 1)) for i in range(k)})
    picked = [cands[i] for i in idx]
    if case_id in FORCE_TOP and FORCE_TOP[case_id] not in picked:
        picked[-1] = FORCE_TOP[case_id]
    return sorted(picked, key=lambda n: GIFTS[n][0])


def feasible(w: list[int], v: list[int], price: int) -> bool:
    tot = sum(w)
    if tot > MAX_TOTAL or max(w) * 100 > TOP_CAP_PCT * tot:
        return False
    return 100 * sum(a * b for a, b in zip(w, v)) <= RTP_PCT * price * tot


def util(w: list[int], v: list[int], price: int) -> float:
    return sum(a * b for a, b in zip(w, v)) / (sum(w) * price * RTP_PCT / 100)


def solve(v: list[int], price: int) -> list[int] | None:
    best: list[int] | None = None
    best_u = 0.0
    for alpha10 in range(5, 40):
        alpha = alpha10 / 10
        for K in [x * 10 for x in range(1, 400)]:
            w = [max(1, round(K / (x / 1000) ** alpha)) for x in v]
            w[-1] = 1
            if feasible(w, v, price):
                u = util(w, v, price)
                if u > best_u:
                    best, best_u = w, u
    if best is None:
        return None
    # полировка ±1 пока утилизация растёт
    improved = True
    while improved:
        improved = False
        for i in range(len(best) - 1):  # топ остаётся 1
            for d in (1, -1):
                c = best.copy()
                c[i] = max(1, c[i] + d)
                if feasible(c, v, price) and util(c, v, price) > util(best, v, price) + 1e-9:
                    best, improved = c, True
    return best


result: dict[str, list[list]] = {}
report = []
for ci, (cid, name, price, mult, k) in enumerate(CASES):
    chosen = None
    for skew in (1.0, 1.6, 2.2, 3.0, 4.0):
        for extra in range(0, 3):
            pool = pick_pool(price, mult + extra * 2, k, cid, skew)
            v = [GIFTS[n][0] for n in pool]
            w = solve(v, price)
            if not w:
                continue
            u = util(w, v, price)
            if u >= 0.9:
                chosen = (pool, v, w)
                break
            if chosen is None or u > util(chosen[2], chosen[1], price):
                chosen = (pool, v, w)
        if chosen and util(chosen[2], chosen[1], price) >= 0.9:
            break
    assert chosen, f"no solution for {cid}"
    pool, v, w = chosen
    result[cid] = []
    for j, (n, wt) in enumerate(zip(pool, w)):
        opts = allowed_variants(n, cid)
        result[cid].append([opts[(ci + j) % len(opts)], wt])
    report.append(
        f"{cid:<11} P={price/1000:>6}  util={util(w, v, price):.3f}  top={max(w)/sum(w):.0%}  "
        f"total={sum(w)}  {[(n, wt) for n, wt in zip(pool, w)]}"
    )

(ROOT / "scripts/case_weights.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
ts = [
    "/**",
    " * СГЕНЕРИРОВАНО скриптом `scripts/generate_nft_case_weights.py` — не редактировать вручную.",
    " * Веса решены на реальных ценах NFT: EV <= price * 0.98, доля топ-предмета <= 45%.",
    " */",
    "export const caseWeights: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {",
]
for cid, entries in result.items():
    ts.append(f"  '{cid}': [" + ", ".join(f"['{g}', {w}]" for g, w in entries) + "],")
ts.append("}")
(ROOT / "src/data/caseWeights.generated.ts").write_text("\n".join(ts) + "\n", encoding="utf-8")
print("\n".join(report))
