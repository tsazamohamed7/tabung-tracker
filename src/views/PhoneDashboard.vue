<template>
  <div class="min-h-screen bg-bg text-ink pb-24">
    <!-- Header -->
    <div class="px-5 pt-8 pb-4 bg-bg-surface border-b border-border sticky top-0 z-10 flex justify-between items-center shadow-sm">
      <div>
        <div class="font-display text-2xl text-accent leading-none">Tabung</div>
        <div class="text-[10px] uppercase tracking-[0.15em] text-ink-muted mt-1">Mobile View</div>
      </div>
      <!-- Switch to PC Button -->
      <button @click="switchToPc" class="text-xs text-ink-muted bg-bg-surface2 px-3 py-1.5 rounded-full hover:text-ink transition-colors">
        Desktop View
      </button>
    </div>

    <div class="p-5 space-y-6">
      
      <!-- Cycle Progress summary -->
      <section>
        <div class="flex items-center justify-between mb-3 text-xs uppercase tracking-wider text-ink-muted">
          <span>Cycle: {{ appStore.currentCycle.label }}</span>
          <span class="font-mono">Day {{ appStore.currentCycle.day }} of {{ appStore.currentCycle.totalDays }}</span>
        </div>
        <div class="bg-bg-surface border border-border rounded-xl p-4">
          <div class="flex justify-between items-baseline mb-2">
            <span class="text-sm text-ink font-medium">Spent</span>
            <span class="font-mono text-lg text-ink">RM {{ totalSpent.toLocaleString() }}</span>
          </div>
          <ProgressBar :value="appStore.currentCycle.day" :max="appStore.currentCycle.totalDays" color="rgba(197,241,53,0.5)" :height="4" class="mb-2" />
          <div class="text-[10px] text-ink-muted flex justify-between">
            <span>{{ appStore.currentCycle.day }} days elapsed</span>
            <span>{{ appStore.currentCycle.totalDays - appStore.currentCycle.day }} days left</span>
          </div>
        </div>
      </section>

      <!-- Category Budgets (Simplified) -->
      <section>
        <div class="text-xs uppercase tracking-wider text-ink-muted mb-3">Envelope Spending</div>
        
        <template v-if="salStore.loading.cycleBudgets">
          <div class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-16 bg-bg-surface border border-border rounded-xl animate-pulse"></div>
          </div>
        </template>
        <template v-else-if="!salStore.cycleBudgetsWithSpent.length">
          <div class="text-center py-8 text-sm text-ink-muted bg-bg-surface rounded-xl border border-border">
            No active plan.
          </div>
        </template>
        <template v-else>
          <div class="grid grid-cols-1 gap-3">
            <div v-for="group in salStore.cycleBudgetsWithSpent" :key="group.category"
                 class="bg-bg-surface border border-border rounded-xl p-3.5">
              <div class="flex justify-between items-center mb-2.5">
                <div class="flex items-center gap-2.5">
                  <div class="w-3 h-3 rounded-full shrink-0" :style="{ background: group.color }"></div>
                  <span class="text-[13px] font-medium text-ink uppercase tracking-wide truncate">{{ group.category }}</span>
                </div>
                <div class="font-mono text-sm text-ink shrink-0">RM {{ group.spent.toLocaleString() }}</div>
              </div>
              <div class="flex items-center gap-3">
                <ProgressBar :value="group.spent" :max="group.planned" :color="group.pct >= 100 ? '#f07070' : group.pct >= 80 ? '#f5b560' : group.color" :height="5" class="flex-1 opacity-90" />
                <span class="text-[11px] font-mono text-ink-muted shrink-0 w-12 text-right">/ {{ group.planned.toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </template>
      </section>

      <!-- Recent Transactions -->
      <section>
        <div class="text-xs uppercase tracking-wider text-ink-muted mb-3">Recent Activity</div>
        <div class="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <template v-if="txStore.loading">
            <div class="p-4 space-y-3">
               <div v-for="i in 3" :key="i" class="h-10 bg-bg-surface2 rounded animate-pulse"></div>
            </div>
          </template>
          <template v-else-if="!recentExpenses.length">
            <div class="p-6 text-center text-sm text-ink-muted">No expenses logged yet.</div>
          </template>
          <template v-else>
            <div v-for="(tx, i) in recentExpenses" :key="tx.id"
                 class="flex items-center gap-3 px-4 py-3 border-t border-border first:border-0"
                 :class="i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-surface1/30'">
              <div class="flex-1 min-w-0">
                <div class="text-[13px] text-ink truncate">{{ tx.description }}</div>
                <div class="text-[10px] text-ink-muted flex items-center gap-1.5 mt-0.5 truncate">
                  <span>{{ formatDate(tx.date) }}</span>
                  <span v-if="tx.category">·</span>
                  <span v-if="tx.category" class="truncate">{{ tx.category }}</span>
                  <span v-if="tx.isCc" class="badge badge-red text-[8.5px] ml-1">CC</span>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="font-mono text-[13px] text-status-danger">
                  -RM {{ Math.abs(tx.amount).toLocaleString() }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

    </div>

    <!-- Floating Action Button -->
    <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bg via-bg z-20 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button @click="showAddTx = true" 
              class="w-full max-w-sm bg-accent text-bg shadow-[0_8px_30px_rgb(200,250,50,0.2)] rounded-2xl h-14 px-8 flex items-center justify-center gap-2 font-semibold hover:scale-[1.02] active:scale-95 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add Transaction
      </button>
    </div>

    <AddTransactionModal v-model="showAddTx" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useSalaryStore } from '@/stores/salary'
import { useTransactionStore } from '@/stores/transactions'
import { useAccountStore } from '@/stores/accounts'
import ProgressBar from '@/components/ProgressBar.vue'
import AddTransactionModal from '@/components/AddTransactionModal.vue'

const router = useRouter()
const appStore = useAppStore()
const salStore = useSalaryStore()
const txStore  = useTransactionStore()
const accStore = useAccountStore()

const showAddTx = ref(false)

onMounted(() => {
  appStore.fetchSettings()
  salStore.fetchCycleBudgets()
  txStore.fetchTransactions()
  accStore.fetchAccounts()
})

const switchToPc = () => {
  localStorage.setItem('tabung_device_mode', 'PC')
  router.push('/dashboard')
}

const totalSpent = computed(() => {
  return salStore.cycleBudgetsWithSpent.reduce((s, b) => s + b.spent, 0)
})

const recentExpenses = computed(() => {
  return txStore.recentTransactions
    .filter(t => t.amount < 0 && t.type !== 'Transfer' && t.category !== 'Income')
    .slice(0, 5)
})

const formatDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
</script>
