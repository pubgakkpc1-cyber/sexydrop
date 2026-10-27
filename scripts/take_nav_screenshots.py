import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')

# Home tab active
cmd_home = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'bottom_nav_home.png')}",
    "http://127.0.0.1:4173/"
]
subprocess.run(cmd_home, check=True)

# Inventory tab active
cmd_inv = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'bottom_nav_inv.png')}",
    "http://127.0.0.1:4173/#/inventory"
]
subprocess.run(cmd_inv, check=True)

print("Nav screenshots taken!")
