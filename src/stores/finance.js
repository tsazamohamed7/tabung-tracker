import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

export const useFinanceStore = defineStore('finance', () => {
  const toast = useToast()

  // ── Loading flags ─────────────────────────────────────────────────────
  const loading = ref({
    accounts:      false,
    transactions:  false,
    envelopes:     false,
    cycleBudgets:  false,
    ipos:          false,
    ccBridge:      false,
    wishlist:      false,
  })

  // ── Fetched cache (lazy per-view, one fetch per session) ──────────────
  const fetched = ref({
    accounts:      false,
    transactions:  false,
    envelopes:     false,
    cycleBudgets:  false,
    ipos:          false,
    ccBridge:      false,
    wishlist:      false,
  })

  // ── State ─────────────────────────────────────────────────────────────
  const accounts      = ref([])
  const transactions  = ref([])
  const envelopes     = ref([])   // dim_salary_plans — the template
  const cycleBudgets  = ref([])   // fact_cycle_budgets — per-cycle editable plan
  const ipos          = ref([])
  const ccBridge      = ref([])
  const wishlist      = ref([])

  const currentCycle = ref({
    id:        '2025-06',
    label:     '25 May – 24 Jun 2025',
    day:       18,
    totalDays: 30,
    income:    9800,
  })

  // ── Generic fetch wrapper ─────────────────────────────────────────────
  async function load(key, apiFn, target) {
    if (fetched.value[key]) return
    loading.value[key] = true
    try {
      target.value = await apiFn()
      fetched.value[key] = true
    } catch (err) {
      toast.error(`Failed to load ${key}: ${err.message}`)
    } finally {
      loading.value[key] = false
    }
  }

  async function reload(key, apiFn, target) {
    fetched.value[key] = false
    await load(key, apiFn, target)
  }

  // ── Fetch actions ─────────────────────────────────────────────────────
  const fetchAccounts      = () => load('accounts',     api.getAccounts,     accounts)
  const fetchTransactions  = () => load('transactions', api.getTransactions, transactions)
  const fetchEnvelopes     = () => load('envelopes',    api.getSalaryPlans,  envelopes)
  const fetchCycleBudgets  = () => load('cycleBudgets', api.getCycleBudgets, cycleBudgets)
  const fetchIpos          = () => load('ipos',         api.getIpos,         ipos)
  const fetchCcBridge      = () => load('ccBridge',     api.getCcBridge,     ccBridge)
  const fetchWishlist      = () => load('wishlist',     api.getWishlist,     wishlist)

  // ── Derived: physical banks ───────────────────────────────────────────
  const physicalBanks = computed(() => {
    const bankDefs = [
      { id: 'maybank',  name: 'Maybank',  color: '#f5c842' },
      { id: 'cimb',     name: 'CIMB',     color: '#e05555' },
      { id: 'muamalat', name: 'Muamalat', color: '#70dba0' },
    ]
    return bankDefs.map(b => ({
      ...b,
      funds:   accounts.value.filter(a => a.physicalLink === b.id && a.type === 'Virtual'),
      balance: accounts.value
        .filter(a => a.physicalLink === b.id && a.type === 'Virtual')
        .reduce((sum, a) => sum + a.balance, 0),
    }))
  })

  // ── Derived: this cycle's budgets with live spent amounts ─────────────
  const activeCycleBudgets = computed(() =>
    cycleBudgets.value.filter(b => b.cycleId === currentCycle.value.id)
  )

  const cycleBudgetsWithSpent = computed(() =>
    activeCycleBudgets.value.map(budget => {
      const spent = transactions.value
        .filter(t =>
          t.cycleId === currentCycle.value.id &&
          t.category === budget.category &&
          t.amount < 0
        )
        .reduce((s, t) => s + Math.abs(t.amount), 0)

      const remaining = budget.planned - spent
      const pct       = budget.planned > 0 ? Math.round((spent / budget.planned) * 100) : 0

      return { ...budget, spent, remaining, pct }
    })
  )

  // ── Derived: envelopes from template with live spent (for Dashboard) ──
  const envelopesWithSpent = computed(() =>
    envelopes.value.map(env => ({
      ...env,
      spent: transactions.value
        .filter(t =>
          t.cycleId === currentCycle.value.id &&
          t.category === env.category &&
          t.amount < 0
        )
        .reduce((s, t) => s + Math.abs(t.amount), 0),
    }))
  )

  // ── Derived: cycle history from all transactions ──────────────────────
  const cycleHistory = computed(() => {
    const cycleMap = {}
    transactions.value.forEach(t => {
      if (!t.cycleId) return
      if (!cycleMap[t.cycleId]) cycleMap[t.cycleId] = { income: 0, spent: 0 }
      if (t.amount > 0 && t.category === 'Income') {
        cycleMap[t.cycleId].income += t.amount
      } else if (t.amount < 0 && t.category !== 'Transfer' && t.category !== 'IPO') {
        cycleMap[t.cycleId].spent += Math.abs(t.amount)
      }
    })
    return Object.entries(cycleMap)
      .map(([cycleId, data]) => ({
        cycleId,
        label:  cycleIdToLabel(cycleId),
        income: data.income,
        spent:  data.spent,
        saved:  data.income - data.spent,
      }))
      .sort((a, b) => b.cycleId.localeCompare(a.cycleId))
  })

  // ── Derived: rollover amounts from previous cycle ─────────────────────
  // For each envelope in the previous cycle's budget, compute leftover
  // = planned - actual_spent. Used in Close Cycle modal.
  const previousCycleRollovers = computed(() => {
    const prevId = getPreviousCycleId(currentCycle.value.id)
    const prevBudgets = cycleBudgets.value.filter(b => b.cycleId === prevId)
    if (!prevBudgets.length) return []

    return prevBudgets.map(budget => {
      const spent = transactions.value
        .filter(t =>
          t.cycleId === prevId &&
          t.category === budget.category &&
          t.amount < 0
        )
        .reduce((s, t) => s + Math.abs(t.amount), 0)

      const leftover = budget.planned - spent
      return {
        budgetId:     budget.id,
        templateId:   budget.templateId,
        name:         budget.name,
        category:     budget.category,
        planned:      budget.planned,
        spent:        Math.round(spent),
        leftover:     Math.round(leftover),
        sourceId:     budget.sourceId,
        isOverspent:  leftover < 0,
        isLocked:     budget.isLocked,
      }
    })
  })

  // ── Derived: payday step state from real transaction data ─────────────
  const paydayStepState = computed(() => {
    const cid = currentCycle.value.id
    const txs = transactions.value.filter(t => t.cycleId === cid)

    const incomeReceived   = txs.some(t => t.category === 'Income')
    const budgetsExist     = activeCycleBudgets.value.length > 0
    const billsPaid        = txs.some(t => t.category === 'Bills') &&
                             !txs.some(t => t.category === 'Bills' && t.ccStatus === 'Pending')
    const rolloverSwept    = txs.some(t =>
                               t.description?.startsWith('Rollover:') ||
                               t.description?.startsWith('T_SWEEP_')
                             )
    return [
      { label: 'Income\nReceived',     done: incomeReceived, hint: incomeReceived  ? 'Income transaction recorded' : 'Awaiting salary' },
      { label: 'Plan\nCreated',        done: budgetsExist,   hint: budgetsExist    ? `${activeCycleBudgets.value.length} envelopes planned` : 'Start a new cycle first' },
      { label: 'Bills\nPaid',          done: billsPaid,      hint: billsPaid       ? 'All bills settled' : 'Bills pending confirmation' },
      { label: 'Cycle\nClosed',        done: rolloverSwept,  hint: rolloverSwept   ? 'Rollovers swept' : 'Close cycle when ready' },
    ]
  })

  // ── Helpers ───────────────────────────────────────────────────────────
  const totalIncome = computed(() =>
    transactions.value.filter(t => t.amount > 0 && t.category === 'Income').reduce((s, t) => s + t.amount, 0)
  )
  const totalExpenses = computed(() =>
    transactions.value.filter(t => t.amount < 0 && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
  )
  const ccPending = computed(() =>
    ccBridge.value.filter(c => c.status === 'Pending' || c.status === 'Unassigned')
  )
  const totalLocked = computed(() =>
    ipos.value.filter(i => i.status === 'Applied').reduce((s, i) => s + i.applyAmount, 0)
  )
  const totalIpoProfit = computed(() =>
    ipos.value.filter(i => i.netProfit).reduce((s, i) => s + i.netProfit, 0)
  )

  const getAccountLabel = (id) => accounts.value.find(a => a.id === id)?.label ?? '—'

  function cycleIdToLabel(cycleId) {
    // '2025-06' → 'Jun 2025'
    try {
      const [year, month] = cycleId.split('-')
      return new Date(year, month - 1).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
    } catch { return cycleId }
  }

  function getPreviousCycleId(cycleId) {
    try {
      const [year, month] = cycleId.split('-').map(Number)
      const prev = new Date(year, month - 2) // month is 1-indexed, Date month is 0-indexed
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    } catch { return null }
  }

  // ── Mutations ─────────────────────────────────────────────────────────

  async function addTransaction(txData) {
    const newTx = {
      id:       `T_${Date.now()}`,
      date:     new Date().toISOString().slice(0, 10),
      cycleId:  currentCycle.value.id,
      isCc:     false,
      ccStatus: null,
      refId:    null,
      ...txData,
    }
    transactions.value.unshift(newTx)
    try {
      await api.addTransaction({
        transaction_id:         newTx.id,
        date:                   newTx.date,
        cycle_id:               newTx.cycleId,
        description:            newTx.description,
        category:               newTx.category,
        amount:                 newTx.amount,
        source_account_id:      newTx.source_account_id ?? '',
        destination_account_id: newTx.destination_account_id ?? '',
        is_cc_transaction:      newTx.isCc,
        cc_settlement_status:   newTx.ccStatus  ?? '',
        ref_id:                 newTx.refId      ?? '',
      })
      toast.success('Transaction saved')
    } catch (err) {
      transactions.value.shift()
      toast.error(`Failed to save transaction: ${err.message}`)
      throw err
    }
    return newTx
  }

  // ── Update a single envelope allocation (rebalancing) ─────────────────
  async function updateEnvelopeAllocation(budgetId, newAmount) {
    const budget = cycleBudgets.value.find(b => b.id === budgetId)
    if (!budget) return
    if (budget.isLocked) { toast.error('This cycle is closed'); return }

    const prev = budget.planned
    budget.planned = newAmount   // optimistic

    try {
      await api.upsertCycleBudget({
        budget_id:         budget.id,
        cycle_id:          budget.cycleId,
        template_id:       budget.templateId,
        envelope_name:     budget.name,
        category:          budget.category,
        planned_amount:    newAmount,
        source_account_id: budget.sourceId,
        rollover_amount:   budget.rolloverAmount ?? '',
        rollover_dest_id:  budget.rolloverDestId ?? '',
        rollover_action:   budget.rolloverAction ?? '',
        is_locked:         false,
      })
    } catch (err) {
      budget.planned = prev
      toast.error(`Failed to update allocation: ${err.message}`)
      throw err
    }
  }

  // ── Start new cycle ───────────────────────────────────────────────────
  async function startNewCycle({ cycleId, income, sourceId, startDate }) {
    try {
      const result = await api.startNewCycle({
        cycle_id:         cycleId,
        income_amount:    income,
        income_source_id: sourceId,
        start_date:       startDate,
      })
      // Refresh both cycle budgets and transactions
      fetched.value.cycleBudgets = false
      fetched.value.transactions = false
      await Promise.all([fetchCycleBudgets(), fetchTransactions()])
      // Update current cycle
      currentCycle.value = {
        id:        cycleId,
        label:     cycleIdToLabel(cycleId),
        day:       1,
        totalDays: 30,
        income,
      }
      toast.success(`Cycle ${cycleId} started — ${result.budgets_created} envelopes created`)
      return result
    } catch (err) {
      toast.error(`Failed to start cycle: ${err.message}`)
      throw err
    }
  }

  // ── Close cycle ───────────────────────────────────────────────────────
  async function closeCycle({ cycleId, closeDate, decisions }) {
    try {
      const result = await api.closeCycle({
        cycle_id:  cycleId,
        close_date: closeDate,
        decisions,
      })
      // Lock budgets in local state
      cycleBudgets.value
        .filter(b => b.cycleId === cycleId)
        .forEach(b => { b.isLocked = true })
      // Refresh transactions (sweep transfers were created server-side)
      fetched.value.transactions = false
      await fetchTransactions()
      toast.success(`Cycle ${cycleId} closed — ${result.sweeps_created} rollover(s) swept`)
      return result
    } catch (err) {
      toast.error(`Failed to close cycle: ${err.message}`)
      throw err
    }
  }

  async function virtualTransfer(fromId, toId, amount) {
    const from = accounts.value.find(a => a.id === fromId)
    const to   = accounts.value.find(a => a.id === toId)
    if (!from || !to) { toast.error('Invalid accounts selected'); return }
    if (from.balance < amount) { toast.error(`Insufficient balance in ${from.label}`); return }

    // 1. Optimistic Update (Local UI updates immediately)
    from.balance -= amount
    to.balance   += amount

    try {
      // 2. Record the Transaction
      await addTransaction({
        transaction_id: `TX-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: `Transfer: ${from.label} → ${to.label}`,
        category: 'Transfer',
        amount: amount,
        source_account_id: fromId,
        destination_account_id: toId,
        is_cc_transaction: false
      })

    // 3. Sync Balances to dim_accounts (CRITICAL STEP)
    // We update both accounts in the spreadsheet
    await Promise.all([
      api.updateAccount({
        account_id: from.id,
        bank_name: from.bank,
        label: from.label,
        balance: from.balance, // The new subtracted balance
        is_active: true,
        type: 'Virtual'
      }),
      api.updateAccount({
        account_id: to.id,
        bank_name: to.bank,
        label: to.label,
        balance: to.balance, // The new added balance
        is_active: true,
        type: 'Virtual'
      })
    ])  

    } catch (err) {
      // Rollback
      from.balance += amount
      to.balance   -= amount
    }
  }

  async function assignCCFund(ccId, fundId) {
    const item = ccBridge.value.find(c => c.id === ccId)
    if (!item) return

    const prev = { ...item }
    // Optimistic
    item.fundingSourceId = fundId
    item.status = 'Assigned'

    try {
      await api.upsertCcBridge({
        bridge_id:         item.id,
        transaction_id:    item.txId,
        description:       item.description,
        amount:            item.amount,
        charge_date:       item.date,
        funding_source_id: fundId,
        settlement_date:   '',
        status:            'Assigned',
      })
      toast.success(`Assigned to ${getAccountLabel(fundId)}`)
    } catch (err) {
      // Rollback
      item.fundingSourceId = prev.fundingSourceId
      item.status = prev.status
      toast.error(`Failed to assign: ${err.message}`)
    }
  }

  async function recordIPOSale(ipoId, sellPrice, brokerage) {
    const ipo = ipos.value.find(i => i.id === ipoId)
    if (!ipo || !ipo.units) { toast.error('IPO has no allocated units'); return }

    const gross     = ipo.units * sellPrice
    const netProfit = gross - ipo.applyAmount + (ipo.refund ?? 0) - brokerage
    const prev      = { ...ipo }

    // Optimistic
    ipo.sellPrice  = sellPrice
    ipo.brokerage  = brokerage
    ipo.netProfit  = netProfit
    ipo.status     = 'Sold'

    try {
      await api.upsertIpo({
        ipo_id:          ipo.id,
        stock_name:      ipo.stock,
        status:          'Sold',
        apply_date:      ipo.applyDate,
        apply_amount:    ipo.applyAmount,
        apply_source_id: ipo.sourceId,
        allocated_units: ipo.units,
        refund_amount:   ipo.refund ?? '',
        listing_date:    ipo.listDate ?? '',
        sell_price:      sellPrice,
        brokerage_fee:   brokerage,
        net_profit:      netProfit,
      })
      toast.success(`IPO sale recorded — Net P&L: RM ${netProfit.toFixed(2)}`)

      // Also add a transaction for the sale proceeds
      await addTransaction({
        description: `IPO Sale — ${ipo.stock}`,
        category:    'IPO',
        amount:      gross - brokerage,
        sourceId:    null,
        destId:      ipo.sourceId,
        refId:       ipo.id,
      })
    } catch (err) {
      // Rollback
      Object.assign(ipo, prev)
      toast.error(`Failed to record sale: ${err.message}`)
    }
  }

  async function addWishlistItem(item) {
    const newItem = {
      id:           `W_${Date.now()}`,
      status:       'Planned',
      date:         '',
      ...item,
    }

    // Optimistic
    wishlist.value.push(newItem)

    try {
      await api.upsertWishlist({
        item_id:         newItem.id,
        item_name:       newItem.name,
        emoji:           newItem.emoji,
        estimated_price: newItem.price,
        target_fund_id:  newItem.targetFundId,
        status:          newItem.status,
        target_date:     newItem.date,
      })
      toast.success(`"${newItem.name}" added to wishlist`)
    } catch (err) {
      wishlist.value.pop()
      toast.error(`Failed to add wishlist item: ${err.message}`)
    }
  }

  const reconItems = computed(() =>
    physicalBanks.value.map(bank => ({
      bank: bank.name, calculated: bank.balance, actual: bank.balance, status: 'Balanced'
    }))
  )

  return {
    // State
    accounts, transactions, envelopes, cycleBudgets, ipos, ccBridge, wishlist,
    currentCycle, loading,

    // Computed
    physicalBanks, totalIncome, totalExpenses, ccPending,
    totalLocked, totalIpoProfit, envelopesWithSpent,
    activeCycleBudgets, cycleBudgetsWithSpent, cycleHistory,
    previousCycleRollovers, paydayStepState, reconItems,

    // Fetch actions
    fetchAccounts, fetchTransactions, fetchEnvelopes, fetchCycleBudgets,
    fetchIpos, fetchCcBridge, fetchWishlist,

    // Mutation actions
    addTransaction, updateEnvelopeAllocation,
    startNewCycle, closeCycle,
    virtualTransfer, assignCCFund, recordIPOSale, addWishlistItem,

    // Helpers
    getAccountLabel, cycleIdToLabel, getPreviousCycleId,
  }
})
