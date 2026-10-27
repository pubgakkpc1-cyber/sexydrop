import os
import urllib.request

GIFTS = {
    'durovscap': 'https://nft.fragment.com/gift/durovscap-1.webp',
    'astralshard': 'https://nft.fragment.com/gift/astralshard-1.webp',
    'plushpepe': 'https://nft.fragment.com/gift/plushpepe-1.webp',
    'resistancedog': 'https://nft.fragment.com/gift/resistancedog-1.webp',
    'heartlocket': 'https://nft.fragment.com/gift/heartlocket-1.webp',
    'diamondring': 'https://nft.fragment.com/gift/diamondring-1.webp',
    'scaredcat': 'https://nft.fragment.com/gift/scaredcat-1.webp',
    'magicpotion': 'https://nft.fragment.com/gift/magicpotion-1.webp',
    'crystalball': 'https://nft.fragment.com/gift/crystalball-1.webp',
    'xmasstocking': 'https://nft.fragment.com/gift/xmasstocking-1.webp',
    'freshsocks': 'https://nft.fragment.com/gift/freshsocks-1.webp',
    'instantramen': 'https://nft.fragment.com/gift/instantramen-1.webp',
    'chillflame': 'https://nft.fragment.com/gift/chillflame-1.webp',
    'heroichelmet': 'https://nft.fragment.com/gift/heroichelmet-680.medium.jpg',
    'swisswatch': 'https://nft.fragment.com/gift/swisswatch-7799.medium.jpg',
    'lootbag': 'https://nft.fragment.com/gift/lootbag-1.webp',
    'minioscar': 'https://nft.fragment.com/gift/minioscar-1.webp',
    'lowrider': 'https://nft.fragment.com/gift/lowrider-1.webp',
}

out_dir = 'scripts/internet_assets/telegram_gifts'
os.makedirs(out_dir, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for name, url in GIFTS.items():
    ext = os.path.splitext(url)[1]
    dest = os.path.join(out_dir, f'{name}{ext}')
    if not os.path.exists(dest):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
                out_file.write(response.read())
            print(f'Downloaded {name}{ext} ({os.path.getsize(dest)} bytes)')
        except Exception as e:
            print(f'Failed {name}: {e}')
    else:
        print(f'Already exists: {name}')

print('Finished downloading Telegram NFT gifts!')
