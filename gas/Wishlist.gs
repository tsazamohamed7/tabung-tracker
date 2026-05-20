// ╔══════════════════════════════════════════════════════╗
// ║  Wishlist.gs — dim_wishlist CRUD                    ║
// ║  Shared partner wishlist items                      ║
// ╚══════════════════════════════════════════════════════╝

const WISH_HEADERS = [
  'item_id',
  'item_name',
  'emoji',
  'estimated_price',  // RM
  'target_fund_id',   // FK → dim_accounts.account_id
  'status',           // Planned | Saving | Purchased
  'target_date',      // e.g. "Dec 2025"
  'notes',
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all wishlist items.
 */
function getWishlist() {
  return sheetToObjects(getSheet(SHEETS.WISHLIST))
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates a wishlist item.
 * Auto-generates item_id if not provided (new item).
 */
function upsertWishlist(data) {
  if (!data.item_id) data.item_id = `W_${Date.now()}`
  return upsertRow(getSheet(SHEETS.WISHLIST), WISH_HEADERS, data, 'item_id')
}
