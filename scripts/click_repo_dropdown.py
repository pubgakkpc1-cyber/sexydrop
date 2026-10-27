import time
import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    
    # Click repository dropdown
    repo_dropdown = page.query_selector("text='Select a repository...'") or page.locator("text='Select a repository...'").first
    print("Found repo dropdown:", repo_dropdown)
    repo_dropdown.click()
    time.sleep(2)
    
    page.screenshot(path="scripts/repo_dropdown.png")
    shutil.copy2("scripts/repo_dropdown.png", r"C:\Users\pc\.gemini\antigravity\brain\30786793-ecc4-43dd-ac87-c091b9dcaa73\repo_dropdown.png")
    
    # List options in dropdown
    options = page.query_selector_all("[role='option'], [class*='option'], [class*='item']")
    print(f"Options found: {len(options)}")
    for opt in options[:20]:
        t = opt.inner_text().strip().replace('\n', ' ')
        if t:
            print(" - Option:", t)
