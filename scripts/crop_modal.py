import cv2

im = cv2.imread('c:/Users/pc/Desktop/Новая папка/case_frames/win/win_13000ms.jpg')
if im is not None:
    # crop middle dialog
    cv2.imwrite('c:/Users/pc/Desktop/Новая папка/case_frames/win/modal_13000.jpg', im[300:1000, 40:680])
    print("Saved modal_13000.jpg")
