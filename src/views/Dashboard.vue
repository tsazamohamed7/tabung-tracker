<template>
  <div>
    <PageHeader
      title="Good morning ✦"
      :sub="`Cycle: ${appStore.currentCycle.label} · Day ${appStore.currentCycle.day} of ${appStore.currentCycle.totalDays}`"
    />

    <!-- KPI row -->
    <div class="grid grid-cols-4 gap-3.5 mb-5">
      <template v-if="accStore.loading || txStore.loading">
        <div v-for="i in 4" :key="i" class="stat-card animate-pulse">
          <div class="h-2.5 w-20 bg-bg-surface3 rounded mb-3"></div>
          <div class="h-6 w-28 bg-bg-surface3 rounded"></div>
        </div>
      </template>
      <template v-else>
        <StatCard label="Total Liquid"  :value="`RM ${accStore.totalLiquid.toLocaleString()}`"            sub="Across all banks"    variant="accent" />
        <StatCard label="Cycle Spent"   :value="`RM ${Math.abs(txStore.totalExpenses).toLocaleString()}`" sub="This cycle"          variant="danger" />
        <StatCard label="CC Pending"    :value="`RM ${ccTotal.toLocaleString()}`"                         :sub="`${ccStore.ccPending.length} items`" variant="warn" />
        <StatCard label="IPO Locked"    :value="`RM ${ipoStore.totalLocked.toLocaleString()}`"            sub="Active applications" variant="info" />
      </template>
    </div>

    <div class="grid grid-cols-[1fr_1.6fr] gap-4">
      <!-- Bank accounts -->
      <div class="flex flex-col gap-3">
        <div class="section-label">Physical Bank Accounts</div>
        <template v-if="accStore.loading">
          <div v-for="i in 3" :key="i" class="card animate-pulse space-y-3">
            <div class="h-2.5 w-16 bg-bg-surface3 rounded"></div>
            <div class="h-5 w-24 bg-bg-surface3 rounded"></div>
            <div class="h-px bg-bg-surface3"></div>
            <div class="h-3 w-full bg-bg-surface3 rounded"></div>
          </div>
        </template>
        <template v-else>
          <div v-for="bank in accStore.physicalBanks" :key="bank.id" class="card">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2 h-2 rounded-full" :style="{ background: bank.color }"></div>
              <div class="text-xs font-bold uppercase tracking-wider" :style="{ color: bank.color }">{{ bank.name }}</div>
            </div>
            <div class="font-mono text-lg text-ink mb-3">RM {{ bank.balance.toLocaleString() }}.00</div>
            <div v-for="fund in bank.funds" :key="fund.id"
                 class="flex items-center justify-between py-1.5 border-t border-border">
              <span class="text-[12.5px] text-ink-muted">{{ fund.label }}</span>
              <span class="font-mono text-[12.5px] text-ink">RM {{ fund.balance.toLocaleString() }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- Right column -->
      <div class="flex flex-col gap-4">
        <!-- Budget health -->
        <div>
          <div class="section-label">Cycle Budget Health</div>
          <div class="card">
            <template v-if="salStore.loading.cycleBudgets || txStore.loading">
              <div v-for="i in 5" :key="i" class="flex items-center gap-2.5 mb-3 animate-pulse">
                <div class="w-[80px] h-2.5 bg-bg-surface3 rounded shrink-0"></div>
                <div class="flex-1 h-2 bg-bg-surface3 rounded"></div>
                <div class="w-[80px] h-2.5 bg-bg-surface3 rounded shrink-0"></div>
              </div>
            </template>
            <template v-else>
              <div v-for="group in salStore.cycleBudgetsWithSpent" :key="group.category"
                   class="flex items-center gap-2.5 mb-2.5 text-xs">
                <div class="w-[80px] text-right text-ink-muted shrink-0 truncate">{{ group.category }}</div>
                <ProgressBar :value="group.spent" :max="group.planned" :color="group.color" :height="7" class="flex-1" />
                <div class="w-[100px] font-mono text-[11px] text-ink shrink-0">
                  RM {{ group.spent }} / {{ group.planned }}
                </div>
              </div>
            </template>
            <ProgressBar :value="appStore.currentCycle.day" :max="appStore.currentCycle.totalDays"
                         color="rgba(197,241,53,0.5)" :height="3" class="mt-4" />
            <div class="flex justify-between text-[11px] text-ink-muted mt-1.5">
              <span>Day {{ appStore.currentCycle.day }} of {{ appStore.currentCycle.totalDays }}</span>
              <span>{{ cycleProgress }}% elapsed</span>
            </div>
          </div>
        </div>

        <!-- Recent transactions -->
        <div>
          <div class="section-label">Recent Transactions</div>
          <div class="card p-0 overflow-hidden">
            <template v-if="txStore.loading">
              <div class="p-4 space-y-3 animate-pulse">
                <div v-for="i in 5" :key="i" class="flex gap-3 items-center">
                  <div class="h-2.5 w-12 bg-bg-surface3 rounded shrink-0"></div>
                  <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
                  <div class="h-2.5 w-16 bg-bg-surface3 rounded shrink-0"></div>
                </div>
              </div>
            </template>
            <template v-else>
              <table class="table-base">
                <thead><tr><th>Date</th><th>Description</th><th>Fund</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr v-for="tx in txStore.recentTransactions" :key="tx.id">
                    <td class="text-ink-muted text-[12px]">{{ formatDate(tx.date) }}</td>
                    <td class="max-w-[160px] truncate">{{ tx.description }}</td>
                    <td>
                      <span class="badge" :class="tx.isCc ? 'badge-red' : 'badge-gray'">
                        {{ tx.isCc ? 'CC' : accStore.getAccountLabel(tx.sourceId) }}
                      </span>
                    </td>
                    <td :class="tx.amount > 0 ? 'amount-pos' : 'amount-neg'">
                      {{ tx.amount > 0 ? '+' : '' }}RM {{ Math.abs(tx.amount).toLocaleString() }}
                    </td>
                  </tr>
                  <tr v-if="!txStore.recentTransactions.length">
                    <td colspan="4" class="text-center text-ink-muted py-6 text-sm">No transactions yet</td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted }     from 'vue'
import { useAppStore }             from '@/stores/app'
import { useAccountStore }         from '@/stores/accounts'
import { useTransactionStore }     from '@/stores/transactions'
import { useSalaryStore }          from '@/stores/salary'
import { useCcStore }              from '@/stores/cc'
import { useIpoStore }             from '@/stores/ipo'
import StatCard    from '@/components/StatCard.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import PageHeader  from '@/components/PageHeader.vue'

const appStore = useAppStore()
const accStore = useAccountStore()
const txStore  = useTransactionStore()
const salStore = useSalaryStore()
const ccStore  = useCcStore()
const ipoStore = useIpoStore()

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
  salStore.fetchCycleBudgets()
  ccStore.fetchCcBridge()
  ipoStore.fetchIpos()
})

const cycleProgress = computed(() => {
  const { day, totalDays } = appStore.currentCycle
  return totalDays > 0 ? Math.round((day / totalDays) * 100) : 0
})

const ccTotal    = computed(() => ccStore.ccPending.reduce((s, c) => s + c.amount, 0))
const formatDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
</script>
