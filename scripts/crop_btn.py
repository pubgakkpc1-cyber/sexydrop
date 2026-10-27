import cv2

for s in [5, 7, 8, 9, 10, 11]:
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{s:02d}.jpg')
    cv2.imwrite(f'c:/Users/pc/Desktop/Новая папка/case_frames/btn_s{s:02d}.jpg', im[380:480, 40:680])
print("Saved btn sequences")
