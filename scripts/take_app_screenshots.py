import os
import subprocess
import time

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')

# Mobile home screen after splash screen
cmd_mobile = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_mobile_home.png')}",
    "http://127.0.0.1:4173/"
]
subprocess.run(cmd_mobile, check=True)

# Desktop home screen
cmd_desktop = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1200,900",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_desktop_home.png')}",
    "http://127.0.0.1:4173/"
]
subprocess.run(cmd_desktop, check=True)

# Mobile Case Detail screen (e.g. VIP case)
cmd_detail = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_case_vip.png')}",
    "http://127.0.0.1:4173/#/cases/vip"
]
subprocess.run(cmd_detail, check=True)

print("Screenshots taken!")
