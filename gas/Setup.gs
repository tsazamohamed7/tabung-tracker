/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          TABUNG TRACKER — ONE-CLICK SETUP SCRIPT            ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  HOW TO USE:                                                 ║
 * ║  1. Open your Google Sheet                                   ║
 * ║  2. Extensions → Apps Script                                 ║
 * ║  3. Paste this entire file into the editor                   ║
 * ║  4. Select "setupTabungTracker" in the function dropdown     ║
 * ║  5. Click ▶ Run                                              ║
 * ║  6. Grant permissions when prompted                          ║
 * ║                                                              ║
 * ║  The script will:                                            ║
 * ║  ✓ Create all 7 sheets with correct headers                  ║
 * ║  ✓ Format header rows (bold, frozen, colored)                ║
 * ║  ✓ Set column widths                                         ║
 * ║  ✓ Seed sample data matching your real account setup         ║
 * ║  ✓ Show a completion summary in a dialog                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Schema Definition ─────────────────────────────────────────────────────

const SCHEMA = {

  app_settings: {
    color: '#546e7a',  // blue-grey
    columns: [
      { header: 'key',        width: 200, note: 'Unique setting key' },
      { header: 'value',      width: 200, note: 'Setting value (always stored as string)' },
      { header: 'updated_at', width: 120, note: 'YYYY-MM-DD of last update' },
      { header: 'note',       width: 300, note: 'Human-readable description' },
    ],
    seed: [
      ['current_cycle_id',      '2025-06', '2025-05-25', 'Active salary cycle ID — FK → fact_cycle_budgets.cycle_id'],
      ['cycle_start_day',       '25',      '2025-01-01', 'Day of month salary arrives (1-31)'],
      ['default_currency',      'MYR',     '2025-01-01', 'ISO 4217 currency code'],
      ['partner_view_enabled',  'true',    '2025-01-01', 'Show partner dashboard tab'],
      ['app_version',           '1.0.0',   '2025-01-01', 'For future schema migrations'],
    ]
  },

  dim_accounts: {
    color: '#1a73e8',  // blue
    columns: [
      { header: 'account_id',           width: 160, note: 'Primary key. e.g. maybank-salary' },
      { header: 'bank_name',            width: 120, note: 'Physical bank name' },
      { header: 'label',                width: 160, note: 'Display name of the fund' },
      { header: 'type',                 width: 100, note: 'Physical | Virtual | CC' },
      { header: 'physical_account_link',width: 160, note: 'Parent physical bank id' },
      { header: 'initial_balance',      width: 130, note: 'Opening balance (RM)' },
      { header: 'balance',              width: 120, note: 'Current balance (RM)' },
      { header: 'goal_amount',          width: 120, note: 'Savings goal target (optional)' },
      { header: 'goal_date',            width: 110, note: 'Target date for goal (optional)' },
      { header: 'cc_expiry',            width: 100, note: 'MM/YY for credit cards' },
      { header: 'cc_last_4',            width: 90,  note: 'Last 4 digits for CC UI' },
      { header: 'is_active',            width: 90,  note: 'TRUE / FALSE' },
    ],
    seed: [
      ['maybank-salary',   'Maybank',  'Salary',        'Virtual', 'maybank',  3200,  3200,  '',    '',          '', '', true],
      ['maybank-emergency', 'Maybank',  'Emergency Fund', 'Virtual', 'maybank',  5000,  5000,  10000, '',          '', '', true],
      ['maybank-sabah',     'Maybank',  'Sabah Trip ✈',   'Virtual', 'maybank',  0,     0,     3500,  'Dec 2025',  '', '', true],
      ['cimb-tutor',        'CIMB',     'Tutor Income',   'Virtual', 'cimb',     2800,  2800,  '',    '',          '', '', true],
      ['cimb-business',     'CIMB',     'Business Float', 'Virtual', 'cimb',     1520,  1520,  3000,  '',          '', '', true],
      ['cimb-tax',          'CIMB',     'Tax Reserve',    'Virtual', 'cimb',     3000,  3000,  4000,  'Dec 2025',  '', '', true],
      ['muamalat-family',   'Muamalat', 'Family Fund',    'Virtual', 'muamalat', 2900,  2900,  '',    '',          '', '', true],
      ['maybank-cc',        'Maybank',  'Maybank CC',     'CC',      'maybank',  0,     -680,  '',    '',          '12/28', '8812', true],
      ['cimb-cc',           'CIMB',     'CIMB CC',        'CC',      'cimb',     0,     -240,  '',    '',          '05/27', '9403', true],
    ]
  },

  fact_transactions: {
    color: '#0f9d58',  // green
    columns: [
      { header: 'transaction_id',         width: 180, note: 'Primary key. Auto-generated.' },
      { header: 'date',                   width: 110, note: 'YYYY-MM-DD' },
      { header: 'cycle_id',               width: 100, note: 'e.g. 2025-06' },
      { header: 'description',            width: 240, note: 'Human-readable description' },
      { header: 'category',               width: 120, note: 'Income|Transfer|Food|Bills|Shopping|Transport|IPO|Personal|Family' },
      { header: 'envelope_id',            width: 150, note: 'FK → dim_salary_plans.template_id' },
      { header: 'amount',                 width: 110, note: 'Positive = credit, Negative = debit (RM)' },
      { header: 'source_account_id',      width: 160, note: 'FK → dim_accounts.account_id' },
      { header: 'destination_account_id', width: 180, note: 'FK → dim_accounts.account_id (transfers only)' },
      { header: 'is_cc_transaction',      width: 140, note: 'TRUE / FALSE' },
      { header: 'cc_settlement_status',   width: 160, note: 'Pending | Settled | (blank)' },
      { header: 'ref_id',                 width: 140, note: 'FK → fact_ipo_tracker.ipo_id or fact_cc_bridge.bridge_id' },
    ],
    seed: [
      ['T001', '2025-05-25', '2025-06', 'Salary — Main Job',     'Income',   '', 7200,  'maybank-salary',   '',                  false, '',        ''],
      ['T002', '2025-05-25', '2025-06', '→ Emergency Fund',      'Transfer', '', 500,   'maybank-salary',   'maybank-emergency', false, '',        ''],
      ['T003', '2025-05-25', '2025-06', '→ Family Fund',         'Transfer', '', 1000,  'maybank-salary',   'muamalat-family',   false, '',        ''],
      ['T004', '2025-05-26', '2025-06', 'Unifi Internet',        'Bills',    '', -169,  'maybank-salary',   '',                  false, '',        ''],
      ['T005', '2025-05-28', '2025-06', 'Lazada purchase',       'Shopping', '', -320,  'maybank-cc',        '',                  true,  'Pending', ''],
      ['T006', '2025-06-01', '2025-06', 'IPO Application — MYEG','IPO',      '', -1000, 'maybank-salary',   '',                  false, '',        'IPO001'],
      ['T007', '2025-06-03', '2025-06', 'Petronas fuel',         'Transport','', -80,   'muamalat-family',   '',                  false, '',        ''],
      ['T008', '2025-06-05', '2025-06', 'Tutor income',          'Income',   '', 2600,  'cimb-tutor',        '',                  false, '',        ''],
      ['T009', '2025-06-07', '2025-06', 'Shopee home items',     'Shopping', '', -240,  'cimb-cc',           '',                  true,  'Pending', ''],
      ['T010', '2025-06-09', '2025-06', 'Grocery — Giant',       'Food',     '', -185,  'muamalat-family',   '',                  false, '',        ''],
      ['T011', '2025-06-11', '2025-06', 'IPO Refund — CTOS',     'IPO',      '', 600,   '',                  'maybank-salary',   false, '',        'IPO002'],
      ['T012', '2025-06-11', '2025-06', 'Petronas fuel',         'Transport','', -100,  'muamalat-family',   '',                  false, '',        ''],
      ['T013', '2025-06-10', '2025-06', 'Watsons personal care', 'Personal', '', -680,  'maybank-cc',        '',                  true,  'Pending', ''],
    ]
  },

  dim_salary_plans: {
    color: '#f4b400',  // yellow
    columns: [
      { header: 'template_id',       width: 150, note: 'Primary key. e.g. env-food' },
      { header: 'item_name',         width: 180, note: 'Envelope display name' },
      { header: 'category',          width: 120, note: 'Category tag' },
      { header: 'planned_amount',    width: 140, note: 'Monthly allocation (RM)' },
      { header: 'priority',          width: 90,  note: 'Allocation order (1 = first)' },
      { header: 'default_source_id', width: 180, note: 'FK → dim_accounts.account_id' },
    ],
    seed: [
      ['env-food',      'Food',             'Food',      1000, 1, 'muamalat-family'],
      ['env-bills',     'Bills & Utilities','Bills',     900,  2, 'maybank-salary'],
      ['env-family',    'Family Expenses',  'Family',    1000, 3, 'muamalat-family'],
      ['env-personal',  'Personal',         'Personal',  500,  4, 'maybank-salary'],
      ['env-transport', 'Transport',        'Transport', 400,  5, 'maybank-salary'],
      ['env-savings',   'Savings — Sabah',  'Savings',   450,  6, 'cimb-tutor'],
      ['env-business',  'Business Float',   'Business',  1000, 7, 'cimb-business'],
      ['env-tax',       'Tax Reserve',      'Tax',       500,  8, 'cimb-tax'],
    ]
  },

  fact_cycle_budgets: {
    color: '#e65100',  // deep orange
    columns: [
      { header: 'budget_id',          width: 200, note: 'PK e.g. BUD_2025-06_env-food' },
      { header: 'cycle_id',           width: 100, note: 'e.g. 2025-06' },
      { header: 'template_id',        width: 140, note: 'FK → dim_salary_plans.template_id' },
      { header: 'envelope_name',      width: 180, note: 'Display name copied from template' },
      { header: 'category',           width: 120, note: 'For matching against fact_transactions' },
      { header: 'planned_amount',     width: 140, note: 'Editable during cycle (RM)' },
      { header: 'source_account_id',  width: 180, note: 'FK → dim_accounts.account_id' },
      { header: 'rollover_amount',    width: 140, note: 'Computed at close: leftover (RM)' },
      { header: 'rollover_dest_id',   width: 180, note: 'FK → dim_accounts.account_id (sweep target)' },
      { header: 'rollover_action',    width: 120, note: 'sweep | keep | overspent' },
      { header: 'is_locked',          width: 90,  note: 'FALSE during cycle, TRUE after close' },
    ],
    seed: [
      ['BUD_2025-06_env-food',      '2025-06', 'env-food',      'Food',             'Food',      1000, 'muamalat-family', '', '', '', false],
      ['BUD_2025-06_env-bills',     '2025-06', 'env-bills',     'Bills & Utilities','Bills',     900,  'maybank-salary', '', '', '', false],
      ['BUD_2025-06_env-family',    '2025-06', 'env-family',    'Family Expenses',  'Family',    1000, 'muamalat-family', '', '', '', false],
      ['BUD_2025-06_env-personal',  '2025-06', 'env-personal',  'Personal',         'Personal',  500,  'maybank-salary', '', '', '', false],
      ['BUD_2025-06_env-transport', '2025-06', 'env-transport', 'Transport',        'Transport', 400,  'maybank-salary', '', '', '', false],
      ['BUD_2025-06_env-savings',   '2025-06', 'env-savings',   'Savings — Sabah',  'Savings',   450,  'cimb-tutor',      '', '', '', false],
      ['BUD_2025-06_env-business',  '2025-06', 'env-business',  'Business Float',   'Business',  1000, 'cimb-business',   '', '', '', false],
      ['BUD_2025-06_env-tax',       '2025-06', 'env-tax',       'Tax Reserve',      'Tax',       500,  'cimb-tax',        '', '', '', false],
      ['BUD_2025-05_env-food',      '2025-05', 'env-food',      'Food',             'Food',      1000, 'muamalat-family', 320, 'cimb-tutor',     'sweep', true],
      ['BUD_2025-05_env-bills',     '2025-05', 'env-bills',     'Bills & Utilities','Bills',     900,  'maybank-salary', 0,   '',               'keep',  true],
      ['BUD_2025-05_env-family',    '2025-05', 'env-family',    'Family Expenses',  'Family',    1000, 'muamalat-family', 520, 'muamalat-family', 'keep', true],
      ['BUD_2025-05_env-personal',  '2025-05', 'env-personal',  'Personal',         'Personal',  500,  'maybank-salary', 85,  'maybank-salary', 'keep', true],
      ['BUD_2025-05_env-transport', '2025-05', 'env-transport', 'Transport',        'Transport', 400,  'maybank-salary', 210, 'maybank-sabah',   'sweep', true],
      ['BUD_2025-05_env-savings',   '2025-05', 'env-savings',   'Savings — Sabah',  'Savings',   450,  'cimb-tutor',      0,   '',               'keep',  true],
      ['BUD_2025-05_env-business',  '2025-05', 'env-business',  'Business Float',   'Business',  1000, 'cimb-business',   0,   '',               'keep',  true],
      ['BUD_2025-05_env-tax',       '2025-05', 'env-tax',       'Tax Reserve',      'Tax',       500,  'cimb-tax',        0,   '',               'keep',  true],
    ]
  },

  fact_ipo_tracker: {
    color: '#9c27b0',  // purple
    columns: [
      { header: 'ipo_id',          width: 120, note: 'Primary key. e.g. IPO001' },
      { header: 'stock_name',      width: 120, note: 'Stock code/name' },
      { header: 'apply_date',      width: 110, note: 'YYYY-MM-DD' },
      { header: 'apply_stock_price',width: 130, note: 'Price per unit (RM)' },
      { header: 'apply_lot',       width: 100, note: '1 lot = 100 units' },
      { header: 'apply_amount',    width: 120, note: 'Total amount applied (RM)' },
      { header: 'apply_source_fund',width: 130, note: 'Number of funds used' },
      { header: 'apply_source_id', width: 160, note: 'FK → dim_accounts.account_id' },
      { header: 'ballot_date',     width: 110, note: 'YYYY-MM-DD' },
      { header: 'allocated_lot',   width: 140, note: 'Lots received after ballot' },
      { header: 'refund_amount',   width: 130, note: 'Refund from unallocated lots (RM)' },
      { header: 'listing_date',    width: 120, note: 'YYYY-MM-DD' },
      { header: 'sell_date',       width: 110, note: 'YYYY-MM-DD' },
      { header: 'sell_price',      width: 110, note: 'Price sold per unit (RM)' },
      { header: 'brokerage_fee',   width: 130, note: 'Brokerage charged (RM)' },
      { header: 'net_profit',      width: 110, note: 'Calculated net P&L (RM)' },
    ],
    seed: [
      ['IPO001', 'MYEG-WC', '2025-06-01', 0.25, 40,  1000, 1, 'maybank-salary', '',          '',  '',   '',           '',          '',   '',  ''  ],
      ['IPO002', 'CTOS-PA', '2025-05-15', 0.80, 20,  1600, 1, 'cimb-tutor',      '2025-06-05', 10,  800,  '2025-06-15', '',          '',   '',  ''  ],
      ['IPO003', 'NEXG',    '2025-04-02', 1.00, 20,  2000, 1, 'maybank-salary', '2025-04-18', 16,  400,  '2025-04-20', '2025-04-21',1.24, 15,  369 ],
      ['IPO004', 'PECCA',   '2025-06-11', 0.50, 20,  1000, 1, 'muamalat-family', '',          '',  '',   '',           '',          '',   '',  ''  ],
    ]
  },

  fact_bursa_tracker: {
    color: '#00796b',  // teal/green
    columns: [
      { header: 'trade_id',       width: 120, note: 'Primary key. e.g. TRD001' },
      { header: 'stock_name',     width: 120, note: 'Stock code/name' },
      { header: 'source_fund_id', width: 160, note: 'FK → dim_accounts.account_id (M+ or Moomoo fund)' },
      { header: 'status',         width: 100, note: 'Holding | Sold' },
      { header: 'buy_date',       width: 110, note: 'YYYY-MM-DD' },
      { header: 'buy_lot',        width: 100, note: '1 lot = 100 shares' },
      { header: 'buy_price',      width: 120, note: 'Price per share (RM)' },
      { header: 'buy_fee',        width: 120, note: 'Brokerage/Stamp/Clearing (RM)' },
      { header: 'total_invested', width: 130, note: 'Total capital deducted (RM)' },
      { header: 'sell_date',      width: 110, note: 'YYYY-MM-DD' },
      { header: 'sell_price',     width: 120, note: 'Price per share (RM)' },
      { header: 'sell_fee',       width: 120, note: 'Brokerage/Stamp/Clearing (RM)' },
      { header: 'total_revenue',  width: 130, note: 'Total revenue credited (RM)' },
      { header: 'net_profit',     width: 120, note: 'P&L (RM)' },
    ],
    seed: []
  },

  fact_cc_bridge: {
    color: '#db4437',  // red
    columns: [
      { header: 'bridge_id',         width: 140, note: 'Primary key. e.g. CC001' },
      { header: 'transaction_id',    width: 160, note: 'FK → fact_transactions.transaction_id' },
      { header: 'description',       width: 220, note: 'Item description (copied from transaction)' },
      { header: 'amount',            width: 110, note: 'CC charge amount (RM)' },
      { header: 'charge_date',       width: 120, note: 'YYYY-MM-DD' },
      { header: 'funding_source_id', width: 180, note: 'FK → dim_accounts.account_id (virtual fund to pay from)' },
      { header: 'settlement_date',   width: 140, note: 'YYYY-MM-DD (when CC bill paid)' },
      { header: 'status',            width: 110, note: 'Unassigned | Assigned | Settled' },
    ],
    seed: [
      ['CC001', 'T005', 'Lazada purchase',       320, '2025-05-28', 'muamalat-family', '', 'Assigned' ],
      ['CC002', 'T009', 'Shopee home items',     240, '2025-06-07', 'muamalat-family', '', 'Assigned' ],
      ['CC003', 'T013', 'Watsons personal care', 680, '2025-06-10', '',                '', 'Unassigned'],
    ]
  },

  dim_wishlist: {
    color: '#00bcd4',  // teal
    columns: [
      { header: 'item_id',         width: 120, note: 'Primary key. e.g. W001' },
      { header: 'item_name',       width: 220, note: 'Display name' },
      { header: 'emoji',           width: 70,  note: 'Emoji icon' },
      { header: 'estimated_price', width: 150, note: 'Estimated cost (RM)' },
      { header: 'target_fund_id',  width: 180, note: 'FK → dim_accounts.account_id' },
      { header: 'status',          width: 110, note: 'Planned | Saving | Purchased' },
      { header: 'target_date',     width: 120, note: 'Desired purchase date' },
      { header: 'notes',           width: 220, note: 'Optional notes' },
    ],
    seed: [
      ['W001', 'Sabah Family Trip',        '✈️', 3500, 'maybank-sabah',    'Saving',   'Dec 2025',  'Annual family holiday'],
      ['W002', 'New sofa (IKEA)',          '🛋️', 1200, 'muamalat-family',  'Planned',  'Anytime',   ''],
      ['W003', 'iPad for kids',            '📱', 1800, 'maybank-salary',  'Planned',  'After Raya',''],
      ['W004', 'Road tax & insurance',     '🚗', 980,  'maybank-salary',  'Planned',  'Aug 2025',  'Renewal due Aug'],
    ]
  },

}

