<template>
  <div class="bg-bg-surface3 rounded-full overflow-hidden" :style="{ height: height + 'px' }">
    <div
      class="h-full rounded-full transition-all duration-500"
      :style="{ width: clampedPct + '%', background: color }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  value: { type: Number, default: 0 },
  max:   { type: Number, default: 100 },
  color: { type: String, default: '#c5f135' },
  height:{ type: Number, default: 6 },
})
const clampedPct = computed(() => Math.min(100, Math.round((props.value / props.max) * 100)))
</script>
