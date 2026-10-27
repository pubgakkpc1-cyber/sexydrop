async function testGifts() {
  const gifts = [
    'durovscap',
    'astralshard',
    'plushpepe',
    'resistancedog',
    'heartlocket',
    'diamondring',
    'cyberhelmet',
    'scaredcat',
    'magicpotion',
    'crystalball',
    'goldentrophy',
    'astralcrown',
    'holidaygift',
    'xmasstocking',
    'freshsocks',
    'instantramen',
    'chillflame',
    'neondream',
    'goldenpepe'
  ]
  for (const g of gifts) {
    for (let id = 1; id <= 10; id++) {
      const url = `https://nft.fragment.com/gift/${g}-${id}.webp`
      try {
        const res = await fetch(url, { method: 'HEAD' })
        if (res.ok) {
          console.log(`Found: ${g} -> ${url}`)
          break
        }
      } catch (e) {}
    }
  }
}

testGifts()
