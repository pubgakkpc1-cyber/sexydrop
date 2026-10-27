import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')

# Mobile scrolled to CasesGrid
html_scroll_script = """
window.scrollTo(0, 520);
"""

# Let's take a full-height mobile screenshot (390 x 2400)
cmd_mobile_full = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,1600",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_mobile_cases.png')}",
    "http://127.0.0.1:4173/"
]
subprocess.run(cmd_mobile_full, check=True)

# Desktop screenshot (1200 x 1400)
cmd_desktop_full = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1200,1200",
    "--virtual-time-budget=4000",
    f"--screenshot={os.path.join(out_dir, 'app_desktop_cases.png')}",
    "http://127.0.0.1:4173/"
]
subprocess.run(cmd_desktop_full, check=True)

print("Full screenshots taken!")
