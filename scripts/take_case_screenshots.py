import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')

# Mobile Farm Case screen
cmd_farm = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_case_farm.png')}",
    "http://127.0.0.1:4173/#/case/farm"
]
subprocess.run(cmd_farm, check=True)

# Mobile Farm Case scrolled to rewards
cmd_farm_scroll = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,1200",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_case_farm_tall.png')}",
    "http://127.0.0.1:4173/#/case/farm"
]
subprocess.run(cmd_farm_scroll, check=True)

print("Case screenshots taken!")
