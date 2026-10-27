import fs from 'node:fs'
import path from 'node:path'

const CASES_DIR = path.resolve('public/cases')

// Definitions of all 22 cases with their Apple Glass color palettes and inner 3D emblems
const CASE_DATA = {
  free: {
    name: 'FREE',
    primary: '#10b981',
    secondary: '#059669',
    accent: '#34d399',
    dark: '#022c22',
    glow: '#10b981',
    emblem: `
      <!-- 3D Emerald Gift Box with Silk Ribbon -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="28" ry="7" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Box Base -->
        <path d="M-22 0 L0 12 L22 0 L0 -12 Z" fill="#34d399"/>
        <path d="M-22 0 L0 12 V28 L-22 16 Z" fill="#059669"/>
        <path d="M22 0 L0 12 V28 L22 16 Z" fill="#047857"/>
        <!-- Ribbon Horizontal & Vertical -->
        <path d="M-5 9.5 L0 12 L5 9.5 V28 L0 28 V12 Z" fill="#fef08a"/>
        <path d="M-22 5 L-12 10.5 V21.5 L-22 16 Z" fill="#fef08a" opacity="0.85"/>
        <path d="M22 5 L12 10.5 V21.5 L22 16 Z" fill="#fde047" opacity="0.85"/>
        <!-- Ribbon Top -->
        <path d="M-5 -2.5 L0 0 L5 -2.5 L0 -5 Z" fill="#fef08a"/>
        <path d="M-11 -6 L-6 -3.5 L6 -9.5 L1 -12 Z" fill="#fef08a" opacity="0.9"/>
        <!-- Bow Knot & Loops -->
        <ellipse cx="-8" cy="-14" rx="8" ry="5" fill="#fde047" transform="rotate(-30 -8 -14)"/>
        <ellipse cx="8" cy="-14" rx="8" ry="5" fill="#fef08a" transform="rotate(30 8 -14)"/>
        <circle cx="0" cy="-12" r="4.5" fill="#eab308"/>
        <!-- Sparkles -->
        <path d="M-20 -15 L-18 -10 L-13 -8 L-18 -6 L-20 -1 L-22 -6 L-27 -8 L-22 -10 Z" fill="#fff" opacity="0.9"/>
        <path d="M22 -10 L23 -6 L27 -5 L23 -4 L22 0 L21 -4 L17 -5 L21 -6 Z" fill="#a7f3d0" opacity="0.85"/>
      </g>
    `
  },
  free24: {
    name: 'FREE 24',
    primary: '#f59e0b',
    secondary: '#d97706',
    accent: '#fbbf24',
    dark: '#451a03',
    glow: '#f59e0b',
    emblem: `
      <!-- 3D Gold Vault with 24H Dial -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="28" rx="28" ry="7" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Gold Vault Body -->
        <rect x="-24" y="-18" width="48" height="42" rx="10" fill="url(#gold-vault-grad)" stroke="#fef08a" stroke-width="1.5"/>
        <!-- Dial Outer Ring -->
        <circle cx="0" cy="3" r="16" fill="#78350f" stroke="#fbbf24" stroke-width="2.5"/>
        <circle cx="0" cy="3" r="12" fill="url(#gold-dial-grad)"/>
        <!-- 24 text -->
        <text x="0" y="8" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-weight="900" font-size="13" fill="#451a03">24</text>
        <!-- Stars & Bolts -->
        <circle cx="-16" cy="-10" r="1.8" fill="#fef08a"/>
        <circle cx="16" cy="-10" r="1.8" fill="#fef08a"/>
        <circle cx="-16" cy="16" r="1.8" fill="#fef08a"/>
        <circle cx="16" cy="16" r="1.8" fill="#fef08a"/>
        <!-- Sunburst Rays -->
        <path d="M0 -22 L0 -26 M18 -14 L21 -17 M22 3 L26 3 M-18 -14 L-21 -17 M-22 3 L-26 3" stroke="#fef08a" stroke-width="2" stroke-linecap="round"/>
      </g>
    `
  },
  farm: {
    name: 'Farm',
    primary: '#22c55e',
    secondary: '#15803d',
    accent: '#86efac',
    dark: '#052e16',
    glow: '#22c55e',
    emblem: `
      <!-- 3D Biosphere Sprout & Golden Wheat -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Soil Pod -->
        <ellipse cx="0" cy="16" rx="22" ry="8" fill="#713f12" stroke="#854d0e" stroke-width="1.5"/>
        <ellipse cx="0" cy="14" rx="18" ry="6" fill="#a16207"/>
        <!-- Sprout Stems -->
        <path d="M-3 14 C-4 5 -12 -4 -16 -10 C-10 -12 0 -2 0 14" fill="#4ade80" stroke="#16a34a" stroke-width="1"/>
        <path d="M3 14 C4 3 14 -6 20 -12 C12 -14 0 -2 0 14" fill="#86efac" stroke="#22c55e" stroke-width="1"/>
        <!-- Golden Wheat Spike -->
        <path d="M0 14 V-18" stroke="#fde047" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="-4" cy="-8" rx="4" ry="2.5" fill="#facc15" transform="rotate(-30 -4 -8)"/>
        <ellipse cx="4" cy="-11" rx="4" ry="2.5" fill="#fde047" transform="rotate(30 4 -11)"/>
        <ellipse cx="-4" cy="-16" rx="4" ry="2.5" fill="#facc15" transform="rotate(-30 -4 -16)"/>
        <ellipse cx="4" cy="-19" rx="4" ry="2.5" fill="#fde047" transform="rotate(30 4 -19)"/>
        <circle cx="0" cy="-24" r="3" fill="#fef08a"/>
      </g>
    `
  },
  autumn: {
    name: 'Autumn',
    primary: '#f97316',
    secondary: '#c2410c',
    accent: '#fdba74',
    dark: '#431407',
    glow: '#f97316',
    emblem: `
      <!-- 3D Golden Maple Leaf with Amber Aura -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Back Glowing Leaves -->
        <path d="M0 -22 L8 -12 L18 -14 L14 -4 L24 2 L14 10 L16 20 L4 16 L0 26 L-4 16 L-16 20 L-14 10 L-24 2 L-14 -4 L-18 -14 L-8 -12 Z" fill="url(#autumn-leaf-grad)" stroke="#fef08a" stroke-width="1.2"/>
        <!-- Leaf Veins -->
        <path d="M0 24 V-14 M0 4 L10 -4 M0 10 L10 4 M0 4 L-10 -4 M0 10 L-10 4" stroke="#7c2d12" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
        <!-- Floating Sparks -->
        <circle cx="-16" cy="-16" r="2" fill="#fef08a"/>
        <circle cx="18" cy="-10" r="2.5" fill="#fed7aa"/>
        <circle cx="12" cy="18" r="1.5" fill="#fef08a"/>
      </g>
    `
  },
  movie: {
    name: 'Movie',
    primary: '#ef4444',
    secondary: '#b91c1c',
    accent: '#fca5a5',
    dark: '#450a0a',
    glow: '#ef4444',
    emblem: `
      <!-- 3D Hollywood Clapperboard & Neon Film -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Clapperboard Base -->
        <rect x="-24" y="-8" width="48" height="32" rx="4" fill="#18181b" stroke="#3f3f46" stroke-width="1.5"/>
        <rect x="-20" y="4" width="40" height="2" fill="#fff" opacity="0.6"/>
        <rect x="-20" y="12" width="24" height="2" fill="#fff" opacity="0.4"/>
        <!-- Clapper Top Sticks (Angled) -->
        <g transform="rotate(-18 -24 -8)">
          <rect x="-24" y="-18" width="48" height="10" rx="3" fill="#18181b" stroke="#71717a" stroke-width="1"/>
          <!-- Stripes -->
          <polygon points="-20,-18 -14,-18 -18,-8 -24,-8" fill="#f43f5e"/>
          <polygon points="-8,-18 -2,-18 -6,-8 -12,-8" fill="#f43f5e"/>
          <polygon points="4,-18 10,-18 6,-8 0,-8" fill="#f43f5e"/>
          <polygon points="16,-18 22,-18 18,-8 12,-8" fill="#f43f5e"/>
        </g>
        <!-- Golden Star on Board -->
        <path d="M0 12 L2 7 L7 7 L3 4 L5 -1 L0 2 L-5 -1 L-3 4 L-7 7 L-2 7 Z" fill="#fde047" transform="scale(0.8) translate(0, 8)"/>
      </g>
    `
  },
  telegram: {
    name: 'Telegram',
    primary: '#0ea5e9',
    secondary: '#0284c7',
    accent: '#38bdf8',
    dark: '#082f49',
    glow: '#0ea5e9',
    emblem: `
      <!-- 3D Telegram Paper Plane with Speed Trail -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Glowing Orbit Circle -->
        <circle cx="0" cy="0" r="26" fill="url(#tg-circle-grad)" opacity="0.25"/>
        <!-- 3D Paper Plane -->
        <g transform="rotate(-15) translate(-4, -2)">
          <path d="M-18 6 L24 -14 L6 16 Z" fill="#e0f2fe"/>
          <path d="M6 16 L24 -14 L-4 8 Z" fill="#bae6fd"/>
          <path d="M-4 8 L6 16 L1 22 Z" fill="#7dd3fc"/>
          <path d="M1 22 L6 16 L3 12 Z" fill="#38bdf8"/>
        </g>
        <!-- Sparkles -->
        <path d="M18 -14 L20 -10 L24 -8 L20 -6 L18 -2 L16 -6 L12 -8 L16 -10 Z" fill="#fff"/>
        <circle cx="-16" cy="14" r="2" fill="#7dd3fc"/>
      </g>
    `
  },
  space: {
    name: 'Space',
    primary: '#8b5cf6',
    secondary: '#6d28d9',
    accent: '#c4b5fd',
    dark: '#2e1065',
    glow: '#8b5cf6',
    emblem: `
      <!-- 3D Saturn with Neon Rings & Rocket -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Ring Back -->
        <ellipse cx="0" cy="2" rx="28" ry="8" fill="none" stroke="#a78bfa" stroke-width="4" opacity="0.5" transform="rotate(-18)"/>
        <!-- Planet Sphere -->
        <circle cx="0" cy="0" r="16" fill="url(#space-planet-grad)"/>
        <path d="M-14 -4 C-8 4 8 4 14 -4" stroke="#c4b5fd" stroke-width="2" fill="none" opacity="0.6"/>
        <!-- Ring Front -->
        <path d="M-26 10 C-18 20 18 10 26 -2" fill="none" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round" transform="rotate(-18)"/>
        <!-- Mini Rocket -->
        <g transform="translate(14, -14) rotate(45) scale(0.65)">
          <path d="M0 -14 C4 -10 6 0 6 10 H-6 C-6 0 -4 -10 0 -14 Z" fill="#f87171"/>
          <circle cx="0" cy="0" r="2.5" fill="#e0f2fe"/>
          <path d="M-6 8 L-10 14 L-6 12 Z" fill="#60a5fa"/>
          <path d="M6 8 L10 14 L6 12 Z" fill="#60a5fa"/>
        </g>
      </g>
    `
  },
  magic: {
    name: 'Magic',
    primary: '#a855f7',
    secondary: '#7e22ce',
    accent: '#e9d5ff',
    dark: '#3b0764',
    glow: '#a855f7',
    emblem: `
      <!-- 3D Potion Flask & Crystal Aura -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Magic Flask Body -->
        <path d="M-5 -16 H5 V-8 L16 12 C19 17 15 24 8 24 H-8 C-15 24 -19 17 -16 12 L-5 -8 Z" fill="url(#potion-glass-grad)" stroke="#d8b4fe" stroke-width="1.5"/>
        <!-- Liquid Inside -->
        <path d="M-13 14 C-15 18 -12 22 -6 22 H6 C12 22 15 18 13 14 C10 16 -10 12 -13 14 Z" fill="#c084fc"/>
        <!-- Cork Stopper -->
        <rect x="-4" y="-21" width="8" height="6" rx="1.5" fill="#a16207" stroke="#ca8a04"/>
        <!-- Bubbles & Sparkles -->
        <circle cx="-2" cy="16" r="2" fill="#fff" opacity="0.8"/>
        <circle cx="4" cy="10" r="1.5" fill="#fff" opacity="0.8"/>
        <path d="M-18 -8 L-16 -5 L-13 -4 L-16 -3 L-18 0 L-20 -3 L-23 -4 L-20 -5 Z" fill="#fef08a"/>
        <path d="M18 -10 L19 -7 L22 -6 L19 -5 L18 -2 L17 -5 L14 -6 L17 -7 Z" fill="#fef08a"/>
      </g>
    `
  },
  kitty: {
    name: 'Kitty',
    primary: '#ec4899',
    secondary: '#be185d',
    accent: '#f472b6',
    dark: '#500724',
    glow: '#ec4899',
    emblem: `
      <!-- 3D Cyber Kitty Helmet with Glowing Visor -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Helmet Base -->
        <circle cx="0" cy="3" r="18" fill="url(#kitty-helmet-grad)" stroke="#fbcfe8" stroke-width="1.5"/>
        <!-- Cat Ears -->
        <polygon points="-16,-6 -14,-22 -4,-12" fill="#f472b6" stroke="#fbcfe8" stroke-width="1.5"/>
        <polygon points="-13,-8 -12,-18 -6,-11" fill="#fb7185"/>
        <polygon points="16,-6 14,-22 4,-12" fill="#f472b6" stroke="#fbcfe8" stroke-width="1.5"/>
        <polygon points="13,-8 12,-18 6,-11" fill="#fb7185"/>
        <!-- Cyan Cyber Visor -->
        <path d="M-14 3 C-14 -3 14 -3 14 3 C14 9 -14 9 -14 3 Z" fill="#22d3ee" stroke="#67e8f9" stroke-width="1"/>
        <path d="M-10 1 H0" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
        <!-- Little Heart on Cheek -->
        <path d="M-6 13 C-8 11 -10 13 -10 15 C-10 17 -6 19 -6 19 C-6 19 -2 17 -2 15 C-2 13 -4 11 -6 13 Z" fill="#f43f5e" transform="scale(0.6) translate(-4, 4)"/>
      </g>
    `
  },
  adult18: {
    name: '18+',
    primary: '#f43f5e',
    secondary: '#e11d48',
    accent: '#fda4af',
    dark: '#4c0519',
    glow: '#f43f5e',
    emblem: `
      <!-- 3D Hot Magenta Flame & 18+ Crown -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Outer Flame -->
        <path d="M0 -22 C6 -14 18 -6 18 8 C18 18 10 24 0 24 C-10 24 -18 18 -18 8 C-18 -2 -10 -12 0 -22 Z" fill="url(#fire-flame-grad)" stroke="#fecdd3" stroke-width="1.2"/>
        <!-- Inner Core Flame -->
        <path d="M0 -8 C4 -2 10 2 10 10 C10 16 5 19 0 19 C-5 19 -10 16 -10 10 C-10 4 -4 0 0 -8 Z" fill="#fef08a"/>
        <!-- 18+ Bold Badge -->
        <rect x="-14" y="2" width="28" height="12" rx="4" fill="#18181b" stroke="#f43f5e" stroke-width="1.2"/>
        <text x="0" y="11" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-weight="900" font-size="9" fill="#fff">18+</text>
      </g>
    `
  },
  money: {
    name: 'Money',
    primary: '#10b981',
    secondary: '#047857',
    accent: '#6ee7b7',
    dark: '#022c22',
    glow: '#10b981',
    emblem: `
      <!-- 3D Gold Bars & Emerald Banknote -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Gold Bullion Stack -->
        <path d="M-18 12 L0 6 L18 12 L0 18 Z" fill="#facc15"/>
        <path d="M-18 12 L0 18 V24 L-18 18 Z" fill="#ca8a04"/>
        <path d="M18 12 L0 18 V24 L18 18 Z" fill="#a16207"/>
        <!-- Flying Dollar Bill -->
        <g transform="rotate(-15) translate(-4, -8)">
          <rect x="-18" y="-10" width="36" height="20" rx="3" fill="#34d399" stroke="#ecfdf5" stroke-width="1.2"/>
          <circle cx="0" cy="0" r="5" fill="#059669"/>
          <text x="0" y="3.5" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="900" font-size="10" fill="#fff">$</text>
        </g>
        <!-- Gold Coin Sparkles -->
        <circle cx="16" cy="-10" r="4" fill="#fef08a" stroke="#ca8a04" stroke-width="1"/>
        <circle cx="-16" cy="2" r="3.5" fill="#fef08a" stroke="#ca8a04" stroke-width="1"/>
      </g>
    `
  },
  'onyx-black': {
    name: 'Onyx Black',
    primary: '#4338ca',
    secondary: '#312e81',
    accent: '#818cf8',
    dark: '#1e1b4b',
    glow: '#6366f1',
    emblem: `
      <!-- 3D Onyx Crystal Prism with Violet Laser -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.4" filter="url(#blur-s)"/>
        <!-- Faceted Octahedron Prism -->
        <polygon points="0,-22 18,2 0,6" fill="#6366f1"/>
        <polygon points="0,-22 -18,2 0,6" fill="#4338ca"/>
        <polygon points="18,2 0,24 0,6" fill="#312e81"/>
        <polygon points="-18,2 0,24 0,6" fill="#1e1b4b"/>
        <!-- Glowing Edge Specular Highlights -->
        <line x1="0" y1="-22" x2="0" y2="24" stroke="#c7d2fe" stroke-width="1.5"/>
        <line x1="-18" y1="2" x2="18" y2="2" stroke="#a5b4fc" stroke-width="1.2"/>
        <circle cx="0" cy="6" r="3" fill="#fff"/>
      </g>
    `
  },
  snoop: {
    name: 'Snoop',
    primary: '#eab308',
    secondary: '#ca8a04',
    accent: '#fde047',
    dark: '#422006',
    glow: '#eab308',
    emblem: `
      <!-- 3D Golden Hip-Hop Crown & Glasses -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Crown Base -->
        <path d="M-20 6 L-24 -12 L-10 -4 L0 -16 L10 -4 L24 -12 L20 6 Z" fill="url(#snoop-crown-grad)" stroke="#fef08a" stroke-width="1.5"/>
        <rect x="-20" y="6" width="40" height="7" rx="2" fill="#ca8a04" stroke="#fde047" stroke-width="1"/>
        <!-- Jewels on Crown -->
        <circle cx="-16" cy="9.5" r="2" fill="#ef4444"/>
        <circle cx="0" cy="9.5" r="2.5" fill="#3b82f6"/>
        <circle cx="16" cy="9.5" r="2" fill="#22c55e"/>
        <circle cx="0" cy="-16" r="2" fill="#fff"/>
        <circle cx="-24" cy="-12" r="1.8" fill="#fff"/>
        <circle cx="24" cy="-12" r="1.8" fill="#fff"/>
      </g>
    `
  },
  peach: {
    name: 'Peach',
    primary: '#fb923c',
    secondary: '#ea580c',
    accent: '#fdba74',
    dark: '#431407',
    glow: '#fb923c',
    emblem: `
      <!-- 3D Ripe Velvet Peach with Leaf -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Peach Body -->
        <path d="M0 -6 C-6 -14 -20 -8 -18 6 C-16 18 -4 24 0 24 C4 24 16 18 18 6 C20 -8 6 -14 0 -6 Z" fill="url(#peach-body-grad)" stroke="#fed7aa" stroke-width="1.2"/>
        <!-- Peach Center Crease -->
        <path d="M0 -6 C-2 4 -2 14 0 24" stroke="#c2410c" stroke-width="1.2" opacity="0.4" fill="none"/>
        <!-- Green Leaf & Stem -->
        <path d="M0 -6 C4 -16 16 -18 20 -14 C16 -10 8 -8 0 -6" fill="#4ade80" stroke="#16a34a" stroke-width="1"/>
        <!-- Dew Drops -->
        <circle cx="-8" cy="4" r="1.5" fill="#fff" opacity="0.8"/>
      </g>
    `
  },
  gem: {
    name: 'Gem',
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#67e8f9',
    dark: '#083344',
    glow: '#06b6d4',
    emblem: `
      <!-- 3D Sparkling Cyan Brilliant Diamond -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Diamond Upper Table -->
        <polygon points="-12,-16 12,-16 20,-6 -20,-6" fill="#a5f3fc"/>
        <!-- Lower Facets -->
        <polygon points="-20,-6 0,22 0,-6" fill="#0891b2"/>
        <polygon points="20,-6 0,22 0,-6" fill="#06b6d4"/>
        <polygon points="-12,-16 0,-6 -20,-6" fill="#22d3ee"/>
        <polygon points="12,-16 0,-6 20,-6" fill="#67e8f9"/>
        <!-- Table Top -->
        <polygon points="-8,-16 8,-16 0,-6" fill="#cffafe"/>
        <!-- Specular Star Sparkle -->
        <path d="M12 -16 L14 -12 L18 -10 L14 -8 L12 -4 L10 -8 L6 -10 L10 -12 Z" fill="#fff"/>
        <circle cx="-14" cy="4" r="2" fill="#fff" opacity="0.9"/>
      </g>
    `
  },
  pepe: {
    name: 'Pepe',
    primary: '#84cc16',
    secondary: '#65a30d',
    accent: '#bef264',
    dark: '#1a2e05',
    glow: '#84cc16',
    emblem: `
      <!-- 3D Pepe Meme Frog Hologram with Gold Chain -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.3" filter="url(#blur-s)"/>
        <!-- Head -->
        <ellipse cx="0" cy="4" rx="22" ry="16" fill="url(#pepe-skin-grad)" stroke="#bef264" stroke-width="1.5"/>
        <!-- Big Eyes -->
        <circle cx="-9" cy="-8" r="8" fill="#fff" stroke="#4d7c0f" stroke-width="2"/>
        <circle cx="9" cy="-8" r="8" fill="#fff" stroke="#4d7c0f" stroke-width="2"/>
        <circle cx="-8" cy="-8" r="3.5" fill="#18181b"/>
        <circle cx="8" cy="-8" r="3.5" fill="#18181b"/>
        <circle cx="-7" cy="-9" r="1.2" fill="#fff"/>
        <circle cx="9" cy="-9" r="1.2" fill="#fff"/>
        <!-- Iconic Pepe Lips -->
        <path d="M-16 10 C-10 18 10 18 16 10 C10 14 -10 14 -16 10 Z" fill="#b91c1c" stroke="#991b1b" stroke-width="1.2"/>
        <!-- Gold Chain -->
        <path d="M-12 18 C-6 26 6 26 12 18" fill="none" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>
      </g>
    `
  },
  cap: {
    name: 'Cap',
    primary: '#0284c7',
    secondary: '#0369a1',
    accent: '#38bdf8',
    dark: '#082f49',
    glow: '#38bdf8',
    emblem: `
      <!-- 3D Durov's Black Cap with Telegram Plane -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Cap Dome -->
        <path d="M-18 6 C-18 -14 12 -16 18 4 Z" fill="#18181b" stroke="#3f3f46" stroke-width="1.5"/>
        <!-- Cap Visor/Brim (Curved Forward) -->
        <path d="M-22 6 C-16 4 12 4 22 10 C16 14 -12 16 -22 6 Z" fill="#27272a" stroke="#52525b" stroke-width="1.2"/>
        <!-- White Telegram Paper Plane on Cap Front -->
        <polygon points="-4,-4 6,-8 0,2" fill="#fff"/>
        <polygon points="0,2 6,-8 2,4" fill="#cbd5e1"/>
        <!-- Top Button -->
        <ellipse cx="0" cy="-14" rx="3" ry="1.5" fill="#52525b"/>
      </g>
    `
  },
  ring: {
    name: 'Ring',
    primary: '#f59e0b',
    secondary: '#b45309',
    accent: '#fde047',
    dark: '#451a03',
    glow: '#f59e0b',
    emblem: `
      <!-- 3D Golden Ring with Brilliant Solitaire Diamond -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Gold Ring Band (Vertical Perspective) -->
        <ellipse cx="0" cy="6" rx="16" ry="18" fill="none" stroke="url(#gold-band-grad)" stroke-width="4.5"/>
        <!-- Ring Crown / Prong Setting -->
        <polygon points="-5,-12 5,-12 7,-8 -7,-8" fill="#fde047"/>
        <!-- Sparkling Giant Solitaire Diamond -->
        <polygon points="-8,-16 8,-16 11,-12 0,-6 -11,-12" fill="#cffafe" stroke="#fff" stroke-width="1"/>
        <polygon points="-8,-16 8,-16 0,-22" fill="#e0f2fe"/>
        <!-- Prism Beams -->
        <path d="M0 -22 L0 -26 M-8 -20 L-11 -23 M8 -20 L11 -23" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </g>
    `
  },
  black: {
    name: 'Black',
    primary: '#475569',
    secondary: '#0f172a',
    accent: '#94a3b8',
    dark: '#020617',
    glow: '#6d28d9',
    emblem: `
      <!-- 3D Dark Matter Tesseract with Ultraviolet Core -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.5" filter="url(#blur-s)"/>
        <!-- Outer Dark Cube Wireframe -->
        <polygon points="0,-18 20,-6 0,6 -20,-6" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="-20,-6 0,6 0,22 -20,10" fill="#0f172a" stroke="#475569" stroke-width="1.5"/>
        <polygon points="20,-6 0,6 0,22 20,10" fill="#020617" stroke="#334155" stroke-width="1.5"/>
        <!-- Glowing Ultraviolet Inner Crystal -->
        <polygon points="0,-8 10,-2 0,4 -10,-2" fill="#a855f7"/>
        <polygon points="-10,-2 0,4 0,12 -10,6" fill="#7e22ce"/>
        <polygon points="10,-2 0,4 0,12 10,6" fill="#9333ea"/>
        <circle cx="0" cy="2" r="3" fill="#fff"/>
      </g>
    `
  },
  epic: {
    name: 'Epic',
    primary: '#6366f1',
    secondary: '#4338ca',
    accent: '#a5b4fc',
    dark: '#1e1b4b',
    glow: '#8b5cf6',
    emblem: `
      <!-- 3D Astral Prismatic Star Crystal -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Prismatic Crystal Clusters -->
        <polygon points="0,-24 8,-4 0,18 -8,-4" fill="#a5b4fc" stroke="#e0e7ff" stroke-width="1.2"/>
        <polygon points="-8,-4 0,18 -18,4" fill="#6366f1"/>
        <polygon points="8,-4 0,18 18,4" fill="#818cf8"/>
        <!-- Cross Crystals -->
        <polygon points="-16,-10 0,-4 -6,6" fill="#c7d2fe"/>
        <polygon points="16,-10 0,-4 6,6" fill="#e0e7ff"/>
        <!-- Cosmic Center Spark -->
        <circle cx="0" cy="-4" r="4" fill="#fff"/>
        <line x1="-12" y1="-4" x2="12" y2="-4" stroke="#fff" stroke-width="1.5"/>
        <line x1="0" y1="-16" x2="0" y2="8" stroke="#fff" stroke-width="1.5"/>
      </g>
    `
  },
  vip: {
    name: 'VIP',
    primary: '#eab308',
    secondary: '#a16207',
    accent: '#fef08a',
    dark: '#422006',
    glow: '#ffc93c',
    emblem: `
      <!-- 3D Golden Trophy with VIP Star -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Trophy Cup -->
        <path d="M-16 -16 H16 V-2 C16 8 8 14 0 14 C-8 14 -16 8 -16 -2 Z" fill="url(#vip-gold-grad)" stroke="#fef08a" stroke-width="1.5"/>
        <!-- Handles -->
        <path d="M-16 -12 C-24 -12 -24 0 -16 0" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
        <path d="M16 -12 C24 -12 24 0 16 0" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
        <!-- Pedestal / Base -->
        <rect x="-4" y="14" width="8" height="6" fill="#ca8a04"/>
        <rect x="-12" y="20" width="24" height="6" rx="2" fill="#854d0e" stroke="#facc15" stroke-width="1"/>
        <!-- VIP Star on Cup -->
        <path d="M0 -7 L2 -3 L6 -3 L3 0 L4 4 L0 2 L-4 4 L-3 0 L-6 -3 L-2 -3 Z" fill="#fff"/>
      </g>
    `
  },
  elite: {
    name: 'Elite',
    primary: '#f43f5e',
    secondary: '#9f1239',
    accent: '#fecdd3',
    dark: '#4c0519',
    glow: '#ff9d0b',
    emblem: `
      <!-- 3D Imperial Astral Crown with Jewels -->
      <g transform="translate(80, 78)">
        <ellipse cx="0" cy="26" rx="26" ry="6" fill="#000" opacity="0.35" filter="url(#blur-s)"/>
        <!-- Crown Velvet Cushion -->
        <path d="M-16 10 C-16 -4 16 -4 16 10 Z" fill="#be123c"/>
        <!-- Gold Crown Arches -->
        <path d="M-20 10 L-22 -8 L-10 0 L0 -14 L10 0 L22 -8 L20 10 Z" fill="url(#elite-gold-grad)" stroke="#fef08a" stroke-width="1.5"/>
        <rect x="-20" y="10" width="40" height="7" rx="2" fill="#ca8a04" stroke="#fde047" stroke-width="1"/>
        <!-- Giant Center Ruby & Diamonds -->
        <circle cx="0" cy="13.5" r="3" fill="#ef4444" stroke="#fff" stroke-width="1"/>
        <circle cx="-12" cy="13.5" r="2" fill="#38bdf8"/>
        <circle cx="12" cy="13.5" r="2" fill="#38bdf8"/>
        <circle cx="0" cy="-14" r="3" fill="#fff" stroke="#facc15" stroke-width="1"/>
      </g>
    `
  }
}

