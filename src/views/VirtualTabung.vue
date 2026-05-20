<template>
  <div class="virtual-tabung-page">
    <PageHeader title="Virtual Tabung" sub="Funds-within-banks · Savings goals">
      <template #action>
        <button class="btn-primary" @click="showTransfer = true">⇄ Transfer Funds</button>
      </template>
    </PageHeader>

    <!-- Loading skeleton -->
    <template v-if="accStore.loading || txStore.loading">
      <div v-for="b in 3" :key="b" class="mb-7">
        <div class="flex items-center gap-2 mb-3 animate-pulse">
          <div class="h-2.5 w-16 bg-bg-surface3 rounded"></div>
          <div class="h-2.5 w-24 bg-bg-surface3 rounded"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div v-for="i in 2" :key="i" class="card animate-pulse space-y-3">
            <div class="h-3 w-24 bg-bg-surface3 rounded"></div>
            <div class="h-6 w-28 bg-bg-surface3 rounded"></div>
            <div class="h-1.5 bg-bg-surface3 rounded-full"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 items-start lg:h-[calc(100vh-180px)] min-h-[500px]">
        
        <!-- LEFT: Physical Banks -->
        <div class="col-span-1 md:col-span-3 lg:col-span-3 flex flex-col gap-3 lg:h-full lg:overflow-y-auto pr-1">
          <div class="section-label mb-0">Physical Banks</div>
          <div v-for="bank in accStore.physicalBanks" :key="bank.id"
               @click="selectBank(bank)"
               class="card cursor-pointer transition-colors border"
               :class="selectedBankId === bank.id ? 'border-accent bg-accent/5' : 'hover:border-border-strong border-transparent'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-1.5 h-10 rounded-full shrink-0" :style="{ background: bank.color }"></div>
                <div>
                  <div class="font-medium text-[15px] text-ink" :class="{'text-accent': selectedBankId === bank.id}">
                    {{ bank.name }}
                  </div>
                  <div class="text-[11px] text-ink-muted font-mono mt-0.5">
                    RM {{ bank.balance.toLocaleString() }}
                  </div>
                </div>
              </div>
              <div class="text-[10px] text-ink-faint font-medium bg-bg-surface2 px-2 py-1 rounded shrink-0">
                {{ bank.funds.length }} funds
              </div>
            </div>
          </div>
        </div>

        <!-- MIDDLE: Virtual Funds -->
        <div class="col-span-1 md:col-span-5 lg:col-span-5 flex flex-col gap-3 lg:h-full lg:overflow-y-auto pr-1 pb-4">
          <div class="flex items-center justify-between mb-0" v-if="activeBank">
            <div class="section-label mb-0">{{ activeBank.name }} Funds</div>
            <button @click="openFundModal(null, activeBank)" class="text-[11px] font-medium text-accent hover:underline">
              + Add Fund
            </button>
          </div>

          <div v-if="!activeBank?.funds.length" class="card border-dashed flex items-center justify-center py-8 text-sm text-ink-faint">
            No virtual funds linked.
          </div>
          <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
            <div v-for="fund in sortedActiveBankFunds" :key="fund.id"
                 @click="selectFund(fund)"
                 class="card border cursor-pointer transition-all group relative flex flex-col"
                 :class="selectedFundId === fund.id ? 'border-accent bg-accent/5 shadow-sm' : 'hover:border-border-strong border-border'">
              
              <div class="flex items-start justify-between mb-1">
                <div>
                  <div class="text-[15px] font-medium text-ink">{{ fund.label }}</div>
                  <div class="text-[11px] text-ink-muted mt-0.5">Virtual</div>
                </div>
                <span class="badge text-[10px]" :class="fund.goal ? 'badge-accent' : 'badge-gray'">
                  {{ fund.goal ? 'Goal' : 'Buffer' }}
                </span>
              </div>

              <div class="flex items-baseline justify-between mt-3">
                <div class="font-mono text-xl" :style="{ color: activeBank.color }">
                  RM {{ fund.balance.toLocaleString() }}
                </div>
                <div v-if="fund.goal" class="text-[11px] text-ink-muted font-mono">
                  / RM {{ fund.goal.toLocaleString() }}
                </div>
              </div>

              <div class="flex-1"></div>

              <template v-if="fund.goal">
                <ProgressBar :value="fund.balance" :max="fund.goal"
                             :color="progressColor(fund.balance, fund.goal)" :height="5" class="mt-2.5 shrink-0" />
                <div class="flex justify-between text-[11px] mt-1.5 shrink-0">
                  <span class="text-ink-muted">
                    {{ Math.round((fund.balance / fund.goal) * 100) }}% ·
                    RM {{ Math.max(0, fund.goal - fund.balance).toLocaleString() }} left
                  </span>
                  <span v-if="fund.goalDate" class="text-ink-faint">{{ fund.goalDate }}</span>
                </div>
              </template>
              <template v-else>
                <div class="mt-2.5 h-1.5 rounded-full overflow-hidden shrink-0" :style="{ background: activeBank.color + '22' }">
                  <div class="h-full rounded-full" :style="{ background: activeBank.color, width: '100%' }"></div>
                </div>
                <div class="text-[11px] text-ink-muted mt-1.5 shrink-0">Buffer · Uncapped</div>
              </template>

              <!-- Action Buttons Row -->
              <div v-if="selectedFundId === fund.id" class="flex gap-1.5 mt-3 pt-3 border-t border-border shrink-0">
                <button class="btn-ghost flex-1 text-[11px] py-1 px-2 justify-center" @click.stop="openTransfer(fund)">
                  Transfer
                </button>
                <button class="btn-ghost flex-1 text-[11px] py-1 px-2 justify-center" @click.stop="openFundModal(fund, activeBank)">
                  Edit Fund
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Transactions -->
        <div class="col-span-1 md:col-span-4 lg:col-span-4 flex flex-col lg:h-full lg:overflow-hidden">
          <div class="section-label mb-2 flex justify-between items-center shrink-0">
            <span>{{ activeFund?.label || activeBank?.name || 'Bank' }} Activity</span>
          </div>
          
          <div v-if="!fundTransactions.length" class="card border-dashed flex items-center justify-center flex-1 text-sm text-ink-faint text-center min-h-[200px]">
            No transactions found.
          </div>
          <div v-else class="card p-0 lg:overflow-y-auto flex-1 divide-y divide-border border-border flex flex-col">
             <div v-for="t in fundTransactions" :key="t.id" class="p-3.5 hover:bg-bg-surface2 transition-colors shrink-0">
                <div class="flex justify-between items-start mb-1 gap-2">
                  <div class="font-medium text-[13px] text-ink leading-snug">{{ t.description }}</div>
                  <div class="font-mono text-[13px] whitespace-nowrap pt-0.5" :class="getTxColor(t)">
                    {{ getTxSign(t) }}RM {{ Math.abs(t.amount).toLocaleString() }}
                  </div>
                </div>
                <div class="flex justify-between items-center text-[11px] text-ink-muted mt-1.5">
                  <div class="flex items-center gap-2">
                    <span>{{ formatDate(t.date) }}</span>
                    <span class="w-1 h-1 rounded-full bg-border-strong"></span>
                    <span>{{ t.category }}</span>
                  </div>
                  <span class="px-1.5 py-0.5 bg-bg-surface3 rounded text-[9px] uppercase tracking-wider font-semibold" v-if="t.envelopeId">
                    ENV
                  </span>
                </div>
             </div>
          </div>
        </div>

      </div>
    </template>

    <!-- Fund Modal (Add / Edit) -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="fundModal.show" class="fixed inset-0 z-[200] flex items-center justify-center p-4"
             @click.self="closeFundModal">
          <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>
          <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-bg-surface2">
              <h2 class="font-display text-lg">{{ fundModal.isEdit ? 'Edit' : 'New' }} Virtual Fund</h2>
              <button class="text-ink-muted hover:text-ink" @click="closeFundModal">✕</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div>
                <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">Fund Name</label>
                <input v-model="fundForm.label" type="text" placeholder="e.g. Raya Fund" class="input-field" />
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">Physical Bank</label>
                <select v-model="fundForm.bankId" class="select-field" :disabled="fundModal.isEdit">
                  <option value="">— Select bank —</option>
                  <option v-for="b in accStore.physicalBanks" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">Savings Goal (RM)</label>
                  <input v-model.number="fundForm.goal" type="number" step="100" placeholder="Optional"
                         class="input-field font-mono" />
                </div>
                <div>
                  <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">Goal Date</label>
                  <input v-model="fundForm.goalDate" type="text" placeholder="e.g. Dec 2025"
                         class="input-field text-xs" />
                </div>
              </div>
              <div v-if="fundModal.isEdit"
                   class="text-[11px] text-ink-muted bg-bg-surface2 rounded-lg px-3 py-2">
                ⓘ Bank cannot be changed after creation.
              </div>
            </div>
            <div class="flex gap-2 px-5 pb-5">
              
              <button 
                v-if="fundModal.isEdit" 
                class="btn-ghost text-status-danger px-3 hover:bg-status-danger/10"
                @click="handleDeleteFund"
                :disabled="vStore.saving"
              >
                Delete
              </button>

              <div class="flex-1"></div>

              <button class="btn-ghost px-4" @click="closeFundModal">Cancel</button>
              <button class="btn-primary px-6" :disabled="vStore.saving" @click="handleSaveFund">
                {{ vStore.saving ? 'Saving…' : (fundModal.isEdit ? 'Save Changes' : 'Create Fund') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Transfer Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showTransfer" class="fixed inset-0 z-[200] flex items-center justify-center p-4"
             @click.self="showTransfer = false">
          <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>
          <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 class="font-display text-lg">Virtual Transfer</h2>
              <button class="text-ink-muted hover:text-ink text-lg" @click="showTransfer = false">✕</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div>
                <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">From</label>
                <select v-model="transferData.fromId" class="select-field">
                  <option value="">— Select fund —</option>
                  <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                    {{ a.label }} · {{ a.bank }} (RM {{ a.balance.toLocaleString() }})
                  </option>
                </select>
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">To</label>
                <select v-model="transferData.toId" class="select-field">
                  <option value="">— Select fund —</option>
                  <option v-for="a in accStore.virtualAccounts.filter(a => a.id !== transferData.fromId)"
                          :key="a.id" :value="a.id">
                    {{ a.label }} · {{ a.bank }}
                  </option>
                </select>
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase mb-1.5 block">Amount (RM)</label>
                <input v-model.number="transferData.amount" type="number" step="0.01"
                       placeholder="0.00" class="input-field font-mono" />
              </div>

              <div v-if="transferData.fromId && transferData.amount > 0"
                   class="bg-bg-surface2 rounded-lg px-3 py-2.5 text-xs flex justify-between">
                <span class="text-ink-muted">Balance after transfer</span>
                <span class="font-mono" :class="balanceAfter >= 0 ? 'text-ink' : 'text-status-danger'">
                  RM {{ balanceAfter.toLocaleString() }}
                </span>
              </div>

              <div v-if="transferError" class="text-xs text-status-danger bg-status-danger/10 p-2.5 rounded-lg">
                {{ transferError }}
              </div>
            </div>
            <div class="flex gap-2 px-5 pb-5">
              <button class="btn-ghost flex-1 justify-center" @click="showTransfer = false">Cancel</button>
              <button class="btn-primary flex-1 justify-center"
                      :disabled="vStore.saving || balanceAfter < 0" @click="handleTransfer">
                {{ vStore.saving ? 'Transferring…' : 'Transfer' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useAccountStore }                    from '@/stores/accounts'
import { useVirtualStore }                    from '@/stores/virtualTabung'
import { useTransactionStore }                from '@/stores/transactions'
import PageHeader  from '@/components/PageHeader.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { useToast } from '@/composables/useToast'

const toast    = useToast()
const accStore = useAccountStore()
const vStore   = useVirtualStore()
const txStore  = useTransactionStore()

// ── Selection State ───────────────────────────────────────────────────────
const selectedBankId = ref(null)
const selectedFundId = ref(null)

const activeBank = computed(() => 
  accStore.physicalBanks.find(b => b.id === selectedBankId.value) || accStore.physicalBanks[0] || null
)

const sortedActiveBankFunds = computed(() => {
  if (!activeBank.value?.funds) return []
  
  const latestTxMap = {}
  txStore.transactions.forEach(t => {
    if (t.sourceId && (!latestTxMap[t.sourceId] || t.date > latestTxMap[t.sourceId])) latestTxMap[t.sourceId] = t.date
    if (t.destId && (!latestTxMap[t.destId] || t.date > latestTxMap[t.destId])) latestTxMap[t.destId] = t.date
  })

  return [...activeBank.value.funds].sort((a, b) => {
    const dateA = latestTxMap[a.id] || ''
    const dateB = latestTxMap[b.id] || ''
    return dateB.localeCompare(dateA) // Descending order
  })
})

const activeFund = computed(() => {
  if (!sortedActiveBankFunds.value.length) return null
  return sortedActiveBankFunds.value.find(f => f.id === selectedFundId.value) || null
})

// Auto-selection semantics
watch(() => accStore.physicalBanks, (banks) => {
  if (banks.length && !selectedBankId.value) {
    selectedBankId.value = banks[0].id
  }
}, { immediate: true })

watch(() => sortedActiveBankFunds.value, (funds) => {
  if (funds.length) {
    if (!funds.find(f => f.id === selectedFundId.value)) {
      selectedFundId.value = null
    }
  } else {
    selectedFundId.value = null
  }
}, { immediate: true })

const selectBank = (bank) => { 
  selectedBankId.value = bank.id
  selectedFundId.value = null
}
const selectFund = (fund) => { 
  selectedFundId.value = selectedFundId.value === fund.id ? null : fund.id 
}

// ── Fund Modal state ──────────────────────────────────────────────────────
const fundModal = reactive({ show: false, isEdit: false, activeId: null })
const fundForm  = reactive({ label: '', bankId: '', goal: null, goalDate: '' })

// ── Transfer state ────────────────────────────────────────────────────────
const showTransfer  = ref(false)
const transferError = ref('')
const transferData  = ref({ fromId: '', toId: '', amount: null })

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
})

const balanceAfter = computed(() => {
  const from = accStore.accounts.find(a => a.id === transferData.value.fromId)
  return from ? from.balance - (transferData.value.amount || 0) : 0
})

const progressColor = (val, max) => {
  const pct = val / max
  return pct >= 0.8 ? '#70dba0' : pct >= 0.5 ? '#f5c842' : '#f07070'
}

// ── Transactions feed ─────────────────────────────────────────────────────
const fundTransactions = computed(() => {
  if (!activeBank.value) return []
  
  if (activeFund.value) {
    const fid = activeFund.value.id
    return txStore.transactions
      .filter(t => t.sourceId === fid || t.destId === fid)
      .sort((a,b) => b.date.localeCompare(a.date))
      .slice(0, 25)
  } else {
    const fundIds = activeBank.value.funds.map(f => f.id)
    return txStore.transactions
      .filter(t => fundIds.includes(t.sourceId) || fundIds.includes(t.destId))
      .sort((a,b) => b.date.localeCompare(a.date))
      .slice(0, 25)
  }
})

const getTxColor = (t) => {
  if (activeFund.value) {
    const fid = activeFund.value.id
    if (t.destId === fid) return 'text-status-success'
    if (t.sourceId === fid) return 'text-ink'
    return 'text-ink-muted'
  } else if (activeBank.value) {
    const fundIds = activeBank.value.funds.map(f => f.id)
    const isDestInBank = fundIds.includes(t.destId)
    const isSourceInBank = fundIds.includes(t.sourceId)
    
    if (isDestInBank && !isSourceInBank) return 'text-status-success'
    if (isSourceInBank && !isDestInBank) return 'text-ink'
    return 'text-ink-muted'
  }
  return 'text-ink-muted'
}

const getTxSign = (t) => {
  if (activeFund.value) {
    const fid = activeFund.value.id
    if (t.destId === fid) return '+'
    if (t.sourceId === fid) return '-'
    return ''
  } else if (activeBank.value) {
    const fundIds = activeBank.value.funds.map(f => f.id)
    const isDestInBank = fundIds.includes(t.destId)
    const isSourceInBank = fundIds.includes(t.sourceId)
    
    if (isDestInBank && !isSourceInBank) return '+'
    if (isSourceInBank && !isDestInBank) return '-'
    return ''
  }
  return ''
}

const formatDate = (dateStr) => {
  try { return new Date(dateStr).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) } 
  catch { return dateStr }
}

