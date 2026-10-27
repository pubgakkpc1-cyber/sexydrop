import cv2
import os

frames_dir = r'c:\Users\pc\Desktop\Новая папка\case_frames'
crops_dir = r'c:\Users\pc\Desktop\Новая папка\case_frames\crops'
os.makedirs(crops_dir, exist_ok=True)

for sec in [0, 1, 2, 7, 8, 9, 10, 13, 14, 20]:
    fpath = os.path.join(frames_dir, f"sec_{sec:02d}.jpg")
    img = cv2.imread(fpath)
    if img is not None:
        cv2.imwrite(os.path.join(crops_dir, f"full_{sec:02d}.jpg"), cv2.resize(img, (360, 640)))
        # top half
        cv2.imwrite(os.path.join(crops_dir, f"top_{sec:02d}.jpg"), img[0:600, :])
print("Saved crops")
