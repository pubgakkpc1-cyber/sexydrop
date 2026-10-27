import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
screenshot_path = os.path.abspath('scripts/test_cases/gallery_preview.png')
html_path = os.path.abspath('scripts/test_cases/index.html')

cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1000,700",
    f"--screenshot={screenshot_path}",
    html_path
]
subprocess.run(cmd, check=True)
print("Screenshot exists:", os.path.exists(screenshot_path))
