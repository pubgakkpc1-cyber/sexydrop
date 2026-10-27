import sys
import time
from playwright.sync_api import sync_playwright

def inspect_chrome(cdp_url="http://localhost:9222"):
    try:
        with sync_playwright() as p:
            print(f"Connecting to {cdp_url}...")
            browser = p.chromium.connect_over_cdp(cdp_url)
            print("Connected!")
            for i, ctx in enumerate(browser.contexts):
                print(f"Context {i}: {len(ctx.pages)} pages")
                for j, page in enumerate(ctx.pages):
                    print(f"  Page {j}: [{page.title()}] - {page.url}")
            return True
    except Exception as e:
        print("Failed to connect:", e)
        return False

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:9222"
    inspect_chrome(url)
