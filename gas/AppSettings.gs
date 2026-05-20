// ╔══════════════════════════════════════════════════════════════╗
// ║  AppSettings.gs — app_settings CRUD                         ║
// ║                                                              ║
// ║  A general-purpose key-value config store for the app.      ║
// ║  Used for: active cycle tracking, global preferences,       ║
// ║  feature flags, partner view config, and future settings.   ║
// ╚══════════════════════════════════════════════════════════════╝

const SETTINGS_HEADERS = [
  'key',         // Unique setting key e.g. "current_cycle_id"
  'value',       // The stored value (always a string)
  'updated_at',  // ISO date string of last update
  'note',        // Human-readable description
]

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns ALL settings as an array of { key, value, updated_at, note }.
 * Frontend converts this to a key-value map via:
 *   Object.fromEntries(rows.map(r => [r.key, r.value]))
 */
function getAllSettings() {
  return sheetToObjects(getSheet(SHEETS.APP_SETTINGS))
}

/**
 * Returns the value of a single setting by key.
 * Returns null if the key doesn't exist.
 */
function getSetting(key) {
  const rows = sheetToObjects(getSheet(SHEETS.APP_SETTINGS))
  const row  = rows.find(r => r.key === key)
  return row ? row.value : null
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Sets a single setting by key. Creates the row if it doesn't exist.
 * Always updates the updated_at timestamp.
 *
 * @param {string} key
 * @param {string} value   Always stored as string. Numbers/booleans are cast.
 * @param {string} note    Optional description (only written on first insert)
 */
function setSetting(key, value, note) {
  if (!key) throw new Error('setSetting: key is required')

  const sheet    = getSheet(SHEETS.APP_SETTINGS)
  const existing = sheetToObjects(sheet).find(r => r.key === key)

  return upsertRow(sheet, SETTINGS_HEADERS, {
    key,
    value:      String(value),
    updated_at: new Date().toISOString().slice(0, 10),
    note:       note ?? existing?.note ?? '',
  }, 'key')
}

/**
 * Sets multiple settings in one call.
 * Accepts an array of { key, value, note? } objects.
 */
function setSettings(entries) {
  if (!Array.isArray(entries)) throw new Error('setSettings: expects an array')
  return entries.map(e => setSetting(e.key, e.value, e.note))
}
