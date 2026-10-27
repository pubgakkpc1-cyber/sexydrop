import subprocess
import json

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# We run chrome with --dump-dom or a small evaluation
cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=2000",
    "--dump-dom",
    "http://127.0.0.1:4173/#/case/farm"
]
p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
dom = p.stdout

# Look for header tag or class
print("Has header:", "<header" in dom)
for line in dom.splitlines():
    if "topNav" in line or "shellContainer" in line or "backButton" in line:
        print(line[:120])
