import cv2
import os

cap = cv2.VideoCapture(r'c:\Users\pc\Desktop\Новая папка\video_2026-10-27_17-55-33.mp4')
spin_dir = r'c:\Users\pc\Desktop\Новая папка\case_frames\spin'
os.makedirs(spin_dir, exist_ok=True)

# Extract frames from 6.0s to 12.0s every 200ms
for ms in range(6000, 12000, 200):
    cap.set(cv2.CAP_PROP_POS_MSEC, ms)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(os.path.join(spin_dir, f"spin_{ms}ms.jpg"), frame)

cap.release()
print("Extracted spin sequence")
