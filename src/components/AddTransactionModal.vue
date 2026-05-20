<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue"
           class="fixed inset-0 z-[200] flex items-center justify-center p-4"
           @click.self="$emit('update:modelValue', false)">
        <!-- Backdrop blur -->
        <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>

        <!-- Modal panel -->
        <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-md shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 class="font-display text-lg text-ink">Add Transaction</h2>
            <button class="text-ink-muted hover:text-ink transition-colors text-lg leading-none"
                    @click="$emit('update:modelValue', false)">✕</button>
          </div>

          <!-- Form -->
          <div class="p-5 flex flex-col gap-4">
            <!-- Description -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Description</label>
              <input v-model="form.description" type="text" placeholder="e.g. Giant grocery, TNB bill…"
                     class="input-field" @keyup.enter="submit" />
            </div>

            <!-- Amount -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Amount (RM)</label>
              <input v-model.number="form.amount" type="number" step="0.01" placeholder="0.00"
                     class="input-field font-mono" />
            </div>

            <!-- Type -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Type</label>
              <div class="flex rounded-lg overflow-hidden border border-border-strong">
                <button v-for="t in types" :key="t"
                        class="flex-1 text-[11px] sm:text-xs py-2 transition-colors truncate px-1"
                        :class="form.type === t
                          ? 'bg-accent text-bg font-medium'
                          : 'bg-bg-surface3 text-ink-muted hover:text-ink hover:bg-bg-surface2'"
                        @click="form.type = t">
                  {{ t }}
                </button>
              </div>
            </div>

            <!-- Category (Expense & Transfer) -->
            <template v-if="(form.type === 'Expense' || form.type === 'Transfer') && form.isSalary">
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Category</label>
                <select v-model="form.category" class="select-field" @change="form.envelopeId = ''">
                  <option value="">— Select category —</option>
                  <option v-for="cat in expenseCategories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>

              <!-- Envelope (only when category has >1 envelope; auto-selected when only 1) -->
              <div v-if="selectedCategoryEnvelopes.length > 1">
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Envelope</label>
                <select v-model="form.envelopeId" class="select-field">
                  <option value="">— Select envelope —</option>
                  <option v-for="env in selectedCategoryEnvelopes" :key="env.id" :value="env.templateId ?? env.id">
                    {{ env.name }} (RM {{ env.planned.toLocaleString() }})
                  </option>
                </select>
              </div>
            </template>

            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">
                <template v-if="form.type === 'Loan'">Lender Fund</template>
                <template v-else-if="form.isCc">Credit Card Used</template>
                <!-- Account -->
                <template v-else>
                  {{ form.type === 'Expense' ? 'Deduct from Fund' : form.type === 'Outsource' ? 'Credit to Fund' : 'From Fund' }}
                </template>
              </label>

              <select v-model="form.sourceId" class="select-field">
                <option value="">— Select {{ form.type === 'Loan' ? 'lender fund' : (form.isCc ? 'card' : 'fund') }} —</option>
    
                <template v-if="form.isCc">
                  <option v-for="acc in creditAccounts" :key="acc.id" :value="acc.id">
                    {{ acc.bank }} · {{ acc.label }}
                  </option>
                </template>
                <template v-else>
                  <option v-for="acc in virtualAccounts" :key="acc.id" :value="acc.id">
                    {{ acc.bank }} · {{ acc.label }} (RM {{ acc.balance.toLocaleString() }})
                  </option>
                </template>
              </select>
            </div>

            <!-- Destination (transfers & loans) -->
            <div v-if="form.type === 'Transfer' || form.type === 'Loan'">
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">
                {{ form.type === 'Loan' ? 'Borrower Fund' : 'To Fund' }}
              </label>
              <select v-model="form.destId" class="select-field">
                <option value="">— Select {{ form.type === 'Loan' ? 'borrower fund' : 'fund' }} —</option>
                <option v-for="acc in virtualAccounts.filter(a => a.id !== form.sourceId)" :key="acc.id" :value="acc.id">
                  {{ acc.bank }} · {{ acc.label }}
                </option>
              </select>
            </div>

            <!-- Source Toggles -->
            <div v-if="form.type === 'Expense' || form.type === 'Transfer'" class="flex gap-3">
              <!-- Salary switch -->
              <div class="flex-1 flex items-center gap-2 p-2.5 bg-bg-surface2 rounded-lg cursor-pointer border border-border-strong"
                   @click="toggleSalary">
                <div class="w-7 h-4 rounded-full transition-colors relative shrink-0"
                     :class="form.isSalary ? 'bg-accent' : 'bg-bg-surface3'">
                  <div class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                       :class="form.isSalary ? 'translate-x-3.5' : 'translate-x-0.5'"></div>
                </div>
                <span class="text-xs text-ink-muted leading-tight">Salary Fund</span>
              </div>

              <!-- CC switch (Expense only) -->
              <div v-if="form.type === 'Expense'" class="flex-1 flex items-center gap-2 p-2.5 bg-bg-surface2 rounded-lg cursor-pointer border border-border-strong"
                   @click="toggleCc">
                <div class="w-7 h-4 rounded-full transition-colors relative shrink-0"
                     :class="form.isCc ? 'bg-status-danger' : 'bg-bg-surface3'">
                  <div class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                       :class="form.isCc ? 'translate-x-3.5' : 'translate-x-0.5'"></div>
                </div>
                <span class="text-xs text-ink-muted leading-tight">Credit Card</span>
                <span v-if="form.isCc" class="badge badge-red text-[9px] px-1 py-0 ml-auto leading-none h-4 flex items-center">CC</span>
              </div>
            </div>

            <!-- Date -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Date</label>
              <input v-model="form.date" type="date" class="input-field font-mono" />
            </div>

            <!-- Error -->
            <div v-if="error" class="text-xs text-status-danger bg-status-danger/10 rounded-lg px-3 py-2">
              {{ error }}
            </div>
          </div>

          <!-- Footer -->
          <div class="flex gap-2 px-5 pb-5">
            <button class="btn-ghost flex-1 justify-center"
                    @click="$emit('update:modelValue', false)">Cancel</button>
            <button class="btn-primary flex-1 justify-center"
                    :disabled="saving"
                    @click="submit">
              <span v-if="saving" class="opacity-60">Saving…</span>
              <span v-else>Save Transaction</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAccountStore }     from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'
