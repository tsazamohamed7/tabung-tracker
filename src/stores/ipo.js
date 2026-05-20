/**
 * useIpoStore — fact_ipo_tracker
 *
 * Owns:
 *  - ipos[]
 *  - recordIPOSale(), applyForIpo()
 *  - totalLocked, totalProfit computed
 *
 * Imports: useTransactionStore (to log sale proceeds transaction)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { useTransactionStore } from '@/stores/transactions'

export const useIpoStore = defineStore('ipo', () => {
  const toast = useToast()
  const txStore = useTransactionStore()

  const ipos = ref([])
  const loading = ref(false)
  const fetched = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchIpos() {
    if (fetched.value) return
    loading.value = true
    try {
      ipos.value = await api.getIpos()
      fetched.value = true
    } catch (err) {
      toast.error(`Failed to load IPOs: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const totalLocked = computed(() =>
    ipos.value
      .filter(i => !i.ballotDate || (i.ballotDate && !i.listDate && i.allocatedLot > 0) || (i.listDate && !i.sellDate && i.allocatedLot > 0))
      .reduce((s, i) => s + (i.applyAmount - (i.refund || 0)), 0)
  )

  const totalRefunds = computed(() =>
    ipos.value
      .filter(i => i.refund)
      .reduce((s, i) => s + i.refund, 0)
  )

  const totalProfit = computed(() =>
    ipos.value
      .filter(i => i.netProfit)
      .reduce((s, i) => s + i.netProfit, 0)
  )

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Submit a new IPO application */
  // [cite: 4]
  async function applyForIpo({ stock, applyStockPrice, applyLot, fundSplits, date }) {
    // Use the first fund in the list as the "Primary" for future refunds
    const primarySourceId = fundSplits[0]?.sourceId || '';
    const applyAmount = applyStockPrice * applyLot * 100; // 1 Lot = 100 Units

    const newIpo = {
      id: `IPO_${Date.now()}`,
      stock: stock.toUpperCase(),
      applyDate: date,
      applyStockPrice: applyStockPrice,
      applyLot: applyLot,
      applyAmount: applyAmount,
      applySourceFund: fundSplits.length,
      sourceId: primarySourceId, // [cite: 4]
      ballotDate: null, allocatedLot: null, refund: null, listDate: null, sellDate: null, sellPrice: null, brokerage: null, netProfit: null
    }

    // Optimistic update
    ipos.value.push(newIpo)

    try {
      await api.upsertIpo({
        ipo_id: newIpo.id,
        stock_name: newIpo.stock,
        apply_date: newIpo.applyDate,
        apply_stock_price: newIpo.applyStockPrice,
        apply_lot: newIpo.applyLot,
        apply_amount: newIpo.applyAmount,
        apply_source_fund: newIpo.applySourceFund,
        apply_source_id: newIpo.sourceId,
        // ... empty fields for other columns
        ballot_date: '', allocated_lot: '', refund_amount: '', listing_date: '', sell_date: '', sell_price: '', brokerage_fee: '', net_profit: ''
      })

      // NEW LOGIC: Create multiple transactions, all sharing the same refId
      for (const split of fundSplits) {
        if (split.amount > 0) {
          await txStore.addTransaction({
            description: `IPO Application — ${newIpo.stock}`,
            category: 'IPO',
            amount: -split.amount,
            sourceId: split.sourceId,
            refId: newIpo.id, // [cite: 8]
          })
        }
      }

      toast.success(`IPO application for ${newIpo.stock} submitted across ${fundSplits.length} funds`)
      return newIpo
    } catch (err) {
      ipos.value.pop() // rollback [cite: 8]
      toast.error(`Failed to apply for IPO: ${err.message}`)
      throw err
    }
  }

  function getOwedCapital(ipoId) {
    const txs = txStore.transactions.filter(t => t.refId === ipoId);
    const balances = {};
    txs.forEach(t => {
      if (t.sourceId) balances[t.sourceId] = (balances[t.sourceId] || 0) + Math.abs(t.amount);
      if (t.destId) balances[t.destId] = (balances[t.destId] || 0) - Math.abs(t.amount);
    });
    return Object.fromEntries(
      Object.entries(balances)
        .map(([k, v]) => [k, Math.round(v * 100) / 100])
        .filter(([_, val]) => val > 0)
    );
  }

  /** Update ballot result (lots allocated + refund) */
  async function updateBallotResult(ipoId, { ballotDate, allocatedLot, refund, refundSplits }) {
    const ipo = ipos.value.find(i => i.id === ipoId)
    if (!ipo) return
    const prev = { ...ipo }

    ipo.ballotDate = ballotDate
    ipo.allocatedLot = allocatedLot
    ipo.refund = refund

    // FIX: If 0 lots are allocated, the lifecycle ends here.
    // We calculate the netProfit immediately (Refund - Applied Amount).
    // Usually this is 0, but if there's a processing fee, it will correctly show as a loss.
    if (allocatedLot === 0) {
      ipo.netProfit = (refund || 0) - ipo.applyAmount
    }

    try {
      await api.upsertIpo({
        ipo_id: ipo.id,
        stock_name: ipo.stock,
        apply_date: ipo.applyDate,
        apply_stock_price: ipo.applyStockPrice,
        apply_lot: ipo.applyLot,
        apply_amount: ipo.applyAmount,
        apply_source_fund: ipo.applySourceFund,
        apply_source_id: ipo.sourceId,
        ballot_date: ballotDate,
        allocated_lot: allocatedLot,
        refund_amount: refund,
        listing_date: ipo.listDate ?? '',
        sell_date: ipo.sellDate ?? '',
        sell_price: ipo.sellPrice ?? '',
        brokerage_fee: ipo.brokerage ?? '',
        net_profit: ipo.netProfit ?? '', // Now includes the 0-lot P&L
      })

      if (refund > 0) {
        if (allocatedLot === 0) {
          const owed = getOwedCapital(ipo.id);
          if (Object.keys(owed).length === 0) {
            await txStore.addTransaction({
              description: `IPO Refund — ${ipo.stock}`, category: 'IPO', amount: refund, destId: ipo.sourceId, refId: ipo.id,
            })
          } else {
            for (const [accId, amt] of Object.entries(owed)) {
              await txStore.addTransaction({
                description: `IPO Refund — ${ipo.stock}`, category: 'IPO', amount: amt, destId: accId, refId: ipo.id,
              })
            }
          }
        } else {
          // Partially successful with user refund splits
          if (refundSplits && refundSplits.length > 0) {
            for (const split of refundSplits) {
              if (split.amount > 0) {
                await txStore.addTransaction({
                  description: `IPO Refund (Partial) — ${ipo.stock}`, category: 'IPO', amount: split.amount, destId: split.sourceId, refId: ipo.id,
                })
              }
            }
          } else {
            await txStore.addTransaction({
              description: `IPO Refund — ${ipo.stock}`, category: 'IPO', amount: refund, destId: ipo.sourceId, refId: ipo.id,
            })
          }
        }
      }
      toast.success(`Ballot result updated for ${ipo.stock}`)
    } catch (err) {
      Object.assign(ipo, prev) // rollback
      toast.error(`Failed to update ballot: ${err.message}`)
      throw err
    }
  }

  async function recordListingDate(ipoId, listDate) {
    const ipo = ipos.value.find(i => i.id === ipoId)
    if (!ipo) return
    ipo.listDate = listDate
    try {
      await api.upsertIpo({
        ipo_id: ipo.id,
        stock_name: ipo.stock,
        apply_date: ipo.applyDate,
        apply_stock_price: ipo.applyStockPrice,
        apply_lot: ipo.applyLot,
        apply_amount: ipo.applyAmount,
        apply_source_fund: ipo.applySourceFund,
        apply_source_id: ipo.sourceId,
        ballot_date: ipo.ballotDate,
        allocated_lot: ipo.allocatedLot,
        refund_amount: ipo.refund,
        listing_date: listDate,
        sell_date: ipo.sellDate ?? '',
        sell_price: ipo.sellPrice ?? '',
        brokerage_fee: ipo.brokerage ?? '',
        net_profit: ipo.netProfit ?? '',
      })
      toast.success(`${ipo.stock} marked as listed`)
    } catch (err) {
      toast.error(`Failed to record listing. ${err.message}`)
      throw err
    }
  }

  /** Record sale and compute net profit */
  async function recordIPOSale(ipoId, { sellDate, sellPrice, brokerage, profitDestId }) {
    const ipo = ipos.value.find(i => i.id === ipoId)
    if (!ipo || !ipo.allocatedLot) { toast.error('IPO has no allocated lots'); return }

    const units = ipo.allocatedLot * 100;
    const gross = units * sellPrice
    const netProfit = gross - ipo.applyAmount + (ipo.refund ?? 0) - brokerage
    const prev = { ...ipo }

    ipo.sellDate = sellDate
    ipo.sellPrice = sellPrice
    ipo.brokerage = brokerage
    ipo.netProfit = netProfit

    try {
      await api.upsertIpo({
        ipo_id: ipo.id,
        stock_name: ipo.stock,
        apply_date: ipo.applyDate,
        apply_stock_price: ipo.applyStockPrice,
        apply_lot: ipo.applyLot,
        apply_amount: ipo.applyAmount,
        apply_source_fund: ipo.applySourceFund,
        apply_source_id: ipo.sourceId,
        ballot_date: ipo.ballotDate ?? '',
        allocated_lot: ipo.allocatedLot ?? '',
        refund_amount: ipo.refund ?? '',
        listing_date: ipo.listDate ?? '',
        sell_date: sellDate,
        sell_price: sellPrice,
        brokerage_fee: brokerage,
        net_profit: netProfit,
      })
      const owed = getOwedCapital(ipo.id);
      let capitalHandled = false;

      if (Object.keys(owed).length > 0) {
        for (const [accId, amt] of Object.entries(owed)) {
          await txStore.addTransaction({
            description: `IPO Capital Return — ${ipo.stock}`,
            category: 'Transfer',
            amount: amt,
            destId: accId,
            refId: ipo.id,
          })
        }
        capitalHandled = true;
      }

      if (!capitalHandled) {
        const capital = ipo.applyAmount - (ipo.refund || 0);
        if (capital > 0) {
          await txStore.addTransaction({
            description: `IPO Capital Return — ${ipo.stock}`,
            category: 'Transfer',
            amount: capital,
            destId: ipo.sourceId,
            refId: ipo.id,
          })
        }
      }

      if (netProfit !== 0 && profitDestId) {
        const isProfit = netProfit > 0;
        await txStore.addTransaction({
          description: `IPO ${isProfit ? 'Profit' : 'Loss'} — ${ipo.stock}`,
          category: 'IPO',
          amount: Math.abs(netProfit),
          sourceId: isProfit ? '' : profitDestId,
          destId: isProfit ? profitDestId : '',
          refId: ipo.id,
        })
      }

      toast.success(`Sale recorded — Net P&L: RM ${netProfit.toFixed(2)}`)
    } catch (err) {
      Object.assign(ipo, prev)   // rollback
      toast.error(`Failed to record sale: ${err.message}`)
      throw err
    }
  }

  return {
    ipos,
    loading,
    totalLocked,
    totalRefunds,
    totalProfit,
    getOwedCapital,
    fetchIpos,
    applyForIpo,
    updateBallotResult,
    recordListingDate,
    recordIPOSale,
  }
})
