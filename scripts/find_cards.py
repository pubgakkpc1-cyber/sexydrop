from PIL import Image
import numpy as np

img = Image.open(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")
w, h = img.size
arr = np.array(img.convert("RGB"))

# Let's inspect horizontal lines and vertical lines to detect the dark gaps vs card rectangles
# The background between cards is darker or has specific color
print(f"Image size: {w}x{h}")

# Let's sample along horizontal line y = 100, 200, 300
for y in [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]:
    row = arr[y, :, :]
    # card background is typically around (24, 38, 46) or similar
    # gap between cards is (14, 22, 27)
    # print average color across columns
    pass

# Let's find columns:
# In 357 width with 3 cards:
# card width is approximately ~105-110 px with ~8-12 px gap and margins
# Let's measure gaps by thresholding
gray = arr.mean(axis=2)
# Margin left, gap 1, gap 2, margin right
print("Row y=100 profile min/max:", gray[100].min(), gray[100].max())
print("Col x=50 profile min/max:", gray[:, 50].min(), gray[:, 50].max())
