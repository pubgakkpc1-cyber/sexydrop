import glob
import os
from PIL import Image

screenshots = sorted(glob.glob(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана*.png"))
for s in screenshots:
    img = Image.open(s)
    print(f"{os.path.basename(s)}: size={img.size}")
