import fs from 'node:fs'

async function check() {
  const pages = [
    { cat: 'box', url: 'https://pngimg.com/images/objects/box' },
    { cat: 'treasure_chest', url: 'https://pngimg.com/images/objects/treasure_chest' },
    { cat: 'gift', url: 'https://pngimg.com/images/holidays/gift' },
  ]
  const results = []
  for (const page of pages) {
    try {
      const res = await fetch(page.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const text = await res.text()
      // find img tags with alt
      const regex = /<img[^>]+src="([^">]+)"[^>]*alt="([^">]*)"/gi
      let match
      while ((match = regex.exec(text)) !== null) {
        const src = match[1]
        const alt = match[2]
        // normalize src
        const fullSrc = src.replace('/small/', '/')
        results.push({ cat: page.cat, src: fullSrc, alt })
      }
    } catch (e) {
      console.log(page.cat, 'err:', e.message)
    }
  }
  console.log('Total extracted:', results.length)
  const openItems = results.filter(r => /open/i.test(r.alt) || /open/i.test(r.src))
  console.log('Open items count:', openItems.length)
  for (const item of openItems.slice(0, 30)) {
    console.log(`[${item.cat}] ${item.alt} -> ${item.src}`)
  }
  fs.writeFileSync('scripts/open_items.json', JSON.stringify(results, null, 2))
}

check()
