import os
import subprocess
from PIL import Image

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')
os.makedirs(out_dir, exist_ok=True)

targets = [
    ("crash_countdown_5.png", "http://127.0.0.1:4173/#/games/crash", 800),
    ("crash_countdown_3.png", "http://127.0.0.1:4173/#/games/crash", 2800),
    ("crash_countdown_1.png", "http://127.0.0.1:4173/#/games/crash", 4800),
    ("crash_flight.png", "http://127.0.0.1:4173/#/games/crash", 7500),
    ("case_detail_sexy_drop.png", "http://127.0.0.1:4173/#/case/farm", 2000),
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
    
    im = Image.open(raw_path)
    cropped = im.crop((40, 0, 480, 920))
    cropped.save(final_path)
    print(f"Saved {filename}")

print("All crash & case screenshots ready!")
