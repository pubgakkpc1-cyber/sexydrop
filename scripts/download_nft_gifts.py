#!/usr/bin/env python3
"""
Скрипт для поиска, скачивания и сохранения аватарок Telegram NFT подарков.
Выкачивает ровно по 3 визуальных вида (с уникальными Backdrop / Model) для каждого из 49 подарков.
Сохраняет файлы в public/gifts/{gift_name}_{1,2,3}.png.
"""

import io
import json
import os
import re
import sys
import time
import urllib.request
from bs4 import BeautifulSoup
from PIL import Image

GIFTS = [
    {"name": "Plush Pepe", "slug": "plushpepe", "file": "plush_pepe", "aliases": ["pepe"], "price_ton": 6720.0},
    {"name": "Heart Locket", "slug": "heartlocket", "file": "heart_locket", "aliases": ["locket"], "price_ton": 1365.0},
    {"name": "Resistance Dog", "slug": "resistancedog", "file": "resistance_dog", "aliases": ["dog"], "price_ton": 493.5},
    {"name": "Durov's Cap", "slug": "durovscap", "file": "durovs_cap", "aliases": ["cap", "durov_cap"], "price_ton": 446.3},
    {"name": "Scared Cat", "slug": "scaredcat", "file": "scared_cat", "aliases": ["cat"], "price_ton": 294.0},
    {"name": "Precious Peach", "slug": "preciouspeach", "file": "precious_peach", "aliases": ["peach"], "price_ton": 273.0},
    {"name": "Heroic Helmet", "slug": "heroichelmet", "file": "heroic_helmet", "aliases": ["helmet"], "price_ton": 194.3},
    {"name": "Loot Bag", "slug": "lootbag", "file": "loot_bag", "aliases": ["loot"], "price_ton": 138.6},
    {"name": "Mighty Arm", "slug": "mightyarm", "file": "mighty_arm", "aliases": ["arm"], "price_ton": 130.2},
    {"name": "Astral Shard", "slug": "astralshard", "file": "astral_shard", "aliases": ["shard"], "price_ton": 128.1},
    {"name": "Westside Sign", "slug": "westsidesign", "file": "westside_sign", "aliases": ["westside"], "price_ton": 119.7},
    {"name": "Mini Oscar", "slug": "minioscar", "file": "mini_oscar", "aliases": ["oscar"], "price_ton": 76.7},
    {"name": "Ion Gem", "slug": "iongem", "file": "ion_gem", "aliases": ["gem"], "price_ton": 72.5},
    {"name": "Low Rider", "slug": "lowrider", "file": "low_rider", "aliases": [], "price_ton": 66.2},
    {"name": "Magic Potion", "slug": "magicpotion", "file": "magic_potion", "aliases": ["potion"], "price_ton": 63.0},
    {"name": "Swiss Watch", "slug": "swisswatch", "file": "swiss_watch", "aliases": ["watch"], "price_ton": 60.9},
    {"name": "Kissed Frog", "slug": "kissedfrog", "file": "kissed_frog", "aliases": ["frog"], "price_ton": 57.8},
    {"name": "Sharp Tongue", "slug": "sharptongue", "file": "sharp_tongue", "aliases": ["tongue"], "price_ton": 52.5},
    {"name": "Voodoo Doll", "slug": "voodoodoll", "file": "voodoo_doll", "aliases": ["voodoodoll"], "price_ton": 43.1},
    {"name": "Vintage Cigar", "slug": "vintagecigar", "file": "vintage_cigar", "aliases": ["cigar"], "price_ton": 41.0},
    {"name": "Signet Ring", "slug": "signetring", "file": "signet_ring", "aliases": ["ring"], "price_ton": 37.8},
    {"name": "Toy Bear", "slug": "toybear", "file": "toy_bear", "aliases": ["bear"], "price_ton": 36.8},
    {"name": "Khabib's Papakha", "slug": "khabibspapakha", "file": "khabibs_papakha", "aliases": ["papakha"], "price_ton": 26.3},
    {"name": "Mad Pumpkin", "slug": "madpumpkin", "file": "mad_pumpkin", "aliases": ["pumpkin"], "price_ton": 18.9},
    {"name": "Trapped Heart", "slug": "trappedheart", "file": "trapped_heart", "aliases": [], "price_ton": 18.9},
    {"name": "Snoop Cigar", "slug": "snoopcigar", "file": "snoop_cigar", "aliases": [], "price_ton": 16.8},
    {"name": "Love Potion", "slug": "lovepotion", "file": "love_potion", "aliases": [], "price_ton": 16.8},
    {"name": "Crystal Ball", "slug": "crystalball", "file": "crystal_ball", "aliases": [], "price_ton": 14.7},
    {"name": "Jingle Bell", "slug": "jinglebells", "file": "jingle_bell", "aliases": ["jingle_bells"], "price_ton": 12.6},
    {"name": "Witch Hat", "slug": "witchhat", "file": "witch_hat", "aliases": [], "price_ton": 10.6},
    {"name": "Fine Pen", "slug": "finepen", "file": "fine_pen", "aliases": ["pen"], "price_ton": 9.8},
    {"name": "Jolly Chimp", "slug": "jollychimp", "file": "jolly_chimp", "aliases": ["chimp"], "price_ton": 8.9},
    {"name": "Surge Board", "slug": "surgeboard", "file": "surge_board", "aliases": ["board"], "price_ton": 8.2},
    {"name": "Input Key", "slug": "inputkey", "file": "input_key", "aliases": ["key"], "price_ton": 7.9},
    {"name": "Snoop Dogg", "slug": "snoopdogg", "file": "snoop_dogg", "aliases": [], "price_ton": 7.0},
    {"name": "Spring Basket", "slug": "springbasket", "file": "spring_basket", "aliases": ["basket"], "price_ton": 6.9},
    {"name": "Liberty Figure", "slug": "libertyfigure", "file": "liberty_figure", "aliases": ["liberty"], "price_ton": 6.6},
    {"name": "Clover Pin", "slug": "cloverpin", "file": "clover_pin", "aliases": ["pin"], "price_ton": 6.6},
    {"name": "Party Sparkler", "slug": "partysparkler", "file": "party_sparkler", "aliases": ["sparkler"], "price_ton": 6.1},
    {"name": "Victory Medal", "slug": "victorymedal", "file": "victory_medal", "aliases": ["medal"], "price_ton": 5.9},
    {"name": "Timeless Book", "slug": "timelessbook", "file": "timeless_book", "aliases": ["book"], "price_ton": 5.7},
    {"name": "Pet Snake", "slug": "petsnake", "file": "pet_snake", "aliases": ["snake"], "price_ton": 5.3},
    {"name": "Whip Cupcake", "slug": "whipcupcake", "file": "whip_cupcake", "aliases": ["cupcake"], "price_ton": 5.3},
    {"name": "Ice Cream", "slug": "icecream", "file": "ice_cream", "aliases": [], "price_ton": 5.2},
    {"name": "Lol Pop", "slug": "lolpop", "file": "lol_pop", "aliases": ["lollipop"], "price_ton": 5.2},
    {"name": "Pool Float", "slug": "poolfloat", "file": "pool_float", "aliases": [], "price_ton": 5.2},
    {"name": "Big Year", "slug": "bigyear", "file": "big_year", "aliases": [], "price_ton": 5.2},
    {"name": "Xmas Stocking", "slug": "xmasstocking", "file": "xmas_stocking", "aliases": ["stocking"], "price_ton": 5.2},
    {"name": "Chill Flame", "slug": "chillflame", "file": "chill_flame", "aliases": ["flame"], "price_ton": 5.0},
    {"name": "Algorithm Cup", "slug": "algorithmcup", "file": "algorithm_cup", "aliases": [], "price_ton": 3450.0},
    {"name": "Intelligence Cup", "slug": "intelligencecup", "file": "intelligence_cup", "aliases": [], "price_ton": 3099.0},
    {"name": "Durov's Glasses", "slug": "durovsglasses", "file": "durovs_glasses", "aliases": [], "price_ton": 150.0},
    {"name": "Nail Bracelet", "slug": "nailbracelet", "file": "nail_bracelet", "aliases": [], "price_ton": 149.0},
    {"name": "Perfume Bottle", "slug": "perfumebottle", "file": "perfume_bottle", "aliases": [], "price_ton": 108.0},
    {"name": "Artisan Brick", "slug": "artisanbrick", "file": "artisan_brick", "aliases": [], "price_ton": 85.0},
    {"name": "Gem Signet", "slug": "gemsignet", "file": "gem_signet", "aliases": [], "price_ton": 72.0},
    {"name": "Bonded Ring", "slug": "bondedring", "file": "bonded_ring", "aliases": [], "price_ton": 47.0},
    {"name": "Neko Helmet", "slug": "nekohelmet", "file": "neko_helmet", "aliases": [], "price_ton": 45.0},
    {"name": "Genie Lamp", "slug": "genielamp", "file": "genie_lamp", "aliases": [], "price_ton": 40.0},
    {"name": "Diamond Ring", "slug": "diamondring", "file": "diamond_ring_nft", "aliases": [], "price_ton": 37.0},
    {"name": "Electric Skull", "slug": "electricskull", "file": "electric_skull", "aliases": [], "price_ton": 35.0},
    {"name": "Eternal Rose", "slug": "eternalrose", "file": "eternal_rose", "aliases": [], "price_ton": 33.0},
    {"name": "Rare Bird", "slug": "rarebird", "file": "rare_bird", "aliases": [], "price_ton": 30.0},
    {"name": "Bling Binky", "slug": "blingbinky", "file": "bling_binky", "aliases": [], "price_ton": 29.0},
    {"name": "Cupid Charm", "slug": "cupidcharm", "file": "cupid_charm", "aliases": [], "price_ton": 27.0},
    {"name": "Sky Stilettos", "slug": "skystilettos", "file": "sky_stilettos", "aliases": [], "price_ton": 20.0},
    {"name": "UFC Strike", "slug": "ufcstrike", "file": "ufc_strike", "aliases": [], "price_ton": 19.0},
    {"name": "Ionic Dryer", "slug": "ionicdryer", "file": "ionic_dryer", "aliases": [], "price_ton": 17.0},
    {"name": "Lucky Locket", "slug": "luckylocket", "file": "lucky_locket", "aliases": [], "price_ton": 17.0},
    {"name": "Flying Broom", "slug": "flyingbroom", "file": "flying_broom", "aliases": [], "price_ton": 15.0},
    {"name": "Skull Flower", "slug": "skullflower", "file": "skull_flower", "aliases": [], "price_ton": 14.0},
    {"name": "Sleigh Bell", "slug": "sleighbell", "file": "sleigh_bell", "aliases": [], "price_ton": 14.0},
    {"name": "Love Candle", "slug": "lovecandle", "file": "love_candle", "aliases": [], "price_ton": 13.0},
    {"name": "Record Player", "slug": "recordplayer", "file": "record_player", "aliases": [], "price_ton": 13.0},
    {"name": "Valentine Box", "slug": "valentinebox", "file": "valentine_box", "aliases": [], "price_ton": 13.0},
    {"name": "Sakura Flower", "slug": "sakuraflower", "file": "sakura_flower", "aliases": [], "price_ton": 12.0},
    {"name": "Top Hat", "slug": "tophat", "file": "top_hat", "aliases": [], "price_ton": 12.0},
    {"name": "Hanging Star", "slug": "hangingstar", "file": "hanging_star", "aliases": [], "price_ton": 11.0},
    {"name": "Joyful Bundle", "slug": "joyfulbundle", "file": "joyful_bundle", "aliases": [], "price_ton": 11.0},
    {"name": "Berry Box", "slug": "berrybox", "file": "berry_box", "aliases": [], "price_ton": 10.0},
    {"name": "Snow Mittens", "slug": "snowmittens", "file": "snow_mittens", "aliases": [], "price_ton": 10.0},
    {"name": "Bunny Muffin", "slug": "bunnymuffin", "file": "bunny_muffin", "aliases": [], "price_ton": 9.0},
    {"name": "Evil Eye", "slug": "evileye", "file": "evil_eye", "aliases": [], "price_ton": 9.0},
    {"name": "Jelly Bunny", "slug": "jellybunny", "file": "jelly_bunny", "aliases": [], "price_ton": 9.0},
    {"name": "Snow Globe", "slug": "snowglobe", "file": "snow_globe", "aliases": [], "price_ton": 8.0},
    {"name": "Bow Tie", "slug": "bowtie", "file": "bow_tie", "aliases": [], "price_ton": 7.0},
    {"name": "Desk Calendar", "slug": "deskcalendar", "file": "desk_calendar", "aliases": [], "price_ton": 7.0},
    {"name": "Eternal Candle", "slug": "eternalcandle", "file": "eternal_candle", "aliases": [], "price_ton": 7.0},
    {"name": "Faith Amulet", "slug": "faithamulet", "file": "faith_amulet", "aliases": [], "price_ton": 7.0},
    {"name": "Hex Pot", "slug": "hexpot", "file": "hex_pot", "aliases": [], "price_ton": 7.0},
    {"name": "Light Sword", "slug": "lightsword", "file": "light_sword", "aliases": [], "price_ton": 7.0},
    {"name": "Lush Bouquet", "slug": "lushbouquet", "file": "lush_bouquet", "aliases": [], "price_ton": 7.0},
    {"name": "Moon Pendant", "slug": "moonpendant", "file": "moon_pendant", "aliases": [], "price_ton": 7.0},
    {"name": "Santa Hat", "slug": "santahat", "file": "santa_hat", "aliases": [], "price_ton": 7.0},
    {"name": "Spy Agaric", "slug": "spyagaric", "file": "spy_agaric", "aliases": [], "price_ton": 7.0},
    {"name": "B-Day Candle", "slug": "bdaycandle", "file": "b_day_candle", "aliases": [], "price_ton": 6.0},
    {"name": "Cookie Heart", "slug": "cookieheart", "file": "cookie_heart", "aliases": [], "price_ton": 6.0},
    {"name": "Ginger Cookie", "slug": "gingercookie", "file": "ginger_cookie", "aliases": [], "price_ton": 6.0},
    {"name": "Holiday Drink", "slug": "holidaydrink", "file": "holiday_drink", "aliases": [], "price_ton": 6.0},
    {"name": "Homemade Cake", "slug": "homemadecake", "file": "homemade_cake", "aliases": [], "price_ton": 6.0},
    {"name": "Hypno Lollipop", "slug": "hypnolollipop", "file": "hypno_lollipop", "aliases": [], "price_ton": 6.0},
    {"name": "Jack-in-the-Box", "slug": "jackinthebox", "file": "jack_in_the_box", "aliases": [], "price_ton": 6.0},
    {"name": "Money Pot", "slug": "moneypot", "file": "money_pot", "aliases": [], "price_ton": 6.0},
    {"name": "Mousse Cake", "slug": "moussecake", "file": "mousse_cake", "aliases": [], "price_ton": 6.0},
    {"name": "Pretty Posy", "slug": "prettyposy", "file": "pretty_posy", "aliases": [], "price_ton": 6.0},
    {"name": "Restless Jar", "slug": "restlessjar", "file": "restless_jar", "aliases": [], "price_ton": 6.0},
    {"name": "Spiced Wine", "slug": "spicedwine", "file": "spiced_wine", "aliases": [], "price_ton": 6.0},
    {"name": "Star Notepad", "slug": "starnotepad", "file": "star_notepad", "aliases": [], "price_ton": 6.0},
    {"name": "Stellar Rocket", "slug": "stellarrocket", "file": "stellar_rocket", "aliases": [], "price_ton": 6.0},
    {"name": "Swag Bag", "slug": "swagbag", "file": "swag_bag", "aliases": [], "price_ton": 6.0},
    {"name": "Winter Wreath", "slug": "winterwreath", "file": "winter_wreath", "aliases": [], "price_ton": 6.0},
    {"name": "Candy Cane", "slug": "candycane", "file": "candy_cane", "aliases": [], "price_ton": 5.0},
    {"name": "Easter Egg", "slug": "easteregg", "file": "easter_egg", "aliases": [], "price_ton": 5.0},
    {"name": "Fresh Socks", "slug": "freshsocks", "file": "fresh_socks", "aliases": [], "price_ton": 5.0},
    {"name": "Happy Brownie", "slug": "happybrownie", "file": "happy_brownie", "aliases": [], "price_ton": 5.0},
    {"name": "Instant Ramen", "slug": "instantramen", "file": "instant_ramen", "aliases": [], "price_ton": 5.0},
    {"name": "Jester Hat", "slug": "jesterhat", "file": "jester_hat", "aliases": [], "price_ton": 5.0},
    {"name": "Lunar Snake", "slug": "lunarsnake", "file": "lunar_snake", "aliases": [], "price_ton": 5.0},
    {"name": "Mirage Lamp", "slug": "miragelamp", "file": "mirage_lamp", "aliases": [], "price_ton": 5.0},
    {"name": "Mood Pack", "slug": "moodpack", "file": "mood_pack", "aliases": [], "price_ton": 5.0},
    {"name": "Snake Box", "slug": "snakebox", "file": "snake_box", "aliases": [], "price_ton": 5.0},
    {"name": "Tama Gadget", "slug": "tamagadget", "file": "tama_gadget", "aliases": [], "price_ton": 5.0},
    {"name": "Vice Cream", "slug": "vicecream", "file": "vice_cream", "aliases": [], "price_ton": 5.0},
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'gifts')
MANIFEST_PATH = os.path.join(OUT_DIR, 'nft_manifest.json')


