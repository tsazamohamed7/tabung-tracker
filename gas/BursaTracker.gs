// ╔══════════════════════════════════════════════════════╗
// ║  BursaTracker.gs — fact_bursa_tracker CRUD           ║
// ║  Tracks open market stock trades: Buy & Sell         ║
// ╚══════════════════════════════════════════════════════╝

const BURSA_HEADERS = [
  'trade_id',
  'stock_name',
  'source_fund_id',
  'status',
  'buy_date',
  'buy_lot',
  'buy_price',
  'buy_fee',
  'total_invested',
  'sell_date',
  'sell_price',
  'sell_fee',
  'total_revenue',
  'net_profit',
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all Bursa trades, newest first by buy_date.
 */
function getBursaTrades() {
  const rows = sheetToObjects(getSheet(SHEETS.BURSA_TRACKER))
  return rows.sort((a, b) => String(b.buy_date).localeCompare(String(a.buy_date)))
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates a Bursa stock trade record.
 * Auto-generates trade_id if not provided (new buy transaction).
 */
function upsertBursaTrade(data) {
  if (!data.trade_id) data.trade_id = `TRD_${Date.now()}`
  return upsertRow(getSheet(SHEETS.BURSA_TRACKER), BURSA_HEADERS, data, 'trade_id')
}