import { useSalaryStore }      from '@/stores/salary'

const props = defineProps({ modelValue: Boolean })
const emit  = defineEmits(['update:modelValue', 'saved'])

const accStore    = useAccountStore()
const txStore     = useTransactionStore()
const salaryStore = useSalaryStore()

// Compatibility shim — modal template uses 'store.*'
const store = {
  get accounts() { return accStore.accounts },
  get currentCycle() { return { id: '' } },
  addTransaction: (data) => txStore.addTransaction(data),
  virtualTransfer: async (fromId, toId, amount, ptCategory, ptEnvelope) => {
    const { useVirtualStore } = await import('@/stores/virtualTabung')
    return useVirtualStore().transfer(fromId, toId, amount, ptCategory, ptEnvelope)
  },
}

const types = ['Expense', 'Outsource', 'Transfer', 'Loan']

// Unique expense categories derived from the active cycle budgets in salary store
const expenseCategories = computed(() => {
  const cats = salaryStore.cycleBudgetsWithSpent.map(g => g.category)
  return cats.length ? cats : ['Food', 'Bills', 'Transport', 'Shopping', 'Family', 'Personal', 'Business', 'Tax']
})



const defaultForm = () => ({
  description: '',
  amount:      null,
  type:        'Expense',
  category:    '',
  envelopeId:  '',
  sourceId:    '',
  destId:      '',
  isCc:        false,
  isSalary:    false,
  date:        new Date().toISOString().slice(0, 10),
})

const form   = ref(defaultForm())
const saving = ref(false)
const error  = ref('')

// Envelopes for the currently selected category
const selectedCategoryEnvelopes = computed(() => {
  if (!form.value.category) return []
  const group = salaryStore.cycleBudgetsWithSpent.find(g => g.category === form.value.category)
  return group ? group.envelopes : []
})

// Add this to your existing computed properties
const creditAccounts = computed(() =>
  accStore.accounts.filter(a => a.type === 'CC' && a.isActive)
)

// When a category is selected, auto-pick the envelope if there is only one
watch(() => form.value.category, () => {
  const envs = selectedCategoryEnvelopes.value
  form.value.envelopeId = envs.length === 1 ? (envs[0].templateId ?? envs[0].id ?? '') : ''
})