// ── Main Entry Point ──────────────────────────────────────────────────────

function setupTabungTracker() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const results = []
  const startTime = new Date()

  Logger.log('═══════════════════════════════════════')
  Logger.log('  Tabung Tracker Setup — Starting...')
  Logger.log('═══════════════════════════════════════')

  // Delete the default "Sheet1" if it's empty and still named Sheet1
  const defaultSheet = ss.getSheetByName('Sheet1')
  if (defaultSheet && defaultSheet.getLastRow() <= 1) {
    // Only delete if there are other sheets or we're about to create some
    if (Object.keys(SCHEMA).length > 0) {
      try { ss.deleteSheet(defaultSheet) } catch(e) { /* ignore if can't delete */ }
    }
  }

  // Process each sheet in schema order
  for (const [sheetName, config] of Object.entries(SCHEMA)) {
    const result = createOrUpdateSheet(ss, sheetName, config)
    results.push(result)
    Logger.log(`✓ ${sheetName}: ${result.status}`)
  }

  // Rename the spreadsheet if it still has default name
  if (ss.getName() === 'Untitled spreadsheet') {
    ss.rename('Tabung Tracker DB')
  }

  const elapsed = ((new Date() - startTime) / 1000).toFixed(1)
  Logger.log('═══════════════════════════════════════')
  Logger.log(`  Setup complete in ${elapsed}s`)
  Logger.log('═══════════════════════════════════════')

  // Show summary dialog
  showSummaryDialog(ss, results, elapsed)
}

