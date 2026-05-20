<template>
  <div>
    <PageHeader title="Bank Reconciliation" sub="Sync calculated vs actual bank balances" />

    <AlertStrip v-if="hasDiscrepancy"
      :message="`Discrepancy detected: ${discrepancyBanks.join(', ')} — calculated vs actual differ.`" />

    <div class="grid grid-cols-3 gap-3.5 mb-5">
      <StatCard label="Banks Balanced"    :value="`${balancedCount} / ${rows.length}`"  variant="success" />
      <StatCard label="Total Discrepancy" :value="`RM ${totalDiscrepancy.toFixed(2)}`"  :variant="totalDiscrepancy === 0 ? 'success' : 'danger'" />
      <StatCard label="Last Synced"       value="Today"  sub="Live from store" />
    </div>

    <div class="flex justify-between items-end mb-3">
      <div class="section-label mb-0">Balance Comparison — {{ today }}</div>
      <button class="btn-ghost text-xs py-1" @click="showAdjustmentModal = true">
        ⚙ Adjustment Options
      </button>
    </div>
    <div class="card p-0 overflow-hidden mb-5">
      <template v-if="accStore.loading">
        <div class="p-4 space-y-3 animate-pulse">
          <div v-for="i in 4" :key="i" class="flex gap-3 items-center">
            <div class="h-2.5 w-24 bg-bg-surface3 rounded"></div>
            <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
            <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
          </div>
        </div>
      </template>
      <table v-else class="table-base">
        <thead>
          <tr>
            <th>Account</th>
            <th>Calculated Balance</th>
            <th>Actual Balance <span class="text-ink-faint font-normal normal-case">(click to edit)</span></th>
            <th>Difference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.bank"
              :class="(row.actual - row.calculated) !== 0 ? 'bg-status-danger/[0.02]' : ''">
            <td class="font-medium">{{ row.bank }}</td>
            <td class="amount-neu">RM {{ row.calculated.toLocaleString() }}.00</td>
            <td>
              <input v-if="editing === row.bank"
                     v-model.number="row.actual"
                     type="number"
                     class="input-field font-mono w-36 text-sm py-1"
                     @blur="stopEdit(row)"
                     @keyup.enter="stopEdit(row)"
                     @keyup.escape="cancelEdit(row)" />
              <span v-else
                    class="font-mono cursor-pointer hover:text-accent transition-colors"
                    :class="(row.actual - row.calculated) !== 0 ? 'text-status-danger' : 'text-ink'"
                    @click="startEdit(row)">
                RM {{ row.actual.toLocaleString() }}.00
              </span>
            </td>
            <td>
              <span :class="(row.actual - row.calculated) === 0 ? 'text-ink-muted text-xs' : (row.actual - row.calculated) > 0 ? 'amount-pos' : 'amount-neg'">
                {{ (row.actual - row.calculated) === 0 ? '—' : `${(row.actual - row.calculated) > 0 ? '+' : ''}RM ${Math.abs(row.actual - row.calculated).toFixed(2)}` }}
              </span>
            </td>
            <td>
              <span class="badge text-[11px]" :class="(row.actual - row.calculated) === 0 ? 'badge-green' : 'badge-red'">
                {{ (row.actual - row.calculated) === 0 ? '✓ Balanced' : '⚠ Discrepancy' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

      <!-- Old Adjustment UI sections removed -->

    <!-- Inter-Fund Debts -->
    <div class="mt-8">
      <div class="section-label">Inter-Fund Debts</div>
      <div class="card p-0 overflow-hidden mb-5">
        <div class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Lender Fund</th>
                <th>Borrower Fund</th>
                <th>Outstanding</th>
                <th class="w-32 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="debt in enrichedDebts" :key="debt.id">
                <td class="font-medium">{{ debt.lenderName }}</td>
                <td>{{ debt.borrowerName }}</td>
                <td class="amount-neu">RM {{ debt.amount.toLocaleString() }}</td>
                <td class="text-center">
                  <button class="btn-primary text-xs py-1 px-3 w-full justify-center" @click="openRepay(debt)">Repay</button>
                </td>
              </tr>
              <tr v-if="!enrichedDebts.length">
                <td colspan="4" class="text-center text-ink-muted py-8 text-sm">No active inter-fund debts</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Inline Repayment Form -->
      <div v-if="repayingDebt" class="card bg-bg-surface2 border-border-strong animate-fade-in">
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <div class="text-[11px] text-ink-muted uppercase tracking-wider mb-1.5">
              Repaying <b>{{ repayingDebt.lenderName }}</b> from <b>{{ repayingDebt.borrowerName }}</b>
            </div>
            <input v-model.number="repayAmount" type="number" step="0.01" class="input-field font-mono" placeholder="RM Amount" @keyup.enter="submitRepay" />
          </div>
          <button class="btn-ghost" @click="cancelRepay">Cancel</button>
          <button class="btn-primary" :disabled="resolving || !repayAmount || repayAmount <= 0" @click="submitRepay">
            {{ resolving ? 'Processing…' : 'Confirm Repayment' }}
          </button>
        </div>
      </div>
    </div>

    <AdjustmentModal v-model="showAdjustmentModal" :enrichedRows="enrichedRows" @adjusted="onAdjusted" />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountStore }                 from '@/stores/accounts'
import { useTransactionStore }             from '@/stores/transactions'
import { useToast }                        from '@/composables/useToast'
import PageHeader  from '@/components/PageHeader.vue'
import AlertStrip  from '@/components/AlertStrip.vue'
import StatCard    from '@/components/StatCard.vue'
import AdjustmentModal from '@/components/AdjustmentModal.vue'

const accStore = useAccountStore()
const txStore  = useTransactionStore()
const toast    = useToast()

const editing     = ref(null)
const resolving   = ref(false)
const showAdjustmentModal = ref(false)

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
})

