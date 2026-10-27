import subprocess

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

cmd = [
    chrome_path,
    "--headless=new",
    "--disable-gpu",
    "--virtual-time-budget=5000",
    "--dump-dom",
    "https://bags-bull-immediate-rabbit.trycloudflare.com/"
]
result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print("=== HEADLESS DOM DUMP FROM CLOUDFLARE TUNNEL ===")
print("Return code:", result.returncode)
print("DOM length:", len(result.stdout))
print(result.stdout[:600])
if result.stderr:
    print("Stderr:", result.stderr[:300])
