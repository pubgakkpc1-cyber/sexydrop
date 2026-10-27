import cv2
import numpy as np
import glob
import os

def find_cards_in_screenshot(path):
    img = cv2.imread(path)
    h, w, _ = img.shape
    
    # The card interior is approximately RGB (26, 44, 51) -> BGR (51, 44, 26)
    # Also in other shots, card background is around BGR [51, 44, 26] or [46, 38, 24]
    # Let's find regions by color range:
    # Lower: BGR [35, 30, 15], Upper: BGR [65, 58, 38]
    lower = np.array([35, 30, 15])
    upper = np.array([65, 58, 38])
    mask = cv2.inRange(img, lower, upper)
    
    # In each card, the gift is in the middle and the ribbon is in the corner.
    # If we close morphological gaps (dilate then erode), the card becomes a solid rectangle!
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    # Also dilate a bit to merge
    dilated = cv2.dilate(closed, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25)), iterations=2)
    
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        # Each card has width ~90-120 and height ~130-180
        if 80 <= cw <= 140 and 120 <= ch <= 200:
            boxes.append((x, y, cw, ch))
            
    # Sort top-to-bottom, left-to-right
    boxes.sort(key=lambda b: (round(b[1] / 50), b[0]))
    return boxes, (w, h)

screenshots = sorted(glob.glob(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана*.png"))
for s in screenshots:
    boxes, (w, h) = find_cards_in_screenshot(s)
    print(f"{os.path.basename(s)} ({w}x{h}) -> found {len(boxes)} cards: {boxes[:3]}...")
