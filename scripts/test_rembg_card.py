from PIL import Image
import rembg
import numpy as np
import os

os.makedirs("c:/Users/pc/Desktop/фотодлябота/test_output", exist_ok=True)

img = Image.open(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")

# Let's crop Card 1 (Coffee in waffle cup)
# Col 1: x in [8, 114], Row 1: y in [7, 165]
# But notice: top right has 'маркет' ribbon, bottom has price pill
# The gift artwork itself is in [8, 15, 114, 125]!
crop_card1 = img.crop((8, 7, 114, 130))
crop_card1.save("c:/Users/pc/Desktop/фотодлябота/test_output/card1_raw.png")

# Remove background with rembg
out1 = rembg.remove(crop_card1)
out1.save("c:/Users/pc/Desktop/фотодлябота/test_output/card1_rembg.png")

# Also crop Card 2 (Statue of liberty)
crop_card2 = img.crop((124, 7, 230, 130))
crop_card2.save("c:/Users/pc/Desktop/фотодлябота/test_output/card2_raw.png")
out2 = rembg.remove(crop_card2)
out2.save("c:/Users/pc/Desktop/фотодлябота/test_output/card2_rembg.png")

# Also Card 4 (Dog with cap)
# Row 2: y in [176, 335]
crop_card4 = img.crop((8, 176, 114, 290))
crop_card4.save("c:/Users/pc/Desktop/фотодлябота/test_output/card4_raw.png")
out4 = rembg.remove(crop_card4)
out4.save("c:/Users/pc/Desktop/фотодлябота/test_output/card4_rembg.png")

print("Done! Check test_output folder.")
