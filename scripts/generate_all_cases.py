import os
import math
import base64
from PIL import Image, ImageFilter, ImageDraw

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def render_loot_drop(box_path, gift_path, glow_rgb=(59, 167, 255), canvas_size=(512, 512)):
    W, H = canvas_size
    canvas = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    
    # 1. Radiant backdrop glow (Apple ambient glass bloom)
    glow_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    cx, cy = W // 2, int(H * 0.48)
    radius = int(W * 0.45)
    for r in range(radius, 0, -6):
        pct = 1.0 - (r / radius)
        alpha = int(75 * (pct ** 1.6))
        glow_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*glow_rgb, alpha))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(14))
    canvas = Image.alpha_composite(canvas, glow_layer)
    
    # 2. Golden / Cyan volumetric light rays from the open box upward
    rays = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(rays)
    origin_x, origin_y = W // 2, int(H * 0.68)
    for i in range(16):
        ang = -math.pi / 2 + (i - 7.5) * (math.pi / 9.5)
        length = W * 0.55
        x2 = origin_x + length * math.cos(ang)
        y2 = origin_y + length * math.sin(ang)
        r_draw.polygon([
            (origin_x - 4, origin_y),
            (origin_x + 4, origin_y),
            (x2 + 18, y2),
            (x2 - 18, y2)
        ], fill=(*glow_rgb, 24))
    rays = rays.filter(ImageFilter.GaussianBlur(10))
    canvas = Image.alpha_composite(canvas, rays)
    
    # 3. Load Open Box
    box_im = Image.open(box_path).convert('RGBA')
    max_box_w = int(W * 0.76)
    max_box_h = int(H * 0.46)
    box_scale = min(max_box_w / box_im.width, max_box_h / box_im.height)
    box_w = int(box_im.width * box_scale)
    box_h = int(box_im.height * box_scale)
    box_im = box_im.resize((box_w, box_h), Image.Resampling.LANCZOS)
    box_x = (W - box_w) // 2
    box_y = H - box_h - int(H * 0.04)
    
    # 4. Load Telegram Gift
    gift_im = Image.open(gift_path).convert('RGBA')
    max_gift_w = int(W * 0.58)
    max_gift_h = int(H * 0.50)
    gift_scale = min(max_gift_w / gift_im.width, max_gift_h / gift_im.height)
    gift_w = int(gift_im.width * gift_scale)
    gift_h = int(gift_im.height * gift_scale)
    gift_im = gift_im.resize((gift_w, gift_h), Image.Resampling.LANCZOS)
    
    gift_x = (W - gift_w) // 2
    # The gift hovers directly over and emerging from the box opening
    gift_y = box_y - int(gift_h * 0.52)
    if gift_y < int(H * 0.03):
        gift_y = int(H * 0.03)
        
    # 5. Gift soft aura / glow ring around the NFT
    aura = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    a_draw = ImageDraw.Draw(aura)
    gcx = gift_x + gift_w // 2
    gcy = gift_y + gift_h // 2
    gr = int(max(gift_w, gift_h) * 0.55)
    for r in range(gr, 0, -4):
        pct = 1.0 - (r / gr)
        a_draw.ellipse([gcx - r, gcy - r, gcx + r, gcy + r], fill=(*glow_rgb, int(55 * pct)))
    aura = aura.filter(ImageFilter.GaussianBlur(12))
    canvas = Image.alpha_composite(canvas, aura)
    
    # 6. Draw Box first (base)
    canvas.paste(box_im, (box_x, box_y), box_im)
    
    # 7. Draw Gift rising out (layered over box opening)
    canvas.paste(gift_im, (gift_x, gift_y), gift_im)
    
    # 8. Floating energy particles & 4-point lens sparkles
    sp_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(sp_layer)
    sparkles = [
        (int(W * 0.16), int(H * 0.28), 9, 230),
        (int(W * 0.84), int(H * 0.22), 11, 240),
        (int(W * 0.24), int(H * 0.55), 6, 190),
        (int(W * 0.78), int(H * 0.52), 8, 210),
        (int(W * 0.50), int(H * 0.07), 10, 255),
        (int(W * 0.35), int(H * 0.14), 5, 170),
        (int(W * 0.65), int(H * 0.16), 6, 180),
    ]
    for sx, sy, sr, sa in sparkles:
        sp_draw.line([sx - sr, sy, sx + sr, sy], fill=(255, 255, 255, sa), width=2)
        sp_draw.line([sx, sy - sr, sx, sy + sr], fill=(255, 255, 255, sa), width=2)
        sp_draw.polygon([
            (sx, sy - 3), (sx + 3, sy), (sx, sy + 3), (sx - 3, sy)
        ], fill=(255, 255, 255, sa))
        sp_draw.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(*glow_rgb, int(sa * 0.4)))
    sp_layer = sp_layer.filter(ImageFilter.GaussianBlur(1))
    canvas = Image.alpha_composite(canvas, sp_layer)
    
    return canvas

