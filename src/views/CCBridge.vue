<template>
  <div>
    <PageHeader title="CC Bridge" sub="Credit card reconciliation & debt mapping" />

    <div class="grid grid-cols-4 gap-3.5 mb-5">
      <template v-if="ccStore.loading">
        <div v-for="i in 4" :key="i" class="stat-card animate-pulse">
          <div class="h-2.5 w-20 bg-bg-surface3 rounded mb-3"></div>
          <div class="h-6 w-24 bg-bg-surface3 rounded"></div>
        </div>
      </template>
      <template v-else>
        <StatCard label="CC Outstanding"    :value="`RM ${totalCcOutstanding.toLocaleString()}`"              :variant="totalCcOutstanding < 0 ? 'danger' : 'success'" />
        <StatCard label="Unassigned Items"  :value="`${ccStore.unassignedCount} item${ccStore.unassignedCount !== 1 ? 's' : ''}`" variant="warn" />
        <StatCard label="Next Bill Date"    value="18 Jun"   sub="7 days away" />
        <StatCard label="Assigned to Funds" :value="`RM ${ccStore.assignedTotal.toLocaleString()}`"
                  :sub="`${assignedCount} of ${ccStore.ccBridge.length} assigned`" variant="accent" />
      </template>
    </div>

    <!-- Wallet Section -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="section-label mb-0">My Credit Cards</div>
        <button class="text-[10px] uppercase tracking-wider text-accent hover:opacity-80 transition-opacity font-medium"
              @click="showAddCardModal = true">
          + Add Card
        </button>
      </div>

      <div v-if="accStore.ccAccounts.length === 0" class="card py-8 flex flex-col items-center justify-center text-ink-muted">
        <div class="text-2xl mb-2 opacity-50">💳</div>
        <div class="text-sm">No credit cards added yet</div>
      </div>
      
      <div v-else class="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
        <div v-for="cc in accStore.ccAccounts" :key="cc.id"
             class="shrink-0 w-[300px] h-[180px] rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden shadow-lg snap-start cursor-pointer transition-all border"
             :style="{ 
               background: cc.bank === 'Maybank' ? 'linear-gradient(135deg, #1c1c1e 0%, #111111 100%)' : 
                           cc.bank === 'CIMB' ? 'linear-gradient(135deg, #6b1422 0%, #3a0810 100%)' : 
                           'linear-gradient(135deg, #174235 0%, #092119 100%)',
             }"
             :class="selectedCard === cc.id ? 'border-accent ring-1 ring-accent shadow-glow scale-[1.02] opacity-100 z-10' : 'border-white/10 opacity-80 hover:opacity-100'"
             @click="selectedCard = selectedCard === cc.id ? null : cc.id">
          
          <!-- Subtle Glow/Overlay -->
          <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div class="absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl opacity-20"
               :style="{ background: cc.bank === 'Maybank' ? '#f5c842' : cc.bank === 'CIMB' ? '#e05555' : '#70dba0' }"></div>

          <!-- Top Row -->
          <div class="flex justify-between items-start relative z-10">
            <div class="font-display font-medium text-white/90 tracking-wide">{{ cc.bank }}</div>
            <!-- EMV Chip Mockup -->
            <div class="w-9 h-7 rounded bg-gradient-to-br from-yellow-100 to-yellow-500 opacity-90 shadow-sm flex items-center justify-center overflow-hidden border border-yellow-600/30">
              <div class="w-full h-[1px] bg-black/10 absolute"></div>
              <div class="h-full w-[1px] bg-black/10 absolute"></div>
            </div>
          </div>

          <!-- Balance -->
          <div class="relative z-10 flex-1 flex flex-col justify-center">
            <div class="text-[10px] uppercase tracking-widest text-white/50 mb-0.5 mt-2">Outstanding</div>
            <div class="font-mono text-2xl font-light tracking-wide" :class="ccTotalByAccount(cc.id) < 0 ? 'text-red-400' : 'text-emerald-400'">
              RM {{ ccTotalByAccount(cc.id).toLocaleString() }}
            </div>
          </div>

          <!-- Bottom Row -->
          <div class="relative z-10 flex justify-between items-end">
            <div>
              <div class="text-[9px] uppercase tracking-widest text-white/50 mb-0.5">Cardholder</div>
              <div class="text-[13px] font-medium text-white/90 truncate max-w-[120px]">{{ cc.label }}</div>
            </div>
            
            <div class="text-right">
              <div class="font-mono text-sm text-white/90 tracking-widest mb-0.5 shadow-sm">
                •••• {{ cc.ccLast4 || 'XXXX' }}
              </div>
              <div class="text-[9px] uppercase tracking-widest text-white/50">
                EXP {{ cc.ccExpiry || '12/99' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- CC list -->
      <div class="flex flex-col gap-4">
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="section-label mb-0">Pending CC Transactions</div>
            <button class="text-[10px] uppercase tracking-wider text-accent hover:opacity-80 transition-opacity font-medium"
                  @click="showAddCcModal = true">
              + CC Transaction
            </button>
          </div>
          <div class="card p-0 overflow-hidden">
            <template v-if="ccStore.loading">
              <div class="p-4 space-y-3 animate-pulse">
                <div v-for="i in 3" :key="i" class="flex gap-3 items-center">
                  <div class="h-2.5 w-12 bg-bg-surface3 rounded"></div>
                  <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
                  <div class="h-2.5 w-14 bg-bg-surface3 rounded"></div>
                </div>
              </div>
            </template>
            <template v-else>
              <table class="table-base">
                <thead>
                  <tr><th>Date</th><th>Item</th><th>Amount</th><th>Fund</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in sortedBridge" :key="item.id"
                    class="cursor-pointer transition-colors"
                    :class="selected.some(i => i.id === item.id) ? 'bg-accent/[0.04] border-l-2 border-accent' : 'hover:bg-white/[0.02]'"
                    @click="toggleSelect(item)">
                    <td class="text-ink-muted text-xs whitespace-nowrap">{{ formatDate(item.date) }}</td>
                    <td class="max-w-[140px] truncate">{{ item.description }}</td>
                    <td class="amount-neg whitespace-nowrap">RM {{ item.amount.toLocaleString() }}</td>
                    <td>
                      <span v-if="item.fundingSourceId" class="badge badge-yellow text-[11px]">
                        {{ accStore.getAccountLabel(item.fundingSourceId) }}
                      </span>
                      <span v-else class="badge badge-accent text-[11px]">Unassigned</span>
                    </td>
                    <td>
                      <span class="badge text-[11px]"
                            :class="item.status === 'Assigned' || item.status === 'Settled' ? 'badge-green'
                                  : item.status === 'Pending'    ? 'badge-red'
                                  : 'badge-accent'">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!sortedBridge.length">
                    <td colspan="5" class="text-center text-ink-muted py-6 text-sm">No pending CC items</td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>
        </div>
      </div>

      <!-- Wizard -->
      <div>
        <div class="section-label">Reconciliation Wizard</div>
        <div class="card min-h-[300px]">
          <template v-if="selected.length > 0">
            <div class="bg-bg-surface2 rounded-lg p-3 mb-4">
              <div class="text-[11px] text-ink-muted uppercase tracking-wider">
                {{ selected.length }} Selected Item{{ selected.length > 1 ? 's' : '' }}
              </div>
              <div v-if="selected.length === 1" class="text-sm text-ink mt-1.5 font-medium">{{ selected[0].description }}</div>
              <div v-else class="text-sm text-ink mt-1.5 font-medium">Multiple Transactions Selected</div>
              <div v-if="selected.length === 1" class="text-[11px] text-ink-muted mt-0.5">{{ formatDate(selected[0].date) }}</div>
              <div class="font-mono text-xl text-status-danger mt-2">RM {{ totalSelectedAmount.toLocaleString() }}</div>
            </div>

            <!-- Settled State -->
            <template v-if="allSettled">
              <div class="flex flex-col items-center justify-center py-8 text-center bg-status-success/5 rounded-xl border border-status-success/20">
                <div class="w-10 h-10 rounded-full bg-status-success/20 flex items-center justify-center text-status-success mb-3">✓</div>
                <div class="text-sm font-medium text-ink">Transaction Settled</div>
                <div v-if="selected.length === 1" class="text-[12px] text-ink-muted mt-1 px-4 leading-relaxed">
                  Paid on <span class="text-ink font-medium">{{ formatDate(selected[0].settlementDate) }}</span><br>
                  using <span class="text-ink font-medium">{{ accStore.getAccountLabel(selected[0].fundingSourceId) }}</span>
                </div>
                <div v-else class="text-[12px] text-ink-muted mt-1 px-4 leading-relaxed">
                  All selected items have been paid.
                </div>
                <button class="btn-ghost text-xs mt-6" @click="resetWizard">Select Another</button>
              </div>
            </template>

            <!-- Assignment Form (Unassigned / Pending / Assigned) -->
            <template v-else>
              <div class="mb-4">
                <label class="text-[11px] text-ink-muted mb-1.5 uppercase tracking-wider block">Assign To</label>
                <select v-model="wizard.type" class="select-field w-full">
                  <option value="virtual">Virtual Fund</option>
                  <option v-if="salaryAccount" value="salary">{{ salaryAccount.label }}</option>
                </select>
              </div>

              <div v-if="accStore.loading" class="space-y-2 animate-pulse mb-4">
                <div v-for="i in 3" :key="i" class="h-12 bg-bg-surface2 rounded-lg"></div>
              </div>

              <div v-else class="mb-4">
                <div v-if="wizard.type === 'virtual'" class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  <label v-for="acc in filteredVirtualAccounts" :key="acc.id"
                        class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-all"
                        :class="wizard.selectedFund === acc.id ? 'border-accent/40 bg-accent/[0.04]' : 'border-border hover:border-border-strong bg-bg-surface2'">
                    <input type="radio" v-model="wizard.selectedFund" :value="acc.id" class="accent-accent shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="text-[13px] text-ink truncate">{{ acc.label }}</div>
                      <div class="text-[11px] text-ink-muted">
                        {{ acc.bank }} · 
                        <span :class="acc.balance >= assignableAmount ? 'text-status-success' : 'text-status-danger'">
                          RM {{ acc.balance.toLocaleString() }} available
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                <div v-else class="flex flex-col gap-3 p-3 bg-bg-surface2 rounded-lg border border-border">
                  <div>
                    <label class="text-[10px] text-ink-muted uppercase mb-1 block">Category</label>
                    <select v-model="wizard.category" class="select-field text-sm w-full">
                      <option value="" disabled>Select Category</option>
                      <option v-for="cat in activeCategories" :key="cat" :value="cat">{{ cat }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] text-ink-muted uppercase mb-1 block">Envelope</label>
                    <select v-model="wizard.envelope" :disabled="!wizard.category" class="select-field text-sm w-full">
                      <option value="" disabled>Select Envelope</option>
                      <option v-for="env in availableEnvelopes" :key="env.id" :value="env.id">
                        {{ env.name }} (RM {{ env.remaining }} left)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <button class="btn-primary w-full justify-center"
                      :disabled="isSaveDisabled || saving"
                      @click="assignFund">
                {{ saving ? 'Saving…' : `Assign & Pay RM ${assignableAmount.toLocaleString()}` }}
              </button>
              <button class="btn-ghost w-full justify-center mt-2 text-xs"
                      @click="resetWizard">Cancel</button>
            </template>
          </template>

          <template v-else>
            <div class="flex flex-col items-center justify-center h-full py-12 text-center">
              <div class="text-2xl mb-3 opacity-40">←</div>
              <div class="text-sm text-ink-muted">Select a CC transaction<br>to assign its funding source</div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <AddCardModal v-model="showAddCardModal" />
    <AddCcTransactionModal v-model="showAddCcModal" @saved="ccStore.fetchCcBridge(true)" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountStore }          from '@/stores/accounts'
import { useTransactionStore }      from '@/stores/transactions'
import { useCcStore }               from '@/stores/cc'
import { useSalaryStore } from '@/stores/salary'
import { useToast } from '@/composables/useToast'
import StatCard  from '@/components/StatCard.vue'
import PageHeader from '@/components/PageHeader.vue'
import AddCardModal from '@/components/AddCardModal.vue'
import AddCcTransactionModal from '@/components/AddCcTransactionModal.vue'

const toast = useToast()
const accStore = useAccountStore()
const txStore  = useTransactionStore()
const ccStore  = useCcStore()
const salaryStore = useSalaryStore()

const selectedCard = ref(null)
const selected = ref([])
const saving   = ref(false)
const showAddCardModal = ref(false)
const showAddCcModal   = ref(false)

const wizard = ref({
  type: 'virtual',
  selectedFund: '',
  category: '',
  envelope: ''
})

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
  ccStore.fetchCcBridge()
  // Call the correct fetch functions from your salary.js store
  salaryStore.fetchEnvelopes()
  salaryStore.fetchCycleBudgets()
})

