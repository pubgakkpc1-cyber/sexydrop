import cv2
import numpy as np
import glob
import os
import shutil
from PIL import Image
from rembg import remove, new_session

# Output directories
DESKTOP_OUT = r"c:\Users\pc\Desktop\фотодлябота\готовые_подарки_png"
APP_OUT = r"c:\Users\pc\Desktop\ai\public\gifts\png"
os.makedirs(DESKTOP_OUT, exist_ok=True)
os.makedirs(APP_OUT, exist_ok=True)

print("Initializing u2netp session...")
session = new_session('u2netp')

def clean_alpha_islands(pil_img):
    arr = np.array(pil_img)
    if arr.ndim < 3 or arr.shape[2] < 4:
        return pil_img
    alpha = arr[:, :, 3]
    
    # Binary mask of alpha > 25
    _, bin_mask = cv2.threshold(alpha, 25, 255, cv2.THRESH_BINARY)
    
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_mask)
    if num_labels <= 1:
        return pil_img
        
    areas = stats[1:, cv2.CC_STAT_AREA]
    max_label = np.argmax(areas) + 1
    max_area = areas[max_label - 1]
    
    keep_mask = np.zeros_like(bin_mask)
    for lbl in range(1, num_labels):
        area = stats[lbl, cv2.CC_STAT_AREA]
        cy = centroids[lbl][1]
        # Keep significant parts of the gift, drop tiny star-dust / badge remnants
        if area >= 45 and not (cy > arr.shape[0] - 22 and area < max_area * 0.12):
            keep_mask[labels == lbl] = 255
            
    arr[:, :, 3] = np.where(keep_mask > 0, alpha, 0)
    cleaned = Image.fromarray(arr)
    bbox = cleaned.getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
    return cleaned

def is_duplicate(img, existing_imgs, threshold=14.0):
    # Downscale to 32x32 RGB to compare perceptual difference
    thumb = img.convert("RGBA").resize((32, 32), Image.Resampling.BILINEAR)
    arr = np.array(thumb).astype(float)
    
    for ex_img in existing_imgs:
        ex_thumb = ex_img.convert("RGBA").resize((32, 32), Image.Resampling.BILINEAR)
        ex_arr = np.array(ex_thumb).astype(float)
        # Average color difference on non-transparent pixels
        diff = np.mean(np.abs(arr[:, :, :3] - ex_arr[:, :, :3]))
        if diff < threshold:
            return True
    return False

all_saved_gifts = []
saved_fingerprints = []

def save_gift(img, base_name):
    # Pad by 6px
    pad = 6
    w, h = img.size
    padded = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    padded.paste(img, (pad, pad))
    
    filename = f"{base_name}.png"
    desktop_path = os.path.join(DESKTOP_OUT, filename)
    app_path = os.path.join(APP_OUT, filename)
    
    padded.save(desktop_path)
    padded.save(app_path)
    all_saved_gifts.append((filename, padded.size))
    saved_fingerprints.append(padded)
    print(f"  -> Saved {filename} ({padded.size[0]}x{padded.size[1]})")

# -------------------------------------------------------------
# 1. Process Standalone Files
# -------------------------------------------------------------
print("\n--- 1. Processing standalone gift images ---")
standalone_map = {
    "images.jpg": "golden_trophy",
    "imgwebp.webp": "flower_bouquet",
    "2084083-234271-9380798fea65cdaa01c0aca50fb21ad9.webp": "yellow_gift_box",
    "517018-243016-1b40488059a0d93d7128d0a4dc7bb34a.webp": "champagne_bottle",
    "9223892_imgwebp.webp": "pink_heart_box",
    "9224675_imgwebp.webp": "solitaire_diamond_ring",
    "9224724_imgwebp.webp": "blue_diamond_gem",
    "9224881_imgwebp.webp": "red_rose",
    "490a6da5b3e9843efe4f0fdd01d85909.webp": "space_rocket",
    "74416-546264-cae02ccf729160404abbb84b42cc5327.webp": "teddy_bear",
    "925a8f0a322f71d71d3257d36a389528.webp": "birthday_cake_white",
}

for fname, name in standalone_map.items():
    fpath = os.path.join(r"c:\Users\pc\Desktop\фотодлябота", fname)
    if not os.path.exists(fpath):
        continue
    raw = Image.open(fpath)
    # If file has square dialog box with text (like imgwebp.webp), crop top gift area
    if fname == "imgwebp.webp":
        raw = raw.crop((120, 50, 456, 300))
    
    # If file already has full alpha transparency (like teddy_bear, space_rocket, birthday_cake)
    if raw.mode == "RGBA":
        arr = np.array(raw)
        if (arr[:, :, 3] < 20).mean() > 0.3: # already transparent background
            cleaned = clean_alpha_islands(raw)
            save_gift(cleaned, name)
            continue
            
    # Otherwise run rembg
    rem = remove(raw, session=session)
    cleaned = clean_alpha_islands(rem)
    save_gift(cleaned, name)

# -------------------------------------------------------------
# 2. Process Grid Screenshots
# -------------------------------------------------------------
print("\n--- 2. Processing grid screenshots ---")

def get_grid_blocks(img_path):
    img = cv2.imread(img_path)
    h, w, _ = img.shape
    dist = np.linalg.norm(img.astype(float) - np.array([51, 44, 26]), axis=2)
    
    col_ratio = (dist < 12).mean(axis=0)
    thresh_x = max(0.04, col_ratio.max() * 0.25)
    in_block = False
    x_blocks = []
    start = 0
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
        
    return x_blocks, y_blocks

screenshots = sorted(glob.glob(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана*.png"))
gift_counter = 1

for s_idx, s in enumerate(screenshots):
    sname = os.path.basename(s)
    print(f"\nProcessing screenshot {s_idx + 1}/{len(screenshots)}: {sname}")
    xb, yb = get_grid_blocks(s)
    pil_s = Image.open(s).convert("RGBA")
    
    for r_idx, (y1, y2) in enumerate(yb):
        for c_idx, (x1, x2) in enumerate(xb):
            card = pil_s.crop((x1, y1, x2, y2))
            arr = np.array(card)
            ch, cw, _ = arr.shape
            
            # Clear bottom price badge area
            arr[int(ch * 0.73):, :, 3] = 0
            
            # Clear top-right ribbon (cyan 'маркет' or orange 'распродан')
            for yy in range(min(45, ch)):
                for xx in range(cw):
                    if xx + (40 - yy) > cw + 4:
                        arr[yy, xx, 3] = 0
                        
            cleaned_card = Image.fromarray(arr)
            # Remove card background
            rem = remove(cleaned_card, session=session)
            # Clean alpha islands
            cleaned = clean_alpha_islands(rem)
            
            # Verify gift size is valid
            if cleaned.width < 25 or cleaned.height < 25:
                continue
                
            # Check duplicate against existing saved gifts
            if is_duplicate(cleaned, saved_fingerprints, threshold=12.0):
                print(f"  -> Skipping duplicate gift at row {r_idx}, col {c_idx}")
                continue
                
            # Unique gift found!
            gift_name = f"gift_{gift_counter:02d}"
            save_gift(cleaned, gift_name)
            gift_counter += 1

print(f"\n=== EXTRACTION COMPLETE ===")
print(f"Total unique gifts saved: {len(all_saved_gifts)}")
print(f"Desktop folder: {DESKTOP_OUT}")
print(f"App folder: {APP_OUT}")
