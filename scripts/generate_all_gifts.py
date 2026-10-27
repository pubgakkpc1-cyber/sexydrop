import os
import base64
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance

RARITY_GLOWS = {
    'common': (52, 211, 153),    # Mint / Emerald
    'rare': (56, 189, 248),      # Cyan / Electric Blue
    'epic': (192, 132, 252),     # Fuchsia / Violet
    'legendary': (251, 191, 36), # 24K Gold / Amber
}

GIFTS_MAPPING = [
    {
        'id': 'fresh-socks',
        'file': 'scripts/internet_assets/telegram_gifts_clean/freshsocks.png',
        'rarity': 'common',
    },
    {
        'id': 'scared-cat',
        'file': 'scripts/internet_assets/telegram_gifts_clean/scaredcat.png',
        'rarity': 'common',
    },
    {
        'id': 'instant-ramen',
        'file': 'scripts/internet_assets/telegram_gifts_clean/instantramen.png',
        'rarity': 'common',
    },
    {
        'id': 'chill-flame',
        'file': 'scripts/internet_assets/telegram_gifts_clean/chillflame.png',
        'rarity': 'common',
    },
    {
        'id': 'xmas-stocking',
        'file': 'scripts/internet_assets/telegram_gifts_clean/xmasstocking.png',
        'rarity': 'common',
    },
    {
        'id': 'holiday-gift',
        'file': 'public/gifts/png/yellow_gift_box.png',
        'rarity': 'common',
    },
    {
        'id': 'heart-locket',
        'file': 'scripts/internet_assets/telegram_gifts_clean/heartlocket.png',
        'rarity': 'rare',
    },
    {
        'id': 'magic-potion',
        'file': 'scripts/internet_assets/telegram_gifts_clean/magicpotion.png',
        'rarity': 'rare',
    },
    {
        'id': 'resistance-dog',
        'file': 'scripts/internet_assets/telegram_gifts_clean/resistancedog.png',
        'rarity': 'rare',
    },
    {
        'id': 'cyber-helmet',
        'file': 'scripts/internet_assets/telegram_gifts_clean/heroichelmet.png',
        'rarity': 'rare',
    },
    {
        'id': 'astral-shard',
        'file': 'scripts/internet_assets/telegram_gifts_clean/astralshard.png',
        'rarity': 'epic',
    },
    {
        'id': 'durovs-cap',
        'file': 'scripts/internet_assets/telegram_gifts_clean/durovscap.png',
        'rarity': 'epic',
    },
    {
        'id': 'diamond-ring',
        'file': 'scripts/internet_assets/telegram_gifts_clean/diamondring.png',
        'rarity': 'epic',
    },
    {
        'id': 'neon-dream',
        'file': 'scripts/internet_assets/telegram_gifts_clean/swisswatch.png',
        'rarity': 'legendary',
    },
    {
        'id': 'plush-pepe',
        'file': 'scripts/internet_assets/telegram_gifts_clean/plushpepe.png',
        'rarity': 'legendary',
    },
    {
        'id': 'crystal-ball',
        'file': 'scripts/internet_assets/telegram_gifts_clean/crystalball.png',
        'rarity': 'legendary',
    },
    {
        'id': 'golden-trophy',
        'file': 'public/gifts/png/golden_trophy.png',
        'rarity': 'legendary',
    },
    {
        'id': 'astral-crown',
        'file': 'scripts/internet_assets/telegram_gifts_clean/minioscar.png',
        'rarity': 'legendary',
    },
    {
        'id': 'golden-pepe',
        'file': 'scripts/internet_assets/telegram_gifts_clean/plushpepe.png',
        'rarity': 'legendary',
        'is_gold': True,
    },
]