const assignedCount = computed(() =>
  ccStore.ccBridge.filter(c => c.status === 'Assigned' || c.status === 'Settled').length
)

const ccTotalByAccount = (accountId) =>
  txStore.transactions
    .filter(t => (t.sourceId === accountId && t.isCc) || t.destId === accountId)
    .reduce((s, t) => {
      if (t.sourceId === accountId && t.isCc) return s + t.amount;
      if (t.destId === accountId) return s + Math.abs(t.amount);
      return s;
    }, 0)

const totalCcOutstanding = computed(() => {
  return accStore.ccAccounts.reduce((sum, cc) => sum + ccTotalByAccount(cc.id), 0)
})

const ccCountByAccount = (accountId) =>
  txStore.transactions.filter(t => (t.sourceId === accountId && t.isCc) || t.destId === accountId).length

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// Finds the specific "Salary" account from dim_accounts
const salaryAccount = computed(() => 
  accStore.accounts.find(a => a.label.toLowerCase() === 'salary')
)

// List of virtual accounts excluding the Salary one
const filteredVirtualAccounts = computed(() => 
  accStore.virtualAccounts.filter(a => a.label.toLowerCase() !== 'salary')
)

// Extracts unique categories currently in use in the active cycle
const activeCategories = computed(() => {
  return salaryStore.cycleBudgetsWithSpent.map(g => g.category)
})

