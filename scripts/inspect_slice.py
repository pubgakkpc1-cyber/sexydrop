import cv2
import numpy as np

img = cv2.imread(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")
h, w, _ = img.shape

# Threshold to separate the cards from the background
# Card color is darker or lighter?
# Let's inspect a horizontal slice across y = 80
slice_y = img[80, :, :]
# Find where cards start and end along x
print("Slice y=80 BGR values across x every 10px:")
for x in range(0, w, 15):
    print(f"x={x:3d}: {slice_y[x].tolist()}")
