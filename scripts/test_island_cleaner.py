import cv2
import numpy as np
from PIL import Image

def clean_alpha_islands(pil_img):
    arr = np.array(pil_img)
    alpha = arr[:, :, 3]
    
    # Binary mask of alpha > 20
    _, bin_mask = cv2.threshold(alpha, 20, 255, cv2.THRESH_BINARY)
    
    # Find connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_mask)
    
    if num_labels <= 1:
        return pil_img
        
    # Find the largest non-background component (the gift)
    # Background label is 0
    areas = stats[1:, cv2.CC_STAT_AREA]
    max_label = np.argmax(areas) + 1
    max_area = areas[max_label - 1]
    
    # Keep components that are substantial (> 10% of max component) or close to center
    keep_mask = np.zeros_like(bin_mask)
    for lbl in range(1, num_labels):
        area = stats[lbl, cv2.CC_STAT_AREA]
        cy = centroids[lbl][1]
        # Discard tiny islands at the very bottom (the star badge slivers)
        if area < 50 or (cy > arr.shape[0] - 25 and area < max_area * 0.15):
            continue
        keep_mask[labels == lbl] = 255
        
    arr[:, :, 3] = np.where(keep_mask > 0, alpha, 0)
    
    cleaned = Image.fromarray(arr)
    bbox = cleaned.getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
    return cleaned

# Test on statue of liberty
img = Image.open(r"c:\Users\pc\Desktop\фотодлябота\test_extracted\statue_of_liberty.png")
cleaned = clean_alpha_islands(img)
cleaned.save(r"c:\Users\pc\Desktop\фотодлябота\test_extracted\statue_cleaned.png")

# Test on dog_cap
img_dog = Image.open(r"c:\Users\pc\Desktop\фотодлябота\test_extracted\dog_cap.png")
cleaned_dog = clean_alpha_islands(img_dog)
cleaned_dog.save(r"c:\Users\pc\Desktop\фотодлябота\test_extracted\dog_cleaned.png")

print("Cleaned!")
