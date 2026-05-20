<template>
  <div class="stat-card">
    <div class="text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">{{ label }}</div>
    <div class="font-mono text-xl font-medium" :class="valueClass">{{ value }}</div>
    <div v-if="sub" class="text-[11px] text-ink-muted mt-1">{{ sub }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  label: String, value: String, sub: String,
  variant: { type: String, default: 'default' }
})
const valueClass = computed(() => ({
  'text-ink': props.variant === 'default',
  'text-status-success': props.variant === 'success',
  'text-status-danger': props.variant === 'danger',
  'text-status-warn': props.variant === 'warn',
  'text-accent': props.variant === 'accent',
  'text-accent-blue': props.variant === 'info',
}))
</script>