// ── Rows — calculated from live store, actual is editable ────────────────
const rows = ref([])

// Sync calculated from live accounts whenever store updates
watch(() => accStore.accounts, (accs) => {
  if (!accs.length) return
  const bankMap = {}
  
  // Discover Banks and Calculate Totals
  accs.filter(a => (a.type === 'Virtual' || a.type === 'CC') && a.isActive)
      .forEach(a => {
        const b = a.bank || 'Unknown Bank'
        bankMap[b] = (bankMap[b] || 0) + a.balance
      })

  // Update Rows
  Object.entries(bankMap).forEach(([bank, calcBalance]) => {
    const existing = rows.value.find(r => r.bank === bank)
    if (existing) {
      existing.calculated = calcBalance
      if (!existing.isEdited) existing.actual = calcBalance
    } else {
      rows.value.push({ bank, calculated: calcBalance, actual: calcBalance, isEdited: false })
    }
  })
  
  // Cleanup old banks
  rows.value = rows.value.filter(r => r.bank in bankMap)
}, { deep: true, immediate: true })

const enrichedRows = computed(() =>
  rows.value.map(r => ({ ...r, diff: r.actual - r.calculated }))
)

const today             = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
const hasDiscrepancy    = computed(() => enrichedRows.value.some(r => r.diff !== 0))
const discrepancyBanks  = computed(() => enrichedRows.value.filter(r => r.diff !== 0).map(r => r.bank))
const balancedCount     = computed(() => enrichedRows.value.filter(r => r.diff === 0).length)
const totalDiscrepancy  = computed(() => enrichedRows.value.reduce((s, r) => s + Math.abs(r.diff), 0))

// ── Inline edit ───────────────────────────────────────────────────────────
let prevActual = 0
const startEdit  = (row) => { prevActual = row.actual; editing.value = row.bank }
const stopEdit   = (row) => {
  editing.value = null
  if (row.actual !== row.calculated) {
    row.isEdited = true
  } else {
    row.isEdited = false
  }
  
  if (row.actual !== prevActual)
    toast.info(`${row.bank} actual updated to RM ${row.actual.toLocaleString()}`)
}
const cancelEdit = (row) => { row.actual = prevActual; editing.value = null }

const onAdjusted = (bank) => {
  const row = rows.value.find(r => r.bank === bank)
  if (row) {
    row.actual = row.calculated
    row.isEdited = false
  }
}

// ── Inter-Fund Debts ──────────────────────────────────────────────────────
const enrichedDebts = computed(() => {
  if (!txStore.activeDebts) return []
  return txStore.activeDebts.map(d => ({
    ...d,
    id: `${d.borrowerId}_${d.lenderId}`,
    borrowerName: accStore.getAccountLabel(d.borrowerId) || 'Unknown Fund',
    lenderName: accStore.getAccountLabel(d.lenderId) || 'Unknown Fund'
  }))
})

const repayingDebt = ref(null)
const repayAmount = ref(null)

const openRepay = (debt) => {
  repayingDebt.value = debt
  repayAmount.value = debt.amount
}

const cancelRepay = () => {
  repayingDebt.value = null
  repayAmount.value = null
}

const submitRepay = async () => {
  if (!repayAmount.value || repayAmount.value <= 0) return
  if (repayAmount.value > repayingDebt.value.amount) {
    toast.error('Cannot over-repay a debt')
    return
  }

  resolving.value = true
  try {
    await txStore.addTransaction({
      description: `Repayment to ${repayingDebt.value.lenderName}`,
      category:    'Repayment',
      amount:      repayAmount.value,
      sourceId:    repayingDebt.value.borrowerId,
      destId:      repayingDebt.value.lenderId,
    })
    toast.success('Repayment recorded successfully')
    cancelRepay()
  } catch (err) {
    // error handled in store
  } finally {
    resolving.value = false
  }
}
</script>
