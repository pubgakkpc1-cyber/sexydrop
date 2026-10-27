from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    
    print("Page URL:", page.url)
    buttons = page.query_selector_all("button")
    for b in buttons:
        t = b.inner_text().strip().replace("\n", " ")
        if any(w in t.lower() for w in ["create", "card", "submit", "deploy", "save"]):
            print("Button:", t)
