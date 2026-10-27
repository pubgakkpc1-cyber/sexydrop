import cv2
import numpy as np
import glob
import os

screenshots = sorted(glob.glob(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана*.png"))
for s in screenshots:
    img = cv2.imread(s)
    h, w, _ = img.shape
    # Check average brightness along x
    col_prof = img.mean(axis=(0, 2))
    # Check average brightness along y
    row_prof = img.mean(axis=(1, 2))
    
    # In each screenshot, find local minima in col_prof (gaps between columns)
    print(f"\n{os.path.basename(s)}: w={w}, h={h}")
    # Print profile at 20 sample points
    xs = np.linspace(0, w-1, 15, dtype=int)
    print("X profile:", [round(float(col_prof[x]), 1) for x in xs])