def render_gift_icon(item_path, rarity, is_gold=False, size=(512, 512)):
    W, H = size
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    glow_rgb = RARITY_GLOWS.get(rarity, (168, 85, 247))
    
    # 1. Soft radial ambient back glow
    glow_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow_layer)
    cx, cy = W // 2, H // 2
    max_r = int(W * 0.44)
    for r in range(max_r, 0, -6):
        pct = 1.0 - (r / max_r)
        alpha = int(60 * (pct ** 1.8))
        g_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*glow_rgb, alpha))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(16))
    canvas = Image.alpha_composite(canvas, glow_layer)
    
    # 2. Load Item
    item_im = Image.open(item_path).convert('RGBA')
    
    if is_gold:
        # Golden tint for golden-pepe
        r, g, b, a = item_im.split()
        # Shift towards gold
        r = ImageEnhance.Brightness(r).enhance(1.2)
        g = ImageEnhance.Brightness(g).enhance(1.05)
        b = ImageEnhance.Brightness(b).enhance(0.4)
        item_im = Image.merge('RGBA', (r, g, b, a))
        
    # Scale item to fit comfortably within 80% of canvas
    max_dim = int(W * 0.82)
    scale = min(max_dim / item_im.width, max_dim / item_im.height)
    new_w = int(item_im.width * scale)
    new_h = int(item_im.height * scale)
    item_im = item_im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    item_x = (W - new_w) // 2
    item_y = (H - new_h) // 2
    
    # 3. Soft drop shadow under the item
    shadow_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sh_draw = ImageDraw.Draw(shadow_layer)
    sh_cy = item_y + new_h - int(new_h * 0.08)
    sh_rx = int(new_w * 0.4)
    sh_ry = int(sh_rx * 0.28)
    sh_draw.ellipse([cx - sh_rx, sh_cy - sh_ry, cx + sh_rx, sh_cy + sh_ry], fill=(0, 0, 0, 110))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(12))
    canvas = Image.alpha_composite(canvas, shadow_layer)
    
    # 4. Composite item
    canvas.paste(item_im, (item_x, item_y), item_im)
    
    # 5. Delicate corner sparkles (Apple SF highlight style)
    sp_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(sp_layer)
    sparkles = [
        (int(W * 0.18), int(H * 0.22), 7, 220),
        (int(W * 0.82), int(H * 0.18), 9, 240),
        (int(W * 0.84), int(H * 0.76), 6, 180),
        (int(W * 0.16), int(H * 0.78), 7, 190),
    ]
    for sx, sy, sr, sa in sparkles:
        sp_draw.line([sx - sr, sy, sx + sr, sy], fill=(255, 255, 255, sa), width=2)
        sp_draw.line([sx, sy - sr, sx, sy + sr], fill=(255, 255, 255, sa), width=2)
        sp_draw.ellipse([sx - 2, sy - 2, sx + 2, sy + 2], fill=(255, 255, 255, sa))
    sp_layer = sp_layer.filter(ImageFilter.GaussianBlur(1))
    canvas = Image.alpha_composite(canvas, sp_layer)
    
    return canvas

out_dir = 'public/gifts'
os.makedirs(out_dir, exist_ok=True)

print(f'Generating {len(GIFTS_MAPPING)} official Telegram NFT gift avatars...')

for g in GIFTS_MAPPING:
    gid = g['id']
    src_file = g['file']
    rarity = g['rarity']
    is_gold = g.get('is_gold', False)
    
    png_path = os.path.join(out_dir, f'{gid}.png')
    svg_path = os.path.join(out_dir, f'{gid}.svg')
    
    canvas = render_gift_icon(src_file, rarity, is_gold=is_gold)
    canvas.save(png_path, 'PNG', optimize=True)
    
    with open(png_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
        
    svg_markup = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" role="img" aria-label="{gid}">
  <image href="data:image/png;base64,{b64}" width="512" height="512" preserveAspectRatio="xMidYMid meet"/>
</svg>
'''
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_markup)
        
    print(f'Rendered [{gid}] ({rarity}): {os.path.getsize(png_path)} B')

print('All Telegram NFT gift avatars generated!')
