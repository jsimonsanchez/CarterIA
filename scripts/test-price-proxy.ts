import handler from '../api/price'

async function main() {
  // AAPL.US -> yahoo=AAPL, twelveData=AAPL (sin exchange)
  const req = new Request('http://localhost/api/price?twelveDataSymbol=AAPL&yahooSymbol=AAPL')
  const res = await handler(req)
  console.log('status:', res.status)
  console.log(await res.json())
}

main()
