/**
 * useAccountStore — dim_accounts
 *
 * Owns:
 *  - accounts[] (all virtual + CC accounts)
 *  - physicalBanks computed (groups virtual accounts by bank)
 *  - getAccountLabel() helper
 *
 * Imported by: useSalaryStore, useCcStore, useVirtualStore, views
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

// Physical bank definitions — the real banks you hold accounts at.
// These are static config, not from the DB (bank names don't change often).
const BANK_DEFS = [
  { id: 'maybank', name: 'Maybank', color: '#f5c842' },
  { id: 'cimb', name: 'CIMB', color: '#f3a1a1ff' },
  { id: 'th', name: 'Tabung Haji', color: '#70dba0' },
  { id: 'asb', name: 'ASB', color: '#043888ff' },
  { id: 'mplus', name: 'M+ Online', color: '#ffffffff' },
  { id: 'aeon', name: 'AEON', color: '#e62eaeff' },
  { id: 'moomoo', name: 'Moomoo', color: '#ff6f4bff' },
  { id: 'atlas', name: 'Atlas', color: '#a8a8a8ff' },
  { id: 'others', name: 'Others', color: '#000000ff' },
]

export const useAccountStore = defineStore('accounts', () => {
  const toast = useToast()
  const accounts = ref([])
  const loading = ref(false)
  const fetched = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchAccounts() {
    if (fetched.value) return
    loading.value = true
    try {
      accounts.value = await api.getAccounts()
      fetched.value = true
    } catch (err) {
      toast.error(`Failed to load accounts: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  async function refetchAccounts() {
    fetched.value = false
    await fetchAccounts()
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const virtualAccounts = computed(() =>
    accounts.value.filter(a => a.type === 'Virtual' && a.isActive)
  )

  const ccAccounts = computed(() =>
    accounts.value.filter(a => a.type === 'CC' && a.isActive)
  )

  const physicalBanks = computed(() =>
    BANK_DEFS.map(bank => {
      const funds = accounts.value.filter(
        a => a.physicalLink === bank.id && a.type === 'Virtual' && a.isActive
      )
      return {
        ...bank,
        funds,
        balance: funds.reduce((sum, a) => sum + a.balance, 0),
      }
    })
  )

  const totalLiquid = computed(() =>
    virtualAccounts.value.reduce((s, a) => s + a.balance, 0)
  )

  // ── Helpers ───────────────────────────────────────────────────────────
  const getAccountLabel = (id) =>
    accounts.value.find(a => a.id === id)?.label ?? '—'

  const getAccount = (id) =>
    accounts.value.find(a => a.id === id) ?? null

  // ── Mutations ─────────────────────────────────────────────────────────
  async function upsertAccount(data) {
    try {
      await api.updateAccount(data)
      // Reflect change locally
      const idx = accounts.value.findIndex(a => a.id === data.account_id)
      if (idx !== -1) {
        accounts.value[idx] = {
          ...accounts.value[idx],
          label: data.label ?? accounts.value[idx].label,
          balance: data.balance !== undefined ? Number(data.balance) : accounts.value[idx].balance,
          goal: data.goal_amount ? Number(data.goal_amount) : accounts.value[idx].goal,
          goalDate: data.goal_date ?? accounts.value[idx].goalDate,
          ccExpiry: data.cc_expiry ?? accounts.value[idx].ccExpiry,
          ccLast4: data.cc_last_4 ?? accounts.value[idx].ccLast4,
          isActive: data.is_active !== undefined ? (data.is_active === true || data.is_active === 'TRUE') : accounts.value[idx].isActive,
        }
      } else {
        // New account — push to local state
        accounts.value.push({
          id: data.account_id,
          bank: data.bank_name,
          label: data.label,
          type: data.type,
          physicalLink: data.physical_account_link,
          balance: Number(data.balance) || 0,
          goal: data.goal_amount ? Number(data.goal_amount) : null,
          goalDate: data.goal_date || null,
          ccExpiry: data.cc_expiry || null,
          ccLast4: data.cc_last_4 || null,
          isActive: data.is_active !== false,
        })
      }
    } catch (err) {
      toast.error(`Failed to save account: ${err.message}`)
      throw err
    }
  }

  // Adjust balance locally (called by useTransactionStore after writes)
  function adjustBalance(accountId, delta) {
    const acc = accounts.value.find(a => a.id === accountId)
    if (acc) acc.balance += delta
  }

  const getAccountColor = (id) => {
    const acc = accounts.value.find(a => a.id === id)
    if (!acc) return 'transparent'
    // If it's a CC, we might want a different default, but CCs don't have physicalLink usually?
    // Actually CCs in dim_accounts also have a bank name. Let's look up BANK_DEFS.
    const bank = BANK_DEFS.find(b => b.id === acc.physicalLink)
    return bank?.color ?? 'transparent'
  }

  return {
    accounts,
    loading,
    virtualAccounts,
    ccAccounts,
    physicalBanks,
    totalLiquid,
    fetchAccounts,
    refetchAccounts,
    getAccountLabel,
    getAccount,
    getAccountColor,
    upsertAccount,
    adjustBalance,
  }
})
