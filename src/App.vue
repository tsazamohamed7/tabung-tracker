<template>
  <div class="flex min-h-screen bg-bg font-sans text-ink relative">
    <aside v-if="showSidebar" class="w-52 min-h-screen bg-bg-surface border-r border-border flex flex-col fixed left-0 top-0 bottom-0 z-50">
      <div class="px-5 py-5 border-b border-border">
        <div class="font-display text-2xl text-accent leading-none">Tabung</div>
        <div class="text-[10px] uppercase tracking-[0.15em] text-ink-muted mt-1">Finance Tracker</div>
      </div>

      <nav class="flex-1 py-2 overflow-y-auto">
        <div v-for="group in navGroups" :key="group.label" class="mb-1">
          <div class="section-label px-5 pt-3">{{ group.label }}</div>
          <router-link
            v-for="item in group.items" :key="item.path" :to="item.path"
            class="flex items-center gap-2.5 px-5 py-2 text-[13.5px] text-ink-muted border-l-2 border-transparent
                   hover:text-ink hover:bg-white/[0.03] transition-all duration-150"
            active-class="!text-ink !border-accent !bg-accent/[0.06]"
          >
            <span class="text-sm w-4 text-center">{{ item.icon }}</span>
            {{ item.label }}
          </router-link>
        </div>
      </nav>

      <div class="p-4 border-t border-border flex flex-col gap-3">
        <div class="bg-accent/10 border border-accent/20 rounded-lg p-3">
          <div class="text-[10px] uppercase tracking-widest text-accent font-semibold">Active Cycle</div>
          <div class="text-xs font-mono text-ink mt-1">{{ appStore.currentCycle.label }}</div>
          <div class="mt-2 bg-bg-surface3 rounded-full h-1 overflow-hidden">
            <div class="h-full bg-accent/60 rounded-full"
                 :style="{ width: cycleProgress + '%' }"></div>
          </div>
          <div class="text-[10px] text-ink-muted mt-1">
            Day {{ appStore.currentCycle.day }} of {{ appStore.currentCycle.totalDays }}
          </div>
        </div>
        <button class="btn-ghost text-xs w-full justify-center" @click="syncNow" :disabled="accStore.loading">
          <span v-if="accStore.loading" class="animate-spin mr-1">↻</span>
          <span v-else>↻</span> 
          Sync Accounts
        </button>
      </div>
    </aside>

    <main :class="[showSidebar ? 'ml-52 p-8' : 'w-full']" class="flex-1 min-h-screen">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <Toast />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '@/components/Toast.vue'
import { useAppStore } from '@/stores/app'
import { useAccountStore } from '@/stores/accounts'
import { useToast } from '@/composables/useToast'

const appStore = useAppStore()
const accStore = useAccountStore()
const toast = useToast()
const route = useRoute()

onMounted(() => appStore.fetchSettings())

const syncNow = async () => {
  toast.info('Reloading account balances…')
  await accStore.refetchAccounts()
}

const showSidebar = computed(() => {
  return !['/welcome', '/phone'].includes(route.path)
})

const cycleProgress = computed(() => {
  const { day, totalDays } = appStore.currentCycle
  return totalDays > 0 ? Math.round((day / totalDays) * 100) : 0
})

const navGroups = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard',  icon: '◈' },
      { path: '/ledger',    label: 'Ledger',      icon: '≡' },
    ]
  },
  {
    label: 'Planning',
    items: [
      { path: '/salary',  label: 'Salary Cycle',   icon: '◎' },
      { path: '/tabung',  label: 'Virtual Tabung', icon: '◫' },
    ]
  },
  {
    label: 'Tracking',
    items: [
      { path: '/cc',  label: 'CC Bridge',   icon: '▣' },
      { path: '/ipo', label: 'IPO Tracker', icon: '▲' },
      { path: '/bursa', label: 'Bursa Equities', icon: '◭' },
      { path: '/house-fund', label: 'House Fund', icon: '⌂' },
    ]
  },
  {
    label: 'Shared',
    items: [
      { path: '/partner', label: 'Partner View',   icon: '◉' },
      { path: '/recon',   label: 'Reconciliation', icon: '⇌' },
    ]
  },
]
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
