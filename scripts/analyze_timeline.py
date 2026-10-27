import cv2
import numpy as np
import glob
import os

# Let's inspect what changes occur in each second and identify the key moments
frames = sorted(glob.glob(r'c:\Users\pc\Desktop\Новая папка\case_frames\sec_*.jpg'))

print(f"Total frames to analyze: {len(frames)}")

# Let's check the button region in each frame (y: 350 to 450, x: 50 to 670 in 720x1280)
# and reel region (y: 200 to 350)
for idx, fpath in enumerate(frames):
    img = cv2.imread(fpath)
    h, w, _ = img.shape
    # sample button area
    btn_crop = img[int(h*0.32):int(h*0.39), int(w*0.08):int(w*0.92)]
    btn_color = np.mean(btn_crop, axis=(0,1)).astype(int)
    # reel area
    reel_crop = img[int(h*0.18):int(h*0.31), int(w*0.05):int(w*0.95)]
    reel_std = np.std(reel_crop)
    if idx in [0, 1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30, 40, 50]:
        print(f"sec_{idx:02d}: btn_color BGR={btn_color}, reel_std={reel_std:.1f}")
