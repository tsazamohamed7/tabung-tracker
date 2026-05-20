<template>
  <div>
    <PageHeader title="Partner View" sub="Simplified shared dashboard" />

    <div class="grid grid-cols-3 gap-3.5 mb-5">
      <template v-if="accStore.loading">
        <div v-for="i in 3" :key="i" class="stat-card animate-pulse">
          <div class="h-2.5 w-20 bg-bg-surface3 rounded mb-3"></div>
          <div class="h-6 w-24 bg-bg-surface3 rounded"></div>
        </div>
      </template>
      <template v-else>
        <StatCard label="Family Fund"
                  :value="`RM ${familyFund?.balance.toLocaleString() ?? '—'}`"
                  sub="Muamalat" variant="accent" />
        <StatCard label="Monthly Budget Left"
                  :value="`RM ${budgetLeft.toLocaleString()}`"
                  :sub="`${daysLeft} days remaining`" variant="warn" />
        <StatCard label="Sabah Trip Fund"
                  :value="`RM ${sabahFund?.balance.toLocaleString() ?? '0'}`"
                  sub="Target RM 3,500"
                  :variant="(sabahFund?.balance ?? 0) > 0 ? 'success' : 'danger'" />
      </template>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- Wishlist -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div class="section-label mb-0">Shared Wishlist</div>
          <button class="btn-ghost text-[11px] py-1 px-2.5" @click="showAdd = !showAdd">+ Add Item</button>
        </div>

        <div v-if="showAdd" class="card-sm mb-3">
          <div class="flex flex-col gap-2">
            <div class="grid grid-cols-[auto_1fr] gap-2">
              <input v-model="newItem.emoji" type="text" placeholder="🎯" maxlength="2"
                     class="input-field w-14 text-center text-lg" />
              <input v-model="newItem.name" type="text" placeholder="Item name" class="input-field" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input v-model.number="newItem.price" type="number" placeholder="Price (RM)" class="input-field font-mono" />
              <input v-model="newItem.date" type="text" placeholder="Target date" class="input-field" />
            </div>
            <div class="flex gap-2">
              <button class="btn-primary text-xs py-1.5" :disabled="addingItem" @click="addItem">
                {{ addingItem ? 'Adding…' : 'Add' }}
              </button>
              <button class="btn-ghost text-xs py-1.5" @click="showAdd = false; resetForm()">Cancel</button>
            </div>
          </div>
        </div>

        <div class="card">
          <template v-if="wishStore.loading">
            <div v-for="i in 4" :key="i" class="flex gap-3 py-3 animate-pulse"
                 :class="{ 'border-t border-border': i > 1 }">
              <div class="w-9 h-9 bg-bg-surface3 rounded"></div>
              <div class="flex-1 space-y-1.5">
                <div class="h-2.5 w-32 bg-bg-surface3 rounded"></div>
                <div class="h-2 w-20 bg-bg-surface3 rounded"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-if="!wishStore.wishlist.length" class="text-sm text-ink-muted text-center py-6">
              No wishlist items yet
            </div>
            <div v-for="(item, i) in wishStore.wishlist" :key="item.id"
                 class="flex items-center gap-3 py-3"
                 :class="{ 'border-t border-border': i > 0 }">
              <div class="text-2xl w-9 text-center shrink-0">{{ item.emoji }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[13.5px] text-ink truncate">{{ item.name }}</div>
                <div class="text-[11px] text-ink-muted mt-0.5">
                  {{ item.date || 'TBD' }} · {{ accStore.getAccountLabel(item.targetFundId) }}
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="font-mono text-sm text-ink">RM {{ item.price.toLocaleString() }}</div>
                <span class="badge text-[10px] mt-0.5"
                      :class="item.status === 'Saving' ? 'badge-accent'
                            : item.status === 'Purchased' ? 'badge-green'
                            : 'badge-gray'">
                  {{ item.status }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Right col -->
      <div class="flex flex-col gap-4">
        <div>
          <div class="section-label">This Month's Family Spending</div>
          <div class="card">
            <template v-if="txStore.loading">
              <div v-for="i in 4" :key="i" class="flex items-center gap-2.5 mb-3 animate-pulse">
                <div class="w-[80px] h-2.5 bg-bg-surface3 rounded shrink-0"></div>
                <div class="flex-1 h-2 bg-bg-surface3 rounded"></div>
                <div class="w-[60px] h-2.5 bg-bg-surface3 rounded shrink-0"></div>
              </div>
            </template>
            <template v-else>
              <div v-for="cat in familySpending" :key="cat.label"
                   class="flex items-center gap-2.5 mb-3 last:mb-0 text-xs">
                <div class="w-[80px] text-right text-ink-muted shrink-0">{{ cat.label }}</div>
                <div class="flex-1 bg-bg-surface3 rounded-full h-2 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500"
                       :style="{ width: Math.min(100, cat.pct) + '%', background: cat.color }"></div>
                </div>
                <div class="w-[60px] font-mono text-[11px] text-ink shrink-0">RM {{ cat.spent }}</div>
              </div>
            </template>
          </div>
        </div>

        <div>
          <div class="section-label">Quick Actions</div>
          <div class="card flex flex-col gap-2">
            <button class="btn-ghost justify-start w-full text-sm" @click="$router.push('/ledger')">
              <span>📝</span> View full ledger
            </button>
            <button class="btn-ghost justify-start w-full text-sm" @click="$router.push('/tabung')">
              <span>💰</span> Check all fund balances
            </button>
            <button class="btn-ghost justify-start w-full text-sm" @click="showAdd = true">
              <span>🛍️</span> Add to wishlist
            </button>
          </div>
        </div>

        <div>
          <div class="section-label">Upcoming Bills</div>
          <div class="card flex flex-col gap-0">
            <div v-for="(bill, i) in upcomingBills" :key="bill.name"
                 class="flex items-center justify-between py-2.5"
                 :class="{ 'border-t border-border': i > 0 }">
              <div>
                <div class="text-sm text-ink">{{ bill.name }}</div>
                <div class="text-[11px] text-ink-muted">Due {{ bill.due }}</div>
              </div>
              <span class="font-mono text-sm text-ink">RM {{ bill.amount }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter }                from 'vue-router'
import { useAppStore }              from '@/stores/app'
import { useAccountStore }          from '@/stores/accounts'
import { useTransactionStore }      from '@/stores/transactions'
import { useWishlistStore }         from '@/stores/wishlist'
import StatCard   from '@/components/StatCard.vue'
import PageHeader from '@/components/PageHeader.vue'

const router    = useRouter()
const appStore  = useAppStore()
const accStore  = useAccountStore()
const txStore   = useTransactionStore()
const wishStore = useWishlistStore()

const showAdd    = ref(false)
const addingItem = ref(false)
const newItem    = ref({ emoji: '🎯', name: '', price: null, date: '' })
const resetForm  = () => { newItem.value = { emoji: '🎯', name: '', price: null, date: '' } }

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
  wishStore.fetchWishlist()
})

