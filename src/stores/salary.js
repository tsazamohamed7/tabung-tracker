/**
 * useSalaryStore — salary planning & cycle management
 *
 * Owns:
 * - envelopes[]      dim_salary_plans (the reusable template)
 * - cycleBudgets[]   fact_cycle_budgets (per-cycle editable plan)
 * - startNewCycle(), closeCycle(), updateEnvelopeAllocation()
 * - All derived computeds: cycleBudgetsWithSpent, cycleHistory,
 * paydayStepState, previousCycleRollovers
 *
 * Imports: useAppStore, useTransactionStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { useTransactionStore } from '@/stores/transactions'

const CATEGORY_COLORS = {
  Charity: '#a78bfa', // Purple (Gentle/Giving)
  Debt: '#f87171', // Red (Urgent/Repayment)
  Food: '#fb923c', // Orange (Energy/Vitality)
  Bills: '#94a3b8', // Slate (Administrative)
  Family: '#4ade80', // Light Green (Nurturing)
  Personal: '#f472b6', // Pink (Self-care)
  Transport: '#60a5fa', // Blue (Movement/Travel)
  Invest: '#2dd4bf', // Teal (Wealth Building)
  Saving: '#10b981', // Emerald (Security/Growth)
  Business: '#818cf8', // Indigo (Professional)
  Tax: '#fbbf24', // Amber (Compliance)
  Utilities: '#22d3ee', // Cyan (Infrastructure)
  Others: '#a8a29e', // Stone (Miscellaneous)
}

export const SALARY_CATEGORIES = Object.keys(CATEGORY_COLORS)


export const useSalaryStore = defineStore('salary', () => {
  const toast = useToast()
  const app = useAppStore()
  const txStore = useTransactionStore()

  const envelopes = ref([])   // dim_salary_plans — the template
  const cycleBudgets = ref([])   // fact_cycle_budgets — per-cycle plan

  const loading = ref({ envelopes: false, cycleBudgets: false })
  const fetched = ref({ envelopes: false, cycleBudgets: false })

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchEnvelopes() {
    if (fetched.value.envelopes) return
    loading.value.envelopes = true
    try {
      envelopes.value = await api.getSalaryPlans()
      fetched.value.envelopes = true
    } catch (err) {
      toast.error(`Failed to load salary plans: ${err.message}`)
    } finally {
      loading.value.envelopes = false
    }
  }

  async function fetchCycleBudgets() {
    if (fetched.value.cycleBudgets) return
    loading.value.cycleBudgets = true
    try {
      cycleBudgets.value = await api.getCycleBudgets()
      fetched.value.cycleBudgets = true
    } catch (err) {
      toast.error(`Failed to load cycle budgets: ${err.message}`)
    } finally {
      loading.value.cycleBudgets = false
    }
  }

  async function refetchCycleBudgets() {
    fetched.value.cycleBudgets = false
    await fetchCycleBudgets()
  }

  // ── Computed ──────────────────────────────────────────────────────────

  /** Budgets for the currently active cycle only */
  const activeCycleBudgets = computed(() =>
    cycleBudgets.value.filter(b => b.cycleId && app.currentCycle.id && String(b.cycleId).slice(0, 7) === String(app.currentCycle.id).slice(0, 7))
  )

  /** * Active cycle budgets grouped by Category.
   * Returns: Array<{ category, color, planned, spent, remaining, pct, envelopes[] }>
   */
  const cycleBudgetsWithSpent = computed(() => {
    const groups = {}

    activeCycleBudgets.value.forEach(budget => {
      const cat = budget.category || 'Others'
      // ✅ Match by envelope_id (templateId) — not category — for accurate per-envelope spend
      const envelopeId = budget.templateId ?? budget.id
      const spent = txStore.getSpentForEnvelope(app.currentCycle.id, envelopeId)

      if (!groups[cat]) {
        groups[cat] = {
          category: cat,
          color: CATEGORY_COLORS[cat] ?? '#8a8a96',
          planned: 0,
          spent: 0,
          remaining: 0,
          pct: 0,
          envelopes: []
        }
      }

      const envelopeData = {
        ...budget,
        spent: Math.round(spent),
        remaining: Math.round(budget.planned - spent),
        pct: budget.planned > 0 ? Math.round((spent / budget.planned) * 100) : 0
      }

      groups[cat].envelopes.push(envelopeData)
      groups[cat].planned += budget.planned
    })

    // Compute accurate category-level spent by summing ALL transactions for the category string
    return Object.values(groups).map(g => {
      g.spent = Math.round(txStore.getSpentForCategory(app.currentCycle.id, g.category))
      g.planned = Math.round(g.planned)
      g.remaining = Math.round(g.planned - g.spent)
      g.pct = g.planned > 0 ? Math.round((g.spent / g.planned) * 100) : 0
      return g
    }).sort((a, b) => a.category.localeCompare(b.category))
  })

  /** Total allocated across all active envelopes */
  const totalAllocated = computed(() =>
    activeCycleBudgets.value.reduce((s, b) => s + b.planned, 0)
  )

  /** How much income is left to allocate */
  const unallocated = computed(() => {
    const income = txStore.getTransactionsForCycle(app.currentCycle.id)
      .filter(t => t.category === 'Income')
      .reduce((s, t) => s + t.amount, 0)
    return income - totalAllocated.value
  })

  /** Template total — sum of all dim_salary_plans amounts */
  const templateTotal = computed(() =>
    envelopes.value.reduce((s, e) => s + e.planned, 0)
  )

  /**
   * Cycle history — computed from all transactions grouped by cycle_id.
   * No hardcoding — reads real transaction data.
   */
  const cycleHistory = computed(() => txStore.computeCycleHistory())

  /**
   * Rollovers from the PREVIOUS cycle.
   * Computes leftover = planned - spent for each envelope.
   */
  const previousCycleRollovers = computed(() => {
    const prevId = getPreviousCycleId(app.currentCycle.id)
    if (!prevId) return []
    const prefix = String(prevId).slice(0, 7)
    const prevBudgets = cycleBudgets.value.filter(b => b.cycleId && String(b.cycleId).slice(0, 7) === prefix)
    if (!prevBudgets.length) return []

    return prevBudgets.map(budget => {
      const envelopeId = budget.templateId ?? budget.id
      const spent = txStore.getSpentForEnvelope(prevId, envelopeId)
      const leftover = Math.round(budget.planned - spent)
      return {
        budgetId: budget.id,
        templateId: budget.templateId,
        name: budget.name,
        category: budget.category,
        color: CATEGORY_COLORS[budget.category] ?? '#8a8a96',
        planned: budget.planned,
        spent: Math.round(spent),
        leftover,
        sourceId: budget.sourceId,
        isOverspent: leftover < 0,
        isLocked: budget.isLocked,
      }
    })
  })

  /**
   * Payday stepper state — each step derived from real transaction data.
   * Never hardcoded.
   */
  const paydayStepState = computed(() => {
    const cid = app.currentCycle.id
    const txs = txStore.getTransactionsForCycle(cid)

    const incomeReceived = txs.some(t => t.category === 'Income')
    const planCreated = activeCycleBudgets.value.length > 0
    const billsPaid = txs.some(t => t.category === 'Bills') &&
      !txs.some(t => t.category === 'Bills' && t.ccStatus === 'Pending')
    const cycleClosed = activeCycleBudgets.value.length > 0 &&
      activeCycleBudgets.value.every(b => b.isLocked)

    return [
      {
        label: 'Income\nReceived',
        done: incomeReceived,
        hint: incomeReceived ? 'Income recorded in ledger' : 'Awaiting salary deposit',
      },
      {
        label: 'Plan\nCreated',
        done: planCreated,
        hint: planCreated
          ? `${activeCycleBudgets.value.length} envelopes planned`
          : 'Start a new cycle to create envelopes',
      },
      {
        label: 'Bills\nPaid',
        done: billsPaid,
        hint: billsPaid ? 'All bills settled' : 'Bills pending confirmation',
      },
      {
        label: 'Cycle\nClosed',
        done: cycleClosed,
        hint: cycleClosed ? 'Rollovers swept ✓' : 'Use Close Cycle when done',
      },
    ]
  })

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Edit a single envelope allocation. Rebalancing enforced in the view. */
  async function updateEnvelopeAllocation(budgetId, newAmount) {
    const budget = cycleBudgets.value.find(b => b.id === budgetId)
    if (!budget) return
    if (budget.isLocked) { toast.error('This cycle is closed'); return }

    const prev = budget.planned
    budget.planned = newAmount   // optimistic

    try {
      await api.upsertCycleBudget({
        budget_id: budget.id,
        cycle_id: budget.cycleId,
        template_id: budget.templateId,
        envelope_name: budget.name,
        category: budget.category,
        planned_amount: newAmount,
        source_account_id: budget.sourceId,
        rollover_amount: budget.rolloverAmount ?? '',
        rollover_dest_id: budget.rolloverDestId ?? '',
        rollover_action: budget.rolloverAction ?? '',
        is_locked: false,
      })
    } catch (err) {
      budget.planned = prev   // rollback
      toast.error(`Failed to update allocation: ${err.message}`)
      throw err
    }
  }
  async function addCycleBudget(data) {
    const budgetId = `BUD_${app.currentCycle.id}_${Date.now()}`
    const newBudget = {
      id: budgetId,
      cycleId: app.currentCycle.id,
      templateId: `env-custom-${Date.now()}`,
      name: data.name,
      category: data.category,
      planned: data.planned,
      sourceId: data.sourceId,
      rolloverAmount: null,
      rolloverDestId: null,
      rolloverAction: null,
      isLocked: false
    }

    cycleBudgets.value.push(newBudget)

    try {
      await api.upsertCycleBudget({
        budget_id: newBudget.id,
        cycle_id: newBudget.cycleId,
        template_id: newBudget.templateId,
        envelope_name: newBudget.name,
        category: newBudget.category,
        planned_amount: newBudget.planned,
        source_account_id: newBudget.sourceId,
        rollover_amount: '',
        rollover_dest_id: '',
        rollover_action: '',
        is_locked: false,
      })
      toast.success('Envelope added')
    } catch (err) {
      cycleBudgets.value = cycleBudgets.value.filter(b => b.id !== budgetId)
      toast.error(`Failed to add envelope: ${err.message}`)
      throw err
    }
  }

  async function editCycleBudget(budgetId, data) {
    const budget = cycleBudgets.value.find(b => b.id === budgetId)
    if (!budget) return
    if (budget.isLocked) { toast.error('This cycle is closed'); return }

    const prev = { ...budget }
    budget.name = data.name
    budget.category = data.category
    budget.planned = data.planned
    budget.sourceId = data.sourceId

    try {
      await api.upsertCycleBudget({
        budget_id: budget.id,
        cycle_id: budget.cycleId,
        template_id: budget.templateId,
        envelope_name: budget.name,
        category: budget.category,
        planned_amount: budget.planned,
        source_account_id: budget.sourceId,
        rollover_amount: budget.rolloverAmount ?? '',
        rollover_dest_id: budget.rolloverDestId ?? '',
        rollover_action: budget.rolloverAction ?? '',
        is_locked: false,
      })
      toast.success('Envelope updated')
    } catch (err) {
      Object.assign(budget, prev)
      toast.error(`Failed to update envelope: ${err.message}`)
      throw err
    }
  }

  async function deleteCycleBudget(budgetId) {
    const budgetIndex = cycleBudgets.value.findIndex(b => b.id === budgetId)
    if (budgetIndex === -1) return
    const budget = cycleBudgets.value[budgetIndex]
    if (budget.isLocked) { toast.error('This cycle is closed'); return }

    const prev = cycleBudgets.value[budgetIndex]
    cycleBudgets.value.splice(budgetIndex, 1)

    try {
      await api.deleteCycleBudget({ budget_id: budgetId })
      toast.success('Envelope removed')
    } catch (err) {
      cycleBudgets.value.splice(budgetIndex, 0, prev)
      toast.error(`Failed to remove envelope: ${err.message}`)
      throw err
    }
  }
  /** Start a new salary cycle — creates fact_cycle_budgets from template */
  async function startNewCycle({ cycleId, income, sourceId, startDate }) {
    try {
      // We now use the full startDate (YYYY-MM-DD) as the primary cycle identifier
      // to ensure Google Sheets stores the correct date in app_settings.
      const result = await api.startNewCycle({
        cycle_id: startDate,
        income_amount: income,
        income_source_id: sourceId,
        start_date: startDate,
      })
      // Switch active cycle in app settings to the full date
      await app.setActiveCycle(startDate)
      // Refresh cycle budgets + transactions
      await Promise.all([refetchCycleBudgets(), txStore.refetchTransactions()])
      toast.success(`Cycle ${startDate} started — ${result.budgets_created} envelopes created`)
      return result
    } catch (err) {
      toast.error(`Failed to start cycle: ${err.message}`)
      throw err
    }
  }

  /** Close cycle — sweep rollovers, lock all budgets */
  async function closeCycle({ cycleId, closeDate, decisions }) {
    try {
      const result = await api.closeCycle({
        cycle_id: cycleId,
        close_date: closeDate,
        decisions,
      })
      // Lock budgets locally
      cycleBudgets.value
        .filter(b => b.cycleId === cycleId)
        .forEach(b => { b.isLocked = true })
      // Refresh transactions (sweep Transfer rows created server-side)
      await txStore.refetchTransactions()
      toast.success(`Cycle ${cycleId} closed — ${result.sweeps_created} rollover(s) swept`)
      return result
    } catch (err) {
      toast.error(`Failed to close cycle: ${err.message}`)
      throw err
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function getPreviousCycleId(cycleId) {
    try {
      const [year, month] = cycleId.split('-').map(Number)
      const prev = new Date(year, month - 2)
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    } catch { return null }
  }

  const categoryColor = (cat) => CATEGORY_COLORS[cat] ?? '#8a8a96'

  return {
    envelopes,
    cycleBudgets,
    loading,
    // Computed
    activeCycleBudgets,
    cycleBudgetsWithSpent,
    totalAllocated,
    unallocated,
    templateTotal,
    cycleHistory,
    previousCycleRollovers,
    paydayStepState,
    // Actions
    fetchEnvelopes,
    fetchCycleBudgets,
    refetchCycleBudgets,
    updateEnvelopeAllocation,
    addCycleBudget,
    editCycleBudget,
    deleteCycleBudget,
    startNewCycle,
    closeCycle,
    // Helpers
    categoryColor,
    getPreviousCycleId,
  }
})