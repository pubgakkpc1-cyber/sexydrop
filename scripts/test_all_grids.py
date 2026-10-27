import cv2
import numpy as np
import glob
import os

def get_grid_blocks(img_path):
    img = cv2.imread(img_path)
    h, w, _ = img.shape
    
    # Distance to card background color [51, 44, 26] (in BGR)
    # Some cards might have slightly different themes or gradients, so let's check:
    dist = np.linalg.norm(img.astype(float) - np.array([51, 44, 26]), axis=2)
    
    # Cards have substantial pixels with dist < 12
    # In columns:
    col_ratio = (dist < 12).mean(axis=0)
    # Threshold to find 3 columns
    in_block = False
    x_blocks = []
    start = 0
    # Dynamic threshold based on col_ratio
    thresh_x = max(0.04, col_ratio.max() * 0.25)
    for x, val in enumerate(col_ratio):
        if val > thresh_x and not in_block:
            in_block = True
            start = x
        elif val <= thresh_x and in_block:
            in_block = False
            if x - start >= 70:
                x_blocks.append((start, x - 1))
    if in_block and w - start >= 70:
        x_blocks.append((start, w - 1))
        
    # In rows:
    row_ratio = (dist < 12).mean(axis=1)
    thresh_y = max(0.04, row_ratio.max() * 0.25)
    in_block = False
    y_blocks = []
    start = 0
    for y, val in enumerate(row_ratio):
        if val > thresh_y and not in_block:
            in_block = True
            start = y
        elif val <= thresh_y and in_block:
            in_block = False
            if y - start >= 100:
                y_blocks.append((start, y - 1))
    if in_block and h - start >= 100:
        y_blocks.append((start, h - 1))
        
    return x_blocks, y_blocks, (w, h)

screenshots = sorted(glob.glob(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана*.png"))
for s in screenshots:
    xb, yb, (w, h) = get_grid_blocks(s)
    print(f"{os.path.basename(s)}: {len(xb)} cols {xb}, {len(yb)} rows {yb}")
