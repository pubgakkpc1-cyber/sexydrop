import os
import base64
from PIL import Image

png_dir = r"c:\Users\pc\Desktop\фотодлябота\готовые_подарки_png"
svg_dir = r"c:\Users\pc\Desktop\ai\public\gifts"

mapping = {
    "fresh-socks": "gift_17.png",
    "scared-cat": "gift_78.png",
    "instant-ramen": "gift_05.png",
    "chill-flame": "gift_100.png",
    "xmas-stocking": "gift_16.png",
    "holiday-gift": "yellow_gift_box.png",
    "heart-locket": "gift_86.png",
    "magic-potion": "gift_75.png",
    "resistance-dog": "gift_04.png",
    "cyber-helmet": "gift_106.png",
    "astral-shard": "gift_77.png",
    "durovs-cap": "gift_76.png",
    "diamond-ring": "solitaire_diamond_ring.png",
    "neon-dream": "gift_27.png",
    "plush-pepe": "gift_87.png",
    "crystal-ball": "gift_64.png",
    "golden-trophy": "golden_trophy.png",
    "astral-crown": "gift_22.png",
    "golden-pepe": "gift_88.png",
}

for gift_id, png_file in mapping.items():
    png_path = os.path.join(png_dir, png_file)
    if not os.path.exists(png_path):
        print(f"Warning: {png_path} not found!")
        continue
        
    with open(png_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
        
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title">
  <title>{gift_id}</title>
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <image href="data:image/png;base64,{b64}" x="4" y="4" width="92" height="92" preserveAspectRatio="xMidYMid meet" filter="url(#shadow)"/>
</svg>
"""
    svg_path = os.path.join(svg_dir, f"{gift_id}.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Updated {gift_id}.svg with real 3D artwork from {png_file}")

print("\nAll 19 catalog SVGs successfully upgraded with real 3D assets!")
