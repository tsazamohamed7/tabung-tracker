// ╔══════════════════════════════════════════════════════╗
// ║  Accounts.gs — dim_accounts CRUD                    ║
// ║  Manages physical + virtual fund account registry   ║
// ╚══════════════════════════════════════════════════════╝

const ACCOUNT_HEADERS = [
  'account_id',
  'bank_name',
  'label',
  'type',                   // Virtual | Physical | CC
  'physical_account_link',  // FK → physical bank id
  'initial_balance',
  'balance',
  'goal_amount',
  'goal_date',
  'cc_expiry',
  'cc_last_4',
  'is_active',
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all active and inactive accounts from dim_accounts.
 * Frontend filters is_active === true for display.
 */
function getAccounts() {
  return sheetToObjects(getSheet(SHEETS.ACCOUNTS))
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates an account row.
 * Used for:
 *   - Creating new virtual funds (VirtualTabung "Add Fund")
 *   - Editing fund labels / goals (VirtualTabung "Edit Fund")
 *   - Updating balance after a virtual transfer (balance sync)
 */
function upsertAccount(data) {
  if (!data.account_id) throw new Error('account_id is required')
  return upsertRow(getSheet(SHEETS.ACCOUNTS), ACCOUNT_HEADERS, data, 'account_id')
}
/**
 * Adjusts an account's balance by a delta (positive or negative).
 */
function adjustAccountBalance(accountId, delta) {
  if (!accountId) return;
  const sheet = getSheet(SHEETS.ACCOUNTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('account_id');
  const balCol = headers.indexOf('balance');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(accountId)) {
      const current = Number(data[i][balCol]) || 0;
      sheet.getRange(i + 1, balCol + 1).setValue(current + delta);
      return;
    }
  }
}
