<template>
  <div class="bg-status-warn/[0.08] border border-status-warn/20 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-status-warn mb-5">
    <span>⚠</span>
    <span class="flex-1">{{ message }}</span>
    <slot />
  </div>
</template>

<script setup>
defineProps({ message: String })
</script>
