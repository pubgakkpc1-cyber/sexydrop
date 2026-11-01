#!/usr/bin/env python3
"""
Обновляет цены NFT-подарков в public/gifts/nft_manifest.json по реальным данным fragment.com.

Для каждого вида (модель + фон) берутся три флора из лотов «в продаже»:
  * флор коллекции;
  * флор по модели  (поиск по названию модели внутри коллекции);
  * флор по фону    (поиск по названию фона внутри коллекции).
Цена вида = максимум из трёх флоров + 2% (наценка проекта). Пара «модель + фон» на рынке почти
никогда не стоит дешевле своей самой редкой части, поэтому берётся максимум, а не среднее.
Если у атрибута нет лотов в продаже, остаётся флор коллекции. Премия за редкий атрибут ограничена
5 флорами коллекции: единичные лоты с завышенной ценой рынком не считаются.

Затем цены разводятся: если у двух видов цена совпала, второй сдвигается вверх на 0.01 TON,
пока цена не станет уникальной (вниз не двигается — наценка никогда не меньше 2%).

Запуск из корня проекта:  python scripts/refresh_nft_prices.py
Источники сохраняются в scripts/nft_price_sources.json; скрипт возобновляемый.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('dl', os.path.join(HERE, 'download_nft_gifts.py'))
dl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dl)

MANIFEST = dl.MANIFEST_PATH
SOURCES = os.path.join(HERE, 'nft_price_sources.json')
MARKUP = 1.02
MAX_PREMIUM = 5.0  # цена вида не выше 5 флоров коллекции
PAUSE = 1.1
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'}
ITEM_RE = re.compile(r'class="tm-grid-item">.*?tm-value icon-before icon-ton">([\d,\.]+)<', re.S)


def floor(slug: str, query: str = '') -> float | None:
    params = {'filter': 'sale', 'sort': 'price_asc'}
    if query:
        params['query'] = query
    url = f'https://fragment.com/gifts/{slug}?' + urllib.parse.urlencode(params)
    last: Exception | None = None
    for attempt in range(4):
        time.sleep(PAUSE)
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                html = r.read().decode('utf-8', 'replace')
            prices = [float(p.replace(',', '')) for p in ITEM_RE.findall(html)]
            return min(prices) if prices else None
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f'{url}: {last}')


def main() -> None:
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    cache: dict[str, dict] = json.load(open(SOURCES, encoding='utf-8')) if os.path.exists(SOURCES) else {}
    slug_of = {g['name']: g['slug'] for g in dl.GIFTS}

    def cached(key: str, fn):
        if key not in cache:
            cache[key] = {'v': fn()}
            json.dump(cache, open(SOURCES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        return cache[key]['v']

    raw: dict[str, float] = {}
    for gi, (name, variants) in enumerate(manifest.items(), 1):
        slug = slug_of.get(name)
        if not slug:
            print(f'[{name}] нет в списке GIFTS — пропуск')
            continue
        col = cached(f'{slug}|', lambda s=slug: floor(s))
        print(f'[{gi}/{len(manifest)}] {name}: флор коллекции {col}', flush=True)
        for v in variants:
            mf = cached(f'{slug}|{v["model"]}', lambda s=slug, q=v['model']: floor(s, q))
            bf = cached(f'{slug}|{v["backdrop"]}', lambda s=slug, q=v['backdrop']: floor(s, q))
            base = max(x for x in (col, mf, bf) if x is not None) if col is not None else max(x for x in (mf, bf, v['price_ton']) if x is not None)
            if col is not None:
                base = min(base, col * MAX_PREMIUM)  # одиночные завышенные лоты редких атрибутов — не рыночная цена
            raw[v['id']] = round(base * MARKUP, 2)
            print(f'   {v["id"]:<26} модель {v["model"]!r}={mf}  фон {v["backdrop"]!r}={bf}  → {raw[v["id"]]}', flush=True)

    # уникальные цены: вверх на 0.01, пока не освободится
    used: set[int] = set()
    final: dict[str, float] = {}
    for vid, price in sorted(raw.items(), key=lambda kv: (kv[1], kv[0])):
        cents = int(round(price * 100))
        while cents in used:
            cents += 1
        used.add(cents)
        final[vid] = cents / 100
    for variants in manifest.values():
        for v in variants:
            if v['id'] in final:
                v['price_ton'] = final[v['id']]
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'\nГОТОВО: обновлено {len(final)} видов, уникальных цен {len(used)}')


if __name__ == '__main__':
    main()
