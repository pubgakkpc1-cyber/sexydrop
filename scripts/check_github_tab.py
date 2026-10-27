import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    context = browser.contexts[0]
    
    new_page = context.new_page()
    new_page.goto("https://github.com")
    time.sleep(3)
    print("GitHub title:", new_page.title())
    print("GitHub URL:", new_page.url)
    
    avatar = new_page.query_selector("img.avatar")
    login_btn = new_page.query_selector("a[href='/login']")
    print("Has avatar:", avatar is not None)
    print("Has sign in button:", login_btn is not None)
    
    # Save screenshot of github
    new_page.screenshot(path="scripts/github_status.png")
    new_page.close()
