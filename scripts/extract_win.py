import cv2
import os

cap = cv2.VideoCapture(r'c:\Users\pc\Desktop\Новая папка\video_2026-10-27_17-55-33.mp4')
win_dir = r'c:\Users\pc\Desktop\Новая папка\case_frames\win'
os.makedirs(win_dir, exist_ok=True)

# Extract frames from 10000ms to 16000ms every 300ms
for ms in range(10000, 16000, 300):
    cap.set(cv2.CAP_PROP_POS_MSEC, ms)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(os.path.join(win_dir, f"win_{ms}ms.jpg"), frame)

cap.release()
print("Extracted win celebration frames")
