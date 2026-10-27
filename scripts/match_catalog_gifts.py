import os
import glob
from PIL import Image

output_dir = r"c:\Users\pc\Desktop\фотодлябота\готовые_подарки_png"
files = sorted(glob.glob(os.path.join(output_dir, "*.png")))

print(f"Total files in output: {len(files)}")
# Let's inspect some candidate files
for f in files:
    name = os.path.basename(f)
    img = Image.open(f)
    # Check width, height
    pass
print("Checking specific files...")
