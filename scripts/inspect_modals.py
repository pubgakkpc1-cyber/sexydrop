import cv2
import numpy as np

# Let's inspect sec_00, sec_01, sec_07, sec_08, sec_13, sec_20
# Let's check text lines or regions
for sec in [0, 1, 7, 8, 9, 13, 20]:
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{sec:02d}.jpg')
    # let's look at the center of the screen at sec_08 / sec_13 / sec_20
    # Is there a modal/dialog?
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    center_patch = gray[400:800, 150:570]
    print(f"sec_{sec:02d}: center_mean={np.mean(center_patch):.1f}, center_std={np.std(center_patch):.1f}")
