from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    
    # Click Combined (Build and deploy a Git repo)
    combined_btn = page.query_selector("button:has-text('Combined')")
    if combined_btn:
        print("Clicking Combined...")
        combined_btn.click()
        time.sleep(2)
    
    # Inspect git repo dropdown or selectors
    inputs = page.query_selector_all("input, select, [role='combobox'], [role='listbox']")
    print(f"Found {len(inputs)} input/combobox elements:")
    for inp in inputs:
        name = inp.get_attribute("name") or inp.get_attribute("placeholder") or inp.get_attribute("id") or ""
        print(" - Input/select:", name)
    
    # Look for repo list
    text_blocks = [el.inner_text().strip().replace('\n', ' ') for el in page.query_selector_all("[data-testid*='repo'], [class*='repo'], [class*='dropdown']")]
    for tb in text_blocks[:15]:
        if tb:
            print(" - Text block:", tb[:100])
