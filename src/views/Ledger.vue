<template>
  <div>
    <PageHeader :title="`Unified Ledger`" :sub="`All transactions · Cycle ${appStore.currentCycle.id}`">
      <template #action>
        <button class="btn-primary" @click="showModal = true">+ Add Transaction</button>
      </template>
    </PageHeader>

    <!-- KPIs -->
    <div class="grid grid-cols-4 gap-3.5 mb-5">
      <template v-if="txStore.loading">
        <div v-for="i in 4" :key="i" class="stat-card animate-pulse">
          <div class="h-2.5 w-20 bg-bg-surface3 rounded mb-3"></div>
          <div class="h-6 w-28 bg-bg-surface3 rounded"></div>
        </div>
      </template>
      <template v-else>
        <StatCard label="Income"    :value="`+RM ${txStore.totalIncome.toLocaleString()}`"                      variant="success" />
        <StatCard label="Expenses"  :value="`-RM ${Math.abs(txStore.totalExpenses).toLocaleString()}`"          variant="danger" />
        <StatCard label="Transfers" :value="`RM ${totalTransfers.toLocaleString()}`"                            variant="info" />
        <StatCard label="Net"       :value="`${net >= 0 ? '+' : ''}RM ${net.toLocaleString()}`"                :variant="net >= 0 ? 'accent' : 'danger'" />
      </template>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <select v-model="filterCategory" class="select-field w-auto text-xs py-1.5">
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c">{{ c }}</option>
      </select>
      <select v-model="filterAccount" class="select-field w-auto text-xs py-1.5">
        <option value="">All accounts</option>
        <option v-for="a in accStore.accounts" :key="a.id" :value="a.id">{{ a.label }}</option>
      </select>
      <select v-model="filterCycle" class="select-field w-auto text-xs py-1.5">
        <option value="">All cycles</option>
        <option v-for="c in cycles" :key="c" :value="c">{{ c }}</option>
      </select>
      <button class="btn-ghost text-xs py-1.5"
              @click="filterCategory = ''; filterAccount = ''; filterCycle = ''">
        Clear
      </button>
      <span class="ml-auto text-xs text-ink-muted self-center">
        {{ filtered.length }} transaction{{ filtered.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <template v-if="txStore.loading">
        <div class="p-4 space-y-3 animate-pulse">
          <div v-for="i in 8" :key="i" class="flex gap-3 items-center">
            <div class="h-2.5 w-10 bg-bg-surface3 rounded shrink-0"></div>
            <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
            <div class="h-5 w-16 bg-bg-surface3 rounded shrink-0"></div>
            <div class="h-2.5 w-20 bg-bg-surface3 rounded shrink-0"></div>
          </div>
        </div>
      </template>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th>Category</th>
              <th>Source</th><th>Destination</th><th>Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in filtered" :key="tx.id">
              <td class="text-ink-muted text-xs whitespace-nowrap">{{ formatDate(tx.date) }}</td>
              <td class="max-w-[200px]"><span class="truncate block">{{ tx.description }}</span></td>
              <td><span class="badge text-[11px]" :class="categoryBadge(tx.category)">{{ tx.category }}</span></td>
              <td class="text-ink-muted text-xs">
                <div class="flex items-center gap-2">
                  <div v-if="tx.sourceId" class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: accStore.getAccountColor(tx.sourceId) }"></div>
                  {{ accStore.getAccountLabel(tx.sourceId) }}
                </div>
              </td>
              <td class="text-ink-muted text-xs">
                <div class="flex items-center gap-2">
                  <div v-if="tx.destId" class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: accStore.getAccountColor(tx.destId) }"></div>
                  {{ accStore.getAccountLabel(tx.destId) }}
                </div>
              </td>
              <td class="whitespace-nowrap" :class="tx.amount >= 0 ? 'amount-pos' : 'amount-neg'">
                {{ tx.amount > 0 ? '+' : '' }}RM {{ Math.abs(tx.amount).toLocaleString() }}
              </td>
              <td>
                <span class="badge text-[11px]" :class="txStatusBadge(tx)">
                  {{ txStatusLabel(tx) }}
                </span>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="7" class="text-center text-ink-muted py-10 text-sm">
                {{ txStore.transactions.length
                    ? 'No transactions match the current filters'
                    : 'No transactions yet' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AddTransactionModal v-model="showModal" @saved="txStore.refetchTransactions" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted }  from 'vue'
import { useAppStore }               from '@/stores/app'
import { useAccountStore }           from '@/stores/accounts'
import { useTransactionStore }       from '@/stores/transactions'
import StatCard              from '@/components/StatCard.vue'
import PageHeader            from '@/components/PageHeader.vue'
import AddTransactionModal   from '@/components/AddTransactionModal.vue'

const appStore = useAppStore()
const accStore = useAccountStore()
const txStore  = useTransactionStore()
const showModal = ref(false)

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
})

