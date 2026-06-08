/**
 * useApi.js
 *
 * GAS Web Apps deployed as "Anyone" don't support standard CORS fetch.
 * Strategy:
 *  - GET  → JSONP (script tag injection) — avoids CORS entirely
 *  - POST → fetch with text/plain body to skip preflight, follow redirect
 *
 * GAS always redirects cross-origin requests. Using text/plain avoids
 * the OPTIONS preflight, and `redirect: 'follow'` handles the 302.
 */

const GAS_URL = import.meta.env.VITE_GAS_URL

if (!GAS_URL) {
  console.warn('[useApi] VITE_GAS_URL not set. Add it to .env.local')
}

// ── JSONP helper (all GET/read requests) ──────────────────────────────────
let _cbCounter = 0

function jsonp(params = {}) {
  return new Promise((resolve, reject) => {
    const cbName = `_gasCb${++_cbCounter}`

    const timeout = setTimeout(() => {
      delete window[cbName]
      script.remove()
      reject(new Error('GAS request timed out after 15s. Check your VITE_GAS_URL.'))
    }, 15000)

    window[cbName] = (data) => {
      clearTimeout(timeout)
      delete window[cbName]
      script.remove()
      if (data?.ok === false) reject(new Error(data.error || 'GAS returned an error'))
      else resolve(data?.data ?? data)
    }

    const qs = new URLSearchParams({ ...params, callback: cbName }).toString()
    const script = document.createElement('script')
    script.src = `${GAS_URL}?${qs}`
    script.onerror = () => {
      clearTimeout(timeout)
      delete window[cbName]
      script.remove()
      reject(new Error('Could not reach GAS endpoint. Check VITE_GAS_URL in .env.local'))
    }
    document.head.appendChild(script)
  })
}

