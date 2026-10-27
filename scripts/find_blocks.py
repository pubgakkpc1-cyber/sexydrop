import cv2
import numpy as np

def analyze_grid_lines(path):
    img = cv2.imread(path)
    h, w, _ = img.shape
    
    # In Telegram, cards have rounded borders. The margin outside is RGB(40,61,72) or darker/lighter.
    # Let's inspect the vertical lines by checking where the card border is.
    # The card background is around BGR [51, 44, 26]
    # Let's compute color distance from [51, 44, 26]
    dist = np.linalg.norm(img.astype(float) - np.array([51, 44, 26]), axis=2)
    # Inside cards, many pixels are dist < 5
    card_bg_ratio_x = (dist < 5).mean(axis=0)
    card_bg_ratio_y = (dist < 5).mean(axis=1)
    
    print(f"File: {path} (w={w}, h={h})")
    # Find columns where card_bg_ratio_x > 0.05
    # Let's print intervals
    return card_bg_ratio_x, card_bg_ratio_y

rx, ry = analyze_grid_lines(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")
# Find contiguous blocks in rx > 0.1
in_block = False
blocks_x = []
start = 0
for x, val in enumerate(rx):
    if val > 0.05 and not in_block:
        in_block = True
        start = x
    elif val <= 0.05 and in_block:
        in_block = False
        blocks_x.append((start, x-1))
if in_block:
    blocks_x.append((start, len(rx)-1))

print("X card blocks:", blocks_x)

in_block = False
blocks_y = []
start = 0
for y, val in enumerate(ry):
    if val > 0.05 and not in_block:
        in_block = True
        start = y
    elif val <= 0.05 and in_block:
        in_block = False
        blocks_y.append((start, y-1))
if in_block:
    blocks_y.append((start, len(ry)-1))

print("Y card blocks:", blocks_y)
