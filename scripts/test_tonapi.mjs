async function fetchAstral() {
  try {
    const res = await fetch('https://tonapi.io/v2/nfts/collections/EQDIReleOkTxCD4g_XEm8xj0LYNg6-zMsTGAAwCA-vEbkGBu/items?limit=2')
    const data = await res.json()
    console.log('Astral Item 0:', data.nft_items[0]?.metadata)
  } catch (e) {
    console.error('Error:', e.message)
  }
}

fetchAstral()
