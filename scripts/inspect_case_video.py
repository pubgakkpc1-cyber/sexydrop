import cv2
import glob
import os

video_path = r'c:\Users\pc\Desktop\Новая папка\video_2026-10-27_17-55-33.mp4'
out_dir = r'c:\Users\pc\Desktop\Новая папка\case_frames'
os.makedirs(out_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"Video FPS: {fps}, Total frames: {total_frames}")

# Check what happens every second
for s in range(0, int(total_frames / fps)):
    cap.set(cv2.CAP_PROP_POS_MSEC, s * 1000)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(os.path.join(out_dir, f"sec_{s:02d}.jpg"), frame)

cap.release()

files = sorted(glob.glob(os.path.join(out_dir, "sec_*.jpg")))
html_lines = [
    "<!DOCTYPE html>",
    "<html><head><meta charset='utf-8'><title>Video Frames</title>",
    "<style>body { background: #121218; color: #fff; font-family: sans-serif; } .grid { display: flex; flex-wrap: wrap; gap: 12px; } .card { background: #1c1c24; border-radius: 8px; padding: 8px; border: 1px solid #333; } img { width: 220px; display: block; border-radius: 6px; }</style>",
    "</head><body><h2>Case Video Breakdown (52s)</h2><div class='grid'>"
]
for f in files:
    name = os.path.basename(f)
    html_lines.append(f"<div class='card'><div><strong>{name}</strong></div><img src='{name}' /></div>")
html_lines.append("</div></body></html>")

with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write("\n".join(html_lines))

print(f"Extracted {len(files)} frames and wrote index.html")
