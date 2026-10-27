import time
import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = browser.contexts[0].pages[-1]
    
    print("Page URL:", page.url)
    page.screenshot(path="scripts/profile_settings.png")
    shutil.copy2("scripts/profile_settings.png", r"C:\Users\pc\.gemini\antigravity\brain\30786793-ecc4-43dd-ac87-c091b9dcaa73\profile_settings.png")
    print("Screenshot saved to artifacts/profile_settings.png")
    
    nav_links = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        }));
    }""")
    print("Nav links count:", len(nav_links))
    for nl in nav_links:
        print(" -", nl['text'], "->", nl['href'])