// ── POST helper (all write/mutation requests) ─────────────────────────────
async function gasPost(resource, payload) {
  // GAS reads payload from e.postData.contents
  // text/plain avoids CORS preflight; follow handles the GAS 302 redirect
  const res = await fetch(`${GAS_URL}?resource=${resource}&method=POST`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from GAS`)
  const json = await res.json()
  if (json?.ok === false) throw new Error(json.error || 'GAS write failed')
  return json?.data ?? json
}

// ── Row mappers: Sheet column names → store object shape ──────────────────

function formatGasDate(val) {
  if (typeof val === 'string' && val.length > 15 && val.includes('T') && val.endsWith('Z')) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
       const y = d.getFullYear()
       const m = String(d.getMonth() + 1).padStart(2, '0')
       const day = String(d.getDate()).padStart(2, '0')
       return `${y}-${m}-${day}`
    }
  }
  return val
}

function mapAccount(row) {
  return {
    id:           row.account_id,
    bank:         row.bank_name,
    label:        row.label,
    type:         row.type,
    physicalLink: row.physical_account_link,
    balance:      Number(row.balance) || 0,
    goal:         row.goal_amount ? Number(row.goal_amount) : null,
    goalDate:     row.goal_date || null,
    ccExpiry:     row.cc_expiry || null,
    ccLast4:      row.cc_last_4 || null,
    isActive:     row.is_active === true || row.is_active === 'TRUE',
  }
}

function mapTransaction(row) {
  return {
    id:          row.transaction_id,
    date:        formatGasDate(row.date),
    cycleId:     formatGasDate(row.cycle_id),
    description: row.description,
    category:    row.category,
    envelopeId:  row.envelope_id || null,
    amount:      Number(row.amount) || 0,
    sourceId:    row.source_account_id  || null,
    destId:      row.destination_account_id || null,
    isCc:        row.is_cc_transaction === true || row.is_cc_transaction === 'TRUE',
    ccStatus:    row.cc_settlement_status || null,
    refId:       row.ref_id || null,
  }
}

const ENVELOPE_COLORS = {
  Food: '#f5b560', Bills: '#8a8a96', Family: '#c5f135',
  Personal: '#9de0f5', Transport: '#f5b8d3', Savings: '#70dba0',
  Business: '#e05555', Tax: '#f5c842',
}

function mapEnvelope(row) {
  return {
    id:       row.template_id,
    name:     row.item_name,
    category: row.category,
    planned:  Number(row.planned_amount) || 0,
    spent:    0, // computed dynamically from transactions in the store
    priority: Number(row.priority) || 99,
    sourceId: row.default_source_id,
    color:    ENVELOPE_COLORS[row.category] || '#8a8a96',
  }
}

function mapIpo(row) {
  return {
    id:              row.ipo_id,
    stock:           row.stock_name,
    applyDate:       row.apply_date,
    applyStockPrice: Number(row.apply_stock_price) || 0,
    applyLot:        Number(row.apply_lot) || 0,
    applyAmount:     Number(row.apply_amount) || 0,
    sourceId:        row.apply_source_id,
    applySourceFund: Number(row.apply_source_fund) || 0,
    ballotDate:      row.ballot_date      || null,
    allocatedLot:    row.allocated_lot    ? Number(row.allocated_lot)    : null,
    refund:          row.refund_amount    ? Number(row.refund_amount)    : null,
    listDate:        row.listing_date     || null,
    sellDate:        row.sell_date        || null,
    sellPrice:       row.sell_price       ? Number(row.sell_price)       : null,
    brokerage:       row.brokerage_fee    ? Number(row.brokerage_fee)    : null,
    netProfit:       row.net_profit       ? Number(row.net_profit)       : null,
  }
}

function mapBursa(row) {
  return {
    id:              row.trade_id,
    stock:           row.stock_name,
    sourceId:        row.source_fund_id,
    status:          row.status,
    buyDate:         formatGasDate(row.buy_date),
    buyLot:          Number(row.buy_lot) || 0,
    buyPrice:        Number(row.buy_price) || 0,
    buyFee:          Number(row.buy_fee) || 0,
    totalInvested:   Number(row.total_invested) || 0,
    sellDate:        formatGasDate(row.sell_date) || null,
    sellPrice:       row.sell_price ? Number(row.sell_price) : null,
    sellFee:         row.sell_fee ? Number(row.sell_fee) : null,
    totalRevenue:    row.total_revenue ? Number(row.total_revenue) : null,
    netProfit:       row.net_profit ? Number(row.net_profit) : null,
  }
}

function mapCcBridge(row) {
  return {
    id:              row.bridge_id,
    txId:            row.transaction_id,
    date:            formatGasDate(row.charge_date),
    description:     row.description,
    amount:          Number(row.amount) || 0,
    fundingSourceId: row.funding_source_id || null,
    settlementDate:  formatGasDate(row.settlement_date),
    status:          row.status,
  }
}

function mapWishlist(row) {
  return {
    id:           row.item_id,
    emoji:        row.emoji,
    name:         row.item_name,
    price:        Number(row.estimated_price) || 0,
    targetFundId: row.target_fund_id,
    status:       row.status,
    date:         row.target_date || '',
  }
}

function mapHouseFund(row) {
  return {
    id:          row.trx_id,
    date:        formatGasDate(row.date),
    type:        row.type,
    funder:      row.funder,
    amount:      Number(row.amount) || 0,
    description: row.description,
  }
}

function mapCycleBudget(row) {
  return {
    id:              row.budget_id,
    cycleId:         formatGasDate(row.cycle_id),
    templateId:      row.template_id,
    name:            row.envelope_name,
    category:        row.category,
    planned:         Number(row.planned_amount) || 0,
    sourceId:        row.source_account_id,
    rolloverAmount:  row.rollover_amount !== '' ? Number(row.rollover_amount) : null,
    rolloverDestId:  row.rollover_dest_id || null,
    rolloverAction:  row.rollover_action  || null,
    isLocked:        row.is_locked === true || row.is_locked === 'TRUE',
  }
}

// ── Public API object (import this in the store) ──────────────────────────
export const api = {
  // ── Reads (JSONP) ──
  getSettings:      () => jsonp({ resource: 'app_settings'  }).then(r => r),
  getAccounts:      () => jsonp({ resource: 'accounts'       }).then(r => r.map(mapAccount)),
  getTransactions:  () => jsonp({ resource: 'transactions'   }).then(r => r.map(mapTransaction)),
  getSalaryPlans:   () => jsonp({ resource: 'salary_plans'   }).then(r => r.map(mapEnvelope)),
  getCycleBudgets:  () => jsonp({ resource: 'cycle_budgets'  }).then(r => r.map(mapCycleBudget)),
  getIpos:          () => jsonp({ resource: 'ipos'           }).then(r => r.map(mapIpo)),
  getBursaTrades:   () => jsonp({ resource: 'bursa_trades'   }).then(r => r.map(mapBursa)),
  getCcBridge:      () => jsonp({ resource: 'cc_bridge'      }).then(r => r.map(mapCcBridge)),
  getWishlist:      () => jsonp({ resource: 'wishlist'       }).then(r => r.map(mapWishlist)),
  getHouseFund:     () => jsonp({ resource: 'house_fund'     }).then(r => r.map(mapHouseFund)),

  // ── Writes (POST) ──
  setSetting:       (key, value, note) => gasPost('app_settings', { key, value, note }),
  addTransaction:   (data) => gasPost('transactions',  data),
  assignCcFunding:   (data) => gasPost('assign_cc_funding', data),
  upsertCycleBudget:(data) => gasPost('cycle_budgets', data),
  deleteCycleBudget:(data) => gasPost('delete_cycle_budget', data),
  upsertIpo:        (data) => gasPost('ipos',          data),
  upsertBursaTrade: (data) => gasPost('bursa_trades',  data),
  upsertCcBridge:   (data) => gasPost('cc_bridge',     data),
  upsertWishlist:   (data) => gasPost('wishlist',       data),
  updateAccount:    (data) => gasPost('accounts',       data),
  startNewCycle:    (data) => gasPost('start_cycle',    data),
  closeCycle:       (data) => gasPost('close_cycle',    data),
  upsertHouseFund:  (data) => gasPost('house_fund_add', data),
  deleteHouseFund:  (data) => gasPost('house_fund_del', data),
}