// ── Sheet Creator ─────────────────────────────────────────────────────────

function createOrUpdateSheet(ss, sheetName, config) {
  let sheet = ss.getSheetByName(sheetName)
  let isNew = false

  if (!sheet) {
    sheet = ss.insertSheet(sheetName)
    isNew = true
  }

  const headers = config.columns.map(c => c.header)

  // ── Write headers ──────────────────────────────────────────────────────
  const headerRange = sheet.getRange(1, 1, 1, headers.length)
  headerRange.setValues([headers])

  // ── Style header row ───────────────────────────────────────────────────
  headerRange
    .setBackground(config.color)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontFamily('Google Sans')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left')
    .setBorder(false, false, true, false, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_MEDIUM)

  // Set header row height
  sheet.setRowHeight(1, 36)

  // Freeze header row
  sheet.setFrozenRows(1)

  // ── Set column widths & notes ──────────────────────────────────────────
  config.columns.forEach((col, i) => {
    sheet.setColumnWidth(i + 1, col.width)
    if (col.note) {
      sheet.getRange(1, i + 1).setNote(col.note)
    }
  })

  // ── Add alternating row banding ────────────────────────────────────────
  // Remove existing bandings first
  sheet.getBandings().forEach(b => b.remove())
  const dataRange = sheet.getRange(2, 1, Math.max(50, sheet.getMaxRows() - 1), headers.length)
  dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)

  // ── Seed data (only if sheet is newly created or empty) ────────────────
  let seededRows = 0
  if (isNew && config.seed && config.seed.length > 0) {
    const seedRange = sheet.getRange(2, 1, config.seed.length, headers.length)
    seedRange.setValues(config.seed)
    seedRange.setFontSize(10)
    seedRange.setFontFamily('Google Sans')
    seedRange.setVerticalAlignment('middle')
    seededRows = config.seed.length
  }

  // ── Add data validation for known enum columns ─────────────────────────
  applyValidations(sheet, sheetName, config)

  // ── Format specific column types ──────────────────────────────────────
  applyColumnFormats(sheet, sheetName, headers)

  return {
    name: sheetName,
    status: isNew ? `Created (${seededRows} seed rows added)` : 'Updated headers & formatting',
    isNew,
    seededRows,
  }
}

