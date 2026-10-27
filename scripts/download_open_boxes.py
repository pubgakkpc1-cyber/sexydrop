import os
import urllib.request

urls = [
    # Open gift boxes
    'https://pngimg.com/uploads/gift/gift_PNG100270.png',
    'https://pngimg.com/uploads/gift/gift_PNG100271.png',
    'https://pngimg.com/uploads/gift/gift_PNG100272.png',
    'https://pngimg.com/uploads/gift/gift_PNG100273.png',
    'https://pngimg.com/uploads/gift/gift_PNG100274.png',
    'https://pngimg.com/uploads/gift/gift_PNG100275.png',
    'https://pngimg.com/uploads/gift/gift_PNG100276.png',
    'https://pngimg.com/uploads/gift/gift_PNG100277.png',
    'https://pngimg.com/uploads/gift/gift_PNG100278.png',
    'https://pngimg.com/uploads/gift/gift_PNG100279.png',
    'https://pngimg.com/uploads/gift/gift_PNG100280.png',
    'https://pngimg.com/uploads/gift/gift_PNG100281.png',
    'https://pngimg.com/uploads/gift/gift_PNG100282.png',
    'https://pngimg.com/uploads/gift/gift_PNG100283.png',
    'https://pngimg.com/uploads/gift/gift_PNG100284.png',
    'https://pngimg.com/uploads/gift/gift_PNG100285.png',
    'https://pngimg.com/uploads/gift/gift_PNG100286.png',
    'https://pngimg.com/uploads/gift/gift_PNG100287.png',
    'https://pngimg.com/uploads/gift/gift_PNG100344.png',
    'https://pngimg.com/uploads/gift/gift_PNG100256.png',
    # Open treasure chests
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG159.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG155.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG153.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG152.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG145.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG141.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG130.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG124.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG119.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG115.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG96.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG52.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG41.png',
    'https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG40.png',
]

dest_dir = 'scripts/internet_assets/open_boxes'
os.makedirs(dest_dir, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for u in urls:
    fname = os.path.basename(u)
    target = os.path.join(dest_dir, fname)
    if not os.path.exists(target):
        try:
            req = urllib.request.Request(u, headers=headers)
            with urllib.request.urlopen(req) as resp, open(target, 'wb') as f:
                f.write(resp.read())
            print(f'Saved {fname} ({os.path.getsize(target)} bytes)')
        except Exception as e:
            print(f'Error {fname}: {e}')
    else:
        print(f'Exists {fname}')

print('Done downloading open boxes!')
