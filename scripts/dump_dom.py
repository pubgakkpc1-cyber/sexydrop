import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=2000",
    "--dump-dom",
    "http://127.0.0.1:4173/#/case/farm"
]
res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
with open('scripts/test_cases/dom_dump.html', 'w', encoding='utf-8') as f:
    f.write(res.stdout)
print("DOM dumped, length:", len(res.stdout))
