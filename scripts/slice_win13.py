import cv2

im = cv2.imread(r'c:\Users\pc\Desktop\Новая папка\case_frames\win\win_13000ms.jpg')
# Let's save 3 vertical slices of win_13000ms.jpg
cv2.imwrite(r'c:\Users\pc\Desktop\Новая папка\case_frames\win\win13_top.jpg', im[0:420, :])
cv2.imwrite(r'c:\Users\pc\Desktop\Новая папка\case_frames\win\win13_mid.jpg', im[420:850, :])
cv2.imwrite(r'c:\Users\pc\Desktop\Новая папка\case_frames\win\win13_bot.jpg', im[850:1280, :])

print("Saved win13 slices")
