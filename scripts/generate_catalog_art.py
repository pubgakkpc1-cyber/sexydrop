"""Генератор SVG-арта каталога: подарки (public/gifts) и обложки кейсов (public/cases)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

# name: (цвет, тень, svg-арт)
GIFTS = {
    "fresh-socks": ("#a5b4fc", "#4338ca", '<path d="M38 18h22v28c0 14 16 14 16 24l-8 14c-14-2-32-10-30-28Z" fill="#e0e7ff"/><path d="M38 18h22v10H38Z" fill="#818cf8"/><circle cx="52" cy="66" r="4" fill="#6366f1"/>'),
    "scared-cat": ("#94a3b8", "#475569", '<path d="m30 34 4-16 14 10Z" fill="#cbd5e1"/><path d="m70 34-4-16-14 10Z" fill="#cbd5e1"/><circle cx="50" cy="55" r="26" fill="#e2e8f0"/><circle cx="41" cy="50" r="3.5" fill="#1e293b"/><circle cx="59" cy="50" r="3.5" fill="#1e293b"/><path d="M50 58v5m0 0-4 4m4-4 4 4" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/><path d="M28 56h10m24 0h10M28 62h10m24 0h10" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>'),
    "instant-ramen": ("#fca5a5", "#b91c1c", '<path d="M24 52h52c0 20-10 30-26 30S24 72 24 52Z" fill="#fecaca"/><path d="M30 52c8-6 14 4 20-2s12 4 20-2" stroke="#dc2626" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M60 14 44 40M68 16 54 40" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"/><path d="M38 20c2-4 6-4 8 0m10-2c2-4 6-4 8 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>'),
    "chill-flame": ("#fda4af", "#be123c", '<path d="M50 14c10 14 24 20 24 38a24 24 0 1 1-48 0c0-12 8-18 12-28 3 8 8 10 12 4 3-5 3-9 0-14Z" fill="#fecdd3"/><path d="M50 46c5 7 10 10 10 18a10 10 0 1 1-20 0c0-6 5-9 10-18Z" fill="#fb7185"/>'),
    "xmas-stocking": ("#f87171", "#991b1b", '<path d="M38 16h20v34l16 12c6 5 4 14-3 17l-16 6c-10 4-17-4-17-14Z" fill="#fca5a5"/><rect x="34" y="10" width="28" height="10" rx="4" fill="#fef2f2"/><circle cx="72" cy="72" r="6" fill="#fef2f2"/>'),
    "holiday-gift": ("#f9a8d4", "#be185d", '<rect x="24" y="38" width="52" height="44" rx="6" fill="#fbcfe8"/><rect x="20" y="26" width="60" height="16" rx="4" fill="#f472b6"/><path d="M50 26v56M35 26c-8-12 6-18 15-6 9-12 23-6 15 6" fill="none" stroke="#9d174d" stroke-width="5" stroke-linecap="round"/>'),
    "heart-locket": ("#fb7185", "#9f1239", '<circle cx="50" cy="55" r="26" fill="none" stroke="#fecdd3" stroke-width="7"/><path d="M50 66c-7-6-13-11-13-18 0-8 10-10 13-3 3-7 13-5 13 3 0 7-6 12-13 18Z" fill="#fda4af"/><circle cx="50" cy="24" r="4" fill="#fecdd3"/>'),
    "magic-potion": ("#c4b5fd", "#6d28d9", '<path d="M44 16h12v16l14 24c6 10-1 24-13 24H43c-12 0-19-14-13-24l14-24Z" fill="#ddd6fe"/><path d="M36 58c4-6 24-6 28 0 3 8-2 14-11 14H47c-9 0-14-6-11-14Z" fill="#8b5cf6"/><circle cx="47" cy="52" r="3" fill="#ede9fe"/><circle cx="56" cy="48" r="2.5" fill="#ede9fe"/>'),
    "resistance-dog": ("#fdba74", "#c2410c", '<path d="M24 38c-6-10-2-20 8-18l8 8Z" fill="#fed7aa"/><path d="m76 38 6-18c10-2 14 8 8 18Z" fill="#fed7aa" transform="scale(-1,1) translate(-160,0)"/><circle cx="50" cy="55" r="27" fill="#fdba74"/><circle cx="41" cy="50" r="3.5" fill="#431407"/><circle cx="59" cy="50" r="3.5" fill="#431407"/><path d="M46 62q4 4 8 0" stroke="#431407" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="58" rx="4" ry="3" fill="#431407"/>'),
    "cyber-helmet": ("#7dd3fc", "#0369a1", '<path d="M26 58c0-18 10-32 24-32s24 14 24 32v6H26Z" fill="#bae6fd"/><path d="M30 58c0-14 8-26 20-26s20 12 20 26Z" fill="#0ea5e9"/><path d="M30 58h40v6H30Z" fill="#0369a1"/><path d="m36 50 10-12m4 8 8-10" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round" opacity=".8"/>'),
    "astral-shard": ("#67e8f9", "#0e7490", '<path d="m50 12 16 24-16 52-16-52Z" fill="#a5f3fc"/><path d="m50 12 16 24-16 12Z" fill="#cffafe"/><path d="m34 36 16 12 16-12" fill="none" stroke="#e0f2fe" stroke-width="2.5" opacity=".8"/><path d="M50 24v76" stroke="#e0f2fe" stroke-width="2" opacity=".5"/>'),
    "durovs-cap": ("#93c5fd", "#1d4ed8", '<path d="M24 58c0-16 12-28 26-28s26 12 26 28Z" fill="#3b82f6"/><path d="M24 58h52v6H24Z" fill="#1e40af"/><path d="M18 64h48c4 0 6 4 2 6-14 6-38 6-50 0-4-2-4-6 0-6Z" fill="#1d4ed8"/><circle cx="50" cy="30" r="4" fill="#93c5fd"/>'),
    "diamond-ring": ("#fde047", "#a16207", '<circle cx="50" cy="57" r="22" fill="none" stroke="#fef08a" stroke-width="8"/><path d="m38 30 6-10h12l6 10-12 11Z" fill="#e0f2fe"/><path d="m38 30 12 2 12-2M44 20l6 12 6-12" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>'),
    "neon-dream": ("#d8b4fe", "#7e22ce", '<path d="M50 50m-26 0a26 26 0 1 1 52 0" fill="none" stroke="#e9d5ff" stroke-width="6" stroke-linecap="round"/><path d="M50 50m-16 0a16 16 0 1 0 32 0" fill="none" stroke="#c084fc" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="50" r="6" fill="#f5d0fe"/><circle cx="76" cy="26" r="3" fill="#fff"/><circle cx="22" cy="74" r="2.5" fill="#fff"/>'),
    "plush-pepe": ("#86efac", "#15803d", '<ellipse cx="50" cy="58" rx="30" ry="24" fill="#4ade80"/><circle cx="34" cy="36" r="11" fill="#4ade80"/><circle cx="66" cy="36" r="11" fill="#4ade80"/><circle cx="34" cy="36" r="6" fill="#fde047"/><circle cx="66" cy="36" r="6" fill="#fde047"/><circle cx="34" cy="36" r="2.8" fill="#052e16"/><circle cx="66" cy="36" r="2.8" fill="#052e16"/><path d="M30 62q20 14 40 0" stroke="#052e16" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="43" cy="54" r="3" fill="#052e16"/><circle cx="57" cy="54" r="3" fill="#052e16"/>'),
    "crystal-ball": ("#a5f3fc", "#155e75", '<circle cx="50" cy="44" r="26" fill="#cffafe" opacity=".9"/><path d="M42 34c-4 4-6 8-6 14" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M32 74h36l-6-8H38Z" fill="#0e7490"/><path d="m64 26 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="#fff" opacity=".9"/>'),
    "golden-trophy": ("#fcd34d", "#b45309", '<path d="M32 18h36v22c0 17-8 26-18 26s-18-9-18-26Z" fill="#fde047"/><path d="M32 25H19c0 18 7 25 19 25M68 25h13c0 18-7 25-19 25" fill="none" stroke="#facc15" stroke-width="7"/><path d="M50 66v12M35 82h30" stroke="#fde047" stroke-width="8" stroke-linecap="round"/><path d="m50 27 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#fef9c3"/>'),
    "astral-crown": ("#fbbf24", "#92400e", '<path d="m22 34 14 12 14-24 14 24 14-12-7 40H29Z" fill="#fde047"/><path d="M29 66h42v9H29Z" fill="#f59e0b"/><circle cx="50" cy="54" r="5" fill="#a855f7"/><circle cx="35" cy="58" r="3.5" fill="#38bdf8"/><circle cx="65" cy="58" r="3.5" fill="#fb7185"/><circle cx="50" cy="22" r="3" fill="#fff"/>'),
    "golden-pepe": ("#fde047", "#a16207", '<ellipse cx="50" cy="58" rx="30" ry="24" fill="#facc15"/><circle cx="34" cy="36" r="11" fill="#facc15"/><circle cx="66" cy="36" r="11" fill="#facc15"/><circle cx="34" cy="36" r="6" fill="#fff7ae"/><circle cx="66" cy="36" r="6" fill="#fff7ae"/><circle cx="34" cy="36" r="2.8" fill="#422006"/><circle cx="66" cy="36" r="2.8" fill="#422006"/><path d="M30 62q20 14 40 0" stroke="#422006" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="43" cy="54" r="3" fill="#422006"/><circle cx="57" cy="54" r="3" fill="#422006"/><path d="m76 20 2.5 5.5L84 28l-5.5 2.5L76 36l-2.5-5.5L68 28l5.5-2.5Z" fill="#fff" opacity=".85"/>'),
}

# id: (цвет, тень, буква)
CASES = {
    "farm": ("#4ade80", "#166534", "F"),
    "autumn": ("#fb923c", "#9a3412", "A"),
    "movie": ("#60a5fa", "#1e40af", "M"),
    "telegram": ("#38bdf8", "#075985", "T"),
    "space": ("#818cf8", "#3730a3", "S"),
    "magic": ("#c084fc", "#6b21a8", "M"),
    "kitty": ("#f9a8d4", "#9d174d", "K"),
    "adult18": ("#f87171", "#991b1b", "18"),
    "money": ("#fbbf24", "#92400e", "$"),
    "onyx-black": ("#64748b", "#0f172a", "O"),
    "snoop": ("#a3e635", "#3f6212", "S"),
    "peach": ("#fda4af", "#be123c", "P"),
    "gem": ("#22d3ee", "#155e75", "G"),
    "pepe": ("#4ade80", "#14532d", "P"),
    "cap": ("#3b82f6", "#1e3a8a", "C"),
    "ring": ("#e2e8f0", "#475569", "R"),
    "black": ("#a78bfa", "#1e1b4b", "B"),
    "epic": ("#a855f7", "#581c87", "E"),
    "vip": ("#fbbf24", "#78350f", "V"),
    "elite": ("#e2e8f0", "#334155", "E"),
    "free": ("#34d399", "#065f46", "F"),
    "free24": ("#facc15", "#713f12", "24"),
}

TEMPLATE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title">
<title>{title}</title><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{color}"/><stop offset="1" stop-color="{shade}"/></linearGradient><radialGradient id="glow"><stop stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="100" height="100" rx="24" fill="{shade}"/><circle cx="50" cy="43" r="43" fill="url(#glow)"/><g fill="{color}" stroke-linejoin="round">{art}</g></svg>'''

CASE_ART = '''<path d="m18 36 32-15 32 15-32 16Z" fill="{color}"/><path d="m18 36 32 16v35L18 69Z" fill="{shade}"/><path d="m82 36-32 16v35l32-18Z" fill="{color}" opacity=".72"/><path d="m39 27 32 16-10 5-32-16Z" fill="#fff" opacity=".5"/><text x="50" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-size="{font}" font-weight="700" fill="#fff">{letter}</text>'''

for name, (color, shade, art) in GIFTS.items():
    target = ROOT / "gifts" / f"{name}.svg"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(TEMPLATE.format(title=name, color=color, shade=shade, art=art), encoding="utf-8")

for name, (color, shade, letter) in CASES.items():
    font = 25 if len(letter) == 1 else 19
    art = CASE_ART.format(color=color, shade=shade, letter=letter, font=font)
    target = ROOT / "cases" / f"{name}.svg"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(TEMPLATE.format(title=name, color=color, shade=shade, art=art), encoding="utf-8")

print(f"gifts: {len(GIFTS)}, cases: {len(CASES)}")
