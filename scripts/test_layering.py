import os
import math
from PIL import Image, ImageFilter, ImageDraw

def render_loot_drop(box_path, gift_path, out_path, glow_rgb=(59, 167, 255), canvas_size=(512, 512)):
    W, H = canvas_size
    canvas = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    
    # 1. Radiant backdrop glow (Apple ambient glass bloom)
    glow_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    cx, cy = W // 2, int(H * 0.48)
    radius = int(W * 0.45)
    for r in range(radius, 0, -6):
        pct = 1.0 - (r / radius)
        alpha = int(70 * (pct ** 1.6))
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
        ], fill=(*glow_rgb, 22))
    rays = rays.filter(ImageFilter.GaussianBlur(10))
    canvas = Image.alpha_composite(canvas, rays)
    
    # 3. Load Open Box
    box_im = Image.open(box_path).convert('RGBA')
    # Fit box nicely in the lower 50%
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
    # Fit gift in upper-middle 55%
    max_gift_w = int(W * 0.58)
    max_gift_h = int(H * 0.50)
    gift_scale = min(max_gift_w / gift_im.width, max_gift_h / gift_im.height)
    gift_w = int(gift_im.width * gift_scale)
    gift_h = int(gift_im.height * gift_scale)
    gift_im = gift_im.resize((gift_w, gift_h), Image.Resampling.LANCZOS)
    
    gift_x = (W - gift_w) // 2
    # The gift hovers directly over and emerging from the box opening
    gift_y = box_y - int(gift_h * 0.55)
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
        a_draw.ellipse([gcx - r, gcy - r, gcx + r, gcy + r], fill=(*glow_rgb, int(50 * pct)))
    aura = aura.filter(ImageFilter.GaussianBlur(12))
    canvas = Image.alpha_composite(canvas, aura)
    
    # 6. Draw Box first (base)
    canvas.paste(box_im, (box_x, box_y), box_im)
    
    # 7. Draw Gift rising out (layered over box so the full NFT item is crisp and visible)
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
        # Cross flare
        sp_draw.line([sx - sr, sy, sx + sr, sy], fill=(255, 255, 255, sa), width=2)
        sp_draw.line([sx, sy - sr, sx, sy + sr], fill=(255, 255, 255, sa), width=2)
        # Diamond core
        sp_draw.polygon([
            (sx, sy - 3), (sx + 3, sy), (sx, sy + 3), (sx - 3, sy)
        ], fill=(255, 255, 255, sa))
        # Halo
        sp_draw.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(*glow_rgb, int(sa * 0.4)))
    sp_layer = sp_layer.filter(ImageFilter.GaussianBlur(1))
    canvas = Image.alpha_composite(canvas, sp_layer)
    
    canvas.save(out_path, 'PNG')
    print('Rendered:', out_path)

if __name__ == '__main__':
    tests = [
        ('cap', 'scripts/internet_assets/open_boxes/gift_PNG100270.png', 'scripts/internet_assets/telegram_gifts_clean/durovscap.png', (59, 167, 255)),
        ('pepe', 'scripts/internet_assets/open_boxes/gift_PNG100272.png', 'scripts/internet_assets/telegram_gifts_clean/plushpepe.png', (110, 227, 110)),
        ('vip', 'scripts/internet_assets/open_boxes/treasure_chest_PNG130.png', 'public/gifts/png/golden_trophy.png', (255, 201, 60)),
        ('magic', 'scripts/internet_assets/open_boxes/gift_PNG100276.png', 'scripts/internet_assets/telegram_gifts_clean/magicpotion.png', (168, 85, 247)),
        ('space', 'scripts/internet_assets/open_boxes/gift_PNG100276.png', 'scripts/internet_assets/telegram_gifts_clean/astralshard.png', (139, 92, 246)),
        ('ring', 'scripts/internet_assets/open_boxes/gift_PNG100284.png', 'scripts/internet_assets/telegram_gifts_clean/diamondring.png', (255, 201, 60)),
        ('adult18', 'scripts/internet_assets/open_boxes/gift_PNG100256.png', 'scripts/internet_assets/telegram_gifts_clean/heartlocket.png', (255, 77, 109)),
        ('free', 'scripts/internet_assets/open_boxes/gift_PNG100271.png', 'scripts/internet_assets/telegram_gifts_clean/freshsocks.png', (70, 217, 123)),
    ]
    os.makedirs('scripts/test_cases', exist_ok=True)
    for name, b, g, glow in tests:
        render_loot_drop(b, g, f'scripts/test_cases/{name}_sample.png', glow_rgb=glow)