const familyFund = computed(() => accStore.accounts.find(a => a.id === 'muamalat-family'))
const sabahFund  = computed(() => accStore.accounts.find(a => a.id === 'maybank-sabah'))
const daysLeft   = computed(() => appStore.currentCycle.totalDays - appStore.currentCycle.day)

const budgetLeft = computed(() => {
  const spent = txStore.transactions
    .filter(t =>
      t.cycleId === appStore.currentCycle.id &&
      t.amount < 0 &&
      t.category !== 'Transfer' &&
      t.category !== 'IPO'
    )
    .reduce((s, t) => s + Math.abs(t.amount), 0)
  // Use income from current cycle transactions
  const income = txStore.transactions
    .filter(t => t.cycleId === appStore.currentCycle.id && t.category === 'Income')
    .reduce((s, t) => s + t.amount, 0)
  return Math.max(0, income - spent)
})

const familySpending = computed(() => {
  const cats   = ['Grocery', 'Transport', 'Dining out', 'Bills']
  const catMap = { Grocery: 'Food', Transport: 'Transport', 'Dining out': 'Food', Bills: 'Bills' }
  const colors = ['#f5b560', '#9de0f5', '#c5f135', '#70dba0']
  const maxBudget = 1200
  return cats.map((cat, i) => {
    const spent = txStore.transactions
      .filter(t => t.category === catMap[cat] && t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    return { label: cat, spent: Math.round(spent), pct: (spent / maxBudget) * 100, color: colors[i] }
  })
})

const upcomingBills = [
  { name: 'Unifi Internet',  due: '15 Jun', amount: 169 },
  { name: 'TNB Electricity', due: '18 Jun', amount: 90 },
  { name: 'Car loan',        due: '20 Jun', amount: 650 },
]

const addItem = async () => {
  if (!newItem.value.name || !newItem.value.price) return
  addingItem.value = true
  try {
    await wishStore.addWishlistItem({
      emoji:        newItem.value.emoji || '🎯',
      name:         newItem.value.name,
      price:        newItem.value.price,
      targetFundId: 'muamalat-family',
      date:         newItem.value.date,
    })
    showAdd.value = false
    resetForm()
  } finally {
    addingItem.value = false
  }
}
</script>