// Reset form when modal opens
watch(() => props.modelValue, (val) => {
  if (val) { form.value = defaultForm(); error.value = '' }
})

// Clear envelopeId when type changes away from Expense or Transfer
watch(() => form.value.type, (newType) => {
  if (newType === 'Outsource') {
    form.value.category   = ''
    form.value.envelopeId = ''
  }
  if (newType !== 'Expense') {
    form.value.isCc = false
  }
  if (newType !== 'Expense' && newType !== 'Transfer') {
    form.value.isSalary = false
  }
})

// Fetch salary data so categories are available
onMounted(() => salaryStore.fetchCycleBudgets())

const virtualAccounts = computed(() =>
  store.accounts.filter(a => a.type === 'Virtual' && a.isActive)
)

// Update the submit function validation and logic
async function submit() {
  error.value = ''

  // 1. Basic Validation
  if (!form.value.description.trim()) { error.value = 'Description is required'; return }
  if (!form.value.amount || form.value.amount <= 0) { error.value = 'Enter a valid amount'; return }
  if (!form.value.sourceId) { 
    error.value = form.value.isCc ? 'Select a credit card' : (form.value.type === 'Loan' ? 'Select a lender fund' : 'Select a fund'); 
    return 
  }
  if ((form.value.type === 'Transfer' || form.value.type === 'Loan') && !form.value.destId) {
    error.value = form.value.type === 'Loan' ? 'Select a borrower fund' : 'Select a destination fund';
    return
  }

  // 2. Conditional Category/Envelope Validation
  // If Salary is ON (for Expense or Transfer), we want a category
  if ((form.value.type === 'Expense' || form.value.type === 'Transfer') && form.value.isSalary && !form.value.category) {
    error.value = 'Please select a category'; return
  }

  saving.value = true
  try {
    const signedAmount = (form.value.type === 'Expense' || form.value.type === 'Loan')
      ? -Math.abs(form.value.amount)
      : Math.abs(form.value.amount)

    // Only resolve envelope if it's a category-enabled transaction
    let resolvedEnvelopeId = ''
    if (form.value.type === 'Transfer' || (form.value.type === 'Expense' && form.value.isSalary)) {
      resolvedEnvelopeId = form.value.envelopeId ||
        (selectedCategoryEnvelopes.value.length === 1
          ? (selectedCategoryEnvelopes.value[0].templateId ?? selectedCategoryEnvelopes.value[0].id ?? '')
          : '')
    }

    if (form.value.type === 'Transfer') {
      await store.virtualTransfer(
        form.value.sourceId, 
        form.value.destId, 
        form.value.amount, 
        form.value.isSalary ? form.value.category : '', 
        resolvedEnvelopeId
      )
    } else {
      let finalCategory = (form.value.type === 'Expense' && !form.value.isSalary) ? '' : form.value.category
      if (form.value.type === 'Outsource') finalCategory = 'Outsource'
      if (form.value.type === 'Loan') finalCategory = 'Loan'

      await store.addTransaction({
        description: form.value.description,
        category:    finalCategory,
        envelopeId:  resolvedEnvelopeId,
        amount:      signedAmount,
        sourceId:    form.value.type === 'Outsource' ? null : form.value.sourceId, 
        destId:      (form.value.type === 'Outsource' || form.value.type === 'Loan') ? form.value.destId || form.value.sourceId : null,
        isCc:        form.value.isCc,
        ccStatus:    form.value.isCc ? 'Unassigned' : null, // Set initial bridge status
        date:        form.value.date,
      })
    }

    emit('update:modelValue', false)
    emit('saved')
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

// Toggles for Expense source
const toggleSalary = () => {
  form.value.isSalary = !form.value.isSalary
  if (form.value.isSalary) {
    form.value.isCc = false // mutually exclusive
    const salaryFund = virtualAccounts.value.find(acc => acc.label.toLowerCase().includes('salary'))
    if (salaryFund) form.value.sourceId = salaryFund.id
  }
}

const toggleCc = () => {
  form.value.isCc = !form.value.isCc
  if (form.value.isCc) {
    form.value.isSalary = false // mutually exclusive
    form.value.sourceId = ''
    if (creditAccounts.value.length === 1) {
      form.value.sourceId = creditAccounts.value[0].id
    }
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
