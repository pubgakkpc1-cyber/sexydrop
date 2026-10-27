from PIL import Image
import numpy as np

img = Image.open(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")
print("Size:", img.size)

# Let's inspect the cards:
# Width: 357, Height: 519
# There are 3 columns and 3 rows in 174044.png
# Let's check pixel columns and rows
arr = np.array(img)
print("Shape:", arr.shape)
# Find bounding boxes of the cards
# The cards have background around (25, 42, 50)
