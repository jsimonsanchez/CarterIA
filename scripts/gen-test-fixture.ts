import ExcelJS from 'exceljs'

/** Genera un .xlsx sintético con la misma forma que un extracto de XTB, para pruebas de UI sin usar datos reales. */
async function main() {
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Cash Operations')

  sheet.addRow(['Account number', 12345678])
  sheet.addRow(['Cash Operations'])
  sheet.addRow(['Date from (UTC)', new Date('2024-01-01')])
  sheet.addRow(['Date to (UTC)', new Date('2026-08-24')])
  sheet.addRow(['Type', 'Instrument', 'Ticker', 'Category', 'Time', 'Amount', 'ID', 'Comment', 'Product', 'Position ID'])

  sheet.addRow(['Stock purchase', 'Apple', 'AAPL.US', 'STOCK', new Date('2025-01-10T10:00:00Z'), -1500, 1001, 'OPEN BUY 10 @ 150.00', 'My Trades', 5001])
  sheet.addRow(['Dividend', 'Apple', 'AAPL.US', 'STOCK', new Date('2025-06-10T10:00:00Z'), 5.5, 1002, 'AAPL.US USD 0.55/ SHR', 'My Trades', null])
  sheet.addRow(['Stock purchase', 'Amazon', 'AMZN.DE', 'STOCK', new Date('2025-02-05T10:00:00Z'), -800, 1003, 'OPEN BUY 4 @ 200.00', 'My Trades', 5002])
  sheet.addRow(['Withholding tax', 'Apple', 'AAPL.US', 'STOCK', new Date('2025-06-10T10:00:01Z'), -1.1, 1004, 'AAPL.US USD WHT 20%', 'My Trades', null])
  sheet.addRow(['Deposit', null, null, null, new Date('2025-01-01T09:00:00Z'), 5000, 1005, 'Test deposit', 'My Trades', null])
  sheet.addRow(['Free funds interest', null, null, null, new Date('2025-03-01T09:00:00Z'), 3.2, 1006, 'Free-funds Interest 2025-02', 'My Trades', null])

  sheet.addRow(['Total', null, null, null, null, 3707.6])

  await wb.xlsx.writeFile('public/test-fixture.xlsx')
  console.log('written public/test-fixture.xlsx')
}

main()
