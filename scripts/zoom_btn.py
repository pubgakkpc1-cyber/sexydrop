import cv2

b5 = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/btn_s05.jpg')
b8 = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/btn_s08.jpg')
b11 = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/btn_s11.jpg')

cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/btn5_zoom.jpg', b5[:, 100:540])
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/btn8_zoom.jpg', b8[:, 100:540])
cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/btn11_zoom.jpg', b11[:, 100:540])

print("Saved zoomed button images")
