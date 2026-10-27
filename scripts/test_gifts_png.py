import os
from PIL import Image
import numpy as np

gifts_png = 'public/gifts/png'
files = [f for f in os.listdir(gifts_png) if f.endswith('.png')][:10]

for f in files:
    p = os.path.join(gifts_png, f)
    im = Image.open(p)
    arr = np.array(im)
    print(f"{f}: size={im.size}, alpha_min={arr[:,:,3].min()}, alpha_max={arr[:,:,3].max()}")
