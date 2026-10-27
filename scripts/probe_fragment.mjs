const candidateNames = [
  'durovscap', 'astralshard', 'plushpepe', 'resistancedog', 'heartlocket',
  'diamondring', 'scaredcat', 'magicpotion', 'crystalball', 'xmasstocking',
  'freshsocks', 'instantramen', 'chillflame', 'heroichelmet', 'swisswatch',
  'lootbag', 'minioscar', 'lowrider', 'rarebird', 'ufcstrike',
  'goldenpepe', 'goldentrophy', 'astralcrown', 'holidaygift', 'neondream',
  'cyberhelmet', 'crown', 'trophy', 'pepe', 'flame', 'socks',
  'potion', 'shard', 'cap', 'ring', 'locket', 'helmet', 'watch',
  'cookie', 'champagne', 'cake', 'flower', 'bear', 'rocket'
]

async function probe() {
  const found = []
  for (const name of candidateNames) {
    for (let id = 1; id <= 3; id++) {
      const url = `https://nft.fragment.com/gift/${name}-${id}.webp`
      try {
        const res = await fetch(url, { method: 'HEAD' })
        if (res.ok) {
          found.push({ name, url })
          console.log(`FOUND: ${name} -> ${url}`)
          break
        }
      } catch (e) {}
    }
  }
  console.log('Total found on fragment:', found.length)
}

probe()
