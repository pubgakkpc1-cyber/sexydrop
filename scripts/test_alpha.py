import os
from PIL import Image
import numpy as np

for f in ['durovscap.webp', 'astralshard.webp', 'plushpepe.webp']:
    p = os.path.join('scripts/internet_assets/telegram_gifts', f)
    im = Image.open(p)
    arr = np.array(im)
    print(f, 'shape:', arr.shape, 'alpha min/max:', arr[:,:,3].min(), arr[:,:,3].max())
    # corners alpha
    print('  top-left alpha:', arr[0, 0, 3], 'center alpha:', arr[750, 750, 3])
