<template>
  <div class="space-y-6 max-w-5xl mx-auto pb-24">
    <!-- Header & KPIs -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-ink">Bursa Tracker</h1>
        <p class="text-sm text-ink-muted mt-1">Manage your open market stock portfolio</p>
      </div>
      <div class="flex items-center gap-3">
        <select v-model="selectedAccountFilter" class="select-field !w-auto min-w-[200px]">
          <option value="all">Overall (All Accounts)</option>
          <option v-for="acc in availableAccounts" :key="acc.id" :value="acc.id">
            {{ acc.bank }} - {{ acc.label }}
          </option>
        </select>
        <button @click="showBuyModal = true" class="btn-primary shadow-sm hover:shadow">
          + Buy Stock
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-5 border border-border bg-surface shadow-sm">
        <div class="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Total Fund Amount</div>
        <div class="text-2xl font-bold text-accent">RM {{ totalFundAmount.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
        <div class="text-xs text-ink-faint mt-1">Cash: RM {{ filteredBalance.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
      </div>

      <div class="card p-5 border border-border bg-surface shadow-sm">
        <div class="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Deployed Capital</div>
        <div class="text-2xl font-bold text-ink">RM {{ filteredTotalDeployed.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
        <div class="text-xs text-ink-faint mt-1">{{ filteredActiveTrades.length }} active positions</div>
      </div>
      
      <div class="card p-5 border border-border bg-surface shadow-sm">
        <div class="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Realized Net Profit</div>
        <div class="text-2xl font-bold" :class="filteredTotalRealizedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'">
          {{ filteredTotalRealizedProfit >= 0 ? '+' : '' }}RM {{ filteredTotalRealizedProfit.toLocaleString(undefined, {minimumFractionDigits: 2}) }}
        </div>
        <div class="text-xs text-ink-faint mt-1">From closed trades</div>
      </div>

      <div class="card p-5 border border-border bg-surface shadow-sm">
        <div class="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Win Rate</div>
        <div class="text-2xl font-bold text-ink">{{ isNaN(filteredWinRate) ? 0 : filteredWinRate.toFixed(1) }}%</div>
        <div class="text-xs text-ink-faint mt-1">{{ filteredClosedTrades.length }} total closed trades</div>
      </div>
    </div>

    <!-- Main Content Tabs -->
    <div class="card border border-border bg-surface overflow-hidden shadow-sm">
      <div class="flex border-b border-border text-sm">
        <button 
          class="px-6 py-3 font-medium transition-colors border-b-2"
          :class="activeTab === 'portfolio' ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'"
          @click="activeTab = 'portfolio'">
          Active Portfolio
        </button>
        <button 
          class="px-6 py-3 font-medium transition-colors border-b-2"
          :class="activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'"
          @click="activeTab = 'history'">
          Trade History
        </button>
        <button 
          v-if="selectedAccountFilter !== 'all'"
          class="px-6 py-3 font-medium transition-colors border-b-2"
          :class="activeTab === 'ledger' ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'"
          @click="activeTab = 'ledger'">
          Fund Ledger
        </button>
      </div>

      <!-- Tab: Portfolio -->
      <div v-if="activeTab === 'portfolio'" class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-alt border-b border-border text-xs text-ink-muted font-medium">
                <th class="p-4 font-medium">Stock</th>
                <th class="p-4 font-medium">Platform</th>
                <th class="p-4 font-medium">Buy Date</th>
                <th class="p-4 font-medium text-right">Avg Price</th>
                <th class="p-4 font-medium text-right">Lots (Units)</th>
                <th class="p-4 font-medium text-right">Invested (RM)</th>
                <th class="p-4 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-sm">
              <tr v-if="!filteredActivePositions.length">
                <td colspan="7" class="p-8 text-center text-ink-faint">No active positions.</td>
              </tr>
              <tr v-for="pos in filteredActivePositions" :key="pos.positionKey" class="hover:bg-surface-alt/50 transition-colors">
                <td class="p-4 font-semibold">{{ pos.stock }}</td>
                <td class="p-4 text-ink-muted text-xs">
                  <div class="flex items-center gap-1.5">
                    <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: accStore.getAccountColor(pos.sourceId) }"></div>
                    {{ accStore.getAccountLabel(pos.sourceId) }}
                  </div>
                </td>
                <td class="p-4 text-ink-muted">{{ formatDate(pos.buyDate) }} <span v-if="pos.trades.length > 1" class="text-[10px] text-ink-faint ml-1">({{ pos.trades.length }} buys)</span></td>
                <td class="p-4 text-right tabular-nums">{{ pos.avgPrice.toFixed(3) }}</td>
                <td class="p-4 text-right tabular-nums">
                  <div>{{ pos.totalLots }}</div>
                  <div class="text-[10px] text-ink-faint">{{ pos.totalLots * 100 }} units</div>
                </td>
                <td class="p-4 text-right tabular-nums font-medium">{{ pos.totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
                <td class="p-4 text-center">
                  <button @click="openSellModal(pos)" class="btn btn-secondary py-1 px-3 text-xs">
                    Sell
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab: History -->
      <div v-if="activeTab === 'history'" class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-alt border-b border-border text-xs text-ink-muted font-medium">
                <th class="p-4 font-medium">Stock</th>
                <th class="p-4 font-medium text-center">Hold Time</th>
                <th class="p-4 font-medium text-right">Capital</th>
                <th class="p-4 font-medium text-right">Revenue</th>
                <th class="p-4 font-medium text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-sm">
              <tr v-if="!filteredClosedTrades.length">
                <td colspan="5" class="p-8 text-center text-ink-faint">No closed trades yet.</td>
              </tr>
              <tr v-for="trade in filteredClosedTrades" :key="trade.id" class="hover:bg-surface-alt/50 transition-colors">
                <td class="p-4 font-semibold">{{ trade.stock }}</td>
                <td class="p-4 text-center text-ink-muted text-xs whitespace-nowrap">
                  {{ formatDate(trade.buyDate) }} <span class="mx-1 text-ink-faint">→</span> {{ formatDate(trade.sellDate) }}
                </td>
                <td class="p-4 text-right tabular-nums">{{ trade.totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
                <td class="p-4 text-right tabular-nums">{{ trade.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
                <td class="p-4 text-right tabular-nums font-bold" :class="trade.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                  {{ trade.netProfit >= 0 ? '+' : '' }}{{ trade.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2}) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab: Ledger -->
      <div v-if="activeTab === 'ledger' && selectedAccountFilter !== 'all'" class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-alt border-b border-border text-xs text-ink-muted font-medium">
                <th class="p-4 font-medium">Date</th>
                <th class="p-4 font-medium">Description</th>
                <th class="p-4 font-medium">Category</th>
                <th class="p-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-sm">
              <tr v-if="!accountTransactions.length">
                <td colspan="4" class="p-8 text-center text-ink-faint">No transactions found for this account.</td>
              </tr>
              <tr v-for="tx in accountTransactions" :key="tx.id" class="hover:bg-surface-alt/50 transition-colors">
                <td class="p-4 text-ink-muted text-xs whitespace-nowrap">{{ formatDate(tx.date) }}</td>
                <td class="p-4">{{ tx.description }}</td>
                <td class="p-4">
                  <span class="badge text-[10px] capitalize">{{ tx.category }}</span>
                </td>
                <td class="p-4 text-right tabular-nums font-medium" :class="getTxAmount(tx) >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                  {{ getTxAmount(tx) >= 0 ? '+' : '' }}RM {{ Math.abs(getTxAmount(tx)).toLocaleString(undefined, {minimumFractionDigits: 2}) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Buy Modal -->
    <div v-if="showBuyModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" @click.self="showBuyModal = false">
      <div class="bg-bg-surface border border-border-strong rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-5 border-b border-border flex justify-between items-center bg-bg-surface2/50">
          <h3 class="font-semibold text-lg">Buy Stock</h3>
          <button @click="showBuyModal = false" class="text-ink-muted hover:text-ink">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div class="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 text-sm">
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Stock Ticker/Name</label>
            <input type="text" v-model="buyForm.stock" class="input-field w-full" placeholder="e.g. MAYBANK" required>
          </div>
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Source Virtual Fund</label>
            <select v-model="buyForm.sourceId" class="input-field w-full">
              <optgroup v-for="bank in tradingBanks" :key="bank.id" :label="bank.name">
                <option v-for="fund in bank.funds" :key="fund.id" :value="fund.id">{{ fund.label }}</option>
              </optgroup>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Buy Date</label>
              <input type="date" v-model="buyForm.buyDate" class="input-field w-full" required>
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Quantity (Lots)</label>
              <input type="number" v-model.number="buyForm.buyLot" class="input-field w-full" min="1" placeholder="Lots">
              <div class="text-[10px] text-ink-faint mt-1">Total: {{ (buyForm.buyLot || 0) * 100 }} units</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Match Price (RM)</label>
              <input type="number" v-model.number="buyForm.buyPrice" class="input-field w-full" min="0" step="0.005" placeholder="0.00">
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Brokerage Fee (RM)</label>
              <input type="number" v-model.number="buyForm.buyFee" class="input-field w-full" min="0" step="0.01" placeholder="0.00">
            </div>
          </div>

          <div class="mt-4 p-4 rounded-xl bg-bg-surface2 border border-border flex justify-between items-center">
            <span class="text-ink-muted font-medium text-sm">Total Capital Required</span>
            <span class="font-bold text-lg text-accent">RM {{ calculatedBuyTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</span>
          </div>
        </div>

        <div class="p-4 border-t border-border bg-bg-surface2/50 flex justify-end gap-3">
          <button @click="showBuyModal = false" class="btn-ghost">Cancel</button>
          <button @click="executeBuy" :disabled="isSubmitting || !buyForm.stock || !buyForm.sourceId || !buyForm.buyLot || !buyForm.buyPrice" class="btn-primary">
            {{ isSubmitting ? 'Processing...' : 'Confirm Buy' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sell Modal -->
    <div v-if="activeSellPosition" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" @click.self="activeSellPosition = null">
      <div class="bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        <div class="p-5 border-b border-border flex justify-between items-center bg-bg-surface2/50">
          <h3 class="font-semibold text-lg text-rose-400">Sell Stock</h3>
          <button @click="activeSellPosition = null" class="text-ink-muted hover:text-ink">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div class="p-5 flex-1 space-y-4 text-sm">
          <div class="flex items-center justify-between p-3 rounded-lg bg-bg-surface2 border border-border">
            <div class="font-bold">{{ activeSellPosition.stock }}</div>
            <div class="text-ink-muted text-xs">Available: {{ activeSellPosition.totalLots * 100 }} units</div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Sell Date</label>
              <input type="date" v-model="sellForm.sellDate" class="input-field w-full" required>
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Quantity (Lots)</label>
              <input type="number" v-model.number="sellForm.sellLot" class="input-field w-full" min="1" :max="activeSellPosition.totalLots" placeholder="Lots" required>
              <div class="text-[10px] text-ink-faint mt-1">Selling: {{ (sellForm.sellLot || 0) * 100 }} units</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Sell Price (RM)</label>
              <input type="number" v-model.number="sellForm.sellPrice" class="input-field w-full" min="0" step="0.005" placeholder="0.00">
              <div class="text-[10px] mt-1 text-ink-faint">
                Avg Cost RM {{ activeSellPosition.avgPrice.toFixed(3) }}
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Brokerage Fee (RM)</label>
              <input type="number" v-model.number="sellForm.sellFee" class="input-field w-full" min="0" step="0.01" placeholder="0.00">
            </div>
          </div>

          <div class="mt-4 p-4 rounded-xl bg-bg-surface2 border border-border flex justify-between items-center">
            <span class="text-ink-muted font-medium text-sm">Estimated P&L</span>
            <span class="font-bold text-lg" :class="calculatedNetProfit >= 0 ? 'text-status-success' : 'text-status-danger'">
              {{ calculatedNetProfit >= 0 ? '+' : '' }}RM {{ calculatedNetProfit.toLocaleString(undefined, {minimumFractionDigits: 2}) }}
            </span>
          </div>
        </div>

        <div class="p-4 border-t border-border bg-bg-surface2/50 flex justify-end gap-3">
          <button @click="activeSellPosition = null" class="btn-ghost">Cancel</button>
          <button @click="executeSell" :disabled="isSubmitting || !sellForm.sellPrice || !sellForm.sellLot || sellForm.sellLot > activeSellPosition.totalLots" class="btn-primary !bg-rose-500/20 !text-rose-400 hover:!bg-rose-500/30">
            {{ isSubmitting ? 'Processing...' : 'Confirm Sell' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBursaStore } from '@/stores/bursa'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'

const bursaStore = useBursaStore()
const accStore = useAccountStore()
const txStore = useTransactionStore()

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const activeTab = ref('portfolio')

const selectedAccountFilter = ref('all')

const availableAccounts = computed(() => {
  // 1. Get IDs of accounts that already have logged trades
  const idsWithTrades = new Set(bursaStore.trades.map(t => t.sourceId))
  
  // 2. Identify known trading broker IDs
  const tradingBrokerIds = ['mplus', 'moomoo']
  
  // 3. Filter accounts that have trades OR belong to these brokers
  return accStore.accounts.filter(a => 
    idsWithTrades.has(a.id) || 
    tradingBrokerIds.includes(a.physicalLink)
  )
})

const tradingBanks = computed(() => {
  return accStore.physicalBanks.filter(b => ['mplus', 'moomoo'].includes(b.id))
})

const filteredTrades = computed(() => {
  if (selectedAccountFilter.value === 'all') return bursaStore.trades
  return bursaStore.trades.filter(t => t.sourceId === selectedAccountFilter.value)
})

const filteredActiveTrades = computed(() => filteredTrades.value.filter(t => t.status === 'Holding'))

const filteredActivePositions = computed(() => {
  const positions = {}
  filteredActiveTrades.value.forEach(t => {
    const key = `${t.stock}_${t.sourceId}`
    if (!positions[key]) {
       positions[key] = {
         positionKey: key,
         stock: t.stock,
         sourceId: t.sourceId,
         totalLots: 0,
         totalInvested: 0,
         trades: []
       }
    }
    positions[key].totalLots += t.buyLot
    positions[key].totalInvested += t.totalInvested
    positions[key].trades.push(t)
  })
  
  return Object.values(positions).map(p => {
    p.avgPrice = p.totalInvested / (p.totalLots * 100)
    p.trades.sort((a,b) => a.buyDate.localeCompare(b.buyDate))
    p.buyDate = p.trades[0].buyDate
    return p
  })
})

const filteredClosedTrades = computed(() => filteredTrades.value.filter(t => t.status === 'Sold'))

const filteredTotalDeployed = computed(() =>
  filteredActivePositions.value.reduce((s, p) => s + (p.totalInvested || 0), 0)
)

const filteredTotalRealizedProfit = computed(() =>
  filteredClosedTrades.value.reduce((s, t) => s + (t.netProfit || 0), 0)
)

const filteredBalance = computed(() => {
  if (selectedAccountFilter.value === 'all') {
    return availableAccounts.value.reduce((s, a) => s + a.balance, 0)
  }
  const acc = accStore.accounts.find(a => a.id === selectedAccountFilter.value)
  return acc?.balance || 0
})

const totalFundAmount = computed(() => filteredBalance.value + filteredTotalDeployed.value)

const filteredWinRate = computed(() => {
  if (filteredClosedTrades.value.length === 0) return 0
  const winners = filteredClosedTrades.value.filter(t => t.netProfit > 0).length
  return (winners / filteredClosedTrades.value.length) * 100
})

const accountTransactions = computed(() => {
  if (selectedAccountFilter.value === 'all') return []
  return txStore.transactions.filter(t => 
    t.sourceId === selectedAccountFilter.value || 
    t.destId === selectedAccountFilter.value
  ).sort((a,b) => b.date.localeCompare(a.date))
})

const getTxAmount = (tx) => {
  // If destId matches, it's money coming in (positive)
  if (tx.destId === selectedAccountFilter.value) return Math.abs(tx.amount)
  // If sourceId matches, it's money going out (negative)
  if (tx.sourceId === selectedAccountFilter.value) return -Math.abs(tx.amount)
  return 0
}

// Buy Form State
const showBuyModal = ref(false)
const isSubmitting = ref(false)
const buyForm = ref({
  stock: '',
  sourceId: '',
  buyDate: new Date().toISOString().split('T')[0],
  buyLot: null,
  buyPrice: null,
  buyFee: 8.00 // Default estimated minimum brokerage
})

const calculatedBuyTotal = computed(() => {
  const lot = Number(buyForm.value.buyLot) || 0
  const price = Number(buyForm.value.buyPrice) || 0
  const fee = Number(buyForm.value.buyFee) || 0
  return (lot * 100 * price) + fee
})

async function executeBuy() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    await bursaStore.buyStock({
      stock: buyForm.value.stock,
      sourceId: buyForm.value.sourceId,
      buyDate: buyForm.value.buyDate,
      buyLot: buyForm.value.buyLot,
      buyPrice: buyForm.value.buyPrice,
      buyFee: buyForm.value.buyFee
    })
    showBuyModal.value = false
    // reset
    buyForm.value = {
      stock: '',
      sourceId: buyForm.value.sourceId, // keep same account active
      buyDate: new Date().toISOString().split('T')[0],
      buyLot: null, buyPrice: null, buyFee: 8.00
    }
  } finally {
    isSubmitting.value = false
  }
}

// Sell Form State
const activeSellPosition = ref(null)
const sellForm = ref({
  sellDate: new Date().toISOString().split('T')[0],
  sellLot: null,
  sellPrice: null,
  sellFee: 8.00
})

function openSellModal(position) {
  activeSellPosition.value = position
  sellForm.value = {
    sellDate: new Date().toISOString().split('T')[0],
    sellLot: position.totalLots, 
    sellPrice: Number(position.avgPrice.toFixed(3)), 
    sellFee: 8.00
  }
}

const calculatedNetProfit = computed(() => {
  if (!activeSellPosition.value || !sellForm.value.sellPrice || !sellForm.value.sellLot) return 0
  const units = sellForm.value.sellLot * 100
  const totalRevenue = (units * sellForm.value.sellPrice) - (Number(sellForm.value.sellFee) || 0)
  
  const avgCostPerLot = activeSellPosition.value.totalInvested / activeSellPosition.value.totalLots
  const investedForSold = avgCostPerLot * sellForm.value.sellLot
  return totalRevenue - investedForSold
})

async function executeSell() {
  if (isSubmitting.value || !activeSellPosition.value) return
  isSubmitting.value = true
  try {
    await bursaStore.sellPosition(activeSellPosition.value.positionKey, {
      sellDate: sellForm.value.sellDate,
      sellLot: sellForm.value.sellLot,
      sellPrice: sellForm.value.sellPrice,
      sellFee: sellForm.value.sellFee
    })
    activeSellPosition.value = null
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  bursaStore.fetchTrades()
  txStore.fetchTransactions()
})
</script>
