import os
import subprocess
from PIL import Image

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')
os.makedirs(out_dir, exist_ok=True)

targets = [
    ("mobile_home.png", "http://127.0.0.1:4173/", 2000),
    ("mobile_rating.png", "http://127.0.0.1:4173/#/rating", 2500),
    ("mobile_crash.png", "http://127.0.0.1:4173/#/games/crash", 2500),
]

for filename, url, budget in targets:
    raw_path = os.path.join(out_dir, f"raw_{filename}")
    final_path = os.path.join(out_dir, filename)
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--window-size=520,920",
        f"--virtual-time-budget={budget}",
        f"--screenshot={raw_path}",
        url
    ]
    subprocess.run(cmd, check=True)
    
    # Crop exactly to the 440px phone container: centered at 520 means (520 - 440)/2 = 40
    im = Image.open(raw_path)
    # left = 40, right = 480
    cropped = im.crop((40, 0, 480, 920))
    cropped.save(final_path)
    print(f"Saved {filename} ({cropped.size})")

print("All mobile screenshots ready!")
