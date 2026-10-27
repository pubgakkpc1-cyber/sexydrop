import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')

cmd_adult = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=390,844",
    "--virtual-time-budget=3000",
    f"--screenshot={os.path.join(out_dir, 'app_case_adult18_noticker.png')}",
    "http://127.0.0.1:4173/#/case/adult18"
]
subprocess.run(cmd_adult, check=True)
print("Adult18 screenshot saved")
