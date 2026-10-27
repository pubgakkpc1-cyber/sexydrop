import cv2
import os

video_path = r"c:\Users\pc\Desktop\Новая папка\video_2026-10-27_17-55-33.mp4"
cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / fps
print(f"Video FPS: {fps}, Total frames: {total_frames}, Duration: {duration:.1f}s")

# Let's extract frames every 5 seconds to see all screens shown in the video!
out_frames_dir = r"c:\Users\pc\Desktop\Новая папка\extracted_frames"
os.makedirs(out_frames_dir, exist_ok=True)

sec = 50
while sec < duration:
    cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(os.path.join(out_frames_dir, f"frame_{int(sec):03d}s.jpg"), frame)
    sec += 5

cap.release()
print("Frames extracted from 50s to end!")
