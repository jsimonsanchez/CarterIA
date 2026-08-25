import handler from '../api/fx'

async function main() {
  for (const from of ['USD', 'GBP', 'EUR']) {
    const req = new Request(`http://localhost/api/fx?from=${from}`)
    const res = await handler(req)
    console.log(from, res.status, await res.json())
  }
}

main()
