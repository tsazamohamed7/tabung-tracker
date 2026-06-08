/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TABUNG TRACKER — HOUSE FUND SETUP ADDENDUM                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  HOW TO USE:                                                 ║
 * ║  1. Run `setupHouseFund()` from the Apps Script editor       ║
 * ║  2. It will add the `fact_house_fund` sheet securely         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const HOUSE_FUND_SCHEMA = {
  fact_house_fund: {
    color: '#3f51b5',  // indigo
    columns: [
      { header: 'trx_id',      width: 140, note: 'Primary key. e.g. HF001' },
      { header: 'date',        width: 110, note: 'YYYY-MM-DD' },
      { header: 'type',        width: 120, note: 'Contribution | Expense | Withdrawal' },
      { header: 'funder',      width: 140, note: 'Funder A | Funder B | Funder C | (blank for expenses)' },
      { header: 'amount',      width: 120, note: 'Amount in RM' },
      { header: 'description', width: 250, note: 'Details' },
    ],
    seed: [
      ['HF001', '2025-06-01', 'Contribution', 'Funder A', 10000, 'Initial deposit for piling'],
      ['HF002', '2025-06-05', 'Contribution', 'Funder B', 5000,  'Progress payment 1'],
      ['HF003', '2025-06-10', 'Expense',      '',         -3500, 'Paid contractor for foundation work'],
    ]
  }
}

function setupHouseFund() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheetName = 'fact_house_fund'
  const config = HOUSE_FUND_SCHEMA[sheetName]
  
  let sheet = ss.getSheetByName(sheetName)
  if (sheet) {
    Logger.log('fact_house_fund sheet already exists.')
    return
  }

  sheet = ss.insertSheet(sheetName)
  const headers = config.columns.map(c => c.header)
  
  // Headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length)
  headerRange.setValues([headers])
  headerRange
    .setBackground(config.color)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontFamily('Google Sans')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left')
    .setBorder(false, false, true, false, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_MEDIUM)

  sheet.setRowHeight(1, 36)
  sheet.setFrozenRows(1)

  // Columns & Notes
  config.columns.forEach((col, i) => {
    sheet.setColumnWidth(i + 1, col.width)
    if (col.note) {
      sheet.getRange(1, i + 1).setNote(col.note)
    }
  })

  // Formatting
  sheet.getRange(2, 2, 500, 1).setNumberFormat('yyyy-mm-dd')
  sheet.getRange(2, 5, 500, 1).setNumberFormat('#,##0.00')

  // Validation
  const typeRule = SpreadsheetApp.newDataValidation().requireValueInList(['Contribution', 'Expense', 'Withdrawal'], true).build()
  sheet.getRange(2, 3, 500, 1).setDataValidation(typeRule)

  const funderRule = SpreadsheetApp.newDataValidation().requireValueInList(['Funder A', 'Funder B', 'Funder C', ''], true).build()
  sheet.getRange(2, 4, 500, 1).setDataValidation(funderRule)

  // Seed Data
  if (config.seed && config.seed.length > 0) {
    const seedRange = sheet.getRange(2, 1, config.seed.length, headers.length)
    seedRange.setValues(config.seed)
    seedRange.setFontSize(10).setFontFamily('Google Sans').setVerticalAlignment('middle')
  }

  Logger.log('fact_house_fund sheet created successfully.')
  SpreadsheetApp.getUi().alert('House Fund sheet successfully added.')
}
