import os
import urllib.request
from rembg import remove, new_session
from PIL import Image

session = new_session('u2netp')
tg_dir = 'scripts/internet_assets/telegram_gifts'
out_dir = 'scripts/internet_assets/telegram_gifts_clean'

new_urls = {
    'heroichelmet': 'https://nft.fragment.com/gift/heroichelmet-1.webp',
    'swisswatch': 'https://nft.fragment.com/gift/swisswatch-1.webp',
    'rarebird': 'https://nft.fragment.com/gift/rarebird-1.webp',
    'ufcstrike': 'https://nft.fragment.com/gift/ufcstrike-1.webp',
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for name, url in new_urls.items():
    raw_path = os.path.join(tg_dir, f'{name}.webp')
    clean_path = os.path.join(out_dir, f'{name}.png')
    
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp, open(raw_path, 'wb') as f:
        f.write(resp.read())
    print(f'Downloaded {name}.webp ({os.path.getsize(raw_path)} B)')
    
    im = Image.open(raw_path)
    cutout = remove(im, session=session)
    bbox = cutout.getbbox()
    if bbox:
        cutout = cutout.crop(bbox)
    cutout.save(clean_path)
    print(f'Cleaned {name}: size={cutout.size}')

print('All 20 Telegram gifts downloaded and cleaned!')
