/**
 * useToast.js
 * Global singleton toast queue. Import anywhere, works across components.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Saved!')
 *   toast.error('Something went wrong')
 *   toast.info('Loading...')
 */

import { ref } from 'vue'

const toasts = ref([])
let _id = 0

function add(message, type = 'info', duration = 4000) {
  const id = ++_id
  toasts.value.push({ id, message, type })
  if (duration > 0) {
    setTimeout(() => remove(id), duration)
  }
  return id
}

function remove(id) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

export function useToast() {
  return {
    toasts,
    success: (msg, duration)  => add(msg, 'success', duration),
    error:   (msg, duration)  => add(msg, 'error',   duration ?? 6000),
    info:    (msg, duration)  => add(msg, 'info',    duration),
    warn:    (msg, duration)  => add(msg, 'warn',    duration),
    remove,
  }
}
