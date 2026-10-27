import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    context = browser.contexts[0]
    page = context.pages[-1]
    
    # Click user menu (top right)
    pubg_btn = page.query_selector("button:has-text('pubg')")
    if pubg_btn:
        pubg_btn.click()
        time.sleep(2)
        
    items = page.query_selector_all("a, button")
    for it in items:
        h = it.get_attribute("href")
        t = it.inner_text().strip().replace('\n', ' ')
        if h or any(w in t.lower() for w in ['account', 'profile', 'token', 'api', 'logout', 'sign out']):
            print(f"User item: {t} -> {h}")
