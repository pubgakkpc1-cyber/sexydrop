import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')

cmd_farm = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=390,844",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_case_farm_clean.png')}",
    "http://127.0.0.1:4173/#/case/farm"
]
subprocess.run(cmd_farm, check=True)
print("Saved clean screenshot")
