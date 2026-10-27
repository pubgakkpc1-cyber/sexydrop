import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        
        target_page = None
        for page in context.pages:
            if "northflank.com" in page.url:
                target_page = page
                break
        
        if not target_page:
            target_page = context.new_page()
            target_page.goto("https://app.northflank.com/t/sexydrops-team")
        
        target_page.bring_to_front()
        time.sleep(3)
        
        print("Page URL:", target_page.url)
        print("Page Title:", target_page.title())
        
        # Save screenshot
        target_page.screenshot(path="scripts/northflank_current.png")
        print("Screenshot saved to scripts/northflank_current.png")
        
        # Print visible text and buttons
        buttons = target_page.query_selector_all("button, a")
        print(f"Found {len(buttons)} interactive elements:")
        for b in buttons[:25]:
            try:
                txt = b.inner_text().strip().replace("\n", " ")
                if txt:
                    print(" - [Button/Link]:", txt)
            except:
                pass

if __name__ == "__main__":
    run()
