// ╔══════════════════════════════════════════════════════╗
// ║  Transactions.gs — fact_transactions CRUD           ║
// ║  The unified ledger. Append-only by design.         ║
// ╚══════════════════════════════════════════════════════╝

const TX_HEADERS = [
  'transaction_id',
  'date',
  'cycle_id',
  'description',
  'category',               // Income | Transfer | Food | Bills | Shopping | Transport | IPO | Personal | Family | Business | Tax | Savings
  'envelope_id',            // FK → dim_salary_plans.template_id
  'amount',                 // Positive = credit, Negative = debit
  'source_account_id',      // FK → dim_accounts.account_id
  'destination_account_id', // FK → dim_accounts.account_id (transfers only)
  'is_cc_transaction',      // TRUE / FALSE
  'cc_settlement_status',   // Pending | Settled | (blank)
  'ref_id',                 // FK → fact_ipo_tracker.ipo_id or fact_cc_bridge.bridge_id
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all transactions. Frontend filters by cycle_id, category, etc.
 * For large datasets, consider adding ?cycle_id= param and filtering here.
 */
function getTransactions() {
  return sheetToObjects(getSheet(SHEETS.TRANSACTIONS))
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Appends a new transaction row. Transactions are immutable by design —
 * never update or delete; create correcting entries instead.
 * Auto-generates a transaction_id if not provided.
 * If is_cc_transaction is true, it automatically creates a corresponding bridge record.
 */
function addTransaction(data) {
  // 1. Ensure we have a transaction ID
  if (!data.transaction_id) {
    data.transaction_id = `T_${Date.now()}`;
  }

  // 2. CC BRIDGE INTEGRATION
  // Check if this is a Credit Card charge (sent as boolean or string "true")
  const isCc = data.is_cc_transaction === true || String(data.is_cc_transaction).toUpperCase() === 'TRUE';

  if (isCc) {
    // Generate a unique Bridge ID
    const bridgeId = `CC_${Date.now()}`;
    
    // Link the transaction to the bridge record using ref_id
    data.ref_id = bridgeId;
    
    // Prepare the bridge entry based on CC_HEADERS in CcBridge.gs
    const bridgeEntry = {
      bridge_id: bridgeId,
      transaction_id: data.transaction_id,
      description: data.description,
      amount: Math.abs(data.amount), // Bridge sheet expects positive RM values
      charge_date: data.date,
      funding_source_id: data.source_account_id,
      status: 'Unassigned'           // Initial status for the Reconciliation Wizard
    };

    // Save to fact_cc_bridge using the function in CcBridge.gs
    try {
      upsertCcBridge(bridgeEntry);
    } catch (e) {
      console.error("Failed to create CC Bridge record: " + e.message);
      // Optional: stop execution if bridge creation is critical
      // throw new Error("Bridge creation failed: " + e.message);
    }
  }

  // 3. BALANCE SYNC INTEGRATION
  // Automatically update dim_accounts sheet
  if (data.source_account_id) {
    // Transfers, Loans, and Repayments always deduct from the source account.
    // Expenses (-) also deduct, while Income (+) adds.
    // If destination_account_id is present alongside source, it's definitely a transfer out.
    const isTransferLike = ['Transfer', 'Loan', 'Repayment'].includes(data.category) || !!data.destination_account_id;
    const delta = isTransferLike ? -Math.abs(data.amount) : Number(data.amount);
    adjustAccountBalance(data.source_account_id, delta);
  }
  if (data.destination_account_id) {
    // Destination always gains the amount (Transfers, Refunds)
    adjustAccountBalance(data.destination_account_id, Math.abs(data.amount));
  }

  // 4. Write the transaction to the unified ledger
  appendRow(getSheet(SHEETS.TRANSACTIONS), TX_HEADERS, data);

  return { 
    transaction_id: data.transaction_id,
    bridge_id: data.ref_id || null 
  };
}


/**
 * Updates only the status of a transaction. 
 * Used for the 'State-Change Exception' in CC reconciliation.
 */
function updateTransactionStatus(txId, newStatus) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  
  const idIdx = headers.indexOf('transaction_id');
  const statusIdx = headers.indexOf('cc_settlement_status');
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === txId) {
      sheet.getRange(i + 1, statusIdx + 1).setValue(newStatus);
      return true;
    }
  }
  return false;
}
