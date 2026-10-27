import cv2
import numpy as np
from PIL import Image

# Read screenshot
img = Image.open(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png").convert("RGBA")
# Crop card 1 (Coffee waffle cup)
# We crop strictly the gift region inside the card
# x in [10, 112], y in [12, 132]
# To avoid the top-right 'маркет' ribbon (x in [65, 114], y in [7, 36]),
# we know where the ribbon is!
crop1 = img.crop((8, 12, 114, 132))

arr = np.array(crop1)
# Card background color is RGB (26, 44, 51)
bg_rgb = np.array([26, 44, 51])

# Color distance in RGB
dist = np.sqrt(np.sum((arr[:, :, :3].astype(float) - bg_rgb) ** 2, axis=2))

# Create smooth alpha mask:
# dist <= 8 -> alpha 0
# dist >= 25 -> alpha 255
# in-between -> smooth ramp
alpha = np.clip((dist - 8) / (25 - 8), 0, 1) * 255
arr[:, :, 3] = alpha.astype(np.uint8)

# Mask out top-right ribbon:
# In this crop, the top-right ribbon is around x in [60, 106], y in [0, 26]
# Let's inspect the result!
out = Image.fromarray(arr)
out.save(r"c:\Users\pc\Desktop\фотодлябота\test_output\card1_colormask.png")
print("Saved card1_colormask.png")
