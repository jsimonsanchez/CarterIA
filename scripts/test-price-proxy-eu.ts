import handler from '../api/price'

async function main() {
  const req = new Request(
    'http://localhost/api/price?twelveDataSymbol=DGE&twelveDataExchange=LSE&yahooSymbol=DGE.L',
  )
  const res = await handler(req)
  console.log('status:', res.status)
  console.log(await res.json())
}

main()