// ── Data Validations ──────────────────────────────────────────────────────

function applyValidations(sheet, sheetName, config) {
  const headers = config.columns.map(c => c.header)
  const maxRows = 500

  const validations = {
    dim_accounts: {
      type:      { col: 'type',      values: ['Virtual', 'Physical', 'CC'] },
      is_active: { col: 'is_active', values: ['TRUE', 'FALSE'] },
    },
    fact_transactions: {
      category: { col: 'category', values: ['Income','Transfer','Food','Bills','Shopping','Transport','IPO','Personal','Family','Savings','Business','Tax'] },
      is_cc:    { col: 'is_cc_transaction', values: ['TRUE', 'FALSE'] },
      cc_status:{ col: 'cc_settlement_status', values: ['Pending', 'Settled', ''] },
    },
    fact_cc_bridge: {
      status: { col: 'status', values: ['Unassigned', 'Assigned', 'Settled'] },
    },
    fact_bursa_tracker: {
      status: { col: 'status', values: ['Holding', 'Sold'] },
    },
    dim_wishlist: {
      status: { col: 'status', values: ['Planned', 'Saving', 'Purchased'] },
    },
  }

  const rules = validations[sheetName]
  if (!rules) return

  Object.values(rules).forEach(({ col, values }) => {
    const colIndex = headers.indexOf(col)
    if (colIndex === -1) return
    const range = sheet.getRange(2, colIndex + 1, maxRows, 1)
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(true)
      .build()
    range.setDataValidation(rule)
  })
}

