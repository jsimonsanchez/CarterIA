import handler from '../api/price'
import { resolveSymbol } from '../src/domain/symbolResolver'

const tickers = ['AMZN.DE', 'EVO.SE', 'DGE.UK', 'SW.FR', 'BRE.IT', 'NOVOB.DK']

async function main() {
  for (const t of tickers) {
    const m = resolveSymbol(t)!
    const params = new URLSearchParams({ twelveDataSymbol: m.twelveDataSymbol, yahooSymbol: m.yahooSymbol })
    if (m.twelveDataExchange) params.set('twelveDataExchange', m.twelveDataExchange)
    const res = await handler(new Request(`http://localhost/api/price?${params}`))
    console.log(t, res.status, await res.json())
  }
}

main()