// ── Fund Modal ────────────────────────────────────────────────────────────
const openFundModal = (fund = null, bank = null) => {
  fundModal.isEdit   = !!fund
  fundModal.activeId = fund?.id ?? null
  fundForm.label     = fund?.label ?? ''
  fundForm.bankId    = bank?.id ?? ''
  fundForm.goal      = fund?.goal ?? null
  fundForm.goalDate  = fund?.goalDate ?? ''
  fundModal.show     = true
}

const closeFundModal = () => { fundModal.show = false }

const handleSaveFund = async () => {
  if (!fundForm.label || !fundForm.bankId) return
  try {
    if (fundModal.isEdit) {
      await vStore.updateVirtualFund(fundModal.activeId, { ...fundForm })
    } else {
      await vStore.createVirtualFund({ ...fundForm })
    }
    closeFundModal()
  } catch { /* toast shown by store */ }
}

// ── Transfer ──────────────────────────────────────────────────────────────
const openTransfer = (fund) => {
  transferData.value  = { fromId: fund.id, toId: '', amount: null }
  transferError.value = ''
  showTransfer.value  = true
}

const handleTransfer = async () => {
  const { fromId, toId, amount } = transferData.value
  if (!fromId || !toId)       { transferError.value = 'Select both funds'; return }
  if (!amount || amount <= 0) { transferError.value = 'Enter a valid amount'; return }
  if (balanceAfter.value < 0) { transferError.value = 'Insufficient balance'; return }

  transferError.value = ''
  try {
    // vStore.saving is handled automatically inside vStore.transfer
    await vStore.transfer(fromId, toId, amount)
    showTransfer.value = false
    transferData.value = { fromId: '', toId: '', amount: null }
  } catch (err) {
    transferError.value = err.message
  }
}

const handleDeleteFund = async () => {
  const fund = accStore.accounts.find(a => a.id === fundModal.activeId)
  if (!fund) return

  if (fund.balance > 0) {
    toast.error(`"${fund.label}" still has RM ${fund.balance.toLocaleString()}. Transfer the funds out before removing it!`)
    return
  }

  if (confirm(`Are you sure you want to remove the "${fund.label}" fund?`)) {
    try {
      await vStore.removeVirtualFund(fund.id)
      if (selectedFundId.value === fund.id) selectedFundId.value = null
      closeFundModal()
    } catch (err) {
      // Error is already handled by the store's toast
    }
  }
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.95); }

/* Hide scrollbar for Chrome, Safari and Opera */
.custom-scrollbar::-webkit-scrollbar {
  display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
.custom-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>
