import os
from rembg import remove, new_session
from PIL import Image

session = new_session('u2netp')
tg_dir = 'scripts/internet_assets/telegram_gifts'
out_dir = 'scripts/internet_assets/telegram_gifts_clean'
os.makedirs(out_dir, exist_ok=True)

files = [f for f in os.listdir(tg_dir) if f.endswith(('.webp', '.jpg', '.png')) and not f.endswith('_clean.png')]

for f in sorted(files):
    src = os.path.join(tg_dir, f)
    base = os.path.splitext(f)[0]
    dst = os.path.join(out_dir, f'{base}.png')
    if os.path.exists(dst):
        print(f'Already exists: {base}')
        continue
    try:
        im = Image.open(src)
        cutout = remove(im, session=session)
        # Crop to visible bbox
        bbox = cutout.getbbox()
        if bbox:
            cutout = cutout.crop(bbox)
        cutout.save(dst)
        print(f'Processed {base}: bbox={cutout.size}')
    except Exception as e:
        print(f'Error {base}: {e}')

print('All Telegram NFT gifts cutouts prepared!')
