// ╔══════════════════════════════════════════════════════╗
// ║  CcBridge.gs — fact_cc_bridge CRUD                  ║
// ║  Maps CC charges to virtual funding sources         ║
// ╚══════════════════════════════════════════════════════╝

const CC_HEADERS = [
  'bridge_id',
  'transaction_id',    // FK → fact_transactions.transaction_id
  'description',       // Item description (copied from transaction)
  'amount',            // CC charge amount (RM, positive)
  'charge_date',
  'funding_source_id', // FK → dim_accounts.account_id (virtual fund to pay from)
  'settlement_date',   // Date CC bill was paid
  'status',            // Unassigned | Assigned | Settled
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all CC bridge records.
 * Frontend filters by status to show pending/unassigned items.
 */
function getCcBridge() {
  return sheetToObjects(getSheet(SHEETS.CC_BRIDGE))
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates a CC bridge record AND updates the source transaction metadata.
 */
function upsertCcBridge(data) {
  if (!data.bridge_id) data.bridge_id = `CC_${Date.now()}`;
  return upsertRow(getSheet(SHEETS.CC_BRIDGE), CC_HEADERS, data, 'bridge_id');
}

/**
 * Orchestrates the Hybrid Assignment:
 * 1. Creates a new funding row from Salary/Virtual Fund
 * 2. Updates original CC transaction status to 'Settled'
 * 3. Updates the bridge record
 */
function assignCcFunding(payload) {
  const { bridge_id, transaction_id, funding_source_id, category, envelope_id, cycle_id } = payload;
  
  // 1. Get original transaction to know which CC was used
  const txSheet = getSheet(SHEETS.TRANSACTIONS);
  const allTxs = getTransactions();
  const originalTx = allTxs.find(t => t.transaction_id === transaction_id);
  
  if (!originalTx) throw new Error("Original transaction not found");

  // i. Format Date to yyyy-MM-dd
  const formattedDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");

  // ii. Clean Envelope ID (Removes BUD_... prefix if exists)
  // e.g., "BUD_2026-03_env-free-1-25" -> "env-free-1-25"
  const cleanEnvelopeId = envelope_id && envelope_id.includes('_') 
    ? envelope_id.split('_').pop() 
    : envelope_id;

  // iii. Conditional Cycle ID logic
  // If the funding source matches the original CC's salary target, use cycle_id.
  // We check if a category/envelope was provided as a proxy for 'Salary' selection.
  const finalCycleId = (category && envelope_id) ? cycle_id : "";

  // 2. Create the NEW Funding Transaction (The Budget Hit)
  const fundingTx = {
    date: formattedDate,
    cycle_id: finalCycleId,
    description: `${originalTx.description}`,
    category: category || 'Transfer',
    envelope_id: cleanEnvelopeId || '',
    amount: -Math.abs(originalTx.amount), // Negative to deduct from Salary/Fund
    source_account_id: funding_source_id,
    destination_account_id: originalTx.source_account_id, // Moves money TO the CC
    is_cc_transaction: false,
    cc_settlement_status: 'Settled',
    ref_id: bridge_id
  };
  addTransaction(fundingTx);

  // 3. Update Original Transaction Status to 'Settled'
  updateTransactionStatus(transaction_id, 'Settled');

  // 4. Update the CC Bridge Record
  const bridgeData = {
    bridge_id: bridge_id,
    funding_source_id: funding_source_id,
    settlement_date: formattedDate,
    status: 'Settled'
  };
  return upsertRow(getSheet(SHEETS.CC_BRIDGE), CC_HEADERS, bridgeData, 'bridge_id');
}
