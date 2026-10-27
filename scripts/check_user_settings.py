import time
import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    page = browser.contexts[0].pages[-1]
    
    page.goto("https://app.northflank.com/u/sexydrop/settings/profile")
    time.sleep(3)
    
    print("Profile URL:", page.url)
    print("Profile Title:", page.title())
    
    page.screenshot(path="scripts/user_settings.png")
    shutil.copy2("scripts/user_settings.png", r"C:\Users\pc\.gemini\antigravity\brain\30786793-ecc4-43dd-ac87-c091b9dcaa73\user_settings.png")
    
    links = [a.get_attribute("href") + " -> " + a.inner_text().strip().replace('\n', ' ') for a in page.query_selector_all("a") if a.get_attribute("href")]
    for l in links:
        print("Link:", l)
