import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

export const useHouseFundStore = defineStore('houseFund', () => {
  const toast        = useToast()
  const transactions = ref([])
  const loading      = ref(false)
  const fetched      = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchHouseFund() {
    if (fetched.value) return
    loading.value = true
    try {
      const data = await api.getHouseFund()
      // Sort by date descending
      transactions.value = data.sort((a, b) => new Date(b.date) - new Date(a.date))
      fetched.value = true
    } catch (err) {
      toast.error(`Failed to load house fund: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  
  const totalContributed = computed(() => {
    return transactions.value
      .filter(t => t.type === 'Contribution' || t.type === 'Withdrawal')
      .reduce((sum, t) => {
        const amt = Math.abs(Number(t.amount) || 0)
        return t.type === 'Withdrawal' ? sum - amt : sum + amt
      }, 0)
  })

  const totalExpenses = computed(() => {
    return transactions.value
      .filter(t => t.type === 'Expense')
      // Expenses might be recorded as negative, so we take absolute value for display sums
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0)
  })

  const currentBalance = computed(() => {
    return transactions.value.reduce((sum, t) => {
      const amt = Math.abs(Number(t.amount) || 0)
      return (t.type === 'Expense' || t.type === 'Withdrawal') ? sum - amt : sum + amt
    }, 0)
  })

  const funderBreakdown = computed(() => {
    const breakdown = {}
    transactions.value
      .filter(t => t.funder && t.funder !== 'Abah' && (t.type === 'Contribution' || t.type === 'Withdrawal'))
      .forEach(t => {
        if (!breakdown[t.funder]) breakdown[t.funder] = 0
        const amt = Math.abs(Number(t.amount) || 0)
        if (t.type === 'Withdrawal') {
          breakdown[t.funder] -= amt
        } else {
          breakdown[t.funder] += amt
        }
      })
    
    // Convert to array for easy iteration in UI
    return Object.keys(breakdown).map(name => ({
      name,
      total: breakdown[name]
    })).sort((a, b) => b.total - a.total)
  })

  // ── Mutations ─────────────────────────────────────────────────────────

  async function addTransaction({ type, funder, amount, date, description }) {
    // Format amount: expenses and withdrawals should ideally be negative for DB consistency
    const formattedAmount = (type === 'Expense' || type === 'Withdrawal') ? -Math.abs(amount) : Math.abs(amount)
    
    const newTrx = {
      id:          `HF_tmp_${Date.now()}`,
      date,
      type,
      funder:      type === 'Expense' ? '' : funder,
      amount:      formattedAmount,
      description,
    }

    transactions.value.unshift(newTrx) // optimistic
    
    try {
      const result = await api.upsertHouseFund({
        trx_id:      '', // let backend generate real ID if empty
        date:        newTrx.date,
        type:        newTrx.type,
        funder:      newTrx.funder,
        amount:      newTrx.amount,
        description: newTrx.description,
      })
      // Update optimistic ID with real one from backend (if it returned it, else re-fetch)
      // Tabung Tracker currently returns the full data block from upsert row
      Object.assign(newTrx, result)
      toast.success(`${type} added successfully`)
    } catch (err) {
      transactions.value = transactions.value.filter(t => t.id !== newTrx.id)
      toast.error(`Failed to add transaction: ${err.message}`)
      throw err
    }
  }

  async function deleteTransaction(trxId) {
    const index = transactions.value.findIndex(t => t.id === trxId)
    if (index === -1) return
    
    const removed = transactions.value.splice(index, 1)[0] // optimistic
    
    try {
      await api.deleteHouseFund({ trx_id: trxId })
      toast.success('Transaction deleted')
    } catch (err) {
      transactions.value.splice(index, 0, removed) // rollback
      toast.error(`Failed to delete: ${err.message}`)
      throw err
    }
  }

  return {
    transactions,
    loading,
    fetched,
    totalContributed,
    totalExpenses,
    currentBalance,
    funderBreakdown,
    fetchHouseFund,
    addTransaction,
    deleteTransaction,
  }
})
