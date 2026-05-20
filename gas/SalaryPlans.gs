// ╔══════════════════════════════════════════════════════════════╗
// ║  SalaryPlans.gs — dim_salary_plans CRUD                     ║
// ║  + startNewCycle payday workflow                            ║
// ╚══════════════════════════════════════════════════════════════╝

const PLAN_HEADERS = [
  'template_id',
  'item_name',
  'category',
  'planned_amount',
  'priority',          // Allocation order — 1 = first
  'default_source_id', // FK → dim_accounts.account_id
]

// ── Read ──────────────────────────────────────────────────────────────────

function getSalaryPlans() {
  const rows = sheetToObjects(getSheet(SHEETS.SALARY_PLANS))
  return rows.sort((a, b) => Number(a.priority) - Number(b.priority))
}

// ── Write ─────────────────────────────────────────────────────────────────

function upsertSalaryPlan(data) {
  if (!data.template_id) throw new Error('template_id is required')
  return upsertRow(getSheet(SHEETS.SALARY_PLANS), PLAN_HEADERS, data, 'template_id')
}

// ── Start New Cycle ───────────────────────────────────────────────────────

/**
 * startNewCycle — triggered by "▶ Start New Cycle" button
 *
 * Steps:
 *  1. Validate the cycle doesn't already exist in fact_cycle_budgets
 *  2. Read dim_salary_plans (the template)
 *  3. Create one fact_cycle_budgets row per envelope
 *     (planned_amount copied from template — user can edit after)
 *  4. Create the Income transaction in fact_transactions
 *
 * NOTE: Envelope allocation Transfer transactions are NOT created here.
 * They are created when the cycle is CLOSED via closeCycle(), reflecting
 * the final edited amounts rather than the template defaults.
 *
 * @param {string} cycle_id         e.g. "2025-07"
 * @param {number} income_amount    Total salary (RM)
 * @param {string} income_source_id FK → dim_accounts (e.g. "maybank-rolling")
 * @param {string} start_date       YYYY-MM-DD (the 25th)
 */
function startNewCycle({ cycle_id, income_amount, income_source_id, start_date }) {
  if (!cycle_id || !income_amount || !income_source_id || !start_date) {
    throw new Error('startNewCycle: all four params are required')
  }

  // Guard: prevent duplicate cycles
  const existing = getCycleBudgets(cycle_id)
  if (existing.length > 0) {
    throw new Error(`Cycle "${cycle_id}" already exists. Use a different cycle ID.`)
  }

  const plans    = getSalaryPlans()
  const budgetIds = []

  // ── Step 1: Create fact_cycle_budgets rows from template ───────────────
  plans.forEach(plan => {
    const budgetId = `BUD_${cycle_id}_${plan.template_id}`
    upsertCycleBudget({
      budget_id:         budgetId,
      cycle_id,
      template_id:       plan.template_id,
      envelope_name:     plan.item_name,
      category:          plan.category,
      planned_amount:    plan.planned_amount,
      source_account_id: plan.default_source_id,
      rollover_amount:   '',
      rollover_dest_id:  '',
      rollover_action:   '',
      is_locked:         false,
    })
    budgetIds.push(budgetId)
  })

  // ── Step 2: Create the Income transaction ──────────────────────────────
  const incomeTxId = `T_INCOME_${cycle_id}`
  addTransaction({
    transaction_id:         incomeTxId,
    date:                   start_date,
    cycle_id,
    description:            'Salary — Main Job',
    category:               'Income',
    amount:                 income_amount,
    source_account_id:      income_source_id,
    destination_account_id: '',
    is_cc_transaction:      false,
    cc_settlement_status:   '',
    ref_id:                 '',
  })


  return {
    cycle_id,
    budgets_created:    budgetIds.length,
    income_tx_id:       incomeTxId,
    budget_ids:         budgetIds,
  }
}
