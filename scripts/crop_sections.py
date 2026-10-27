import cv2

# Let's inspect sec_00 (start), sec_01 (navigated to case), sec_08 (spinning or result?), sec_20
im0 = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/sec_00.jpg')
im1 = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/sec_01.jpg')
im8 = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/sec_08.jpg')

# Header of im1: y: 40 to 140, x: 0 to 720
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/header_01.jpg', im1[40:140, :])
# Ticker of im1: y: 140 to 220, x: 0 to 720
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/ticker_01.jpg', im1[140:220, :])
# Reel of im1: y: 220 to 390, x: 0 to 720
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/reel_01.jpg', im1[220:390, :])
# Button of im1: y: 390 to 520, x: 0 to 720
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/button_01.jpg', im1[390:520, :])
# Rewards header & top cards of im1: y: 520 to 900, x: 0 to 720
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/rewards_01.jpg', im1[520:900, :])

print("Cropped sections of case screen")
