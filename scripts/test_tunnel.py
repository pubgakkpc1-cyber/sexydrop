import httpx
import re

url = "https://bags-bull-immediate-rabbit.trycloudflare.com"
r = httpx.get(url, follow_redirects=True, timeout=10.0)
print("Index status:", r.status_code)
print("HTML content:\n", r.text)

scripts = re.findall(r'src="([^"]+)"', r.text)
links = re.findall(r'href="([^"]+)"', r.text)

for s in scripts + links:
    if s.startswith("http"):
        asset_url = s
    else:
        asset_url = url + ("" if s.startswith("/") else "/") + s
    try:
        ar = httpx.get(asset_url, timeout=10.0)
        print(f"Asset {asset_url} -> {ar.status_code} ({len(ar.content)} bytes)")
    except Exception as e:
        print(f"Asset {asset_url} -> ERROR: {e}")