// ── Column Formats ────────────────────────────────────────────────────────

function applyColumnFormats(sheet, sheetName, headers) {
  const maxRows = 500

  // Date columns → date format
  const dateCols = headers.reduce((acc, h, i) => {
    if (h.includes('date') || h === 'listing_date') acc.push(i + 1)
    return acc
  }, [])
  dateCols.forEach(col => {
    sheet.getRange(2, col, maxRows, 1)
      .setNumberFormat('yyyy-mm-dd')
  })

  // Amount / balance / price columns → number format with 2 dp
  const amountCols = headers.reduce((acc, h, i) => {
    if (['amount','balance','initial_balance','goal_amount','planned_amount',
         'apply_amount','refund_amount','sell_price','brokerage_fee','net_profit',
         'estimated_price'].includes(h)) acc.push(i + 1)
    return acc
  }, [])
  amountCols.forEach(col => {
    sheet.getRange(2, col, maxRows, 1)
      .setNumberFormat('#,##0.00')
  })

  // Boolean columns → checkbox
  const boolCols = headers.reduce((acc, h, i) => {
    if (h.includes('is_') || h === 'is_cc_transaction') acc.push(i + 1)
    return acc
  }, [])
  boolCols.forEach(col => {
    sheet.getRange(2, col, maxRows, 1)
      .insertCheckboxes()
  })
}

