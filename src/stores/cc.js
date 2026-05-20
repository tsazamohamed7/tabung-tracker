/**
 * useCcStore — fact_cc_bridge
 *
 * Owns:
 *  - ccBridge[]
 *  - assignCCFund(), settleCCBridge()
 *  - computed: ccPending, ccTotal, ccByAccount
 *
 * Imports: useAccountStore (for getAccountLabel)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'
import { useAppStore } from '@/stores/app'

export const useCcStore = defineStore('cc', () => {
  const toast    = useToast()
  const accStore = useAccountStore()
  const appStore = useAppStore()

  const ccBridge = ref([])
  const loading  = ref(false)
  const fetched  = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchCcBridge(force = false) {
    if (fetched.value && !force) return
    loading.value = true
    try {
      ccBridge.value = await api.getCcBridge()
      fetched.value  = true
    } catch (err) {
      toast.error(`Failed to load CC bridge: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const ccPending = computed(() =>
    ccBridge.value.filter(c => c.status === 'Pending' || c.status === 'Unassigned')
  )

  const ccTotal = computed(() =>
    ccBridge.value.reduce((s, c) => s + c.amount, 0)
  )

  const unassignedCount = computed(() =>
    ccBridge.value.filter(c => c.status === 'Unassigned').length
  )

  const assignedTotal = computed(() =>
    ccBridge.value.filter(c => c.fundingSourceId).reduce((s, c) => s + c.amount, 0)
  )

  /** Returns CC totals grouped by CC account ID */
  const ccByAccount = computed(() => {
    const map = {}
    ccBridge.value.forEach(c => {
      // Find the CC account from the transaction source
      if (!map[c.txId]) map[c.txId] = 0
    })
    return map
  })

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Assign a virtual fund or salary as the payer for a CC charge */
  async function assignCCFund(bridgeId, fundId, metadata = {}, skipRefresh = false) {
    const item = ccBridge.value.find(c => c.bridge_id === bridgeId || c.id === bridgeId)
    if (!item) return

    loading.value = true
    try {
      // Call the new orchestrated backend function
      await api.assignCcFunding({
        bridge_id: bridgeId,
        transaction_id: item.transaction_id || item.txId,
        funding_source_id: fundId,
        category: metadata.category,
        envelope_id: metadata.envelope,
        cycle_id: appStore.currentCycle.id
      })

      if (!skipRefresh) {
        // Refresh data to show updated statuses and new rows
        fetched.value = false 
        await fetchCcBridge()
      
        // Also trigger a refresh in the transaction store so the new funding row appears
        const txStore = useTransactionStore()
        await txStore.fetchTransactions(true) 
      
        toast.success("Assignment complete")
      }
    } catch (err) {
      toast.error(`Failed to assign: ${err.message}`)
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Mark a CC bridge item as settled (CC bill paid) */
  async function settleCCBridge(ccId, settlementDate) {
    const item = ccBridge.value.find(c => c.id === ccId)
    if (!item) return
    const prev = { status: item.status }

    item.status = 'Settled'

    try {
      await api.upsertCcBridge({
        bridge_id:         item.id,
        transaction_id:    item.txId,
        description:       item.description,
        amount:            item.amount,
        charge_date:       item.date,
        funding_source_id: item.fundingSourceId ?? '',
        settlement_date:   settlementDate ?? new Date().toISOString().slice(0, 10),
        status:            'Settled',
      })
      toast.success('CC item settled')
    } catch (err) {
      item.status = prev.status
      toast.error(`Failed to settle: ${err.message}`)
      throw err
    }
  }

  return {
    ccBridge,
    loading,
    ccPending,
    ccTotal,
    unassignedCount,
    assignedTotal,
    fetchCcBridge,
    assignCCFund,
    settleCCBridge,
  }
})
