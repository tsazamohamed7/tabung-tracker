/**
 * useAppStore — application-level state
 *
 * Owns:
 *  - app_settings (fetched from GAS)
 *  - currentCycle (derived from settings + today's date, never hardcoded)
 *  - global UI state (toast is separate, but global loading could live here)
 *
 * Imported by: all domain stores that need currentCycle or settings
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

export const useAppStore = defineStore('app', () => {
  const toast = useToast()

  // ── Raw settings map ──────────────────────────────────────────────────
  // Populated from app_settings sheet. Keys match the sheet's 'key' column.
  const settings = ref({
    current_cycle_id:     '2025-06',   // fallback until fetched
    cycle_start_day:      '25',
    default_currency:     'MYR',
    partner_view_enabled: 'true',
    app_version:          '1.0.0',
  })

  const loading  = ref(false)
  const fetched  = ref(false)

  // ── Fetch settings from GAS ───────────────────────────────────────────
  async function fetchSettings() {
    if (fetched.value) return
    loading.value = true
    try {
      const rows = await api.getSettings()
      // Convert array of { key, value } into a plain object
      rows.forEach(r => { 
        let val = r.value
        
        // If the value looks like an ISO date string (common when GAS returns a Date cell),
        // format it to a clean YYYY-MM-DD string.
        if (typeof val === 'string' && val.length > 15 && val.includes('T') && val.endsWith('Z')) {
          const d = new Date(val)
          if (!isNaN(d.getTime())) {
             const y = d.getFullYear()
             const m = String(d.getMonth() + 1).padStart(2, '0')
             const day = String(d.getDate()).padStart(2, '0')
             val = `${y}-${m}-${day}`
          }
        }
        
        settings.value[r.key] = val 
      })
      fetched.value = true
    } catch (err) {
      toast.error(`Failed to load app settings: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // ── Persist a setting back to GAS ─────────────────────────────────────
  async function saveSetting(key, value, note) {
    // Optimistic
    settings.value[key] = String(value)
    try {
      await api.setSetting(key, value, note)
    } catch (err) {
      toast.error(`Failed to save setting "${key}": ${err.message}`)
      throw err
    }
  }

  // ── currentCycle — fully computed, never hardcoded ────────────────────
  /**
   * Cycle runs from the startDay of the month defined in cycleId to the day before startDay next month.
   * e.g. cycle "2026-03" = 25 Mar 2026 → 24 Apr 2026
   */
  const currentCycle = computed(() => {
    const cycleId   = settings.value.current_cycle_id ?? '2025-06'
    const parts     = cycleId.split('-')
    const year      = parseInt(parts[0], 10)
    const month     = parseInt(parts[1], 10) // 1-indexed (1-12)

    // If cycleId has 3 parts (YYYY-MM-DD), use the day from there, otherwise use setting
    const startDay  = parts.length >= 3 ? parseInt(parts[2], 10) : parseInt(settings.value.cycle_start_day ?? '25', 10)

    // JS months are 0-indexed. month 01 (Jan) -> index 0.
    const startDate = new Date(year, month - 1, startDay)
    // Cycle ends one day before the same day of the NEXT month
    const endDate   = new Date(year, month, startDay - 1)

    const today      = new Date()
    const msPerDay   = 1000 * 60 * 60 * 24
    const dayOfCycle = Math.max(1, Math.floor((today - startDate) / msPerDay) + 1)
    const totalDays  = Math.round((endDate - startDate) / msPerDay) + 1

    // Format label e.g. "25 May – 24 Jun 2025"
    const fmt = (d) => d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
    const label = `${fmt(startDate)} – ${fmt(endDate)} ${year}`

    return {
      id:        cycleId,
      label,
      startDate: startDate.toISOString().slice(0, 10),
      endDate:   endDate.toISOString().slice(0, 10),
      day:       Math.min(dayOfCycle, totalDays),
      totalDays,
    }
  })

  // ── Convenience getters ───────────────────────────────────────────────
  const currency            = computed(() => settings.value.default_currency ?? 'MYR')
  const cycleStartDay       = computed(() => parseInt(settings.value.cycle_start_day ?? '25', 10))
  const partnerViewEnabled  = computed(() => settings.value.partner_view_enabled === 'true')

  // ── Switch active cycle ───────────────────────────────────────────────
  async function setActiveCycle(cycleId) {
    await saveSetting('current_cycle_id', cycleId, 'Active salary cycle ID')
  }

  return {
    settings,
    loading,
    currentCycle,
    currency,
    cycleStartDay,
    partnerViewEnabled,
    fetchSettings,
    saveSetting,
    setActiveCycle,
  }
})
