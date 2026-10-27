import cv2
import numpy as np
import glob
import os
from PIL import Image

dirs = [
    r"c:\Users\pc\Desktop\фотодлябота\готовые_подарки_png",
    r"c:\Users\pc\Desktop\ai\public\gifts\png"
]

def refine_image(path):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    h, w = alpha.shape
    
    # 1. Connected components analysis
    _, bin_mask = cv2.threshold(alpha, 15, 255, cv2.THRESH_BINARY)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_mask)
    
    if num_labels <= 1:
        return
        
    areas = stats[1:, cv2.CC_STAT_AREA]
    max_label = np.argmax(areas) + 1
    max_area = areas[max_label - 1]
    
    keep_mask = np.zeros_like(bin_mask)
    for lbl in range(1, num_labels):
        area = stats[lbl, cv2.CC_STAT_AREA]
        cy = centroids[lbl][1]
        bx, by, bw, bh = stats[lbl, cv2.CC_STAT_LEFT], stats[lbl, cv2.CC_STAT_TOP], stats[lbl, cv2.CC_STAT_WIDTH], stats[lbl, cv2.CC_STAT_HEIGHT]
        
        # Discard if it is located in the bottom 25% of image AND either:
        # - thin horizontal sliver (bh <= 6)
        # - or area is less than 15% of the main body
        # - or has gap of empty rows between main body and this island
        is_bottom_island = (by > h * 0.72) and (bh <= 10 or area < max_area * 0.18)
        
        if is_bottom_island:
            continue
            
        keep_mask[labels == lbl] = 255
        
    arr[:, :, 3] = np.where(keep_mask > 0, alpha, 0)
    
    # 2. Check if there are any trailing alpha rows at the bottom separated by an empty row
    row_sum = (arr[:, :, 3] > 0).sum(axis=1)
    # Scan from bottom up
    cur_y = h - 1
    while cur_y > 0 and row_sum[cur_y] == 0:
        cur_y -= 1
    # Now cur_y is the bottom-most pixel
    # Check if cur_y has only a few pixels and the row above it has 0 pixels
    while cur_y > h * 0.7:
        if row_sum[cur_y] > 0 and cur_y > 2 and row_sum[cur_y - 1] == 0 and row_sum[cur_y - 2] == 0:
            # Island at bottom! Cut it off
            arr[cur_y:, :, 3] = 0
            cur_y -= 1
        else:
            break

    cleaned = Image.fromarray(arr)
    bbox = cleaned.getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
        # Re-pad neatly with 4px margin
        pad = 4
        padded = Image.new("RGBA", (cleaned.width + pad * 2, cleaned.height + pad * 2), (0, 0, 0, 0))
        padded.paste(cleaned, (pad, pad))
        padded.save(path)
    else:
        # If whole image was empty, delete
        try:
            os.remove(path)
        except:
            pass

for d in dirs:
    files = glob.glob(os.path.join(d, "*.png"))
    for f in files:
        refine_image(f)

print("Refinement completed across all files!")
