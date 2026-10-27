import cv2
import glob
import os

spin_files = sorted(glob.glob(r'c:\Users\pc\Desktop\Новая папка\case_frames\spin\spin_*ms.jpg'))

for f in spin_files:
    im = cv2.imread(f)
    h, w = im.shape[:2]
    # crop roulette: y from 220 to 390
    name = os.path.basename(f)
    crop_reel = im[220:400, :]
    cv2.imwrite(os.path.join(r'c:\Users\pc\Desktop\Новая папка\case_frames\spin', f'reel_{name}'), crop_reel)

print(f"Processed {len(spin_files)} reel crops")
