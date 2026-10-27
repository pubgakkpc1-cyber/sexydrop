import cv2

img = cv2.imread(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")
h, w, _ = img.shape

# Let's inspect slice along x = 60 (center of Card 1) down all rows y
col = img[:, 60, :]
print(f"Col x=60 profile across y (every 10px):")
for y in range(0, h, 15):
    print(f"y={y:3d}: {col[y].tolist()}")
