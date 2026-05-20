// ╔══════════════════════════════════════════════════════╗
// ║  IpoTracker.gs — fact_ipo_tracker CRUD              ║
// ║  Tracks IPO lifecycle: Applied → Balloted →         ║
// ║  Listed → Sold                                      ║
// ╚══════════════════════════════════════════════════════╝

const IPO_HEADERS = [
  'ipo_id',
  'stock_name',
  'apply_date',
  'apply_stock_price',
  'apply_lot',
  'apply_amount',
  'apply_source_fund',
  'apply_source_id',
  'ballot_date',
  'allocated_lot',
  'refund_amount',
  'listing_date',
  'sell_date',
  'sell_price',
  'brokerage_fee',
  'net_profit',
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all IPO records, newest first by apply_date.
 */
function getIpos() {
  const rows = sheetToObjects(getSheet(SHEETS.IPO_TRACKER))
  return rows.sort((a, b) => String(b.apply_date).localeCompare(String(a.apply_date)))
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates an IPO record.
 *
 * Called at each lifecycle stage transition:
 *   Applied   → initial creation from "Apply for IPO" modal
 *   Balloted  → update allocated_units + refund_amount
 *   Listed    → update listing_date
 *   Sold      → update sell_price, brokerage_fee, net_profit, status = 'Sold'
 *
 * Auto-generates ipo_id if not provided (new application).
 */
function upsertIpo(data) {
  if (!data.ipo_id) data.ipo_id = `IPO_${Date.now()}`
  return upsertRow(getSheet(SHEETS.IPO_TRACKER), IPO_HEADERS, data, 'ipo_id')
}
