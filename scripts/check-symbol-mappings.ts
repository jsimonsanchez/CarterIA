import { resolveSymbol } from '../src/domain/symbolResolver'

const tickers = [
  '5MVW.DE', 'AAPL.US', 'AMZN.DE', 'ASML.US', 'ASWC.DE', 'BLSH.US', 'BRE.IT',
  'CBUK.DE', 'CEBS.DE', 'CSH.FR', 'CSH2.FR', 'DECK.US', 'DGE.UK', 'EGLN.UK',
  'ESIT.DE', 'ETLK.DE', 'EVO.SE', 'FLXK.DE', 'GOOGL.US', 'GPN.US', 'IB1T.DE',
  'IGLN.UK', 'IQQ7.DE', 'IUSS.DE', 'LDOS.US', 'LULU.US', 'LVS.US', 'LYB.US',
  'META.US', 'MSFT.US', 'MU.US', 'NOVOB.DK', 'NVDA.US', 'NVO.US', 'OXY.US',
  'RELY.US', 'SLVR.DE', 'SPYL.DE', 'SW.FR', 'TAP.US', 'UBER.US', 'UNH.US',
  'WTEJ.DE', 'XPQP.DE', 'XUTC.DE',
]

let unresolved = 0
for (const t of tickers) {
  const m = resolveSymbol(t)
  if (!m) {
    unresolved++
    console.log(`${t.padEnd(10)} -> SIN RESOLVER`)
  } else {
    console.log(`${t.padEnd(10)} -> yahoo=${m.yahooSymbol.padEnd(12)} twelveData=${m.twelveDataSymbol}${m.twelveDataExchange ? ` (${m.twelveDataExchange})` : ''}`)
  }
}
console.log(`\ntotal: ${tickers.length}, sin resolver: ${unresolved}`)
