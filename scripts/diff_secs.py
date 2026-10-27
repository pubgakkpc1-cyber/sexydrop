import cv2
import numpy as np

for s in range(15):
    im_curr = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{s:02d}.jpg')
    im_next = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{s+1:02d}.jpg')
    diff = np.mean(np.abs(im_curr.astype(float) - im_next.astype(float)))
    print(f"Diff sec_{s:02d} -> sec_{s+1:02d}: {diff:.2f}")
