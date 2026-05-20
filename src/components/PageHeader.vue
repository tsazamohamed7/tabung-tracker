<template>
  <div class="flex items-start justify-between mb-7">
    <div>
      <h1 class="font-display text-[28px] text-ink leading-tight">{{ title }}</h1>
      <p v-if="sub" class="text-sm text-ink-muted mt-1">{{ sub }}</p>
    </div>
    <slot name="action" />
  </div>
</template>

<script setup>
defineProps({ title: String, sub: String })
</script>
