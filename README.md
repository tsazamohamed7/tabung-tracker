# Tabung Tracker

Personal finance management app built with **Vue 3 + Pinia + Vue Router + Tailwind CSS**, backed by **Google Apps Script + Google Sheets**.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
tabung-tracker/
├── src/
│   ├── assets/
│   │   └── main.css          # Tailwind + global component classes
│   ├── components/
│   │   ├── StatCard.vue      # KPI number card
│   │   ├── ProgressBar.vue   # Reusable progress bar
│   │   ├── PageHeader.vue    # Page title + action slot
│   │   └── AlertStrip.vue    # Warning banner
│   ├── composables/
│   │   └── useApi.js         # GAS API wrapper
│   ├── stores/
│   │   └── finance.js        # Pinia store (all state + actions)
│   ├── views/
│   │   ├── Dashboard.vue     # Overview, bank balances, budget health
│   │   ├── Ledger.vue        # Unified transaction ledger
│   │   ├── SalaryCycle.vue   # Envelope budgeting, rollover manager
│   │   ├── VirtualTabung.vue # Fund-within-bank manager + goals
│   │   ├── CCBridge.vue      # CC reconciliation wizard
│   │   ├── IpoTracker.vue    # IPO lifecycle tracker
│   │   ├── PartnerView.vue   # Shared dashboard + wishlist
│   │   └── Reconciliation.vue# Bank balance sync tool
│   ├── App.vue               # Root layout with sidebar + router-view
│   └── main.js               # App bootstrap
├── gas/
│   └── Code.gs               # Google Apps Script backend
├── index.html
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Google Sheets Setup

### 1. Create a new Google Sheet

Give it any name (e.g. "Tabung Tracker DB"). Copy its ID from the URL:
`https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`

### 2. Create the following sheets (tabs)

| Sheet Name          | Purpose                        |
|---------------------|--------------------------------|
| `dim_accounts`      | Account & virtual fund registry|
| `fact_transactions` | Unified ledger                 |
| `dim_salary_plans`  | Budget envelope templates      |
| `fact_ipo_tracker`  | IPO lifecycle records          |
| `fact_cc_bridge`    | CC debt mapper                 |
| `dim_wishlist`      | Shared wishlist                |

The GAS backend will auto-create headers on first write.

### 3. Seed headers manually (recommended)

**dim_accounts:** `account_id | bank_name | label | type | physical_account_link | initial_balance | balance | is_active`

**fact_transactions:** `transaction_id | date | cycle_id | description | category | amount | source_account_id | destination_account_id | is_cc_transaction | cc_settlement_status | ref_id`

**dim_salary_plans:** `template_id | item_name | category | planned_amount | priority | default_source_id`

**fact_ipo_tracker:** `ipo_id | stock_name | status | apply_date | apply_amount | apply_source_id | allocated_units | refund_amount | listing_date | sell_price | net_profit`

**fact_cc_bridge:** `bridge_id | transaction_id | funding_source_id | settlement_date | status`

**dim_wishlist:** `item_id | item_name | emoji | estimated_price | target_fund_id | status | target_date`

---

## Google Apps Script Setup

### 1. Open Apps Script

From your Google Sheet: **Extensions → Apps Script**

### 2. Paste Code.gs

Copy the contents of `gas/Code.gs` into the editor. Update line 9:
```js
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'
```

### 3. Deploy as Web App

- Click **Deploy → New deployment**
- Type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone** *(or "Anyone with Google account" for security)*
- Copy the deployment URL

### 4. Configure the frontend

```bash
cp .env.example .env.local
# Edit .env.local and paste your GAS URL
```

```env
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

### 5. Connect the store to the API

In `src/stores/finance.js`, the store currently uses hardcoded seed data.  
To wire up live GAS data, add to any action:

```js
import { useApi } from '@/composables/useApi'

// Inside your store action:
const api = useApi()
const data = await api.getAccounts()
accounts.value = data
```

---

## Salary Cycle: 25th–24th

The salary cycle runs from the **25th of one month to the 24th of the next**. The `startNewCycle` GAS function handles this:

```js
await api.startNewCycle({
  cycle_id: '2025-07',
  income_amount: 9800,
  income_source_id: 'maybank-rolling',
  start_date: '2025-06-25'
})
```

This creates one income transaction + one allocation transaction per envelope in `dim_salary_plans`.

---

## Tech Stack

| Layer       | Technology                  |
|-------------|----------------------------|
| Frontend    | Vue 3 (Composition API)    |
| State       | Pinia                      |
| Routing     | Vue Router 4 (hash mode)   |
| Styling     | Tailwind CSS 3             |
| Build       | Vite 5                     |
| Backend     | Google Apps Script         |
| Database    | Google Sheets              |

---

## Roadmap / Next Steps

- [ ] Wire all views to live GAS API (replace seed data in store)
- [ ] Add transaction form modal (currently button placeholder)
- [ ] IPO application form
- [ ] Chart views (monthly spending trends, fund growth)
- [ ] Push notifications for CC bill due dates
- [ ] Export cycle report as PDF
- [ ] Mobile-responsive layout
