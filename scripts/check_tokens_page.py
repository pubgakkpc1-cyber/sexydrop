import time
import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    context = browser.contexts[0]
    
    page = context.new_page()
    page.goto("https://app.northflank.com/account/tokens")
    time.sleep(3)
    
    print("Tokens Page URL:", page.url)
    print("Tokens Page Title:", page.title())
    
    page.screenshot(path="scripts/tokens_page.png")
    shutil.copy2("scripts/tokens_page.png", r"C:\Users\pc\.gemini\antigravity\brain\30786793-ecc4-43dd-ac87-c091b9dcaa73\tokens_page.png")
    print("Screenshot saved to artifacts/tokens_page.png")
    
    buttons = [b.inner_text().strip().replace('\n', ' ') for b in page.query_selector_all("button, a")]
    print("Buttons on tokens page:")
    for b in buttons:
        if any(w in b.lower() for w in ['token', 'create', 'new', 'generate', 'api']):
            print(" -", b)