// ── Summary Dialog ────────────────────────────────────────────────────────

function showSummaryDialog(ss, results, elapsed) {
  const sheetUrl = ss.getUrl()

  const rows = results.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-family:monospace;font-size:13px;color:#1a73e8">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-size:13px;color:${r.isNew ? '#0f9d58' : '#f4b400'}">
        ${r.isNew ? '✓ Created' : '↻ Updated'}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-size:13px;color:#5f6368">
        ${r.seededRows > 0 ? `${r.seededRows} rows seeded` : r.isNew ? '0 rows (new)' : 'Headers refreshed'}
      </td>
    </tr>
  `).join('')

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Google Sans', Arial, sans-serif; margin: 0; padding: 20px; color: #202124; }
      h2 { font-size: 18px; font-weight: 500; margin: 0 0 4px; }
      p  { font-size: 13px; color: #5f6368; margin: 0 0 20px; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #e8eaed; border-radius: 8px; overflow: hidden; }
      thead th { background: #f8f9fa; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #5f6368; border-bottom: 2px solid #e8eaed; }
      .footer { margin-top: 20px; padding: 12px 16px; background: #e8f5e9; border-radius: 8px; font-size: 13px; color: #1e8e3e; }
      .next-steps { margin-top: 16px; }
      .next-steps p { font-size: 13px; color: #202124; font-weight: 500; margin-bottom: 8px; }
      .next-steps ol { margin: 0; padding-left: 20px; font-size: 13px; color: #5f6368; line-height: 1.8; }
      code { background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 4px; padding: 1px 6px; font-family: monospace; font-size: 12px; color: #d93025; }
    </style>

    <h2>✅ Tabung Tracker Setup Complete</h2>
    <p>Completed in ${elapsed}s · Spreadsheet: <strong>${ss.getName()}</strong></p>

    <table>
      <thead>
        <tr>
          <th>Sheet</th>
          <th>Status</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="next-steps">
      <p>Next steps:</p>
      <ol>
        <li>Copy this spreadsheet's ID from the URL bar</li>
        <li>Paste it into <code>Code.gs</code> → <code>const SHEET_ID = '...'</code></li>
        <li>Deploy the script as a Web App</li>
        <li>Paste the deployment URL into <code>.env.local</code> in your Vue project</li>
      </ol>
    </div>

    <div class="footer">
      🔗 Spreadsheet ID is in the URL: <strong>docs.google.com/spreadsheets/d/<span style="color:#d93025">THIS_PART</span>/edit</strong>
    </div>
  `)
    .setWidth(540)
    .setHeight(480)

  SpreadsheetApp.getUi().showModalDialog(html, 'Setup Complete 🎉')
}

