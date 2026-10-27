import cv2
import numpy as np

# Let's inspect modal_13000 dimensions and colors
im = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/win/modal_13000.jpg')
h, w = im.shape[:2]
print(f"Modal size: {w}x{h}")

# Let's check sections:
# Top header of modal (0 to 120)
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/win/modal_top.jpg', im[0:120, :])
# Center image of modal (120 to 450)
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/win/modal_center.jpg', im[120:450, :])
# Bottom buttons of modal (450 to end)
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/win/modal_buttons.jpg', im[450:h, :])
print("Saved modal slices")
