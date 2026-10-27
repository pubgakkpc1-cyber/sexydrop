import os
import subprocess

html = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>All 22 Cases Preview</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #0b0914; color: #fff; font-family: -apple-system, sans-serif; padding: 24px; }
    h1 { font-size: 22px; margin-bottom: 6px; color: #fff; }
    p { font-size: 13px; color: #8c88a6; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px 8px; text-align: center; }
    .card img { width: 100%; height: 130px; object-fit: contain; }
    .title { margin-top: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; color: #e2e8f0; }
  </style>
</head>
<body>
  <h1>All 22 Opened Cases with Telegram Gifts</h1>
  <p>Real 3D opened boxes sourced from web + official Telegram NFT gifts from Fragment</p>
  <div class="grid">
"""

cases = [
    'farm', 'autumn', 'movie', 'telegram', 'space', 'magic',
    'kitty', 'adult18', 'money', 'onyx-black', 'snoop', 'peach',
    'gem', 'pepe', 'cap', 'ring', 'black', 'epic',
    'vip', 'elite', 'free', 'free24'
]

for c in cases:
    html += f"""
    <div class="card">
      <img src="../../public/cases/{c}.png" />
      <div class="title">{c}</div>
    </div>
    """

html += """
  </div>
</body>
</html>
"""

with open('scripts/test_cases/full_gallery.html', 'w', encoding='utf-8') as f:
    f.write(html)

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
screenshot_path = os.path.abspath('scripts/test_cases/full_gallery_preview.png')
html_path = os.path.abspath('scripts/test_cases/full_gallery.html')

cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1200,900",
    f"--screenshot={screenshot_path}",
    html_path
]
subprocess.run(cmd, check=True)
print("Saved full gallery screenshot:", os.path.exists(screenshot_path))