// Generate the high-fidelity Apple 3D Liquid Glass SVG
function generateGlassSvg(id, data) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <!-- Filters for Depth, Specular Sheen & Floating Ambient Shadows -->
    <filter id="blur-s" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <filter id="glow-ambient" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="12"/>
    </filter>

    <!-- Base Glass Case Body Gradient -->
    <linearGradient id="glass-body-${id}" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${data.accent}" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="${data.primary}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${data.dark}" stop-opacity="0.88"/>
    </linearGradient>

    <!-- Apple Refractive Glass Rim (1.5px border highlight) -->
    <linearGradient id="glass-rim-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="30%" stop-color="${data.accent}" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="${data.primary}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4"/>
    </linearGradient>

    <!-- Top Diagonal Sheen Gradient -->
    <linearGradient id="glass-sheen-${id}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>

    <!-- Internal Core Light Source -->
    <radialGradient id="core-glow-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${data.glow}" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="${data.primary}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${data.primary}" stop-opacity="0"/>
    </radialGradient>

    <!-- Common Metallic & Glass Gradients for Emblems -->
    <linearGradient id="gold-vault-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <radialGradient id="gold-dial-grad" cx="40%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="60%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </radialGradient>
    <linearGradient id="autumn-leaf-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </linearGradient>
    <radialGradient id="tg-circle-grad" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </radialGradient>
    <radialGradient id="space-planet-grad" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#e9d5ff"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </radialGradient>
    <linearGradient id="potion-glass-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f3e8ff" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#7e22ce" stop-opacity="0.4"/>
    </linearGradient>
    <radialGradient id="kitty-helmet-grad" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fce7f3"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#9d174d"/>
    </radialGradient>
    <linearGradient id="fire-flame-grad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#e11d48"/>
      <stop offset="60%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#fef08a"/>
    </linearGradient>
    <linearGradient id="snoop-crown-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </linearGradient>
    <radialGradient id="peach-body-grad" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffedd5"/>
      <stop offset="50%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </radialGradient>
    <radialGradient id="pepe-skin-grad" cx="40%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#d9f99d"/>
      <stop offset="60%" stop-color="#84cc16"/>
      <stop offset="100%" stop-color="#4d7c0f"/>
    </radialGradient>
    <linearGradient id="gold-band-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <linearGradient id="vip-gold-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </linearGradient>
    <linearGradient id="elite-gold-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>
  </defs>

  <!-- 1. Ambient Ground Drop Shadow & Colored Floor Reflection -->
  <ellipse cx="80" cy="144" rx="46" ry="10" fill="#000000" opacity="0.45" filter="url(#blur-s)"/>
  <ellipse cx="80" cy="142" rx="36" ry="7" fill="${data.glow}" opacity="0.4" filter="url(#glow-ambient)"/>

  <!-- 2. Apple Liquid Glass Capsule Body (Squircle) -->
  <rect x="15" y="13" width="130" height="130" rx="36" 
        fill="url(#glass-body-${id})" 
        stroke="url(#glass-rim-${id})" 
        stroke-width="1.8"/>

  <!-- 3. Internal Volumetric Core Glow -->
  <circle cx="80" cy="78" r="46" fill="url(#core-glow-${id})"/>

  <!-- 4. Inner Themed 3D Emblem Floating in Glass -->
  ${data.emblem.trim()}

  <!-- 5. Apple Liquid Glass Specular Reflection Overlay (Curved Gloss Sheen) -->
  <path d="M 17 48 C 17 28 32 15 52 15 L 108 15 C 128 15 143 28 143 48 C 143 62 120 72 80 72 C 40 72 17 62 17 48 Z" 
        fill="url(#glass-sheen-${id})" 
        opacity="0.85"/>

  <!-- 6. Corner Specular Light Glint (Apple Gloss Bead) -->
  <ellipse cx="44" cy="27" rx="14" ry="4" transform="rotate(-28 44 27)" fill="#ffffff" opacity="0.75"/>
  <circle cx="28" cy="38" r="2.5" fill="#ffffff" opacity="0.6"/>

  <!-- 7. Bottom Rim Subsurface Light Accent -->
  <path d="M 38 140 C 60 143 100 143 122 140" stroke="${data.accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.65" fill="none"/>
</svg>`
}

// Generate all cases
let count = 0
for (const [id, data] of Object.entries(CASE_DATA)) {
  const filePath = path.join(CASES_DIR, `${id}.svg`)
  const content = generateGlassSvg(id, data)
  fs.writeFileSync(filePath, content, 'utf8')
  count++
}

console.log(`Successfully generated ${count} Apple Liquid Glass cases in ${CASES_DIR}`)
