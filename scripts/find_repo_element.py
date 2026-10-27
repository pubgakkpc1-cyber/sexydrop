from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    
    # Find all elements containing text 'Select a repository'
    elements = page.query_selector_all(":has-text('Select a repository')")
    print(f"Elements: {len(elements)}")
    for el in elements[-3:]:
        tag = el.evaluate("e => e.tagName")
        outer = el.evaluate("e => e.outerHTML.slice(0, 250)")
        print(f"Tag: {tag} | Outer: {outer}")