// ── Utility: Re-run just formatting (safe to re-run anytime) ─────────────

function reformatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  for (const [sheetName, config] of Object.entries(SCHEMA)) {
    const sheet = ss.getSheetByName(sheetName)
    if (!sheet) continue
    const headers = config.columns.map(c => c.header)
    const headerRange = sheet.getRange(1, 1, 1, headers.length)
    headerRange
      .setBackground(config.color)
      .setFontColor('#ffffff')
      .setFontWeight('bold')
    Logger.log(`Reformatted: ${sheetName}`)
  }
  SpreadsheetApp.getUi().alert('All sheets reformatted.')
}

// ── Utility: Clear all seed data (keeps headers) ──────────────────────────

function clearAllSeedData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ui = SpreadsheetApp.getUi()

  const confirm = ui.alert(
    'Clear all data?',
    'This will delete all rows below the header in every sheet. Headers are kept. Continue?',
    ui.ButtonSet.YES_NO
  )
  if (confirm !== ui.Button.YES) return

  for (const sheetName of Object.keys(SCHEMA)) {
    const sheet = ss.getSheetByName(sheetName)
    if (!sheet || sheet.getLastRow() <= 1) continue
    sheet.deleteRows(2, sheet.getLastRow() - 1)
    Logger.log(`Cleared: ${sheetName}`)
  }
  ui.alert('All data cleared. Headers preserved.')
}

