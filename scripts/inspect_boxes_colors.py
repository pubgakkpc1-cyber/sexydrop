import os
from PIL import Image
import numpy as np

boxes_dir = 'scripts/internet_assets/open_boxes'
files = sorted(os.listdir(boxes_dir))

print(f"{'Filename':<28} | {'Size':<10} | {'Avg RGB (Non-transparent)':<25} | {'Dominant Color'}")
print("-" * 80)

for f in files:
    if not f.endswith('.png'):
        continue
    p = os.path.join(boxes_dir, f)
    im = Image.open(p).convert('RGBA')
    arr = np.array(im)
    alpha = arr[:, :, 3]
    mask = alpha > 40
    if not np.any(mask):
        continue
    rgb = arr[:, :, :3][mask]
    avg_r = int(np.mean(rgb[:, 0]))
    avg_g = int(np.mean(rgb[:, 1]))
    avg_b = int(np.mean(rgb[:, 2]))
    
    # Simple color classification
    dom = "other"
    if avg_r > avg_g + 30 and avg_r > avg_b + 30:
        dom = "Red / Pink / Warm"
    elif avg_g > avg_r + 20 and avg_g > avg_b + 20:
        dom = "Green / Emerald"
    elif avg_b > avg_r + 20 and avg_b > avg_g + 20:
        dom = "Blue / Cyan"
    elif avg_r > 150 and avg_g > 120 and avg_b < 100:
        dom = "Gold / Yellow / Amber"
    elif avg_r > 120 and avg_b > 120 and avg_g < 100:
        dom = "Purple / Magenta"
    elif avg_r < 80 and avg_g < 80 and avg_b < 80:
        dom = "Dark / Obsidian / Black"
    else:
        dom = f"RGB({avg_r},{avg_g},{avg_b})"
        
    print(f"{f:<28} | {f'{im.width}x{im.height}':<10} | rgb({avg_r:>3},{avg_g:>3},{avg_b:>3}) | {dom}")
