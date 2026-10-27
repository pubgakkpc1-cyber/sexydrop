from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = [pg for pg in browser.contexts[0].pages if "northflank.com" in pg.url][0]
    print("Current URL:", page.url)
    
    # Check Environment dropdown
    env_btn = page.query_selector("button:has-text('Select an environment')") or page.query_selector("[placeholder*='environment']")
    print("Env element found:", env_btn is not None)
    
    # Check what repositories exist now
    repo_btn = page.query_selector("button:has-text('Select a repository')")
    print("Repo element found:", repo_btn is not None)
