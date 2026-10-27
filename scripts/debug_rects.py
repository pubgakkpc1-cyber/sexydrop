import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
script = """
const nav = document.querySelector('header');
const pill = document.querySelector('[class*="balancePill"]');
const btn = document.querySelector('[class*="depositButton"]');
const screen = document.querySelector('[class*="screen"]');
console.log('window.innerWidth:', window.innerWidth);
console.log('screen rect:', screen ? JSON.stringify(screen.getBoundingClientRect()) : null);
console.log('nav rect:', nav ? JSON.stringify(nav.getBoundingClientRect()) : null);
console.log('pill rect:', pill ? JSON.stringify(pill.getBoundingClientRect()) : null);
console.log('btn rect:', btn ? JSON.stringify(btn.getBoundingClientRect()) : null);
"""

# Let's run a quick node or chrome script
cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "--virtual-time-budget=3000",
    "--dump-dom",
    "http://127.0.0.1:4173/#/case/farm"
]
res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
print("DOM length:", len(res.stdout))
