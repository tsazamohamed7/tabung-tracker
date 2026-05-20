<template>
  <div class="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-ink">
    <div class="mb-10 text-center">
      <div class="font-display text-4xl text-accent leading-none mb-2">Tabung</div>
      <div class="text-[12px] uppercase tracking-[0.15em] text-ink-muted">Finance Tracker</div>
    </div>

    <div class="w-full max-w-sm space-y-4">
      <div class="text-center text-sm text-ink-muted mb-6">Choose your interface</div>

      <button @click="selectMode('PC')"
              class="w-full flex items-center gap-4 bg-bg-surface border border-border-strong rounded-2xl p-5 hover:border-accent hover:bg-bg-surface1 transition-all group">
        <div class="w-12 h-12 bg-bg-surface2 rounded-full flex items-center justify-center shrink-0 group-hover:text-accent">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
        </div>
        <div class="flex-1 text-left">
          <div class="text-lg font-medium">PC View</div>
          <div class="text-xs text-ink-muted mt-1">Full dashboard, ledger & planning</div>
        </div>
        <div class="text-accent opacity-0 group-hover:opacity-100 transition-opacity">→</div>
      </button>

      <button @click="selectMode('Phone')"
              class="w-full flex items-center gap-4 bg-bg-surface border border-border-strong rounded-2xl p-5 hover:border-accent hover:bg-bg-surface1 transition-all group">
        <div class="w-12 h-12 bg-bg-surface2 rounded-full flex items-center justify-center shrink-0 group-hover:text-accent">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
        </div>
        <div class="flex-1 text-left">
          <div class="text-lg font-medium">Phone View</div>
          <div class="text-xs text-ink-muted mt-1">Quick adds & cycle tracking</div>
        </div>
        <div class="text-accent opacity-0 group-hover:opacity-100 transition-opacity">→</div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const selectMode = (mode) => {
  localStorage.setItem('tabung_device_mode', mode)
  if (mode === 'PC') {
    router.push('/dashboard')
  } else {
    router.push('/phone')
  }
}
</script>