// Filter envelopes based on selected category
const availableEnvelopes = computed(() => {
  if (!wizard.value.category) return []
  
  // Find the category group in cycleBudgetsWithSpent
  const group = salaryStore.cycleBudgetsWithSpent.find(g => g.category === wizard.value.category)
  return group ? group.envelopes : []
})

const isSaveDisabled = computed(() => {
  if (wizard.value.type === 'virtual') return !wizard.value.selectedFund
  return !wizard.value.category || !wizard.value.envelope
})

const sortedBridge = computed(() => {
  // Create a shallow copy to avoid mutating the original store array
  let bridgeList = ccStore.ccBridge;

  if (selectedCard.value) {
    bridgeList = bridgeList.filter(item => {
      const tx = txStore.transactions.find(t => t.id === item.txId);
      if (!tx) return false;
      return (tx.sourceId === selectedCard.value && tx.isCc) || tx.destId === selectedCard.value;
    });
  }

  return [...bridgeList].sort((a, b) => {
    // 1. Sort by Status Priority (Unassigned/Pending first)
    const statusOrder = { 'Unassigned': 0, 'Pending': 0, 'Assigned': 1, 'Settled': 2 };
    const statusA = statusOrder[a.status] ?? 99;
    const statusB = statusOrder[b.status] ?? 99;

    if (statusA !== statusB) {
      return statusA - statusB;
    }

    // 2. Secondary Sort: Date (Newest first)
    // localeCompare works great for YYYY-MM-DD strings
    return b.date.localeCompare(a.date);
  });
});
  
