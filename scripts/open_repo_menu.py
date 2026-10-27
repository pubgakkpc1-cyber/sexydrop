import time
import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    
    # Click button via JS
    btn = page.query_selector("button:has-text('Select a repository...')")
    print("Clicking button via JS...")
    btn.evaluate("b => b.click()")
    time.sleep(2)
    
    # Save screenshot
    page.screenshot(path="scripts/repo_menu.png")
    shutil.copy2("scripts/repo_menu.png", r"C:\Users\pc\.gemini\antigravity\brain\30786793-ecc4-43dd-ac87-c091b9dcaa73\repo_menu.png")
    print("Screenshot saved to artifacts/repo_menu.png")
    
    # Find all items in dropdown
    items = page.query_selector_all("[role='menuitem'], [role='option'], li, div[class*='item']")
    print(f"Items found: {len(items)}")
    for it in items[:25]:
        t = it.inner_text().strip().replace('\n', ' ')
        if t:
            print(" -", t)
