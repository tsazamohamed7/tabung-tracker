<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue"
           class="fixed inset-0 z-[200] flex items-center justify-center p-4"
           @click.self="$emit('update:modelValue', false)">
        <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>

        <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 class="font-display text-lg text-ink">Add Credit Card</h2>
            <button class="text-ink-muted hover:text-ink transition-colors text-lg leading-none"
                    @click="$emit('update:modelValue', false)">✕</button>
          </div>

          <div class="p-5 flex flex-col gap-4">
            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Card Name</label>
              <input v-model="form.label" type="text" placeholder="e.g. Maybank Shopee Visa"
                     class="input-field" @keyup.enter="submit" />
            </div>

            <div>
              <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Bank</label>
              <select v-model="form.bank" class="select-field">
                <option value="Maybank">Maybank</option>
                <option value="CIMB">CIMB</option>
                <option value="Muamalat">Muamalat</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Last 4 Digits</label>
                <input v-model="form.ccLast4" type="text" placeholder="e.g. 1234" maxlength="4"
                       class="input-field font-mono" />
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Expiry Date</label>
                <input v-model="form.ccExpiry" type="text" placeholder="MM/YY" maxlength="5"
                       class="input-field font-mono" />
              </div>
            </div>

            <div v-if="error" class="text-xs text-status-danger bg-status-danger/10 rounded-lg px-3 py-2">
              {{ error }}
            </div>
          </div>

          <div class="flex gap-2 px-5 pb-5">
            <button class="btn-ghost flex-1 justify-center"
                    @click="$emit('update:modelValue', false)">Cancel</button>
            <button class="btn-primary flex-1 justify-center"
                    :disabled="saving"
                    @click="submit">
              <span v-if="saving" class="opacity-60">Saving…</span>
              <span v-else>Save Card</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAccountStore } from '@/stores/accounts'

const props = defineProps({ modelValue: Boolean })
const emit  = defineEmits(['update:modelValue', 'saved'])

const accStore = useAccountStore()

const defaultForm = () => ({
  label: '',
  bank: 'Maybank',
  ccLast4: '',
  ccExpiry: ''
})

const form   = ref(defaultForm())
const saving = ref(false)
const error  = ref('')

// Reset form when modal opens
watch(() => props.modelValue, (val) => {
  if (val) { form.value = defaultForm(); error.value = '' }
})

async function submit() {
  error.value = ''

  if (!form.value.label.trim()) { 
    error.value = 'Card name is required'
    return 
  }

  saving.value = true
  try {
    await accStore.upsertAccount({
      account_id: `CC_${Date.now()}`,
      bank_name: form.value.bank,
      label: form.value.label.trim(),
      type: 'CC', // Must be exactly 'CC' for your store to catch it
      balance: 0,
      cc_last_4: form.value.ccLast4,
      cc_expiry: form.value.ccExpiry,
      is_active: true
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