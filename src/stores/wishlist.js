/**
 * useWishlistStore — dim_wishlist
 *
 * Owns:
 *  - wishlist[]
 *  - addWishlistItem(), updateWishlistItem(), markPurchased()
 *
 * No cross-store imports needed.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

export const useWishlistStore = defineStore('wishlist', () => {
  const toast    = useToast()
  const wishlist = ref([])
  const loading  = ref(false)
  const fetched  = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchWishlist() {
    if (fetched.value) return
    loading.value = true
    try {
      wishlist.value = await api.getWishlist()
      fetched.value  = true
    } catch (err) {
      toast.error(`Failed to load wishlist: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const savingItems = computed(() =>
    wishlist.value.filter(w => w.status === 'Saving')
  )

  const plannedItems = computed(() =>
    wishlist.value.filter(w => w.status === 'Planned')
  )

  const totalEstimated = computed(() =>
    wishlist.value
      .filter(w => w.status !== 'Purchased')
      .reduce((s, w) => s + w.price, 0)
  )

  // ── Mutations ─────────────────────────────────────────────────────────

  async function addWishlistItem({ emoji, name, price, targetFundId, date, notes }) {
    const newItem = {
      id:           `W_${Date.now()}`,
      emoji:        emoji || '🎯',
      name,
      price,
      targetFundId: targetFundId || '',
      status:       'Planned',
      date:         date || '',
    }

    wishlist.value.push(newItem)   // optimistic

    try {
      await api.upsertWishlist({
        item_id:         newItem.id,
        item_name:       newItem.name,
        emoji:           newItem.emoji,
        estimated_price: newItem.price,
        target_fund_id:  newItem.targetFundId,
        status:          newItem.status,
        target_date:     newItem.date,
        notes:           notes || '',
      })
      toast.success(`"${name}" added to wishlist`)
    } catch (err) {
      wishlist.value.pop()   // rollback
      toast.error(`Failed to add item: ${err.message}`)
      throw err
    }
  }

  async function updateWishlistItem(itemId, updates) {
    const item = wishlist.value.find(w => w.id === itemId)
    if (!item) return
    const prev = { ...item }
    Object.assign(item, updates)   // optimistic

    try {
      await api.upsertWishlist({
        item_id:         item.id,
        item_name:       item.name,
        emoji:           item.emoji,
        estimated_price: item.price,
        target_fund_id:  item.targetFundId,
        status:          item.status,
        target_date:     item.date,
        notes:           item.notes || '',
      })
    } catch (err) {
      Object.assign(item, prev)   // rollback
      toast.error(`Failed to update item: ${err.message}`)
      throw err
    }
  }

  async function markPurchased(itemId) {
    await updateWishlistItem(itemId, { status: 'Purchased' })
    toast.success('Marked as purchased 🎉')
  }

  return {
    wishlist,
    loading,
    savingItems,
    plannedItems,
    totalEstimated,
    fetchWishlist,
    addWishlistItem,
    updateWishlistItem,
    markPurchased,
  }
})
