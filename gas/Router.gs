// ╔══════════════════════════════════════════════════════╗
// ║  Router.gs — HTTP entry points & request routing    ║
// ║  doGet / doPost → handleRead / handleWrite          ║
// ╚══════════════════════════════════════════════════════╝

// ── Entry points ──────────────────────────────────────────────────────────

/**
 * Handles all GET requests.
 * - If ?callback=xxx is present, wraps response as JSONP (for Vue frontend).
 * - If ?method=POST is present, treats it as a write via URL params fallback.
 */
function doGet(e) {
  const params   = e.parameter
  const resource = params.resource
  const callback = params.callback
  const method   = params.method

  try {
    let result

    if (method === 'POST') {
      const body = params.payload ? JSON.parse(params.payload) : {}
      result = handleWrite(resource, body)
    } else {
      result = handleRead(resource)
    }

    return respond({ ok: true, data: result }, callback)

  } catch (err) {
    return respond({ ok: false, error: err.message }, callback)
  }
}

/**
 * Handles all POST requests.
 * Reads body from e.postData.contents (standard) or e.parameter.payload (fallback).
 */
function doPost(e) {
  const params   = e.parameter
  const resource = params.resource

  let body = {}
  try {
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents)
    } else if (params.payload) {
      body = JSON.parse(params.payload)
    }
  } catch (_) { /* malformed JSON — proceed with empty body */ }

  try {
    const result = handleWrite(resource, body)
    return respond({ ok: true, data: result })
  } catch (err) {
    return respond({ ok: false, error: err.message })
  }
}

// ── Response helper ───────────────────────────────────────────────────────

/**
 * Serialises result to JSON or JSONP depending on whether a callback is provided.
 */
function respond(payload, callback) {
  const json = JSON.stringify(payload)
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT)
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON)
}

// ── Read router ───────────────────────────────────────────────────────────

function handleRead(resource) {
  switch (resource) {
    case 'app_settings':   return getAllSettings()
    case 'accounts':       return getAccounts()
    case 'transactions':   return getTransactions()
    case 'salary_plans':   return getSalaryPlans()
    case 'cycle_budgets':  return getCycleBudgets()
    case 'ipos':           return getIpos()
    case 'bursa_trades':   return getBursaTrades()
    case 'cc_bridge':      return getCcBridge()
    case 'wishlist':       return getWishlist()
    default:
      throw new Error(`Unknown read resource: "${resource}"`)
  }
}

// ── Write router ──────────────────────────────────────────────────────────

function handleWrite(resource, body) {
  switch (resource) {
    case 'app_settings':   return setSetting(body.key, body.value, body.note)
    case 'app_settings_bulk': return setSettings(body.entries)
    case 'accounts':       return upsertAccount(body)
    case 'transactions':   return addTransaction(body)
    case 'salary_plans':   return upsertSalaryPlan(body)
    case 'cycle_budgets':  return upsertCycleBudget(body)
    case 'delete_cycle_budget': return deleteCycleBudget(body)
    case 'ipos':           return upsertIpo(body)
    case 'bursa_trades':   return upsertBursaTrade(body)
    case 'cc_bridge':      return upsertCcBridge(body)
    case 'assign_cc_funding': return assignCcFunding(body)
    case 'wishlist':       return upsertWishlist(body)
    case 'start_cycle':    return startNewCycle(body)
    case 'close_cycle':    return closeCycle(body)
    default:
      throw new Error(`Unknown write resource: "${resource}"`)
  }
}