/**
 * Utility: Scans ALL transactions and recalculates balances for all accounts.
 * Use this if the dim_accounts sheet ever gets out of sync with the ledger.
 */
function syncAllAccountBalances() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    'Recalculate Balances?',
    'This will reset ALL account balances in dim_accounts based on the full transaction ledger. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const accounts = getAccounts();
  const transactions = getTransactions();

  // 1. Reset all current balances to initial_balance
  const balanceMap = {};
  accounts.forEach(acc => {
    balanceMap[acc.account_id] = Number(acc.initial_balance) || 0;
  });

  // 2. Process ledger
  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    if (tx.source_account_id && balanceMap[tx.source_account_id] !== undefined) {
      const delta = tx.category === 'Transfer' ? -Math.abs(amount) : amount;
      balanceMap[tx.source_account_id] += delta;
    }
    if (tx.destination_account_id && balanceMap[tx.destination_account_id] !== undefined) {
      balanceMap[tx.destination_account_id] += Math.abs(amount);
    }
  });

  // 3. Write back to sheet
  Object.keys(balanceMap).forEach(id => {
    upsertAccount({
      account_id: id,
      balance: balanceMap[id]
    });
  });

  ui.alert('Account balances successfully recalculated from ledger.');
}

// ── Menu: Add custom menu to Sheet UI ─────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🪙 Tabung Tracker')
    .addItem('▶ Run Setup',               'setupTabungTracker')
    .addSeparator()
    .addItem('↻ Reformat Headers',        'reformatAllSheets')
    .addItem('⚖ Recalculate Account Balances', 'syncAllAccountBalances')
    .addItem('🗑 Clear All Data (keep headers)', 'clearAllSeedData')
    .addToUi()
}
