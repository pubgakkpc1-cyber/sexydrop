import os
import glob
from PIL import Image

folder = r"c:\Users\pc\Desktop\фотодлябота\готовые_подарки_png"
pngs = sorted(glob.glob(os.path.join(folder, "*.png")))

cards_html = []
for p in pngs:
    fname = os.path.basename(p)
    im = Image.open(p)
    w, h = im.size
    cards_html.append(f"""
      <div class="card">
        <div class="img-wrap">
          <img src="{fname}" alt="{fname}" loading="lazy" />
        </div>
        <div class="name">{fname}</div>
        <div class="size">{w} &times; {h} px</div>
      </div>
    """)

html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Коллекция подарков Telegram — прозрачный фон (PNG)</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0d0b14;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 30px 20px;
    }}
    h1 {{
      font-size: 26px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #54c8ff, #9d4edd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    .subtitle {{
      color: #8b9bb4;
      font-size: 14px;
      margin-bottom: 24px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 16px;
    }}
    .card {{
      background: #171524;
      border: 1px solid #28243d;
      border-radius: 14px;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s, border-color 0.2s;
    }}
    .card:hover {{
      transform: translateY(-3px);
      border-color: #54c8ff;
    }}
    .img-wrap {{
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-image: 
        linear-gradient(45deg, #1f1c30 25%, transparent 25%), 
        linear-gradient(-45deg, #1f1c30 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, #1f1c30 75%), 
        linear-gradient(-45deg, transparent 75%, #1f1c30 75%);
      background-size: 12px 12px;
      background-position: 0 0, 0 6px, 6px -6px, -6px 0px;
      border-radius: 10px;
      margin-bottom: 10px;
      overflow: hidden;
    }}
    .img-wrap img {{
      max-width: 90px;
      max-height: 90px;
      object-fit: contain;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
    }}
    .name {{
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      word-break: break-all;
    }}
    .size {{
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
    }}
  </style>
</head>
<body>
  <h1>🎁 Коллекция подарков Telegram (прозрачный фон)</h1>
  <div class="subtitle">Всего извлечено: {len(pngs)} подарков · Фон удален · Оригинальные 3D-модели сохранены · Формат PNG с альфа-каналом</div>
  <div class="grid">
    {''.join(cards_html)}
  </div>
</body>
</html>
"""

html_path = os.path.join(folder, "index.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
print(f"Generated gallery HTML at: {html_path}")
