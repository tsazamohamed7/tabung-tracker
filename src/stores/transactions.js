/**
 * useTransactionStore — fact_transactions
 *
 * Owns:
 *  - transactions[] (the unified ledger)
 *  - addTransaction() (the single write path — all stores use this)
 *  - computed aggregates: totalIncome, totalExpenses
 *  - getSpentForCycle() helper (used by salary store for envelope progress)
 *
 * Imported by: useSalaryStore, useIpoStore, useVirtualStore, views
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'

export const useTransactionStore = defineStore('transactions', () => {
  const toast = useToast()

  const transactions = ref([])
  const loading      = ref(false)
  const fetched      = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchTransactions() {
    if (fetched.value) return
    loading.value = true
    try {
      transactions.value = await api.getTransactions()
      fetched.value = true
    } catch (err) {
      toast.error(`Failed to load transactions: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  async function refetchTransactions() {
    fetched.value = false
    await fetchTransactions()
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const totalIncome = computed(() =>
    transactions.value
      .filter(t => t.amount > 0 && t.category === 'Income')
      .reduce((s, t) => s + t.amount, 0)
  )

  const totalExpenses = computed(() =>
    transactions.value
      .filter(t => t.amount < 0 && t.category !== 'Transfer' && !(t.isCc && t.ccStatus === 'Settled'))
      .reduce((s, t) => s + t.amount, 0)
  )

  const recentTransactions = computed(() =>
    [...transactions.value]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
  )

  const activeDebts = computed(() => {
    const debts = {}
    transactions.value.forEach(t => {
      if (t.category === 'Loan') {
        const key = `${t.destId}_${t.sourceId}` // borrower_lender
        debts[key] = (debts[key] || 0) + Math.abs(t.amount)
      } else if (t.category === 'Repayment') {
        const key = `${t.sourceId}_${t.destId}` // borrower_lender
        debts[key] = (debts[key] || 0) - Math.abs(t.amount)
      }
    })

    const result = []
    for (const [key, amount] of Object.entries(debts)) {
      if (Math.abs(amount) > 0.005) {
        const [borrowerId, lenderId] = key.split('_')
        result.push({ borrowerId, lenderId, amount })
      }
    }
    return result
  })

  // ── Helpers ───────────────────────────────────────────────────────────
  /**
   * Returns total spent (absolute) for a specific envelope within a cycle.
   * Used by salary store to compute per-envelope progress bars.
   *
   * @param {string} cycleId     - e.g. '2025-06'
   * @param {string} envelopeId - FK → dim_salary_plans.template_id, e.g. 'env-food'
   */
  function getSpentForEnvelope(cycleId, envelopeId) {
    const prefix = String(cycleId).slice(0, 7)
    return transactions.value
      .filter(t => t.cycleId && String(t.cycleId).slice(0, 7) === prefix && 
        (t.envelopeId === envelopeId || t.envelopeId === `BUD_${t.cycleId}_${envelopeId}`) && 
        (t.amount < 0 || t.destId))
      .reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  /**
   * Returns total spent (absolute) for all transactions matching a specific category within a cycle.
   *
   * @param {string} cycleId  - e.g. '2025-06'
   * @param {string} category - e.g. 'Food'
   */
  function getSpentForCategory(cycleId, category) {
    const prefix = String(cycleId).slice(0, 7)
    return transactions.value
      .filter(t => t.cycleId && String(t.cycleId).slice(0, 7) === prefix && t.category === category && (t.amount < 0 || t.destId) && !(t.isCc && t.ccStatus === 'Settled'))
      .reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  // Keep legacy alias so existing callers don't break immediately
  function getSpentForCycle(cycleId, category) {
    const prefix = String(cycleId).slice(0, 7)
    return transactions.value
      .filter(t => t.cycleId && String(t.cycleId).slice(0, 7) === prefix && t.category === category && (t.amount < 0 || t.destId) && !(t.isCc && t.ccStatus === 'Settled'))
      .reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  /**
   * Returns all transactions for a given cycle.
   */
  function getTransactionsForCycle(cycleId) {
    const prefix = String(cycleId).slice(0, 7)
    return transactions.value.filter(t => t.cycleId && String(t.cycleId).slice(0, 7) === prefix)
  }

  /**
   * Groups transactions by cycle_id and computes income/spent/saved per cycle.
   * Used by salary store for cycle history.
   */
  function computeCycleHistory() {
    const app = useAppStore()
    const map = {}
    transactions.value.forEach(t => {
      if (!t.cycleId) return
      if (!map[t.cycleId]) map[t.cycleId] = { income: 0, spent: 0 }
      if (t.amount > 0 && t.category === 'Income') {
        map[t.cycleId].income += t.amount
      } else if (t.amount < 0 && t.category !== 'Transfer' && t.category !== 'IPO' && !(t.isCc && t.ccStatus === 'Settled')) {
        map[t.cycleId].spent += Math.abs(t.amount)
      }
    })

    return Object.entries(map)
      .map(([cycleId, data]) => ({
        cycleId,
        label:  cycleIdToLabel(cycleId),
        income: data.income,
        spent:  Math.round(data.spent),
        saved:  Math.round(data.income - data.spent),
        isActive: cycleId && app.currentCycle.id && String(cycleId).slice(0, 7) === String(app.currentCycle.id).slice(0, 7),
      }))
      .sort((a, b) => b.cycleId.localeCompare(a.cycleId))
  }

  function cycleIdToLabel(cycleId) {
    try {
      const [year, month] = cycleId.split('-')
      return new Date(year, month - 1).toLocaleDateString('en-MY', {
        month: 'short', year: 'numeric'
      })
    } catch { return cycleId }
  }

  // ── Write — single path for ALL transaction creation ──────────────────
  /**
   * Adds a transaction. Optimistic — rolls back on failure.
   * All other stores call THIS function instead of the API directly.
   *
   * @param {Object} txData  Partial transaction — missing fields are defaulted
   */
  async function addTransaction(txData) {
    const app = useAppStore()
    const newTx = {
      id:       `T_${Date.now()}`,
      date:     new Date().toISOString().slice(0, 10),
      cycleId:  app.currentCycle.id,
      isCc:     false,
      ccStatus: null,
      refId:    null,
      ...txData,
    }

    // Optimistic insert at top
    transactions.value.unshift(newTx)

    try {
      await api.addTransaction({
        transaction_id:         newTx.id,
        date:                   newTx.date,
        cycle_id:               newTx.cycleId,
        description:            newTx.description,
        category:               newTx.category      ?? '',
        envelope_id:            newTx.envelopeId    ?? '',
        amount:                 newTx.amount,
        source_account_id:      newTx.sourceId      ?? '',
        destination_account_id: newTx.destId        ?? '',
        is_cc_transaction:      newTx.isCc,
        cc_settlement_status:   newTx.ccStatus      ?? '',
        ref_id:                 newTx.refId         ?? '',
      })
    } catch (err) {
      transactions.value.shift()   // rollback
      toast.error(`Failed to save transaction: ${err.message}`)
      throw err
    }

    return newTx
  }

  return {
    transactions,
    loading,
    totalIncome,
    totalExpenses,
    recentTransactions,
    activeDebts,
    fetchTransactions,
    refetchTransactions,
    addTransaction,
    getSpentForEnvelope,
    getSpentForCategory,
    getSpentForCycle,          // legacy — kept for backward compat
    getTransactionsForCycle,
    computeCycleHistory,
  }
})
