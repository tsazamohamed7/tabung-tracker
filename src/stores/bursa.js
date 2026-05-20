import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { useTransactionStore } from '@/stores/transactions'
import { useAccountStore } from '@/stores/accounts'

export const useBursaStore = defineStore('bursa', () => {
  const toast = useToast()
  const txStore = useTransactionStore()
  const accStore = useAccountStore()

  const trades = ref([])
  const loading = ref(false)
  const fetched = ref(false)

  // ── Fetch ─────────────────────────────────────────────────────────────
  async function fetchTrades() {
    if (fetched.value) return
    loading.value = true
    try {
      trades.value = await api.getBursaTrades()
      fetched.value = true
    } catch (err) {
      toast.error(`Failed to load Bursa trades: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const activeTrades = computed(() =>
    trades.value.filter(t => t.status === 'Holding')
  )

  const closedTrades = computed(() =>
    trades.value.filter(t => t.status === 'Sold')
  )

  const totalDeployed = computed(() =>
    activeTrades.value.reduce((s, t) => s + (t.totalInvested || 0), 0)
  )

  const totalRealizedProfit = computed(() =>
    closedTrades.value.reduce((s, t) => s + (t.netProfit || 0), 0)
  )

  const winRate = computed(() => {
    if (closedTrades.value.length === 0) return 0
    const winners = closedTrades.value.filter(t => t.netProfit > 0).length
    return (winners / closedTrades.value.length) * 100
  })

  // ── Mutations ─────────────────────────────────────────────────────────

  async function buyStock({ stock, sourceId, buyDate, buyLot, buyPrice, buyFee }) {
    const totalInvested = (buyLot * 100 * buyPrice) + buyFee
    
    const newTrade = {
      id: `TRD_${Date.now()}`,
      stock: stock.toUpperCase(),
      sourceId,
      status: 'Holding',
      buyDate,
      buyLot,
      buyPrice,
      buyFee,
      totalInvested,
      sellDate: null,
      sellPrice: null,
      sellFee: null,
      totalRevenue: null,
      netProfit: null,
    }

    trades.value.unshift(newTrade) // optimistic prepend showing newest first

    try {
      await api.upsertBursaTrade({
        trade_id: newTrade.id,
        stock_name: newTrade.stock,
        source_fund_id: newTrade.sourceId,
        status: newTrade.status,
        buy_date: newTrade.buyDate,
        buy_lot: newTrade.buyLot,
        buy_price: newTrade.buyPrice,
        buy_fee: newTrade.buyFee,
        total_invested: newTrade.totalInvested,
        sell_date: '',
        sell_price: '',
        sell_fee: '',
        total_revenue: '',
        net_profit: ''
      })

      // Add corresponding transaction to ledger (Deduction from source fund)
      await txStore.addTransaction({
        description: `Bursa Buy — ${newTrade.stock}`,
        category: 'Transfer', // Using Transfer to keep it neutral, or maybe 'Personal'/'Shopping'? User might want to assign, let's use default Income/Expense logic depending on how UI is built. But it's an expense.
        // Wait, for IPO it's 'IPO'. For Bursa, what category? Tabung Tracker relies on strict categories. Let's use 'Shopping' or 'Savings'? Let's use 'Shopping' to deduct and then credit back? Or 'Transfer'? The IPO uses 'IPO' category. We don't have 'Bursa' category. Let's use 'Transfer' so it doesn't affect standard budgeting or 'Personal'. Wait, I'll just use 'Income' for sells and 'Transfer' for buys. No, IPO uses 'IPO'. If they didn't add a 'Bursa' category, it might reject. Let's look at Setup.gs categories:
        // ['Income','Transfer','Food','Bills','Shopping','Transport','IPO','Personal','Family','Savings','Business','Tax']
        // 'Transfer' is safest because 'Shopping' burns cycle budget.
        // Even better: use 'Savings' or 'Personal'. Actually, I'll use 'Personal' or 'Business'? Or just 'Transfer'. Transfer is ignored in cycle rolling. Let's use 'Transfer'.
        amount: -totalInvested,
        sourceId: newTrade.sourceId,
        refId: newTrade.id, // Tie it to the trade
      })

      // Sync local UI balance instantly
      accStore.adjustBalance(newTrade.sourceId, -totalInvested)

      toast.success(`Purchased ${newTrade.stock}`)
      return newTrade
    } catch (err) {
      trades.value.shift() // rollback
      toast.error(`Failed to buy stock: ${err.message}`)
      throw err
    }
  }

  async function sellStock(tradeId, { sellDate, sellPrice, sellFee }, skipToast = false) {
    const trade = trades.value.find(t => t.id === tradeId)
    if (!trade) return
    const prev = { ...trade }

    const units = trade.buyLot * 100
    const totalRevenue = (units * sellPrice) - sellFee
    const netProfit = totalRevenue - trade.totalInvested

    trade.sellDate = sellDate
    trade.sellPrice = sellPrice
    trade.sellFee = sellFee
    trade.totalRevenue = totalRevenue
    trade.netProfit = netProfit
    trade.status = 'Sold'

    try {
      await api.upsertBursaTrade({
        trade_id: trade.id,
        stock_name: trade.stock,
        source_fund_id: trade.sourceId,
        status: trade.status,
        buy_date: trade.buyDate,
        buy_lot: trade.buyLot,
        buy_price: trade.buyPrice,
        buy_fee: trade.buyFee,
        total_invested: trade.totalInvested,
        sell_date: trade.sellDate,
        sell_price: trade.sellPrice,
        sell_fee: trade.sellFee,
        total_revenue: trade.totalRevenue,
        net_profit: trade.netProfit
      })

      // Add revenue back to the funding source
      await txStore.addTransaction({
        description: `Bursa Sell — ${trade.stock}`,
        category: 'Transfer', 
        amount: trade.totalRevenue,
        destId: trade.sourceId,
        refId: trade.id,
      })

      // Sync local UI balance instantly
      accStore.adjustBalance(trade.sourceId, trade.totalRevenue)

      if (!skipToast) toast.success(`Sold ${trade.stock} — P&L: RM ${netProfit.toFixed(2)}`)
    } catch (err) {
      Object.assign(trade, prev) // rollback
      toast.error(`Failed to record sell: ${err.message}`)
      throw err
    }
  }

  async function sellPosition(positionKey, { sellDate, sellLot, sellPrice, sellFee }) {
    const activeTradesForPosition = activeTrades.value
      .filter(t => `${t.stock}_${t.sourceId}` === positionKey)
      .sort((a,b) => a.buyDate.localeCompare(b.buyDate) || a.id.localeCompare(b.id)) // FIFO

    let remainingLotsToSell = sellLot
    let feeRemaining = sellFee
    
    try {
      for (let i = 0; i < activeTradesForPosition.length; i++) {
        if (remainingLotsToSell <= 0) break;
        
        const trade = activeTradesForPosition[i]
        
        if (trade.buyLot <= remainingLotsToSell) {
          // Full sell of this trade row
          const lotsSold = trade.buyLot
          remainingLotsToSell -= lotsSold
          
          let allocatedFee = remainingLotsToSell === 0 ? feeRemaining : Number((sellFee * (lotsSold / sellLot)).toFixed(2))
          feeRemaining -= allocatedFee
          
          await sellStock(trade.id, {
            sellDate,
            sellPrice,
            sellFee: allocatedFee
          }, true)
        } else {
          // Partial sell (Split)
          const lotsSold = remainingLotsToSell
          const lotsRemaining = trade.buyLot - lotsSold
          
          const holdingRatio = lotsRemaining / trade.buyLot
          
          const holdingBuyFee = Number((trade.buyFee * holdingRatio).toFixed(2))
          const soldBuyFee = trade.buyFee - holdingBuyFee
          
          const holdingInvested = Number((trade.totalInvested * holdingRatio).toFixed(2))
          const soldInvested = trade.totalInvested - holdingInvested
          
          // Create new holding trade
          const newHoldingTrade = {
            id: `TRD_${Date.now()}_split`,
            stock: trade.stock,
            sourceId: trade.sourceId,
            status: 'Holding',
            buyDate: trade.buyDate,
            buyLot: lotsRemaining,
            buyPrice: trade.buyPrice,
            buyFee: holdingBuyFee,
            totalInvested: holdingInvested,
            sellDate: null, sellPrice: null, sellFee: null, totalRevenue: null, netProfit: null
          }
          
          // Insert new holding trade into GAS
          await api.upsertBursaTrade({
            trade_id: newHoldingTrade.id,
            stock_name: newHoldingTrade.stock,
            source_fund_id: newHoldingTrade.sourceId,
            status: newHoldingTrade.status,
            buy_date: newHoldingTrade.buyDate,
            buy_lot: newHoldingTrade.buyLot,
            buy_price: newHoldingTrade.buyPrice,
            buy_fee: newHoldingTrade.buyFee,
            total_invested: newHoldingTrade.totalInvested,
            sell_date: '',
            sell_price: '',
            sell_fee: '',
            total_revenue: '',
            net_profit: ''
          })
          
          // Local state
          trades.value.push(newHoldingTrade)
          
          // Update original trade in memory (sellStock handles upserting all fields)
          trade.buyLot = lotsSold
          trade.buyFee = soldBuyFee
          trade.totalInvested = soldInvested
          
          // Sell the portion
          let allocatedFee = feeRemaining
          await sellStock(trade.id, {
            sellDate,
            sellPrice,
            sellFee: allocatedFee
          }, true)
          
          remainingLotsToSell = 0
        }
      }
      toast.success(`Successfully sold ${sellLot * 100} units of ${positionKey.split('_')[0]}`)
    } catch (err) {
      toast.error(`Error during partial sell processing: ${err.message}`)
      throw err
    }
  }

  return {
    trades,
    loading,
    activeTrades,
    closedTrades,
    totalDeployed,
    totalRealizedProfit,
    winRate,
    fetchTrades,
    buyStock,
    sellStock,
    sellPosition
  }
})
