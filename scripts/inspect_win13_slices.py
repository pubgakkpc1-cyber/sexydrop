import cv2
import numpy as np

for name in ['win13_top', 'win13_mid', 'win13_bot']:
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/win/{name}.jpg')
    print(f"{name}: shape {im.shape}, non-dark pixels count: {np.sum(im > 30)}")
