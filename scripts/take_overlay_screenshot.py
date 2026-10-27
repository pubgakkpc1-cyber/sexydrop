import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    page.screenshot(path="scripts/current_view.png")
    shutil.copy2("scripts/current_view.png", r"C:\Users\pc\.gemini\antigravity\brain\30786793-ecc4-43dd-ac87-c091b9dcaa73\current_view.png")
    print("Screenshot saved to artifacts/current_view.png")
    
    # Check overlays
    overlays = page.query_selector_all("div[class*='overlay'], div[class*='backdrop'], [role='dialog']")
    print(f"Overlays found: {len(overlays)}")
    for o in overlays:
        print("Overlay text:", o.inner_text().strip().replace("\n", " ")[:200])
