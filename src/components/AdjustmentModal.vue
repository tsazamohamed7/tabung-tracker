<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue"
           class="fixed inset-0 z-[200] flex items-center justify-center p-4"
           @click.self="$emit('update:modelValue', false)">
        <!-- Backdrop blur -->
        <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>

        <!-- Modal panel -->
        <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 class="font-display text-lg text-ink">Adjustment Options</h2>
            <button class="text-ink-muted hover:text-ink transition-colors text-lg leading-none"
                    @click="$emit('update:modelValue', false)">✕</button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-5">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Left Column: Add Adjustment -->
              <div>
                <div class="section-label">Add Adjustment</div>
                <div class="card bg-bg-surface2">
                  <div class="text-xs text-ink-muted mb-4">Record a missing transaction to reconcile a discrepancy.</div>
                  
                  <div class="flex flex-col gap-3">
                    <!-- Bank Select -->
                    <div>
                      <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Account</label>
                      <select v-model="resolveForm.bank" class="select-field bg-bg-surface border-border">
                        <option disabled value="">— Select Bank —</option>
                        <option v-for="r in enrichedRows" :key="r.bank" :value="r.bank">
                          {{ r.bank }} 
                          <span v-if="r.diff !== 0">(RM {{ Math.abs(r.diff).toFixed(2) }} off)</span>
                          <span v-else>(Balanced)</span>
                        </option>
                      </select>
                    </div>

                    <!-- Fund Select -->
                    <div v-if="resolveForm.bank">
                      <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Fund to Adjust</label>
                      <select v-model="resolveForm.fundId" class="select-field bg-bg-surface border-border mb-3">
                        <option disabled value="">— Select specific fund —</option>
                        <option v-for="f in availableFunds" :key="f.id" :value="f.id">
                          {{ f.label }} (RM {{ f.balance.toLocaleString() }})
                        </option>
                      </select>
                    </div>

                    <!-- Description & Category -->
                    <div class="grid grid-cols-2 gap-3 mb-3" v-if="resolveForm.fundId">
                      <div>
                        <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Description</label>
                        <input v-model="resolveForm.description" type="text" placeholder="e.g. Bank charges" class="input-field bg-bg-surface border-border" />
                      </div>
                      <div>
                        <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Category</label>
                        <select v-model="resolveForm.category" class="select-field bg-bg-surface border-border">
                          <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
                        </select>
                      </div>
                    </div>

                    <!-- Amount -->
                    <div v-if="resolveForm.fundId">
                      <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Amount (RM)</label>
                      <input v-model.number="resolveForm.amount" type="number" step="0.01" class="input-field bg-bg-surface border-border font-mono" />
                    </div>

                    <button class="btn-primary justify-center mt-2 w-full"
                            :disabled="resolving || !resolveForm.fundId || !resolveForm.amount"
                            @click="addAdjustment">
                      {{ resolving ? 'Saving…' : 'Add Adjustment & Reconcile' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Right Column: History -->
              <div class="flex flex-col">
                <div class="section-label">Adjustment History</div>
                <div class="card p-0 overflow-hidden flex-1 border-border-strong bg-bg-surface2">
                  <div class="overflow-x-auto max-h-[400px]">
                    <table class="table-base">
                      <thead class="sticky top-0 bg-bg-surface2">
                        <tr><th>Date</th><th>Account</th><th>Adjustment</th><th>Reason</th></tr>
                      </thead>
                      <tbody>
                        <tr v-for="h in allHistory" :key="h.id">
                          <td class="text-ink-muted text-xs">{{ h.date }}</td>
                          <td class="text-xs">{{ h.account }}</td>
                          <td :class="h.adj < 0 ? 'amount-neg' : 'amount-pos'">
                            {{ h.adj > 0 ? '+' : '' }}RM {{ Math.abs(h.adj).toLocaleString() }}
                          </td>
                          <td class="text-ink-muted text-xs">{{ h.reason }}</td>
                        </tr>
                        <tr v-if="!allHistory.length">
                          <td colspan="4" class="text-center text-ink-muted py-8 text-sm">No adjustments history found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAccountStore }                 from '@/stores/accounts'
import { useTransactionStore }             from '@/stores/transactions'
import { useToast }                        from '@/composables/useToast'

const props = defineProps({
  modelValue: Boolean,
  enrichedRows: { type: Array, required: true }
})
const emit = defineEmits(['update:modelValue', 'adjusted'])

const accStore = useAccountStore()
const txStore  = useTransactionStore()
const toast    = useToast()

const resolving   = ref(false)
const resolveForm = ref({ bank: '', fundId: '', description: '', amount: null, category: '' })

// Default bank selection
watch(() => props.modelValue, (val) => {
  if (val && !resolveForm.value.bank && props.enrichedRows.length > 0) {
    const disc = props.enrichedRows.find(r => r.diff !== 0)
    if (disc) resolveForm.value.bank = disc.bank
  }
})

// ── Adjustment History ───────────────────────────────────────────────────
const ADJ_CATEGORIES = ['Bank Charges', 'Misc Debit', 'Interest', 'ATM Withdrawal', 'Misc Credit']
const formatDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })

