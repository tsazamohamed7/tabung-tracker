<template>
  <div class="max-w-5xl mx-auto space-y-6 pb-20">
    
    <!-- Header -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-ink">House Construction Fund</h1>
        <p class="text-sm text-ink-muted">Manage joint funds and track construction expenses</p>
      </div>
      <div class="flex gap-3">
        <button class="btn-secondary" @click="openExpenseModal">
          <span class="mr-2">−</span> Add Expense
        </button>
        <button class="btn-primary" @click="openContributionModal">
          <span class="mr-2">+</span> Add Contribution
        </button>
      </div>
    </header>

    <!-- Overview Cards -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between">
        <div class="text-xs uppercase tracking-widest text-ink-muted font-medium mb-2">Abah Fund</div>
        <div class="text-3xl font-display font-semibold text-accent" :class="{ 'text-red-500': houseStore.currentBalance < 0 }">
          <span class="text-lg opacity-50 mr-1">RM</span>{{ format(houseStore.currentBalance) }}
        </div>
      </div>
      <div class="bg-bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between">
        <div class="text-xs uppercase tracking-widest text-ink-muted font-medium mb-2">Total Contributed</div>
        <div class="text-3xl font-display font-semibold text-green-600">
          <span class="text-lg opacity-50 mr-1">RM</span>{{ format(houseStore.totalContributed) }}
        </div>
      </div>
      <div class="bg-bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between">
        <div class="text-xs uppercase tracking-widest text-ink-muted font-medium mb-2">Total Expenses</div>
        <div class="text-3xl font-display font-semibold text-ink">
          <span class="text-lg opacity-50 mr-1">RM</span>{{ format(houseStore.totalExpenses) }}
        </div>
      </div>
    </section>

    <!-- Funder Breakdown -->
    <section class="bg-bg-surface border border-border p-6 rounded-2xl space-y-5">
      <h2 class="text-sm uppercase tracking-widest text-ink-muted font-semibold">Funder Contributions</h2>
      <div v-if="houseStore.funderBreakdown.length === 0" class="text-sm text-ink-muted italic">
        No contributions yet.
      </div>
      <div class="space-y-4" v-else>
        <div v-for="funder in houseStore.funderBreakdown" :key="funder.name">
          <div class="flex justify-between text-sm mb-1.5">
            <span class="font-medium text-ink">{{ funder.name }}</span>
            <span class="text-ink-muted font-mono">RM {{ format(funder.total) }}</span>
          </div>
          <div class="h-2 w-full bg-bg-surface3 rounded-full overflow-hidden">
            <div class="h-full bg-accent rounded-full transition-all duration-500" 
                 :style="{ width: getFunderPercentage(funder.total) + '%' }"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Transaction Ledger -->
    <section class="bg-bg-surface border border-border rounded-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center bg-bg-surface2/50 gap-4">
        <h2 class="text-sm uppercase tracking-widest text-ink-muted font-semibold">Transaction History</h2>
        
        <div class="flex flex-wrap gap-3">
          <select v-model="filterType" class="select-field text-sm py-1.5 px-3 w-full sm:w-auto">
            <option value="All">All Types</option>
            <option value="Contribution">Contribution (In)</option>
            <option value="Withdrawal">Withdrawal (Out)</option>
            <option value="Expense">Expense</option>
          </select>
          <select v-model="filterFunder" class="select-field text-sm py-1.5 px-3 w-full sm:w-auto">
            <option value="All">All Funders</option>
            <option value="Kak Dayah">Kak Dayah</option>
            <option value="Alin">Alin</option>
            <option value="Azam">Azam</option>
            <option value="Abah">Abah</option>
          </select>
        </div>
      </div>

      <div v-if="houseStore.loading" class="p-8 text-center text-sm text-ink-muted animate-pulse">
        Loading transactions...
      </div>
      
      <div v-else-if="houseStore.transactions.length === 0" class="p-8 text-center text-sm text-ink-muted">
        No transactions found. Start by adding a contribution!
      </div>

      <table v-else class="w-full text-sm text-left">
        <thead class="text-xs text-ink-muted uppercase bg-bg-surface border-b border-border">
          <tr>
            <th class="px-6 py-3 font-medium">Date</th>
            <th class="px-6 py-3 font-medium">Type & Funder</th>
            <th class="px-6 py-3 font-medium">Description</th>
            <th class="px-6 py-3 font-medium text-right">Amount</th>
            <th class="px-6 py-3 font-medium text-center w-16">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in filteredTransactions" :key="tx.id" class="border-b border-border/50 hover:bg-bg-surface2/30 transition-colors">
            <td class="px-6 py-4 font-mono text-ink-muted whitespace-nowrap">{{ tx.date }}</td>
            <td class="px-6 py-4">
              <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                    :class="{
                      'bg-green-100 text-green-800': tx.type === 'Contribution',
                      'bg-orange-100 text-orange-800': tx.type === 'Withdrawal',
                      'bg-red-100 text-red-800': tx.type === 'Expense'
                    }">
                {{ tx.type }}
              </span>
              <div v-if="tx.type === 'Contribution' || tx.type === 'Withdrawal'" class="mt-1 text-xs text-ink-muted ml-1">
                {{ tx.funder }}
              </div>
            </td>
            <td class="px-6 py-4 text-ink">{{ tx.description }}</td>
            <td class="px-6 py-4 text-right font-mono font-medium"
                :class="{
                  'text-green-600': tx.type === 'Contribution',
                  'text-orange-600': tx.type === 'Withdrawal',
                  'text-ink': tx.type === 'Expense'
                }">
              {{ tx.type === 'Contribution' ? '+' : '' }}{{ tx.type === 'Withdrawal' ? '-' : '' }}{{ format(tx.amount) }}
            </td>
            <td class="px-6 py-4 text-center">
              <button class="text-red-400 hover:text-red-600 p-1" @click="confirmDelete(tx.id)" title="Delete">
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Add Transaction Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="closeModal">
      <div class="bg-bg-surface w-full max-w-md rounded-2xl shadow-xl border border-border p-6 animate-fade-in-up">
        <h3 class="text-lg font-semibold text-ink mb-6">
          Add {{ formType === 'Expense' ? 'Expense' : 'Funder Transaction' }}
        </h3>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          
          <div v-if="formType === 'Contribution' || formType === 'Withdrawal'" class="space-y-1">
            <label class="text-xs font-medium text-ink-muted uppercase">Funder Name</label>
            <select v-model="form.funder" @change="handleFunderChange" required class="select-field w-full">
              <option disabled value="">Select Funder...</option>
              <option value="Kak Dayah">Kak Dayah</option>
              <option value="Alin">Alin</option>
              <option value="Azam">Azam</option>
              <option value="Abah">Abah</option>
            </select>
          </div>

          <div v-if="(formType === 'Contribution' || formType === 'Withdrawal') && form.funder === 'Abah'" class="flex gap-4 pt-1">
            <label class="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="radio" v-model="formType" value="Contribution" class="text-accent focus:ring-accent" />
              <span>Contribution (In)</span>
            </label>
            <label class="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="radio" v-model="formType" value="Withdrawal" class="text-accent focus:ring-accent" />
              <span>Withdrawal (Out)</span>
            </label>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-ink-muted uppercase">Amount (RM)</label>
            <input type="number" step="0.01" min="0.01" v-model="form.amount" required class="input-field w-full" placeholder="0.00" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-ink-muted uppercase">Date</label>
            <input type="date" v-model="form.date" required class="input-field w-full" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-ink-muted uppercase">Description</label>
            <input type="text" v-model="form.description" required class="input-field w-full" placeholder="Brief details..." />
          </div>

          <div class="pt-4 flex gap-3">
            <button type="button" class="btn-ghost flex-1 justify-center" @click="closeModal" :disabled="submitting">Cancel</button>
            <button type="submit" class="btn-primary flex-1 justify-center" :disabled="submitting">
              {{ submitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useHouseFundStore } from '@/stores/houseFund'

const houseStore = useHouseFundStore()

onMounted(() => {
  houseStore.fetchHouseFund()
})

const format = (val) => {
  if (val == null) return '0.00'
  return Number(val).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getFunderPercentage = (total) => {
  if (!houseStore.totalContributed || houseStore.totalContributed === 0) return 0
  return (total / houseStore.totalContributed) * 100
}

// ── Filters ─────────────────────────────────────────────────────────────
const filterType = ref('All')
const filterFunder = ref('All')

const filteredTransactions = computed(() => {
  return houseStore.transactions.filter(tx => {
    if (filterType.value !== 'All' && tx.type !== filterType.value) return false
    if (filterFunder.value !== 'All') {
      // If we are filtering by a funder, but the transaction is an expense (which has no funder), hide it
      // unless we want to show it. Typically, if we filter by Funder X, we only want their transactions.
      if (tx.funder !== filterFunder.value) return false
    }
    return true
  })
})

// ── Form State ──────────────────────────────────────────────────────────
const showModal = ref(false)
const formType = ref('Contribution')
const submitting = ref(false)
const form = ref({
  funder: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: ''
})

const openContributionModal = () => {
  formType.value = 'Contribution'
  resetForm()
  showModal.value = true
}

const openExpenseModal = () => {
  formType.value = 'Expense'
  resetForm()
  showModal.value = true
}

const closeModal = () => {
  if (!submitting.value) {
    showModal.value = false
  }
}

const handleFunderChange = () => {
  if (form.funder !== 'Abah' && formType.value === 'Withdrawal') {
    formType.value = 'Contribution'
  }
}

const resetForm = () => {
  form.value = {
    funder: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  }
}

const submitForm = async () => {
  if (!form.value.amount || !form.value.date || !form.value.description) return
  if ((formType.value === 'Contribution' || formType.value === 'Withdrawal') && !form.value.funder) return

  submitting.value = true
  try {
    await houseStore.addTransaction({
      type: formType.value,
      funder: (formType.value === 'Contribution' || formType.value === 'Withdrawal') ? form.value.funder : '',
      amount: Number(form.value.amount),
      date: form.value.date,
      description: form.value.description
    })
    closeModal()
  } catch (e) {
    // Error handled by store toast
  } finally {
    submitting.value = false
  }
}

const confirmDelete = async (id) => {
  if (confirm('Are you sure you want to delete this transaction?')) {
    await houseStore.deleteTransaction(id)
  }
}

</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.2s ease-out forwards;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
