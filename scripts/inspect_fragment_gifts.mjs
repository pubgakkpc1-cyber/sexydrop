async function getGiftsInfo() {
  try {
    const res = await fetch('https://fragment.com/gifts', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })
    const text = await res.text()
    // Look for gift item names in the page
    const matches = [...text.matchAll(/<div[^>]*class="[^"]*table-cell-value[^"]*"[^>]*>([^<]+)<\/div>/g)].map(m => m[1].trim())
    console.log('Sample cell values:', matches.slice(0, 30))
    // Also look for gift titles
    const titles = [...text.matchAll(/<span[^>]*class="[^"]*item-name[^"]*"[^>]*>([^<]+)<\/span>/g)].map(m => m[1].trim())
    console.log('Item titles:', [...new Set(titles)])
  } catch (e) {
    console.error(e)
  }
}
getGiftsInfo()