const itemsToAssign = computed(() => selected.value.filter(i => i.status !== 'Settled'))
const assignableAmount = computed(() => itemsToAssign.value.reduce((s, i) => s + i.amount, 0))
const totalSelectedAmount = computed(() => selected.value.reduce((s, i) => s + i.amount, 0))
const allSettled = computed(() => selected.value.length > 0 && selected.value.every(i => i.status === 'Settled'))

const toggleSelect = (item) => {
  const index = selected.value.findIndex(i => i.id === item.id)
  if (index !== -1) {
    selected.value.splice(index, 1)
  } else {
    selected.value.push(item)
  }
  
  if (selected.value.length === 1 && item.fundingSourceId) {
    wizard.value.selectedFund = item.fundingSourceId
  }
}

const resetWizard = () => {
  selected.value = []
  wizard.value = { type: 'virtual', selectedFund: '', category: '', envelope: '' }
}

const assignFund = async () => {
  if (isSaveDisabled.value || itemsToAssign.value.length === 0) return
  saving.value = true
  
  try {
    const sourceId = wizard.value.type === 'salary' 
      ? salaryAccount.value.id 
      : wizard.value.selectedFund

    for (const item of itemsToAssign.value) {
      await ccStore.assignCCFund(
        item.id, 
        sourceId, 
        { 
          category: wizard.value.category, 
          envelope: wizard.value.envelope 
        },
        true // skip refresh
      )
    }

    await ccStore.fetchCcBridge(true)
    await txStore.fetchTransactions(true)
    toast.success(`${itemsToAssign.value.length} items assigned successfully`)

    resetWizard()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

</script>
