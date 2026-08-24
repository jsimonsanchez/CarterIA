import fs from 'node:fs'
import ExcelJS from 'exceljs'
import { parseXtbWorkbook } from '../src/import/xtbImporter'
import { computePositions } from '../src/domain/positions'

const path = process.argv[2]
if (!path) {
  console.error('Uso: tsx scripts/validate-import.ts <ruta-al-extracto.xlsx>')
  process.exit(1)
}

async function main() {
  const buf = fs.readFileSync(path)
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

  const result = await parseXtbWorkbook(arrayBuffer as ArrayBuffer)
  console.log('transactions:', result.transactions.length)
  console.log('skipped:', result.skipped)
  console.log('warnings:', result.warnings.length)
  for (const w of result.warnings.slice(0, 20)) console.log('  -', w.rowId, w.message)

  const byType: Record<string, number> = {}
  for (const tx of result.transactions) byType[tx.type] = (byType[tx.type] ?? 0) + 1
  console.log('by type:', byType)

  const positions = computePositions(result.transactions)
  positions.sort((a, b) => a.symbol.localeCompare(b.symbol))
  console.log('\ncomputed positions:', positions.length)
  for (const p of positions) {
    console.log(
      `  ${p.symbol.padEnd(10)} qty=${p.quantity.toFixed(4).padStart(10)} avgCost(EUR)=${p.averageCost.toFixed(4)}`,
    )
  }

  // Reconciliación contra la hoja "Open Positions" del propio extracto.
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(arrayBuffer as ArrayBuffer)
  const openSheet = wb.getWorksheet('Open Positions')
  if (!openSheet) {
    console.log('\n(sin hoja "Open Positions", se omite la reconciliación)')
    return
  }

  const openQtyByTicker: Record<string, number> = {}
  let currentTicker = ''
  openSheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 9) return
    const ticker = String(row.getCell(3).value ?? '').trim()
    const type = String(row.getCell(5).value ?? '').trim()
    const volume = Number(row.getCell(6).value ?? 0)
    if (ticker) currentTicker = ticker
    if (type === 'BUY' && currentTicker) {
      openQtyByTicker[currentTicker] = (openQtyByTicker[currentTicker] ?? 0) + volume
    }
  })

  console.log('\nreconciliación (computado vs "Open Positions" del extracto):')
  const allTickers = new Set([...positions.map((p) => p.symbol), ...Object.keys(openQtyByTicker)])
  let mismatches = 0
  for (const t of [...allTickers].sort()) {
    const computed = positions.find((p) => p.symbol === t)?.quantity ?? 0
    const expected = openQtyByTicker[t] ?? 0
    const diff = Math.abs(computed - expected)
    const flag = diff > 0.001 ? '  <-- DIFERENCIA' : ''
    if (diff > 0.001) mismatches++
    console.log(
      `  ${t.padEnd(10)} computado=${computed.toFixed(4).padStart(10)} esperado=${expected.toFixed(4).padStart(10)}${flag}`,
    )
  }
  console.log(`\ntotal mismatches: ${mismatches} / ${allTickers.size}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
