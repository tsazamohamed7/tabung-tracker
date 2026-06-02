// ╔══════════════════════════════════════════════════════╗
// ║  Config.gs — Global constants & shared DB helpers   ║
// ║  All other .gs files read from this file.           ║
// ╚══════════════════════════════════════════════════════╝

const SHEET_ID = '[YOUR_SHEET_ID]'

const SHEETS = {
  APP_SETTINGS:  'app_settings',
  ACCOUNTS:      'dim_accounts',
  TRANSACTIONS:  'fact_transactions',
  SALARY_PLANS:  'dim_salary_plans',
  CYCLE_BUDGETS: 'fact_cycle_budgets',
  IPO_TRACKER:   'fact_ipo_tracker',
  BURSA_TRACKER: 'fact_bursa_tracker',
  CC_BRIDGE:     'fact_cc_bridge',
  WISHLIST:      'dim_wishlist',
}

// ── Low-level sheet access ────────────────────────────────────────────────

/**
 * Returns a Sheet object by name from the configured spreadsheet.
 * Throws a clear error if the sheet doesn't exist (e.g. Setup.gs not run yet).
 */
function getSheet(name) {
  const ss    = SpreadsheetApp.openById(SHEET_ID)
  const sheet = ss.getSheetByName(name)
  if (!sheet) throw new Error(`Sheet "${name}" not found. Have you run setupTabungTracker() yet?`)
  return sheet
}

/**
 * Reads all rows from a sheet and returns them as an array of plain objects,
 * keyed by the header row values. Empty first-column rows are skipped.
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues()
  if (data.length < 2) return []
  const headers = data[0]
  return data
    .slice(1)
    .filter(row => row[0] !== '' && row[0] !== null && row[0] !== undefined)
    .map(row => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = row[i] })
      return obj
    })
}

/**
 * Appends a new row to the sheet using the provided headers as column order.
 * Any key missing from obj is written as an empty string.
 */
function appendRow(sheet, headers, obj) {
  sheet.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''))
}

/**
 * Upserts a row by matching obj[idKey] against the id column.
 * - If a matching row is found, updates it in-place (preserves unset columns).
 * - If not found, appends a new row.
 * Returns { action: 'updated'|'inserted', id }
 */
function upsertRow(sheet, headers, obj, idKey) {
  const data  = sheet.getDataRange().getValues()
  const idCol = data[0].indexOf(idKey)
  if (idCol === -1) throw new Error(`Column "${idKey}" not found in "${sheet.getName()}"`)

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(obj[idKey])) {
      const newRow = headers.map(h => {
        const col = data[0].indexOf(h)
        return obj[h] !== undefined ? obj[h] : (col !== -1 ? data[i][col] : '')
      })
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow])
      return { action: 'updated', id: obj[idKey] }
    }
  }

  appendRow(sheet, headers, obj)
  return { action: 'inserted', id: obj[idKey] }
}

/**
 * Deletes a row matching idValue in idKey column.
 */
function deleteRow(sheet, idKey, idValue) {
  const data  = sheet.getDataRange().getValues()
  const idCol = data[0].indexOf(idKey)
  if (idCol === -1) throw new Error(`Column "${idKey}" not found in "${sheet.getName()}"`)

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(idValue)) {
      sheet.deleteRow(i + 1)
      return { action: 'deleted', id: idValue }
    }
  }
  throw new Error(`Row with ${idKey}="${idValue}" not found for deletion`)
}
