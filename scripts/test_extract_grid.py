from PIL import Image
import numpy as np
from rembg import remove, new_session
import os

session = new_session('u2netp')
out_dir = r"c:\Users\pc\Desktop\фотодлябота\test_extracted"
os.makedirs(out_dir, exist_ok=True)

img = Image.open(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png").convert("RGBA")

x_blocks = [(7, 113), (124, 230), (242, 348)]
y_blocks = [(8, 171), (180, 343), (352, 515)]

card_names = [
    ["coffee_cup", "statue_of_liberty", "lantern"],
    ["dog_cap", "noodles_wok", "choco_popsicle"],
    ["swirl_lollipop", "pink_flamingo", "backpack"]
]

for row_idx, (y1, y2) in enumerate(y_blocks):
    for col_idx, (x1, x2) in enumerate(x_blocks):
        name = card_names[row_idx][col_idx]
        
        # Crop the card
        card = img.crop((x1, y1, x2, y2))
        arr = np.array(card)
        
        # In the card, clear the bottom price badge area (y > 118)
        arr[118:, :, 3] = 0
        
        # In the card, the top-right ribbon 'маркет' is cyan/blue:
        # Cyan ribbon color: R in [40, 100], G in [130, 200], B in [180, 240]
        # or diagonal region x - y > 60 in top right:
        h, w, _ = arr.shape
        for yy in range(min(45, h)):
            for xx in range(w):
                # Diagonal cut for the ribbon
                if xx + (40 - yy) > w + 5:
                    arr[yy, xx, 3] = 0
        
        # Convert back to PIL
        cleaned_card = Image.fromarray(arr)
        
        # Remove background using rembg
        isolated = remove(cleaned_card, session=session)
        
        # Crop to non-transparent bounding box
        bbox = isolated.getbbox()
        if bbox:
            isolated = isolated.crop(bbox)
            
        # Pad slightly by 4px for neat aesthetic
        pad = 4
        padded = Image.new("RGBA", (isolated.width + pad * 2, isolated.height + pad * 2), (0, 0, 0, 0))
        padded.paste(isolated, (pad, pad))
        
        save_path = os.path.join(out_dir, f"{name}.png")
        padded.save(save_path)
        print(f"Saved {name}: {padded.size}")

print("Batch 1 done!")
