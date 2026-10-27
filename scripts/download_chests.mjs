import fs from 'node:fs'
import path from 'node:path'

const ids = [1, 2, 4, 12, 18, 25, 28, 32, 40, 50, 66, 75]
const dir = path.resolve('scripts/internet_assets')

async function run() {
  for (const id of ids) {
    const url = `https://pngimg.com/uploads/treasure_chest/treasure_chest_PNG${id}.png`
    const dest = path.join(dir, `chest_${id}.png`)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        fs.writeFileSync(dest, Buffer.from(buf))
        console.log(`Downloaded chest ${id} (${buf.byteLength} bytes)`)
      }
    } catch (e) {
      console.log(`Error ${id}:`, e.message)
    }
  }
}

run()
