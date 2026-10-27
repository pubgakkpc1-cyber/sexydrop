import cv2
import numpy as np

for ms in [10600, 11200, 11800, 12400, 13000, 13600, 14200, 14800]:
    f = f'c:/Users/pc/Desktop/Новая папка/case_frames/win/win_{ms}ms.jpg'
    im = cv2.imread(f)
    if im is not None:
        # save preview
        cv2.imwrite(f'c:/Users/pc/Desktop/Новая папка/case_frames/win/preview_{ms}ms.jpg', cv2.resize(im, (360, 640)))
print("Saved win previews")
