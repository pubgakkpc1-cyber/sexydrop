import os
from PIL import Image

tg_dir = 'scripts/internet_assets/telegram_gifts'
for f in sorted(os.listdir(tg_dir)):
    p = os.path.join(tg_dir, f)
    im = Image.open(p)
    print(f"{f}: size={im.size}, mode={im.mode}")
