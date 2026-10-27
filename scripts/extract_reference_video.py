import cv2
import os

video_path = r"c:\Users\pc\Desktop\Новая папка (2)\video_2026-10-27_21-25-48.mp4"
out_dir = r"c:\Users\pc\Desktop\ai\scripts\test_cases\video_frames"
os.makedirs(out_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print("Cannot open video:", video_path)
    exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / fps if fps > 0 else 0
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"Video info: {width}x{height}, {fps:.2f} fps, {total_frames} frames, {duration:.2f} sec")

# Extract frames every second or key milestones
step = max(1, int(fps * 1.5))
frame_idx = 0
saved = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break
    if frame_idx % step == 0:
        sec = frame_idx / fps
        fname = f"frame_{saved:02d}_{sec:.1f}s.png"
        cv2.imwrite(os.path.join(out_dir, fname), frame)
        saved += 1
    frame_idx += 1

cap.release()
print(f"Extracted {saved} frames to {out_dir}")
