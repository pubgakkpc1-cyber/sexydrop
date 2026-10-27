import cv2

# Let's crop the button and modal areas from sec_00, sec_01, sec_08, sec_13, sec_20
for sec in [0, 1, 7, 8, 9, 13, 20]:
    im = cv2.imread(f'c:/Users/pc/Desktop/Новая папка/case_frames/sec_{sec:02d}.jpg')
    # Save a clear 540x960 version in case_frames
    cv2.imwrite(f'c:/Users/pc/Desktop/Новая папка/case_frames/view_{sec:02d}.jpg', cv2.resize(im, (540, 960)))
print('Saved view images')
