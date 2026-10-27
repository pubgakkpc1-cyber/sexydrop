import cv2
import numpy as np

# Let's inspect sec 0 to 52
for s in range(52):
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{s:02d}.jpg')
    # Let's inspect the top header (y: 50..120), reel (y: 200..380), button (y: 380..500)
    top_header = im[50:120, 20:300]
    button_area = im[380:480, 50:670]
    print(f"s={s:02d}: top_header_mean={np.mean(top_header):.1f}, btn_mean={np.mean(button_area):.1f}")
