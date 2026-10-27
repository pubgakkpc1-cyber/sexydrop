async function fetchAllGifts() {
  try {
    const res = await fetch('https://fragment.com/gifts', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    })
    const text = await res.text()
    const matches = [...text.matchAll(/https:\/\/nft\.fragment\.com\/gift\/([a-z0-9]+)-/gi)].map(m => m[1])
    console.log('Unique gift slugs:', [...new Set(matches)])
  } catch (e) {
    console.error(e)
  }
}
fetchAllGifts()
