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
            <h2 class="font-display text-lg text-ink">Add CC Transaction</h2>
            <button class="text-ink-muted hover:text-ink transition-colors text-lg leading-none"
                    @click="$emit('update:modelValue', false)">✕</button>
          </div>

          <!-- Form -->
          <div class="p-5 flex flex-col gap-4">
            <!-- Description -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Description</label>
              <input v-model="form.description" type="text" placeholder="e.g. Petrol, Groceries…"
                     class="input-field" @keyup.enter="submit" />
            </div>

            <!-- Amount -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Amount (RM)</label>
              <input v-model.number="form.amount" type="number" step="0.01" placeholder="0.00"
                     class="input-field font-mono" />
            </div>

            <!-- Credit Card -->
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Credit Card Used</label>
              <select v-model="form.sourceId" class="select-field">
                <option value="">— Select card —</option>
                <option v-for="acc in creditAccounts" :key="acc.id" :value="acc.id">
                  {{ acc.bank }} · {{ acc.label }}
                </option>
              </select>
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
import { ref, computed, watch } from 'vue'
import { useAccountStore }     from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'

const props = defineProps({ modelValue: Boolean })
const emit  = defineEmits(['update:modelValue', 'saved'])

const accStore    = useAccountStore()
const txStore     = useTransactionStore()

const creditAccounts = computed(() =>
  accStore.accounts.filter(a => a.type === 'CC' && a.isActive)
)

const defaultForm = () => ({
  description: '',
  amount:      null,
  sourceId:    '',
  date:        new Date().toISOString().slice(0, 10),
})

const form   = ref(defaultForm())
const saving = ref(false)
const error  = ref('')

// Reset form when modal opens
watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = defaultForm()
    error.value = ''
    // Auto-select if only one CC
    if (creditAccounts.value.length === 1) {
      form.value.sourceId = creditAccounts.value[0].id
    }
  }
})

async function submit() {
  error.value = ''

  if (!form.value.description.trim()) { error.value = 'Description is required'; return }
  if (!form.value.amount || form.value.amount <= 0) { error.value = 'Enter a valid amount'; return }
  if (!form.value.sourceId) { error.value = 'Select a credit card'; return }

  saving.value = true
  try {
    await txStore.addTransaction({
      description: form.value.description,
      amount:      -Math.abs(form.value.amount),
      sourceId:    form.value.sourceId,
      isCc:        true,
      ccStatus:    'Unassigned',
      date:        form.value.date,
      type:        'Expense'
    })

    emit('update:modelValue', false)
    emit('saved')
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
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
