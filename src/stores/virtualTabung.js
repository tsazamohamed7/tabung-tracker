/**
 * useVirtualStore — virtual fund management
 *
 * Owns:
 *  - transfer()           virtual transfers between funds
 *  - createVirtualFund()  add new fund to dim_accounts
 *  - updateVirtualFund()  edit label/goal/goalDate
 *
 * Imports: useAccountStore, useTransactionStore
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'

export const useVirtualStore = defineStore('virtualTabung', () => {
  const toast    = useToast()
  const accStore = useAccountStore()
  const txStore  = useTransactionStore()

  const saving = ref(false)

  // ── Transfer ──────────────────────────────────────────────────────────
  async function transfer(fromId, toId, amount, category = 'Transfer', envelopeId = '') {
    const from = accStore.getAccount(fromId)
    const to   = accStore.getAccount(toId)
    if (!from || !to) { toast.error('Invalid accounts selected'); return }
    if (from.balance < amount) { toast.error(`Insufficient balance in ${from.label}`); return }

    // Optimistic balance update
    accStore.adjustBalance(fromId, -amount)
    accStore.adjustBalance(toId,    amount)

    saving.value = true
    try {
      await txStore.addTransaction({
        description: `Transfer: ${from.label} → ${to.label}`,
        category,
        envelopeId,
        amount,
        sourceId:    fromId,
        destId:      toId,
      })
    } catch (err) {
      // Rollback
      accStore.adjustBalance(fromId,  amount)
      accStore.adjustBalance(toId,   -amount)
      throw err
    } finally {
      saving.value = false
    }
  }

  // ── Create virtual fund ───────────────────────────────────────────────
  async function createVirtualFund({ label, bankId, goal, goalDate }) {
    if (!label || !bankId) {
      toast.error('Fund name and bank are required')
      throw new Error('Validation failed')
    }

    const bank = accStore.physicalBanks.find(b => b.id === bankId)
    if (!bank) { toast.error('Bank not found'); throw new Error('Bank not found') }

    const newId = `${bankId}-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

    const newAccount = {
      id:           newId,
      bank:         bank.name,
      label,
      type:         'Virtual',
      physicalLink: bankId,
      balance:      0,
      goal:         goal || null,
      goalDate:     goalDate || null,
      isActive:     true,
    }

    saving.value = true
    try {
      await accStore.upsertAccount({
        account_id:            newId,
        bank_name:             bank.name,
        label,
        type:                  'Virtual',
        physical_account_link: bankId,
        initial_balance:       0,
        balance:               0,
        goal_amount:           goal || '',
        goal_date:             goalDate || '',
        is_active:             true,
      })
      toast.success(`"${label}" fund created under ${bank.name}`)
    } catch (err) {
      toast.error(`Failed to create fund: ${err.message}`)
      throw err
    } finally {
      saving.value = false
    }
  }

  // ── Update virtual fund ───────────────────────────────────────────────
  async function updateVirtualFund(accountId, { label, goal, goalDate }) {
    const account = accStore.getAccount(accountId)
    if (!account) { toast.error('Fund not found'); throw new Error('Fund not found') }

    saving.value = true
    try {
      await accStore.upsertAccount({
        account_id:            accountId,
        bank_name:             account.bank,
        label,
        type:                  account.type,
        physical_account_link: account.physicalLink,
        initial_balance:       account.balance,
        balance:               account.balance,
        goal_amount:           goal || '',
        goal_date:             goalDate || '',
        is_active:             account.isActive,
      })
      toast.success(`"${label}" updated`)
    } catch (err) {
      toast.error(`Failed to update fund: ${err.message}`)
      throw err
    } finally {
      saving.value = false
    }
  }

  // ── Remove virtual fund ───────────────────────────────────────────────
  async function removeVirtualFund(accountId) {
    // 1. Get the account from the account store
    const account = accStore.getAccount(accountId)
  
    if (!account) {
      toast.error('Fund not found')
      throw new Error('Fund not found')
    }

    // Double check balance is 0 (safety check in the store)
    if (account.balance !== 0) {
      toast.error('Balance must be RM 0 before removing')
      return
    }

    saving.value = true
    try {
      // 2. We use upsertAccount from accStore. 
      // It handles both the API call and updating the local accounts array.
      await accStore.upsertAccount({
        account_id: accountId,
        bank_name: account.bank,
        label: account.label,
        type: account.type,
        physical_account_link: account.physicalLink,
        balance: 0,
        is_active: false // This triggers the "removal"
      })

      toast.success(`"${account.label}" has been removed`)
    } catch (err) {
      // Error is already toasted in accStore.upsertAccount, 
      // but we re-throw to stop the UI flow
      throw err
    } finally {
      saving.value = false
    }
  }

  // Don't forget to return it at the bottom
  return {
    saving,
    transfer,
    createVirtualFund,
    updateVirtualFund,
    removeVirtualFund, // Add this
  }
})