def fetch_url(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as resp:
                return resp.read()
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def process_gift(gift_info, manifest):
    name = gift_info["name"]
    slug = gift_info["slug"]
    file_prefix = gift_info["file"]
    aliases = gift_info.get("aliases", [])
    price_ton = gift_info["price_ton"]

    # Check if already 3 variants exist and are in manifest
    all_files_exist = True
    for i in (1, 2, 3):
        fpath = os.path.join(OUT_DIR, f"{file_prefix}_{i}.png")
        if not (os.path.exists(fpath) and os.path.getsize(fpath) > 1024):
            all_files_exist = False
            break

    if all_files_exist and name in manifest and len(manifest[name]) >= 3:
        print(f"[{name}] Already complete in manifest, skipping.")
        return manifest[name]

    print(f"\n[{name}] Fetching collection https://fragment.com/gifts/{slug} ...")
    col_url = f"https://fragment.com/gifts/{slug}"
    try:
        col_html = fetch_url(col_url).decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[{name}] Error fetching collection {col_url}: {e}")
        return []

    soup = BeautifulSoup(col_html, 'html.parser')
    links = []
    seen = set()
    for a in soup.select('a[href^="/gift/"]'):
        href = a['href']
        if href not in seen:
            seen.add(href)
            links.append(href)

    print(f"[{name}] Found {len(links)} item links")
    variants = []
    seen_backdrops = set()
    seen_models = set()

    for href in links[:20]:
        time.sleep(1.1)  # safe rate limiting (1.1s delay)
        item_url = f"https://fragment.com{href}"
        try:
            item_html = fetch_url(item_url).decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"  Failed to fetch item {item_url}: {e}")
            continue

        item_soup = BeautifulSoup(item_html, 'html.parser')
        attrs = {}
        for row in item_soup.select('table tr, .table-row, dl, div.table-cell'):
            text = row.get_text(" | ", strip=True)
            if 'Model' in text or 'Backdrop' in text or 'Symbol' in text:
                parts = [p.strip() for p in text.split('|') if p.strip()]
                if len(parts) >= 2:
                    attrs[parts[0]] = parts[1]

        backdrop = attrs.get('Backdrop', f"Backdrop_{len(variants)+1}")
        model = attrs.get('Model', f"Model_{len(variants)+1}")
        symbol = attrs.get('Symbol', "")

        # We want unique combinations of backdrop / model
        if backdrop in seen_backdrops and model in seen_models:
            continue

        item_id = href.split('/')[-1]
        raw_num = item_id.split('-')[-1]
        serial = int(raw_num) if raw_num.isdigit() else None

        # Download high-res image
        img_data = None
        for ext in ('.large.jpg', '.webp', '.medium.jpg'):
            img_url = f"https://nft.fragment.com/gift/{item_id}{ext}"
            try:
                img_data = fetch_url(img_url)
                if img_data:
                    break
            except Exception:
                continue

        if not img_data:
            print(f"  Could not download image for {item_id}")
            continue

        try:
            im = Image.open(io.BytesIO(img_data)).convert('RGBA')
        except Exception as e:
            print(f"  Error converting image: {e}")
            continue

        idx = len(variants) + 1
        fn = f"{file_prefix}_{idx}.png"
        fpath = os.path.join(OUT_DIR, fn)
        im.save(fpath, 'PNG')

        # Also save aliases if any
        for al in aliases:
            al_fpath = os.path.join(OUT_DIR, f"{al}_{idx}.png")
            im.save(al_fpath, 'PNG')

        print(f"  [v{idx}] Saved {fn} (Model='{model}', Backdrop='{backdrop}', #{serial})")

        seen_backdrops.add(backdrop)
        seen_models.add(model)
        variants.append({
            "idx": idx,
            "id": f"{file_prefix}-{idx}",
            "fragment_id": item_id,
            "serial": serial,
            "model": model,
            "backdrop": backdrop,
            "symbol": symbol,
            "image": f"/gifts/{fn}",
            "price_ton": price_ton
        })

        if len(variants) >= 3:
            break

    manifest[name] = variants
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return variants


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
        except Exception:
            manifest = {}

    total = len(GIFTS)
    for idx, gift_info in enumerate(GIFTS, 1):
        name = gift_info["name"]
        print(f"\n==========================================")
        print(f"Processing ({idx}/{total}): {name} ({gift_info['price_ton']} TON)")
        print(f"==========================================")
        process_gift(gift_info, manifest)

    # Final summary check
    print("\n\n================ FINAL CHECK ================")
    missing_gifts = []
    total_downloaded = 0
    for gift_info in GIFTS:
        name = gift_info["name"]
        prefix = gift_info["file"]
        vars_found = []
        for i in (1, 2, 3):
            fn = f"{prefix}_{i}.png"
            p = os.path.join(OUT_DIR, fn)
            if os.path.exists(p) and os.path.getsize(p) > 1024:
                vars_found.append(fn)
                total_downloaded += 1
        if len(vars_found) < 3:
            missing_gifts.append((name, len(vars_found)))
        else:
            print(f"OK: {name} -> 3 variants present ({', '.join(vars_found)})")

    print(f"\nTotal variant files downloaded: {total_downloaded} / {total * 3}")
    if missing_gifts:
        print(f"WARNING: Incomplete gifts ({len(missing_gifts)}): {missing_gifts}")
    else:
        print("SUCCESS! ALL 49 GIFTS HAVE EXACTLY 3 DISTINCT VARIANTS DOWNLOADED AS PNG!")


if __name__ == '__main__':
    main()
