<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-start gap-3 px-4 py-3 rounded-lg border text-sm max-w-sm w-full
                 shadow-lg pointer-events-auto cursor-pointer backdrop-blur-sm"
          :class="styles[toast.type]"
          @click="remove(toast.id)"
        >
          <span class="text-base shrink-0 mt-px">{{ icons[toast.type] }}</span>
          <span class="flex-1 leading-snug">{{ toast.message }}</span>
          <button class="opacity-40 hover:opacity-100 transition-opacity shrink-0 mt-px text-xs">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()

const styles = {
  success: 'bg-bg-surface border-status-success/30 text-status-success',
  error:   'bg-bg-surface border-status-danger/30  text-status-danger',
  warn:    'bg-bg-surface border-status-warn/30    text-status-warn',
  info:    'bg-bg-surface border-border-strong      text-ink',
}

const icons = {
  success: '✓',
  error:   '✕',
  warn:    '⚠',
  info:    '○',
}
</script>

<style scoped>
.toast-enter-active  { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active  { transition: all 0.2s ease-in; }
.toast-enter-from    { opacity: 0; transform: translateX(60px) scale(0.96); }
.toast-leave-to      { opacity: 0; transform: translateX(60px) scale(0.96); }
.toast-move          { transition: transform 0.2s ease; }
</style>
