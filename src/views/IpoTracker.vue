<template>
  <div>
    <PageHeader title="IPO Tracker" sub="Short-term investment lifecycle">
      <template #action>
        <button class="btn-primary" @click="showApplyModal = true">+ Apply for IPO</button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-4 gap-3.5 mb-5">
      <template v-if="ipoStore.loading">
        <div v-for="i in 4" :key="i" class="stat-card animate-pulse">
          <div class="h-2.5 w-20 bg-bg-surface3 rounded mb-3"></div>
          <div class="h-6 w-24 bg-bg-surface3 rounded"></div>
        </div>
      </template>
      <template v-else>
        <StatCard label="Capital Locked"   :value="`RM ${ipoStore.totalLocked.toLocaleString()}`"   variant="info" />
        <StatCard label="Refunds Received" :value="`+RM ${ipoStore.totalRefunds.toLocaleString()}`" variant="success" />
        <StatCard label="Net Profit (YTD)" :value="`+RM ${ipoStore.totalProfit.toLocaleString()}`"  variant="accent" />
        <StatCard label="Total IPOs"       :value="`${ipoStore.ipos.length}`" />
      </template>
    </div>

    <!-- IPO Table -->
    <div class="section-label">All IPOs</div>
    <div class="card p-0 overflow-hidden mb-5">
      <template v-if="ipoStore.loading">
        <div class="p-4 space-y-3 animate-pulse">
          <div v-for="i in 4" :key="i" class="flex gap-3 items-center">
            <div class="h-2.5 w-16 bg-bg-surface3 rounded"></div>
            <div class="h-5 w-20 bg-bg-surface3 rounded"></div>
            <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
          </div>
        </div>
      </template>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th>Stock</th><th>Stage</th><th>Applied</th><th>Amount</th>
              <th>Allocated</th><th>Refund</th><th>Sell Price</th><th>Net P&L</th>
              <th>Source</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ipo in ipoStore.ipos" :key="ipo.id"
                class="cursor-pointer transition-colors"
                :class="activeIpo?.id === ipo.id ? 'bg-accent/[0.04]' : 'hover:bg-white/[0.02]'"
                @click="activeIpo = ipo">
              <td class="font-mono font-medium">{{ ipo.stock }}</td>
              <td><span class="badge text-[11px]" :class="stageBadge(ipoStatus(ipo))">● {{ ipoStatus(ipo) }}</span></td>
              <td class="text-ink-muted text-xs whitespace-nowrap">{{ formatDate(ipo.applyDate) }}</td>
              <td class="amount-neg whitespace-nowrap">
                <div class="font-mono">RM {{ ipo.applyAmount.toLocaleString() }}</div>
                <div class="text-[9px] text-ink-muted mt-0.5">{{ ipo.applyLot }} lots @ RM{{ ipo.applyStockPrice }}</div>
              </td>
              <td class="font-mono text-xs">{{ ipo.allocatedLot ? `${ipo.allocatedLot} lots` : '—' }}</td>
              <td :class="ipo.refund ? 'amount-pos' : 'text-ink-muted text-xs'">
                {{ ipo.refund ? `+RM ${ipo.refund.toLocaleString()}` : '—' }}
              </td>
              <td class="font-mono text-xs">{{ ipo.sellPrice ? `RM ${ipo.sellPrice}` : '—' }}</td>
              <td :class="ipo.netProfit ? 'amount-pos' : 'text-ink-muted text-xs'">
                {{ ipo.netProfit ? `+RM ${ipo.netProfit.toLocaleString()}` : '—' }}
              </td>
              <td class="text-xs text-ink-muted">{{ accStore.getAccountLabel(ipo.sourceId) }}</td>
              <td>
                <button v-if="ipoStatus(ipo) === 'Listed'"
                        class="btn-primary text-[11px] py-1 px-2.5 whitespace-nowrap"
                        @click.stop="activeIpo = ipo">
                  Record Sale
                </button>
              </td>
            </tr>
            <tr v-if="!ipoStore.ipos.length">
              <td colspan="10" class="text-center text-ink-muted py-8 text-sm">No IPOs tracked yet</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Lifecycle panel -->
    <template v-if="activeIpo">
      <div class="section-label">{{ activeIpo.stock }} — Details</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div class="card" ref="formRef">
          <div class="font-display mb-5">Lifecycle</div>
          <div class="flex mb-5">
          <div v-for="(step, i) in lifecycleSteps" :key="i"
               class="flex-1 relative"
               :class="i < lifecycleSteps.length - 1
                 ? 'after:content-[\'\'] after:absolute after:top-3 after:left-1/2 after:w-full after:h-px after:bg-border-strong'
                 : ''">
            <div class="relative z-10 w-6 h-6 rounded-full mx-auto flex items-center justify-center text-[10px] font-bold"
                 :class="{
                   'bg-accent text-bg': stepDone(i),
                   'bg-status-danger text-white': stepFailed(i),
                   'bg-bg-surface border-2 border-accent text-accent': stepCurrent(i),
                   'bg-bg-surface3 border border-border-strong text-ink-muted': !stepDone(i) && !stepCurrent(i) && !stepFailed(i)
                 }">
              <template v-if="stepFailed(i)">✕</template>
              <template v-else>{{ stepDone(i) ? '✓' : i + 1 }}</template>
            </div>
            <div class="text-center text-[10px] text-ink-muted mt-1.5 leading-snug">{{ step.label }}</div>
            <div class="text-center text-[10px] text-ink-faint">{{ step.sub(activeIpo) }}</div>
          </div>
        </div>

        <!-- Sale form -->
        <template v-if="ipoStatus(activeIpo) === 'Listed'">
          <div class="border-t border-border pt-4">
            <div class="text-xs text-ink-muted mb-3">
              Record sale for <strong class="text-ink">{{ activeIpo.stock }}</strong>
              ({{ (activeIpo.allocatedLot * 100).toLocaleString() }} units)
            </div>
            <div class="flex gap-3 items-end flex-wrap">
              <div class="flex-1 min-w-[120px]">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Sell Date</label>
                <input v-model="saleForm.sellDate" type="date" class="input-field font-mono" />
              </div>
              <div class="flex-1 min-w-[120px]">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Sell Price (RM)</label>
                <input v-model.number="saleForm.price" type="number" step="0.005" placeholder="0.00" class="input-field font-mono" />
              </div>
              <div class="flex-1 min-w-[120px]">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Brokerage (RM)</label>
                <input v-model.number="saleForm.brokerage" type="number" step="0.01" placeholder="12.00" class="input-field font-mono" />
              </div>
              <div class="flex-1 min-w-[120px]">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Profit Dest.</label>
                <select v-model="saleForm.profitDestId" class="select-field font-mono">
                  <option value="">— Fund —</option>
                  <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                    {{ a.label }}
                  </option>
                </select>
              </div>
              <button class="btn-primary whitespace-nowrap" :disabled="recordingSale || !saleForm.profitDestId" @click="recordSale">
                {{ recordingSale ? 'Saving…' : 'Record Sale' }}
              </button>
            </div>
            <div v-if="saleForm.price && activeIpo.allocatedLot"
                 class="mt-3 bg-bg-surface2 rounded-lg p-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div class="text-ink-muted mb-0.5">Gross</div>
                <div class="font-mono text-ink">RM {{ (saleForm.price * activeIpo.allocatedLot * 100).toFixed(2) }}</div>
              </div>
              <div>
                <div class="text-ink-muted mb-0.5">Brokerage</div>
                <div class="font-mono text-status-danger">-RM {{ (saleForm.brokerage || 0).toFixed(2) }}</div>
              </div>
              <div>
                <div class="text-ink-muted mb-0.5">Est. P&L</div>
                <div class="font-mono" :class="estProfit >= 0 ? 'text-status-success' : 'text-status-danger'">
                  {{ estProfit >= 0 ? '+' : '' }}RM {{ estProfit.toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="ipoStatus(activeIpo) === 'Sold'">
          <div class="border-t border-border pt-4 text-center text-sm text-ink-muted">
            Sold @ RM {{ activeIpo.sellPrice }} on {{ formatDate(activeIpo.sellDate) }} ·
            Net profit: <span class="text-status-success font-mono">+RM {{ activeIpo.netProfit?.toLocaleString() }}</span>
          </div>
        </template>
        <template v-else-if="ipoStatus(activeIpo) === 'Applied'">
          <div class="border-t border-border pt-4">
            <div class="text-xs text-ink-muted mb-3">Record ballot result for <strong class="text-ink">{{ activeIpo.stock }}</strong></div>
            <div class="flex gap-3 flex-col sm:flex-row items-end">
              <div class="flex-1 w-full">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Ballot Date</label>
                <input v-model="ballotDate" type="date" class="input-field font-mono" />
              </div>
              <div class="flex-1 w-full">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Allocated (Lots)</label>
                <input v-model.number="allocatedLot" type="number" placeholder="e.g. 10" class="input-field font-mono" />
              </div>
              <div class="flex-1 w-full" v-if="allocatedLot > 0">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Refund (RM)</label>
                <input v-model.number="refundAmount" type="number" step="0.01" class="input-field font-mono" />
              </div>
            </div>
            
            <div v-if="allocatedLot > 0 && refundAmount > 0" class="mt-4 p-3 bg-bg-surface2 rounded-lg border border-border">
              <div class="flex justify-between items-center mb-2">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider">Refund Route</label>
                <button @click="addRefundRow" class="text-[10px] text-accent font-bold hover:underline">+ Add Route</button>
              </div>
              <div v-for="(split, index) in refundSplits" :key="index" class="flex gap-2 items-start mb-2">
                <select v-model="split.sourceId" class="select-field flex-1 text-xs">
                  <option value="">— Select fund —</option>
                  <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                    {{ a.label }}
                  </option>
                </select>
                <input v-model.number="split.amount" type="number" placeholder="Amt" class="input-field w-24 font-mono text-xs" />
                <button v-if="refundSplits.length > 1" @click="removeRefundRow(index)" class="text-status-danger p-1">✕</button>
              </div>
              <div class="text-[10px] mt-1 flex justify-between">
                <span :class="isRefundTally ? 'text-status-success' : 'text-status-danger'">
                  Total: RM {{ totalRefundSplitAmount.toLocaleString() }} / RM {{ refundAmount.toLocaleString() }}
                </span>
              </div>
            </div>

            <div class="mt-4 text-right">
              <button class="btn-primary" 
                      :disabled="allocatedLot > 0 && refundAmount > 0 && !isRefundTally" 
                      @click="handleRecordBallot">Save</button>
            </div>
          </div>
        </template>
        <template v-else-if="ipoStatus(activeIpo) === 'Not Allotted'">
          <div class="border-t border-border pt-4 text-center">
            <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-status-danger/10 text-status-danger mb-2">
              ✕
            </div>
            <div class="text-sm font-bold text-ink">Unsuccessful Ballot</div>
            <div class="text-xs text-ink-muted">
              You received 0 lots. RM {{ activeIpo.refund?.toLocaleString() }} has been refunded to your account.
            </div>
          </div>
        </template>
        <template v-else-if="ipoStatus(activeIpo) === 'Balloted'">
          <div class="border-t border-border pt-4">
            <div class="text-xs text-ink-muted mb-3">Record listing for <strong class="text-ink">{{ activeIpo.stock }}</strong></div>
            <div class="flex gap-3 flex-col sm:flex-row items-end">
              <div class="flex-1 w-full max-w-[200px]">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Listing Date</label>
                <input v-model="listingDate" type="date" class="input-field font-mono" />
              </div>
              <button class="btn-primary" @click="handleRecordListing">Mark as Listed</button>
            </div>
          </div>
        </template>
        </div>

        <div class="card flex flex-col relative max-h-[450px]">
          <div class="font-display mb-5 sticky top-0 bg-bg-surface z-10 pb-2">Transaction Ledger</div>
          <div v-if="txStore.loading" class="animate-pulse space-y-3">
             <div class="h-12 w-full bg-bg-surface3 rounded-lg"></div>
             <div class="h-12 w-full bg-bg-surface3 rounded-lg"></div>
          </div>
          <div v-else-if="!activeIpoTransactions.length" class="text-ink-muted text-sm text-center py-8">
            No transactions linked to this IPO. (Legacy application)
          </div>
          <div v-else class="space-y-2 overflow-y-auto flex-1 pr-2">
            <div v-for="tx in activeIpoTransactions" :key="tx.id" class="p-3 bg-bg-surface2 rounded-lg flex justify-between items-center transition-colors hover:bg-bg-surface3">
              <div>
                <div class="text-xs font-bold text-ink mb-1">{{ tx.description }}</div>
                <div class="text-[10px] text-ink-muted">{{ formatDate(tx.date) }} • {{ getTxAccountText(tx) }}</div>
              </div>
              <div class="text-[11px] font-mono" :class="tx.amount > 0 ? 'text-status-success' : 'text-ink'">
                {{ tx.amount > 0 ? '+' : '' }}RM {{ Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2}) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Apply modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showApplyModal"
             class="fixed inset-0 z-[200] flex items-center justify-center p-4"
             @click.self="showApplyModal = false">
          <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>
          <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 class="font-display text-lg">Apply for IPO</h2>
              <button class="text-ink-muted hover:text-ink text-lg" @click="showApplyModal = false">✕</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Stock Code</label>
                <input v-model="applyForm.stock" type="text" placeholder="e.g. MYEG-WC" class="input-field font-mono uppercase" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Apply Lot</label>
                  <input v-model.number="applyForm.applyLot" type="number" placeholder="e.g. 100" class="input-field font-mono" />
                </div>
                <div>
                  <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Stock Price (RM)</label>
                  <input v-model.number="applyForm.applyStockPrice" type="number" step="0.005" placeholder="0.25" class="input-field font-mono" />
                </div>
              </div>
              <div class="bg-bg-surface3 border-l-2 border-accent rounded p-2 text-[10px] text-ink-muted">
                1 Lot = 100 Units. Total application cost will be <strong>RM {{ applyFormAmount.toLocaleString() }}</strong>.
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Apply Date</label>
                <input v-model="applyForm.date" type="date" class="input-field font-mono" />
              </div>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <label class="text-[11px] text-ink-muted uppercase tracking-wider">Fund Sources</label>
                  <button @click="addFundRow" class="text-[10px] text-accent font-bold hover:underline">+ Add Fund</button>
                </div>

                <div v-for="(split, index) in applyForm.fundSplits" :key="index" class="flex gap-2 items-start">
                  <select v-model="split.sourceId" class="select-field flex-1 text-xs">
                    <option value="">— Select fund —</option>
                    <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                      {{ a.label }} (RM {{ a.balance.toLocaleString() }})
                    </option>
                  </select>
                  <input v-model.number="split.amount" type="number" placeholder="Amt" class="input-field w-24 font-mono text-xs" />
                  <button v-if="applyForm.fundSplits.length > 1" @click="removeFundRow(index)" class="text-status-danger p-1">✕</button>
                </div>

                <div v-if="applyFormAmount > 0" class="text-[10px] mt-1 flex justify-between">
                  <span :class="isTally ? 'text-status-success' : 'text-status-danger'">
                    Source Total: RM {{ totalSplitAmount.toLocaleString() }} / RM {{ applyFormAmount.toLocaleString() }}
                  </span>
                  <span v-if="!isTally" class="italic">Amount must match exactly</span>
                </div>
              </div>
            </div>
            <div class="flex gap-2 px-5 pb-5">
              <button class="btn-ghost flex-1 justify-center" @click="showApplyModal = false">Cancel</button>
              <button class="btn-primary flex-1 justify-center" 
                  :disabled="applyingIpo || !isTally || !applyForm.stock" 
                  @click="handleApply">
                {{ applyingIpo ? 'Applying…' : 'Submit Application' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountStore }          from '@/stores/accounts'
import { useIpoStore }              from '@/stores/ipo'
import { useTransactionStore }      from '@/stores/transactions'
import StatCard   from '@/components/StatCard.vue'
import PageHeader from '@/components/PageHeader.vue'

const accStore = useAccountStore()
const ipoStore = useIpoStore()
const txStore  = useTransactionStore()

const activeIpo      = ref(null)
const showApplyModal = ref(false)
const applyingIpo    = ref(false)
const recordingSale  = ref(false)
const formRef        = ref(null)

const ballotDate   = ref(new Date().toISOString().slice(0, 10))
const allocatedLot = ref(null)
const refundAmount = ref(null)
const refundSplits = ref([{ sourceId: '', amount: null }])
const listingDate  = ref(new Date().toISOString().slice(0, 10))

const saleForm  = ref({ sellDate: new Date().toISOString().slice(0, 10), price: null, brokerage: 12, profitDestId: '' })
const applyForm = ref({ 
  stock: '', 
  applyLot: null,
  applyStockPrice: null,
  amount: null, 
  date: new Date().toISOString().slice(0, 10), 
  fundSplits: [{ sourceId: '', amount: null }] 
})

const applyFormAmount = computed(() => {
  return (applyForm.value.applyLot || 0) * (applyForm.value.applyStockPrice || 0) * 100;
})

// UI Helpers
const addFundRow = () => applyForm.value.fundSplits.push({ sourceId: '', amount: null })
const removeFundRow = (index) => {
  if (applyForm.value.fundSplits.length > 1) applyForm.value.fundSplits.splice(index, 1)
}

const addRefundRow = () => refundSplits.value.push({ sourceId: '', amount: null })
const removeRefundRow = (index) => {
  if (refundSplits.value.length > 1) refundSplits.value.splice(index, 1)
}

// Validation Logic
const totalSplitAmount = computed(() => 
  applyForm.value.fundSplits.reduce((sum, f) => sum + (f.amount || 0), 0)
)
const isTally = computed(() => applyFormAmount.value === totalSplitAmount.value)

const totalRefundSplitAmount = computed(() => 
  refundSplits.value.reduce((sum, f) => sum + (f.amount || 0), 0)
)
const isRefundTally = computed(() => refundAmount.value === totalRefundSplitAmount.value)

watch(allocatedLot, (newVal) => {
  if (newVal > 0 && activeIpo.value) {
    const owed = ipoStore.getOwedCapital(activeIpo.value.id)
    const keys = Object.keys(owed)
    if (keys.length > 0 && refundSplits.value.length === 1 && !refundSplits.value[0].sourceId) {
      refundSplits.value = keys.map(k => ({ sourceId: k, amount: null }))
    }
  }
})

onMounted(() => {
  accStore.fetchAccounts()
  ipoStore.fetchIpos()
  txStore.fetchTransactions()
})

const activeIpoTransactions = computed(() => {
  if (!activeIpo.value) return [];
  return txStore.transactions
    .filter(t => t.refId === activeIpo.value.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
})

const getTxAccountText = (tx) => {
  if (tx.sourceId && tx.destId) return `${accStore.getAccountLabel(tx.sourceId)} → ${accStore.getAccountLabel(tx.destId)}`
  if (tx.sourceId) return `From ${accStore.getAccountLabel(tx.sourceId)}`
  if (tx.destId) return `To ${accStore.getAccountLabel(tx.destId)}`
  return ''
}

const stageOrder = ['Applied', 'Balloted', 'Listed', 'Sold', 'Not Allotted']

const ipoStatus = (ipo) => {
  if (ipo.sellDate) return 'Sold'
  if (ipo.listDate) return 'Listed'
  if (ipo.ballotDate) {
    // If ballot date exists but lots are 0, it's a dead end
    return (ipo.allocatedLot > 0) ? 'Balloted' : 'Not Allotted'
  }
  return 'Applied'
}

const estProfit = computed(() => {
  if (!activeIpo.value || !saleForm.value.price) return 0
  const gross = saleForm.value.price * (activeIpo.value.allocatedLot ? activeIpo.value.allocatedLot * 100 : 0)
  return gross - activeIpo.value.applyAmount + (activeIpo.value.refund ?? 0) - (saleForm.value.brokerage || 0)
})

const lifecycleSteps = [
  { label: 'Applied',  sub: (i) => i.applyDate ? formatDate(i.applyDate) : '' },
  { label: 'Balloted', sub: (i) => i.allocatedLot ? `${i.allocatedLot.toLocaleString()} lots` : (i.ballotDate ? '0 lots' : '—') },
  { label: 'Listed',   sub: (i) => ipoStatus(i) === 'Not Allotted' ? 'N/A' : (i.listDate ? formatDate(i.listDate) : '—') },
  { label: 'Sold',     sub: (i) => ipoStatus(i) === 'Not Allotted' ? 'N/A' : (i.sellPrice ? `@ RM ${i.sellPrice}` : '—') },
]

const stepDone    = (i) => {
  if (!activeIpo.value) return false
  const status = ipoStatus(activeIpo.value)
  if (status === 'Not Allotted' && i >= 2) return false
  return stageOrder.indexOf(status) > i
}
const stepCurrent = (i) => {
  if (!activeIpo.value) return false
  const status = ipoStatus(activeIpo.value)
  if (status === 'Not Allotted' && i === 1) return true // Balloted is the current/last valid stage
  return stageOrder.indexOf(status) === i
}
const stepFailed = (i) => {
  if (!activeIpo.value) return false
  return ipoStatus(activeIpo.value) === 'Not Allotted' && i >= 2
}

const stageBadge = (status) => ({
  Applied: 'badge-blue', 
  Balloted: 'badge-pink', 
  Listed: 'badge-accent', 
  Sold: 'badge-green',
  'Not Allotted': 'badge-gray', // Style for unsuccessful ballot
}[status] ?? 'badge-gray')

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const recordSale = async () => {
  if (!saleForm.value.price || !saleForm.value.sellDate || !activeIpo.value) return
  recordingSale.value = true
  try {
    await ipoStore.recordIPOSale(activeIpo.value.id, {
      sellDate: saleForm.value.sellDate,
      sellPrice: saleForm.value.price, 
      brokerage: saleForm.value.brokerage || 0,
      profitDestId: saleForm.value.profitDestId
    })
    activeIpo.value = ipoStore.ipos.find(i => i.id === activeIpo.value.id)
    saleForm.value  = { sellDate: new Date().toISOString().slice(0, 10), price: null, brokerage: 12, profitDestId: '' }
  } finally {
    recordingSale.value = false
  }
}

const handleRecordBallot = async () => {
  if (!activeIpo.value || allocatedLot.value === null) return
  
  // Auto sum for failed ballots
  const actRefund = allocatedLot.value === 0 ? activeIpo.value.applyAmount : (refundAmount.value || 0)

  await ipoStore.updateBallotResult(activeIpo.value.id, {
    ballotDate: ballotDate.value,
    allocatedLot: allocatedLot.value,
    refund: actRefund,
    refundSplits: refundSplits.value
  })
  activeIpo.value = ipoStore.ipos.find(i => i.id === activeIpo.value.id)
  allocatedLot.value = null
  refundAmount.value = null
  refundSplits.value = [{ sourceId: '', amount: null }]
}

const handleRecordListing = async () => {
  if (!activeIpo.value || !listingDate.value) return
  await ipoStore.recordListingDate(activeIpo.value.id, listingDate.value)
  activeIpo.value = ipoStore.ipos.find(i => i.id === activeIpo.value.id)
}

const handleApply = async () => {
  // 1. Validation: Must have stock, amount, and the splits must equal the total amount
  if (!applyForm.value.stock || !applyFormAmount.value || !isTally.value) {
    toast.error("Please ensure the stock name is filled and fund totals match exactly.")
    return
  }

  applyingIpo.value = true
  try {
    // 2. Pass the new structure to the store
    await ipoStore.applyForIpo({
      stock:      applyForm.value.stock,
      applyStockPrice: applyForm.value.applyStockPrice,
      applyLot:   applyForm.value.applyLot,
      date:       applyForm.value.date,
      fundSplits: applyForm.value.fundSplits,
    })

    // 3. Success: Close and Reset
    showApplyModal.value = false
    resetApplyForm()
  } catch (err) {
    // Error is handled by the store's toast, but we stop the loading state here
    console.error(err)
  } finally {
    applyingIpo.value = false
  }
}

/** Helper to reset the form back to 1 empty row */
const resetApplyForm = () => {
  applyForm.value = { 
    stock: '', 
    applyLot: null,
    applyStockPrice: null,
    amount: null, 
    date: new Date().toISOString().slice(0, 10), 
    fundSplits: [{ sourceId: '', amount: null }] 
  }
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
