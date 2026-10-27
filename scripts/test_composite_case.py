import os
import math
from PIL import Image, ImageFilter, ImageDraw

def composite_case(box_path, gift_path, out_path, glow_rgb=(59, 167, 255), canvas_size=(512, 512)):
    # Create RGBA canvas
    canvas = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    W, H = canvas_size
    
    # 1. Back ambient glow (Apple soft diffuse radial glow)
    glow_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    cx, cy = W // 2, int(H * 0.58)
    radius = int(W * 0.38)
    for r in range(radius, 0, -8):
        alpha = int(45 * (1.0 - (r / radius) ** 1.5))
        glow_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*glow_rgb, alpha))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(18))
    canvas = Image.alpha_composite(canvas, glow_layer)
    
    # 2. Light rays / aura bursting upwards from inside the open box
    ray_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    ray_draw = ImageDraw.Draw(ray_layer)
    ray_origin = (W // 2, int(H * 0.65))
    num_rays = 12
    for i in range(num_rays):
        angle = -math.pi / 2 + (i - num_rays / 2) * (math.pi / 7)
        length = W * 0.42
        x2 = ray_origin[0] + length * math.cos(angle)
        y2 = ray_origin[1] + length * math.sin(angle)
        ray_draw.line([ray_origin, (x2, y2)], fill=(255, 255, 255, 30), width=6)
    ray_layer = ray_layer.filter(ImageFilter.GaussianBlur(8))
    canvas = Image.alpha_composite(canvas, ray_layer)
    
    # 3. Open Box (bottom / base layer)
    box_im = Image.open(box_path).convert('RGBA')
    # Scale box to fill bottom ~55-60% of canvas
    box_target_w = int(W * 0.78)
    box_scale = box_target_w / box_im.width
    box_w = box_target_w
    box_h = int(box_im.height * box_scale)
    if box_h > int(H * 0.58):
        box_h = int(H * 0.58)
        box_w = int(box_im.width * (box_h / box_im.height))
    box_im = box_im.resize((box_w, box_h), Image.Resampling.LANCZOS)
    box_x = (W - box_w) // 2
    box_y = H - box_h - int(H * 0.05)
    
    # 4. Telegram NFT Gift (floating out of the box, positioned at upper-middle)
    gift_im = Image.open(gift_path).convert('RGBA')
    gift_target_w = int(W * 0.55)
    gift_scale = gift_target_w / gift_im.width
    gift_w = gift_target_w
    gift_h = int(gift_im.height * gift_scale)
    if gift_h > int(H * 0.52):
        gift_h = int(H * 0.52)
        gift_w = int(gift_im.width * (gift_h / gift_im.height))
    gift_im = gift_im.resize((gift_w, gift_h), Image.Resampling.LANCZOS)
    
    gift_x = (W - gift_w) // 2
    # Gift floats above/inside the opening
    gift_y = box_y - int(gift_h * 0.42)
    if gift_y < int(H * 0.04):
        gift_y = int(H * 0.04)
        
    # 5. Gift soft drop shadow / under-glow
    shadow_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    s_cx = W // 2
    s_cy = box_y + int(box_h * 0.2)
    s_rx = int(gift_w * 0.35)
    s_ry = int(s_rx * 0.3)
    s_draw.ellipse([s_cx - s_rx, s_cy - s_ry, s_cx + s_rx, s_cy + s_ry], fill=(*glow_rgb, 120))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(10))
    canvas = Image.alpha_composite(canvas, shadow_layer)
    
    # 6. Composite the Gift (drawn so it emerges from the box)
    canvas.paste(gift_im, (gift_x, gift_y), gift_im)
    
    # 7. Composite the Open Box (drawn over lower part of gift so it looks inside)
    # To make it look like it's inside: we paste the box, but if the box has transparency in its opening, the gift shows through!
    # If the box is solid front, pasting it covers the lower tip of the gift perfectly!
    canvas.paste(box_im, (box_x, box_y), box_im)
    
    # 8. Extra sparkles / stars floating around
    sparkles = [
        (int(W * 0.22), int(H * 0.25), 8, 220),
        (int(W * 0.78), int(H * 0.22), 10, 240),
        (int(W * 0.82), int(H * 0.45), 6, 180),
        (int(W * 0.18), int(H * 0.48), 7, 190),
        (int(W * 0.5), int(H * 0.08), 9, 255),
    ]
    sp_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(sp_layer)
    for sx, sy, sr, sa in sparkles:
        # Cross sparkle
        sp_draw.line([sx - sr, sy, sx + sr, sy], fill=(255, 255, 255, sa), width=2)
        sp_draw.line([sx, sy - sr, sx, sy + sr], fill=(255, 255, 255, sa), width=2)
        # Core dot
        sp_draw.ellipse([sx - 2, sy - 2, sx + 2, sy + 2], fill=(255, 255, 255, sa))
    sp_layer = sp_layer.filter(ImageFilter.GaussianBlur(1))
    canvas = Image.alpha_composite(canvas, sp_layer)
    
    canvas.save(out_path, 'PNG')
    print('Generated composite case:', out_path)

if __name__ == '__main__':
    box = 'scripts/internet_assets/open_boxes/gift_PNG100270.png'
    gift = 'scripts/internet_assets/telegram_gifts_clean/durovscap.png'
    os.makedirs('scripts/test_cases', exist_ok=True)
    composite_case(box, gift, 'scripts/test_cases/cap_test.png', glow_rgb=(59, 167, 255))
