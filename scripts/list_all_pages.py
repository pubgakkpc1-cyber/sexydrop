from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    for i, page in enumerate(browser.contexts[0].pages):
        print(f"Page {i}: [{page.title()}] - {page.url}")
