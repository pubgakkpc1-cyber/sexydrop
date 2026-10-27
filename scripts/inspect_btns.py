import cv2
import numpy as np

for s in [5, 7, 8, 9, 10, 11]:
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/btn_s{s:02d}.jpg')
    print(f"s={s:02d}: shape={im.shape}, mean BGR={np.mean(im, axis=(0,1)).astype(int)}")
