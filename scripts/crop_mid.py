import cv2

for s in [0, 7, 8, 9, 13, 20]:
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{s:02d}.jpg')
    cv2.imwrite(f'c:/Users/pc/Desktop/Новая папка/case_frames/mid_{s:02d}.jpg', im[200:700, :])
print("Cropped mid sections")
