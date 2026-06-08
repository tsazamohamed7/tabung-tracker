// ╔══════════════════════════════════════════════════════╗
// ║  HouseFund.gs — fact_house_fund CRUD                 ║
// ║  Manages the construction project shared pool        ║
// ╚══════════════════════════════════════════════════════╝

const HOUSE_FUND_HEADERS = [
  'trx_id',
  'date',
  'type',
  'funder',
  'amount',
  'description',
]

// ── Read ──────────────────────────────────────────────────────────────────

function getHouseFundTrx() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('fact_house_fund')
  if (!sheet) return []
  return sheetToObjects(sheet)
}

// ── Write ─────────────────────────────────────────────────────────────────

function upsertHouseFundTrx(data) {
  if (!data.trx_id) {
    data.trx_id = 'HF' + new Date().getTime().toString().slice(-6)
  }
  
  // Clean empty funder to avoid undefined stringification issues
  if (!data.funder) data.funder = ''
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('fact_house_fund')
  if (!sheet) throw new Error('fact_house_fund sheet not found. Run setupHouseFund() first.')
    
  return upsertRow(sheet, HOUSE_FUND_HEADERS, data, 'trx_id')
}

function deleteHouseFundTrx(data) {
  if (!data.trx_id) throw new Error('trx_id is required to delete')
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('fact_house_fund')
  if (!sheet) throw new Error('fact_house_fund sheet not found')
    
  const rows = sheet.getDataRange().getValues()
  const headers = rows[0]
  const idCol = headers.indexOf('trx_id')
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(data.trx_id)) {
      sheet.deleteRow(i + 1)
      return { success: true, trx_id: data.trx_id }
    }
  }
  
  throw new Error('Transaction not found')
}
