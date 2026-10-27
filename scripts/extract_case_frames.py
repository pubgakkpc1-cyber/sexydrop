import cv2
import os

video_path = r"c:\Users\pc\Desktop\Новая папка\video_2026-10-27_17-55-33.mp4"
cap = cv2.VideoCapture(video_path)
out_dir = r"c:\Users\pc\Desktop\Новая папка\case_frames"
os.makedirs(out_dir, exist_ok=True)

# Extract frames from 0 to 15s every 0.5s
sec = 0.0
while sec <= 16.0:
    cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(os.path.join(out_dir, f"frame_{sec:04.1f}s.jpg"), frame)
    sec += 0.5

cap.release()
print("Extracted 0s-16s frames!")
