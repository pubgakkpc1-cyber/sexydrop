from rembg import remove, new_session
from PIL import Image

session = new_session('u2netp')
im = Image.open('scripts/internet_assets/telegram_gifts/durovscap.webp')
out = remove(im, session=session)
out.save('scripts/internet_assets/telegram_gifts/durovscap_clean.png')
print('Cutout saved, size:', out.size)
