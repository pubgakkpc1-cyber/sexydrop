async function test() {
  try {
    const res = await fetch('https://api.getgems.io/public/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        query: `
          query {
            alphaNftCollections(query: "gift", first: 5) {
              edges {
                node {
                  address
                  name
                  image {
                    sized(width: 500, height: 500)
                  }
                }
              }
            }
          }
        `
      })
    })
    console.log('Status:', res.status)
    const json = await res.json()
    console.log(JSON.stringify(json, null, 2))
  } catch (e) {
    console.log('Error:', e.message)
  }
}

test()