const allHistory = computed(() => 
  txStore.transactions
    .filter(t => ADJ_CATEGORIES.includes(t.category))
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .map(t => ({
      id: t.id,
      date: formatDate(t.date),
      account: accStore.getAccountLabel(t.sourceId || t.destId),
      adj: t.amount,
      reason: t.description
    }))
)

// ── Dynamic Form Options ──────────────────────────────────────────────────
const availableFunds = computed(() => {
  if (!resolveForm.value.bank) return []
  return accStore.accounts.filter(a => a.bank === resolveForm.value.bank && (a.type === 'Virtual' || a.type === 'CC') && a.isActive)
})

const availableCategories = computed(() => {
  const diffRow = props.enrichedRows.find(r => r.bank === resolveForm.value.bank)
  if (!diffRow) return []
  return diffRow.diff > 0 ? ['Interest', 'Misc Credit'] : ['Bank Charges', 'Misc Debit', 'ATM Withdrawal']
})

watch(() => resolveForm.value.bank, () => {
  resolveForm.value.fundId = ''
  resolveForm.value.category = availableCategories.value[0] || ''
})

// ── Add adjustment ────────────────────────────────────────────────────────
const addAdjustment = async () => {
  if (!resolveForm.value.description || !resolveForm.value.amount || !resolveForm.value.fundId) {
    toast.error('Please fill all fields')
    return
  }
  
  resolving.value = true
  try {
    const row = props.enrichedRows.find(r => r.bank === resolveForm.value.bank)
    const isPositiveAdj = row ? row.diff > 0 : false
    const finalAmount = isPositiveAdj ? Math.abs(resolveForm.value.amount) : -Math.abs(resolveForm.value.amount)

    const fund = availableFunds.value.find(f => f.id === resolveForm.value.fundId)
    const isCc = fund && fund.type === 'CC'

    await txStore.addTransaction({
      description: resolveForm.value.description,
      category:    resolveForm.value.category,
      amount:      finalAmount,
      sourceId:    isPositiveAdj ? '' : resolveForm.value.fundId,
      destId:      isPositiveAdj ? resolveForm.value.fundId : '',
      isCc:        isCc,
      ccStatus:    isCc ? 'Unassigned' : null,
    })
    
    toast.success(`Adjustment recorded`)
    emit('adjusted', resolveForm.value.bank)
    resolveForm.value = { bank: '', fundId: '', description: '', amount: null, category: '' }
    emit('update:modelValue', false)
  } catch (e) {
    toast.error(`Failed to add adjustment: ${e.message}`)
  } finally {
    resolving.value = false
  }
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .relative,
.modal-leave-active .relative { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative { transform: scale(0.96) translateY(8px); opacity: 0; }
.modal-leave-to .relative    { transform: scale(0.96) translateY(8px); opacity: 0; }
</style>
