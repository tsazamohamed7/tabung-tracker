#!/usr/bin/env node
/** Phase 1 dry-run-first importer. Input is a JSON object keyed by V1 sheet name. */
import { readFile, writeFile } from 'node:fs/promises'

const input = process.argv[process.argv.indexOf('--input') + 1]
const reportPath = process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : null
const apply = process.argv.includes('--apply')
if (!input) throw new Error('Usage: node scripts/migrate-google-sheets.mjs --input export.json [--report report.json] [--apply]')
if (apply && !process.argv.includes('--confirm-production-write')) throw new Error('--apply requires --confirm-production-write; dry-run is the default')
const data = JSON.parse(await readFile(input, 'utf8'))
const issues = []; const maps = { accounts: new Map(), salary_plans: new Map(), cycles: new Map(), cycle_budgets: new Map(), transactions: new Map(), cc_bridges: new Map() }
const rows = name => data[name] ?? []
const bool = (v, where) => v === true || v === false || ['true','false'].includes(String(v).toLowerCase()) ? String(v).toLowerCase() === 'true' : (issues.push({where, reason:'invalid_boolean', value:v}), null)
const money = (v, where) => { const n=Number(v); if (!Number.isFinite(n)) { issues.push({where,reason:'invalid_amount',value:v}); return null } return Math.round(n*100)/100 }
const date = (v, where) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v+'T00:00:00Z'))) { issues.push({where,reason:'invalid_date',value:v}); return null } return String(v) }
const legacy = (v, where, map) => { if (!v) return null; if (map.has(v)) issues.push({where,reason:'duplicate_legacy_id',value:v}); map.set(v,true); return v }
const stats = {}
function validate(name, fn) { const source=rows(name); const before=issues.length; source.forEach((r,i)=>fn(r, i)); stats[name]={source:source.length, invalid:issues.length-before}; stats[name].valid=stats[name].source-stats[name].invalid }
validate('dim_accounts',(r,i)=>{ legacy(r.account_id,'accounts['+i+']',maps.accounts); money(r.initial_balance??0,'accounts['+i+'].initial_balance'); money(r.balance??0,'accounts['+i+'].balance'); bool(r.is_active,'accounts['+i+'].is_active') })
validate('dim_salary_plans',(r,i)=>{ legacy(r.template_id,'salary_plans['+i+']',maps.salary_plans); money(r.planned_amount,'salary_plans['+i+'].planned_amount'); if(r.default_source_id&&!maps.accounts.has(r.default_source_id)) issues.push({where:'salary_plans['+i+']',reason:'unknown_account_reference',value:r.default_source_id}) })
validate('fact_cycle_budgets',(r,i)=>{ legacy(r.budget_id,'cycle_budgets['+i+']',maps.cycle_budgets); const code=String(r.cycle_id).slice(0,7); if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(code)) issues.push({where:'cycle_budgets['+i+']',reason:'invalid_cycle',value:r.cycle_id}); else maps.cycles.set(code,true); if(r.template_id&&!maps.salary_plans.has(r.template_id)) issues.push({where:'cycle_budgets['+i+']',reason:'unknown_salary_template_reference',value:r.template_id}) })
validate('fact_transactions',(r,i)=>{ legacy(r.transaction_id,'transactions['+i+']',maps.transactions); date(r.date,'transactions['+i+'].date'); money(r.amount,'transactions['+i+'].amount'); const code=String(r.cycle_id??'').slice(0,7); if(code&&!maps.cycles.has(code)) issues.push({where:'transactions['+i+']',reason:'unknown_cycle_reference',value:r.cycle_id}); for(const k of ['source_account_id','destination_account_id']) if(r[k]&&!maps.accounts.has(r[k])) issues.push({where:'transactions['+i+']',reason:'unknown_account_reference',value:r[k]}); if(r.envelope_id&&!maps.salary_plans.has(r.envelope_id)) issues.push({where:'transactions['+i+']',reason:'unknown_salary_template_reference',value:r.envelope_id}); bool(r.is_cc_transaction,'transactions['+i+'].is_cc_transaction') })
validate('fact_cc_bridge',(r,i)=>{ legacy(r.bridge_id,'cc_bridges['+i+']',maps.cc_bridges); if(!maps.transactions.has(r.transaction_id)) issues.push({where:'cc_bridges['+i+']',reason:'unknown_transaction_reference',value:r.transaction_id}); if(r.funding_source_id&&!maps.accounts.has(r.funding_source_id)) issues.push({where:'cc_bridges['+i+']',reason:'unknown_account_reference',value:r.funding_source_id}); money(r.amount,'cc_bridges['+i+'].amount') })
for (const n of ['fact_ipo_tracker','fact_bursa_tracker','dim_wishlist','fact_house_fund','app_settings']) stats[n]={source:rows(n).length,valid:rows(n).length,invalid:0}
const report={mode:apply?'apply-blocked-until-implemented':'dry-run',stats,issues,notes:['No Supabase writes occur in dry-run.','Cycle values are normalized to YYYY-MM; start/end dates require migration configuration.']}
if(reportPath) await writeFile(reportPath,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
