import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    context = browser.contexts[0]
    page = context.pages[-1]
    
    # Click Settings
    settings_btn = page.query_selector("text='Settings'")
    if settings_btn:
        settings_btn.click()
        time.sleep(2)
    
    links = [a.get_attribute("href") + " -> " + a.inner_text().strip().replace('\n', ' ') for a in page.query_selector_all("a") if a.get_attribute("href")]
    for l in links:
        if any(w in l.lower() for w in ["token", "api", "setting", "key"]):
            print("Link:", l)
