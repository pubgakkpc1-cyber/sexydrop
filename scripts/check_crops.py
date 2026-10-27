from PIL import Image
import os

crops_dir = r'c:\Users\pc\Desktop\Новая папка\case_frames\crops'
for f in os.listdir(crops_dir):
    p = os.path.join(crops_dir, f)
    im = Image.open(p)
    print(f, im.size)
