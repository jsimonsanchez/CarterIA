import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseIbkrFlexReport } from './ibkrImporter'

/** Informe de ejemplo con la estructura real de IBKR, con datos inventados. */
function report({ currency = 'EUR', lines = '', extra = '' } = {}): string {
  return `<FlexQueryResponse queryName="X" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="U000" fromDate="20250808" toDate="20260806">
<AccountInformation accountId="U000" currency="${currency}" name="Ejemplo" />
<StmtFunds>
${lines}
</StmtFunds>
<OpenPositions>
<OpenPosition conid="793419333" currency="SEK" assetCategory="STK" subCategory="COMMON" symbol="HACK" description="EJEMPLO AB" isin="SE0025138357" listingExchange="SFB" position="400" levelOfDetail="SUMMARY" />
<OpenPosition conid="393891829" currency="USD" assetCategory="STK" subCategory="ETF" symbol="BTCWUSD" description="WISDOMTREE PHYSICAL BITCOIN" isin="GB00BJYDH287" listingExchange="EBS" position="70" levelOfDetail="SUMMARY" />
</OpenPositions>
${extra}
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`
}

const DEPOSIT =
  '<StatementOfFundsLine currency="EUR" activityCode="DEP" activityDescription="Electronic Fund Transfer" date="20250808" amount="1700" tradeQuantity="0" tradePrice="0" tradeGross="0" tradeCommission="0" levelOfDetail="BaseCurrency" transactionID="1" />'

const BUY =
  '<StatementOfFundsLine currency="EUR" assetCategory="STK" subCategory="COMMON" symbol="HACKs" conid="793419333" isin="SE0025138357" listingExchange="SFB" activityCode="BUY" activityDescription="Buy 250 EJEMPLO AB" date="20250825" tradeQuantity="250" tradePrice="70.57" tradeGross="-1583.47" tradeCommission="-1.39" amount="-1584.86" levelOfDetail="BaseCurrency" transactionID="2" />'

const FOREX =
  '<StatementOfFundsLine currency="EUR" assetCategory="CASH" symbol="EUR.SEK" conid="37893488" activityCode="FOREX" activityDescription="Net Amount in Base from Forex Trade" date="20250825" tradeQuantity="-1585.16" tradePrice="11.11" tradeGross="-0.29" tradeCommission="0" amount="-0.29" levelOfDetail="BaseCurrency" transactionID="3" />'

const DIVIDEND =
  '<StatementOfFundsLine currency="EUR" assetCategory="STK" subCategory="COMMON" symbol="HACK" conid="793419333" isin="SE0025138357" listingExchange="SFB" activityCode="DIV" activityDescription="CASH DIVIDEND" date="20260512" tradeQuantity="0" tradeGross="0" tradeCommission="0" amount="160" levelOfDetail="BaseCurrency" transactionID="4" />'

const WITHHOLDING =
  '<StatementOfFundsLine currency="EUR" assetCategory="STK" subCategory="COMMON" symbol="HACK" conid="793419333" isin="SE0025138357" listingExchange="SFB" activityCode="FRTAX" activityDescription="SE TAX" date="20260512" tradeQuantity="0" tradeGross="0" tradeCommission="0" amount="-48" levelOfDetail="BaseCurrency" transactionID="5" />'

const BUY_USD =
  '<StatementOfFundsLine currency="EUR" assetCategory="STK" subCategory="ETF" symbol="BTCWUSD" conid="393891829" isin="GB00BJYDH287" listingExchange="EBS" activityCode="BUY" activityDescription="Buy 70" date="20250820" tradeQuantity="70" tradeGross="-1634.54" tradeCommission="-2.76" amount="-1637.29" levelOfDetail="BaseCurrency" transactionID="6" />'

describe('parseIbkrFlexReport', () => {
  it('lee una compra con el precio en euros y la comisión aparte', () => {
    const { transactions } = parseIbkrFlexReport(report({ lines: BUY }))

    assert.equal(transactions.length, 1)
    const tx = transactions[0]
    assert.equal(tx.broker, 'ibkr')
    assert.equal(tx.type, 'buy')
    assert.equal(tx.symbol, 'HACK.SE')
    assert.equal(tx.isin, 'SE0025138357')
    assert.equal(tx.quantity, 250)
    // El precio sale del bruto en euros, sin la comisión: 1583,47 / 250.
    assert.equal(tx.price, 1583.47 / 250)
    assert.equal(tx.commission, 1.39)
    assert.equal(tx.total, -1584.86)
    assert.equal(tx.currency, 'EUR')
    assert.equal(tx.category, 'STOCK')
    assert.equal(tx.date, '2025-08-25T00:00:00.000Z')
  })

  it('traduce los códigos de actividad a los tipos de la app', () => {
    const { transactions } = parseIbkrFlexReport(
      report({ lines: [DEPOSIT, DIVIDEND, WITHHOLDING, FOREX].join('\n') }),
    )

    assert.deepEqual(
      transactions.map((t) => t.type),
      ['deposit', 'dividend', 'fee', 'other'],
    )
  })

  it('no asigna instrumento a las conversiones de divisa, que solo mueven la caja', () => {
    const { transactions } = parseIbkrFlexReport(report({ lines: FOREX }))

    assert.equal(transactions[0].symbol, '')
    assert.equal(transactions[0].total, -0.29)
  })

  it('descarta las líneas que no están en divisa base, para no duplicar importes', () => {
    const nativa = BUY.replace('levelOfDetail="BaseCurrency"', 'levelOfDetail="Currency"').replace(
      'transactionID="2"',
      'transactionID="2b"',
    )
    const { transactions } = parseIbkrFlexReport(report({ lines: [BUY, nativa].join('\n') }))

    assert.equal(transactions.length, 1)
  })

  it('resuelve el ticker de precios por la bolsa en la que cotiza', () => {
    const { mappings } = parseIbkrFlexReport(report({ lines: BUY }))

    assert.deepEqual(mappings, [
      {
        xtbSymbol: 'HACK.SE',
        twelveDataSymbol: 'HACK',
        twelveDataExchange: 'OMX',
        yahooSymbol: 'HACK.ST',
        name: 'EJEMPLO AB',
      },
    ])
  })

  it('para un ISIN con varias líneas usa la de la divisa de la posición', () => {
    const { mappings } = parseIbkrFlexReport(report({ lines: BUY_USD }))

    // El mismo ETP cotiza en francos en la bolsa suiza; la posición está en
    // dólares, así que el precio tiene que venir de la línea en dólares.
    assert.equal(mappings[0].yahooSymbol, 'BTCW.L')
    assert.equal(mappings[0].xtbSymbol, 'BTCWUSD.CH')
  })

  it('avisa si lo calculado no cuadra con las posiciones que declara IBKR', () => {
    const { reportedPositions } = parseIbkrFlexReport(report({ lines: BUY }))

    assert.deepEqual(reportedPositions, [
      { symbol: 'HACK.SE', quantity: 400 },
      { symbol: 'BTCWUSD.CH', quantity: 70 },
    ])
  })

  it('rechaza una cuenta que no esté en euros', () => {
    assert.throws(() => parseIbkrFlexReport(report({ currency: 'USD', lines: DEPOSIT })), /USD/)
  })

  it('rechaza un fichero que no sea un informe Flex', () => {
    assert.throws(() => parseIbkrFlexReport('<html>nada</html>'), /informe Flex/)
  })
})