# Cases definition matching catalog.ts
CASE_SPECS = [
    {
        'id': 'farm',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100271.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/scaredcat.png',
        'glow': '#46d97b'
    },
    {
        'id': 'autumn',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100278.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/xmasstocking.png',
        'glow': '#ff9f2e'
    },
    {
        'id': 'movie',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100285.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/minioscar.png',
        'glow': '#ff5d5d'
    },
    {
        'id': 'telegram',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100270.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/durovscap.png',
        'glow': '#3ba7ff'
    },
    {
        'id': 'space',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100276.png',
        'gift': 'public/gifts/png/space_rocket.png',
        'glow': '#8b5cf6'
    },
    {
        'id': 'magic',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100276.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/magicpotion.png',
        'glow': '#a855f7'
    },
    {
        'id': 'kitty',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100274.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/scaredcat.png',
        'glow': '#ff7ad9'
    },
    {
        'id': 'adult18',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100256.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/heartlocket.png',
        'glow': '#ff4d6d'
    },
    {
        'id': 'money',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG130.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/lootbag.png',
        'glow': '#2fbf6a'
    },
    {
        'id': 'onyx-black',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100282.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/chillflame.png',
        'glow': '#7c5cff'
    },
    {
        'id': 'snoop',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG115.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/lowrider.png',
        'glow': '#ffc93c'
    },
    {
        'id': 'peach',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100280.png',
        'gift': 'public/gifts/png/pink_heart_box.png',
        'glow': '#ffb07a'
    },
    {
        'id': 'gem',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG155.png',
        'gift': 'public/gifts/png/blue_diamond_gem.png',
        'glow': '#38e1ff'
    },
    {
        'id': 'pepe',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100272.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/plushpepe.png',
        'glow': '#6ee36e'
    },
    {
        'id': 'cap',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100270.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/durovscap.png',
        'glow': '#a3d94c'
    },
    {
        'id': 'ring',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100284.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/diamondring.png',
        'glow': '#ffc93c'
    },
    {
        'id': 'black',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100282.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/resistancedog.png',
        'glow': '#6d28d9'
    },
    {
        'id': 'epic',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG124.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/crystalball.png',
        'glow': '#8b5cf6'
    },
    {
        'id': 'vip',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG130.png',
        'gift': 'public/gifts/png/golden_trophy.png',
        'glow': '#ffc93c'
    },
    {
        'id': 'elite',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG159.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/astralshard.png',
        'glow': '#ff9d0b'
    },
    {
        'id': 'free',
        'box': 'scripts/internet_assets/open_boxes/gift_PNG100271.png',
        'gift': 'scripts/internet_assets/telegram_gifts_clean/freshsocks.png',
        'glow': '#b7a4f9'
    },
    {
        'id': 'free24',
        'box': 'scripts/internet_assets/open_boxes/treasure_chest_PNG40.png',
        'gift': 'public/gifts/png/golden_trophy.png',
        'glow': '#ffc93c'
    },
]

out_cases_dir = 'public/cases'
os.makedirs(out_cases_dir, exist_ok=True)

print(f'Starting generation of {len(CASE_SPECS)} cases...')

for spec in CASE_SPECS:
    cid = spec['id']
    box = spec['box']
    gift = spec['gift']
    glow = hex_to_rgb(spec['glow'])
    
    png_path = os.path.join(out_cases_dir, f'{cid}.png')
    svg_path = os.path.join(out_cases_dir, f'{cid}.svg')
    
    # 1. Render composite image
    img = render_loot_drop(box, gift, glow_rgb=glow, canvas_size=(512, 512))
    img.save(png_path, 'PNG', optimize=True)
    
    # 2. Encode to base64 for self-contained SVG
    with open(png_path, 'rb') as f:
        b64_data = base64.b64encode(f.read()).decode('utf-8')
        
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Open 3D Case with Telegram Gift/NFT -->
  <image href="data:image/png;base64,{b64_data}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>
'''
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
        
    print(f'Generated case [{cid}]: PNG ({os.path.getsize(png_path)} B), SVG ({os.path.getsize(svg_path)} B)')

print('All 22 cases successfully generated!')