const filterCategory = ref('')
const filterAccount  = ref('')
const filterCycle    = ref('')
const categories = ['Income','Transfer','Bills','Shopping','Transport','Food','IPO','Personal','Family','Business','Tax','Savings']

const cycles = computed(() =>
  [...new Set(txStore.transactions.map(t => t.cycleId))].sort().reverse()
)

const filtered = computed(() => {
  let txs = [...txStore.transactions].sort((a, b) => b.date.localeCompare(a.date))
  if (filterCategory.value) txs = txs.filter(t => t.category === filterCategory.value)
  if (filterAccount.value)  txs = txs.filter(t => t.sourceId === filterAccount.value || t.destId === filterAccount.value)
  if (filterCycle.value)    txs = txs.filter(t => t.cycleId === filterCycle.value)
  return txs
})

const totalTransfers = computed(() =>
  txStore.transactions.filter(t => t.category === 'Transfer').reduce((s, t) => s + Math.abs(t.amount), 0)
)
const net = computed(() => txStore.totalIncome + txStore.totalExpenses)

const formatDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })

const categoryBadge = (cat) => ({
  Income: 'badge-green', Transfer: 'badge-gray', Bills: 'badge-gray',
  IPO: 'badge-blue', Food: 'badge-yellow', Shopping: 'badge-pink',
  Transport: 'badge-yellow', Family: 'badge-yellow', Personal: 'badge-blue',
  Business: 'badge-red', Tax: 'badge-yellow', Savings: 'badge-green',
}[cat] ?? 'badge-gray')
const txStatusBadge = (tx) => {
  if (['Pending', 'Unassigned'].includes(tx.ccStatus)) return 'badge-red'
  
  if (tx.category === 'IPO' || (tx.category === 'Transfer' && tx.description?.includes('IPO Capital Return'))) {
    if (tx.description?.includes('Application')) return 'badge-gray'
    if (tx.description?.includes('Refund') || tx.description?.includes('Capital Return')) return 'badge-blue'
    if (tx.description?.includes('Profit')) return 'badge-green'
    if (tx.description?.includes('Loss')) return 'badge-red'
    return 'badge-blue'
  }

  if (tx.refId && tx.category !== 'IPO') {
    if (!['Transfer', 'Repayment', 'Loan'].includes(tx.category)) return 'badge-green'
    return 'badge-blue'
  }
  if (tx.category === 'Transfer') return 'badge-gray'
  if (tx.category === 'Repayment') return 'badge-gray'
  if (tx.category === 'Loan') {
    const debt = txStore.activeDebts.find(d => d.borrowerId === tx.destId && d.lenderId === tx.sourceId)
    return debt ? 'badge-red' : 'badge-green'
  }
  return 'badge-green'
}

const txStatusLabel = (tx) => {
  if (tx.ccStatus === 'Pending') return 'CC Pending'
  if (tx.ccStatus === 'Unassigned') return 'Unassigned'
  
  if (tx.category === 'IPO' || (tx.category === 'Transfer' && tx.description?.includes('IPO Capital Return'))) {
    if (tx.description?.includes('Application')) return 'Locked'
    if (tx.description?.includes('Refund') || tx.description?.includes('Capital Return')) return 'Returned'
    if (tx.description?.includes('Profit')) return 'Profit'
    if (tx.description?.includes('Loss')) return 'Loss'
    return 'IPO'
  }

  if (tx.category === 'Transfer') return 'Transfer'
  if (tx.category === 'Repayment') return 'Repayment'
  if (tx.category === 'Loan') {
    const debt = txStore.activeDebts.find(d => d.borrowerId === tx.destId && d.lenderId === tx.sourceId)
    return debt ? 'Unpaid' : 'Settled'
  }
  return 'Settled'
}
</script>
