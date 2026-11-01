#!/usr/bin/env python3
"""
Шансы кейсов «как у владельца»: Elite, VIP, Epic и Black — ровно по утверждённой таблице шансов,
остальные платные кейсы — по тому же принципу, но рассчитанные автоматически.

Принцип (по таблицам владельца): джекпоты (в разы дороже кейса) выпадают крайне редко, основная
масса шансов приходится на призы дешевле цены кейса, средний возврат игрокам 85–90% (а не 98%).

Запуск из корня проекта:  python scripts/apply_case_odds.py
Читает public/gifts/nft_manifest.json и src/data/caseWeights.generated.ts (состав кейсов),
пишет src/data/caseOddsFixed.ts: кейсы, которых нет в OWNER и в STYLE_CASES, остаются как были.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RTP_TARGET = 0.75  # средний возврат игрокам в автоматических кейсах (у кейсов владельца 46–63% по расчёту)

manifest = json.loads((ROOT / 'public/gifts/nft_manifest.json').read_text(encoding='utf-8'))
VARIANT_PRICE = {x['id']: int(round(x['price_ton'] * 1000)) for v in manifest.values() for x in v}
NAME_OF_ID = {x['id']: n for n, v in manifest.items() for x in v}

# Утверждённые владельцем шансы, % (сумма по кейсу = 100)
OWNER: dict[str, list[tuple[str, float]]] = {
    'elite': [('Plush Pepe', 0.05), ('Intelligence Cup', 0.1), ('Algorithm Cup', 0.1), ('Mini Oscar', 3.02),
              ('TON 250', 35.26), ('TON 100', 61.48)],
    'vip': [('Heart Locket', 0.51), ('Loot Bag', 1.46), ('Nail Bracelet', 2.02), ('Gem Signet', 48),
            ('Diamond Ring', 48)],
    'epic': [('Resistance Dog', 0.011), ('Scared Cat', 0.223), ('Loot Bag', 1.06), ('Perfume Bottle', 2.02),
             ('TON 100', 3), ('TON 50', 2.19), ('Toy Bear', 6.56), ('Eternal Rose', 24.86),
             ('Lucky Locket', 31.8), ('Flying Broom', 28.27)],
    'black': [('Astral Shard', 0.135), ('Precious Peach', 0.487), ('Ion Gem', 0.482), ('Sharp Tongue', 0.676),
              ("Khabib's Papakha", 0.77), ('Vintage Cigar', 0.972), ('Love Potion', 1.46), ('Snoop Cigar', 5),
              ('Jolly Chimp', 11.65), ('Fine Pen', 7.41), ('Chill Flame', 21.17), ('Pool Float', 11.65),
              ('Lol Pop', 23.29), ('Clover Pin', 14.84)],
}
# Остальные платные кейсы (кроме бесплатных и уже утверждённых ранее: farm, sweet, bronze, silver, gold)
STYLE_CASES = ['autumn', 'movie', 'telegram', 'magic', 'kitty', 'space', 'adult18', 'snoop', 'money',
               'onyx-black', 'peach', 'gem', 'pepe', 'cap', 'ring', 'potion', 'jewel', 'meme', 'party',
               'cute', 'street', 'heroes']
TOTAL = 1_000_000

CASE_PRICE = {  # minor, как в catalog.ts
    'autumn': 8000, 'movie': 9000, 'telegram': 10000, 'magic': 10000, 'kitty': 10000, 'space': 12000,
    'adult18': 14000, 'snoop': 15000, 'money': 16000, 'onyx-black': 16000, 'peach': 16000, 'gem': 16000,
    'pepe': 30000, 'cap': 30000, 'ring': 30000, 'potion': 18000, 'jewel': 12000, 'meme': 7000, 'party': 6000,
    'cute': 6000, 'street': 7000, 'heroes': 14000, 'elite': 300000, 'vip': 120000, 'epic': 80000, 'black': 40000,
}


def label_of(item_id: str) -> str:
    if item_id.startswith('ton_'):
        amount = int(item_id[4:]) / 1000
        return f'TON {amount:g}'
    return NAME_OF_ID[item_id]


def price_of(item_id: str) -> int:
    return int(item_id[4:]) if item_id.startswith('ton_') else VARIANT_PRICE[item_id]


def load_ts(path: Path) -> dict[str, list[list]]:
    text = path.read_text(encoding='utf-8')
    out = {}
    for cid, ents in re.findall(r"^  '([a-z0-9-]+)': \[(.*)\],$", text, re.M):
        out[cid] = [[i, int(w)] for i, w in re.findall(r"\['([^']+)', (\d+)\]", ents)]
    return out


def split(ids: list[str], group_weight: int) -> list[list]:
    q, r = divmod(group_weight, len(ids))
    return [[i, max(1, q + (1 if k < r else 0))] for k, i in enumerate(ids)]


def groups_of(entries: list[list]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for item_id, _ in entries:
        groups.setdefault(label_of(item_id), []).append(item_id)
    return groups


def rtp(entries: list[list], price: int) -> float:
    tot = sum(w for _, w in entries)
    return sum(price_of(i) * w for i, w in entries) / tot / price


def owner_case(cid: str, pool: list[list]) -> list[list]:
    groups = groups_of(pool)
    out: list[list] = []
    for label, pct in OWNER[cid]:
        ids = groups.get(label)
        if not ids:
            raise SystemExit(f'{cid}: приза «{label}» нет в составе кейса')
        out += split(ids, round(pct * TOTAL / 100))
    return out


def style_case(cid: str, pool: list[list]) -> list[list] | None:
    """Автоматические шансы по принципу владельца. None — не получилось, оставляем как было."""
    price = CASE_PRICE[cid]
    groups = groups_of(pool)
    avg = {g: sum(price_of(i) for i in ids) / len(ids) for g, ids in groups.items()}
    ratio = {g: avg[g] / price for g in groups}
    cheap = sorted((g for g in groups if ratio[g] < 1.2), key=lambda g: avg[g])
    n_low = max(1, round(len(cheap) * 0.6))
    tiers = {
        'J': [g for g in groups if ratio[g] >= 4],
        'H': [g for g in groups if 1.2 <= ratio[g] < 4],
        'M': cheap[n_low:],
        'L': cheap[:n_low],
    }
    if not tiers['L']:
        return None
    for rt, scale in [(r, sc) for r in (0.75, 0.70, 0.65, 0.60, 0.55, 0.50, 0.45) for sc in (1.0, 0.8, 0.6, 0.4, 0.2)]:
        shares = {'J': 0.10 * scale, 'H': 0.18 * scale, 'M': 0.22 * scale}
        ev_total = rt * price
        p: dict[str, float] = {}
        for t in 'JHM':
            if not tiers[t]:
                continue
            for g in tiers[t]:
                p[g] = shares[t] * ev_total / len(tiers[t]) / avg[g]
        mass_other = sum(p.values())
        used = sum(p[g] * avg[g] for g in p)
        m_l = 1 - mass_other
        ev_l = ev_total - used
        lo, hi = min(avg[g] for g in tiers['L']), max(avg[g] for g in tiers['L'])
        if m_l <= 0.02 or ev_l <= 0:
            continue
        target_mean = ev_l / m_l
        if not (lo <= target_mean <= hi):
            continue
        a, b = -12.0, 12.0
        for _ in range(80):
            mid = (a + b) / 2
            ws = {g: avg[g] ** mid for g in tiers['L']}
            mean = sum(ws[g] * avg[g] for g in ws) / sum(ws.values())
            if mean < target_mean:
                a = mid
            else:
                b = mid
        ws = {g: avg[g] ** ((a + b) / 2) for g in tiers['L']}
        tot_w = sum(ws.values())
        for g in ws:
            p[g] = m_l * ws[g] / tot_w
        out: list[list] = []
        for g, ids in groups.items():
            if g in p:
                out += split(ids, max(len(ids), round(p[g] * TOTAL)))
        return out
    return None


def smooth_case(cid: str, pool: list[list], target: float = 0.60) -> list[list] | None:
    """Запасной вариант: шанс убывает с ценой как price^-γ, γ подбирается под нужный возврат."""
    price = CASE_PRICE[cid]
    groups = groups_of(pool)
    avg = {g: sum(price_of(i) for i in ids) / len(ids) for g, ids in groups.items()}
    lo_g, hi_g = 0.0, 12.0
    for _ in range(80):
        mid = (lo_g + hi_g) / 2
        ws = {g: (avg[g] / price) ** -mid for g in groups}
        tot = sum(ws.values())
        rtp_v = sum(ws[g] * avg[g] for g in ws) / tot / price
        if rtp_v > target:
            lo_g = mid
        else:
            hi_g = mid
    ws = {g: (avg[g] / price) ** -((lo_g + hi_g) / 2) for g in groups}
    tot = sum(ws.values())
    if max(ws.values()) / tot > 0.45:
        return None
    out: list[list] = []
    for g, ids in groups.items():
        out += split(ids, max(len(ids), round(ws[g] / tot * TOTAL)))
    return out


def main() -> None:
    pool_all = load_ts(ROOT / 'src/data/caseWeights.generated.ts')
    fixed_path = ROOT / 'src/data/caseOddsFixed.ts'
    text = fixed_path.read_text(encoding='utf-8', newline='')
    nl = '\r\n' if '\r\n' in text else '\n'
    text = text.replace('\r\n', '\n')
    fixed = load_ts(fixed_path)
    report = []
    for cid in OWNER:
        fixed[cid] = owner_case(cid, pool_all[cid])
        report.append(f'{cid:<11} по таблице владельца   RTP {rtp(fixed[cid], CASE_PRICE[cid]) * 100:5.1f}%  призов {len(fixed[cid])}')
    # Покрытие: если таблицы владельца убрали из кейсов какие-то коллекции, добавляем их в автоматические кейсы
    covered = {NAME_OF_ID[i] for ents in fixed.values() for i, _ in ents if i in NAME_OF_ID}
    covered |= {NAME_OF_ID[i] for c in STYLE_CASES for i, _ in pool_all[c] if i in NAME_OF_ID}
    price_sorted = sorted(STYLE_CASES, key=lambda c: CASE_PRICE[c])
    for name in sorted(n for n in manifest if n not in covered):
        mean = sum(VARIANT_PRICE[v['id']] for v in manifest[name]) / len(manifest[name])
        host = next((c for c in price_sorted if mean <= 4 * CASE_PRICE[c] and c not in ('onyx-black',)), price_sorted[-1])
        ids = [v['id'] for v in sorted(manifest[name], key=lambda v: v['price_ton'])
               if v['backdrop'] not in ('Black', 'Onyx Black')][:3]
        pool_all[host] += [[i, 1] for i in ids]
        report.append(f'{name}: добавлена в {host} для покрытия')
    for cid in STYLE_CASES:
        res = style_case(cid, pool_all[cid])
        for target in (0.60, 0.70, 0.80, 0.90):
            if res is not None:
                break
            res = smooth_case(cid, pool_all[cid], target)
        if res is None:
            report.append(f'{cid:<11} НЕ УДАЛОСЬ — остаются прежние шансы')
            continue
        fixed[cid] = res
        report.append(f'{cid:<11} авто-шансы             RTP {rtp(res, CASE_PRICE[cid]) * 100:5.1f}%  призов {len(res)}')

    head = text[: text.index('export const fixedCaseWeights')]
    body = ['export const fixedCaseWeights: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {']
    for cid, entries in fixed.items():
        body.append(f"  '{cid}': [" + ', '.join(f"['{i}', {w}]" for i, w in entries) + '],')
    body.append('}')
    fixed_path.write_text((head + '\n'.join(body) + '\n').replace('\n', nl), encoding='utf-8', newline='')
    print('\n'.join(report))


if __name__ == '__main__':
    main()
