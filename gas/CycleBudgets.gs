// ╔══════════════════════════════════════════════════════════════╗
// ║  CycleBudgets.gs — fact_cycle_budgets CRUD                  ║
// ║                                                              ║
// ║  This is the "middle layer" between the salary template      ║
// ║  (dim_salary_plans) and actual spending (fact_transactions). ║
// ║                                                              ║
// ║  One row per envelope per cycle. Created when a new cycle    ║
// ║  starts, editable during the cycle, locked when closed.     ║
// ╚══════════════════════════════════════════════════════════════╝

const CYCLE_BUDGET_HEADERS = [
  'budget_id',          // PK  e.g. BUD_2025-06_env-food
  'cycle_id',           // FK  e.g. 2025-06
  'template_id',        // FK  → dim_salary_plans.template_id
  'envelope_name',      // Copied from template at creation
  'category',           // For matching against fact_transactions
  'planned_amount',     // Editable during cycle
  'source_account_id',  // Fund this envelope draws from
  'rollover_amount',    // Computed at close: leftover from this cycle
  'rollover_dest_id',   // Chosen at close: where to sweep leftover
  'rollover_action',    // sweep | keep | overspent (set at close)
  'is_locked',          // FALSE during cycle, TRUE after close
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns all cycle budget rows.
 * Frontend filters by cycle_id to get the active cycle's envelopes.
 * Pass ?cycle_id=2025-06 to filter server-side (optional optimisation).
 */
function getCycleBudgets(cycleId) {
  const rows = sheetToObjects(getSheet(SHEETS.CYCLE_BUDGETS))
  return cycleId ? rows.filter(r => r.cycle_id === cycleId) : rows
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates a single cycle budget row.
 * Used for:
 *   - Initial creation (startNewCycle copies template rows here)
 *   - Mid-cycle rebalancing (user edits planned_amount)
 *   - Close-cycle rollover assignment (rollover_dest_id, rollover_action)
 */
function upsertCycleBudget(data) {
  if (!data.budget_id) throw new Error('budget_id is required')
  const sheet = getSheet(SHEETS.CYCLE_BUDGETS)

  // Guard: prevent editing a locked cycle budget
  const existing = sheetToObjects(sheet).find(r => r.budget_id === data.budget_id)
  if (existing && existing.is_locked === true) {
    throw new Error(`Budget "${data.budget_id}" is locked. Closed cycles cannot be edited.`)
  }

  return upsertRow(sheet, CYCLE_BUDGET_HEADERS, data, 'budget_id')
}

/**
 * Deletes a cycle budget row.
 */
function deleteCycleBudget(data) {
  if (!data.budget_id) throw new Error('budget_id is required')
  const sheet = getSheet(SHEETS.CYCLE_BUDGETS)

  // Guard: prevent editing a locked cycle budget
  const existing = sheetToObjects(sheet).find(r => r.budget_id === data.budget_id)
  if (existing && existing.is_locked === true) {
    throw new Error(`Budget "${data.budget_id}" is locked. Closed cycles cannot be edited.`)
  }

  return deleteRow(sheet, 'budget_id', data.budget_id)
}

// ── Close Cycle Workflow ──────────────────────────────────────────────────

/**
 * closeCycle — triggered by "Close Cycle" → "Confirm & Sweep" in the view.
 *
 * Steps:
 *  1. Validate all envelopes have a rollover decision (sweep or keep)
 *  2. For each envelope where action = 'sweep':
 *     a. Create a Transfer transaction: source_account → rollover_dest
 *     b. Amount = rollover_amount (the leftover)
 *  3. Mark all cycle budgets for this cycle as is_locked = TRUE
 *  4. Return a summary
 *
 * @param {string}   cycle_id    The cycle being closed e.g. "2025-06"
 * @param {string}   close_date  YYYY-MM-DD
 * @param {Object[]} decisions   Array of { budget_id, rollover_action, rollover_dest_id, rollover_amount }
 *                               — the user's per-envelope rollover choices from the modal
 */
function closeCycle({ cycle_id, close_date, decisions }) {
  if (!cycle_id || !close_date || !decisions?.length) {
    throw new Error('closeCycle requires cycle_id, close_date, and decisions[]')
  }

  const sheet   = getSheet(SHEETS.CYCLE_BUDGETS)
  const budgets = sheetToObjects(sheet).filter(r => r.cycle_id === cycle_id)

  if (!budgets.length) throw new Error(`No budgets found for cycle "${cycle_id}"`)
  if (budgets[0].is_locked === true) throw new Error(`Cycle "${cycle_id}" is already closed`)

  const sweepTxIds = []
  const kept       = []
  const overspent  = []

  // ── Step 1: Apply rollover decisions ──────────────────────────────────
  for (const decision of decisions) {
    const budget = budgets.find(b => b.budget_id === decision.budget_id)
    if (!budget) continue

    const amount = Number(decision.rollover_amount) || 0

    if (decision.rollover_action === 'sweep' && amount > 0) {
      // Create a sweep transfer transaction
      const txId = `T_SWEEP_${cycle_id}_${budget.template_id}`
      addTransaction({
        transaction_id:         txId,
        date:                   close_date,
        cycle_id,
        description:            `Rollover: ${budget.envelope_name} → sweep`,
        category:               'Transfer',
        amount:                 amount,
        source_account_id:      budget.source_account_id,
        destination_account_id: decision.rollover_dest_id,
        is_cc_transaction:      false,
        cc_settlement_status:   '',
        ref_id:                 '',
      })
      sweepTxIds.push(txId)

    } else if (amount < 0) {
      overspent.push({ envelope: budget.envelope_name, amount: Math.abs(amount) })
    } else {
      kept.push({ envelope: budget.envelope_name, amount })
    }

    // Update the budget row with rollover details
    upsertRow(sheet, CYCLE_BUDGET_HEADERS, {
      ...budget,
      rollover_amount:  amount,
      rollover_action:  decision.rollover_action,
      rollover_dest_id: decision.rollover_dest_id || '',
      is_locked:        true,
    }, 'budget_id')
  }

  return {
    cycle_id,
    status:           'closed',
    sweeps_created:   sweepTxIds.length,
    sweep_tx_ids:     sweepTxIds,
    kept_envelopes:   kept.length,
    overspent_count:  overspent.length,
    overspent,
  }
}
