<template>
  <div>
    <PageHeader :title="`Salary Cycle · ${appStore.currentCycle.id}`" :sub="appStore.currentCycle.label">
      <template #action>
        <div class="flex gap-2">
          <button class="btn-ghost" @click="showCloseModal = true" :disabled="!canClose">
            ✕ Close Cycle
          </button>
          <button class="btn-primary" @click="showStartModal = true">▶ Start New Cycle</button>
        </div>
      </template>
    </PageHeader>

    <!-- Rollover alert -->
    <div v-if="unseenRollovers.length"
         class="bg-status-warn/[0.08] border border-status-warn/20 rounded-lg px-4 py-3
                flex items-center gap-2.5 text-sm text-status-warn mb-5">
      <span>⚠</span>
      <span class="flex-1">
        Previous cycle has <strong>{{ unseenRollovers.length }} envelope(s)</strong>
        with RM {{ totalRollover.toLocaleString() }} leftover — close it to sweep.
      </span>
      <button class="btn-ghost text-xs py-1 px-3 ml-auto text-status-warn border-status-warn/30"
              @click="showCloseModal = true">Close Cycle</button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-0 border-b border-border mb-5">
      <button v-for="tab in tabs" :key="tab.id"
              class="px-5 py-2.5 text-sm transition-colors border-b-2 -mb-px"
              :class="activeTab === tab.id
                ? 'text-ink border-accent font-medium'
                : 'text-ink-muted border-transparent hover:text-ink'"
              @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </div>

    <!-- ── TAB: PLAN ── -->
    <div v-if="activeTab === 'plan'">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <div class="section-label">Envelope Allocations — {{ appStore.currentCycle.id }}</div>
      <div class="card p-0 overflow-hidden">
        <div class="p-4 border-b border-border bg-bg-surface/50">
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[11px] text-ink-muted uppercase tracking-wider mb-0.5">Cycle Income</div>
              <div class="font-mono text-xl text-ink">RM {{ cycleIncome.toLocaleString() }}</div>
            </div>
            <div class="text-right">
              <div class="text-[11px] text-ink-muted uppercase tracking-wider mb-0.5">Unallocated</div>
              <div class="font-mono text-xl"
                   :class="salStore.unallocated < 0 ? 'text-status-danger'
                         : salStore.unallocated === 0 ? 'text-status-success'
                         : 'text-accent'">
                {{ salStore.unallocated < 0 ? '-' : '' }}RM {{ Math.abs(salStore.unallocated).toLocaleString() }}
              </div>
            </div>
          </div>

          <div v-if="salStore.unallocated < 0"
               class="text-[11px] text-status-danger bg-status-danger/10 rounded px-2.5 py-1.5 mt-3">
            Over-allocated by RM {{ Math.abs(salStore.unallocated).toLocaleString() }} — reduce another envelope.
          </div>
        </div>

        <template v-if="salStore.loading.cycleBudgets">
          <div v-for="i in 5" :key="i" class="p-4 border-b border-border animate-pulse flex justify-between">
            <div class="h-4 w-32 bg-bg-surface3 rounded"></div>
            <div class="h-4 w-20 bg-bg-surface3 rounded"></div>
          </div>
        </template>

        <div v-else-if="!salStore.activeCycleBudgets.length"
             class="py-12 text-center text-sm text-ink-muted">
          No plan yet.
          <button class="text-accent hover:underline ml-1" @click="showStartModal = true">
            Start a new cycle.
          </button>
        </div>

        <template v-else>
          <div v-for="group in salStore.cycleBudgetsWithSpent" :key="group.category" 
               class="border-b border-border last:border-0">
            <button @click="toggleExpanded(group.category)"
                    class="w-full flex items-center justify-between p-4 hover:bg-bg-surface2 transition-colors group">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full" :style="{ background: group.color }"></div>
                <span class="text-[13px] font-medium text-ink uppercase tracking-wide">{{ group.category }}</span>
                <span class="text-[11px] text-ink-muted">({{ group.envelopes.length }} items)</span>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <div class="font-mono text-[13px] text-ink">RM {{ group.planned.toLocaleString() }}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" 
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                     class="text-ink-muted group-hover:text-ink transition-transform duration-200"
                     :class="{ 'rotate-180': expandedId === group.category }">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </button>

            <div v-if="expandedId === group.category" class="bg-bg-surface1/30 px-4 pb-2">
              <div v-for="budget in group.envelopes" :key="budget.id" 
                   class="py-3 border-t border-border/50 first:border-0 relative group/env">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0 flex items-center gap-2">
                    <div>
                      <div class="text-[13px] text-ink truncate">{{ budget.name }}</div>
                      <div class="text-[10px] text-ink-muted">{{ accStore.getAccountLabel(budget.sourceId) }}</div>
                    </div>
                    <!-- Actions -->
                    <div v-if="!budget.isLocked" class="opacity-0 group-hover/env:opacity-100 flex items-center gap-1 transition-opacity">
                      <button @click.stop="openManageEnvelope(budget)" class="p-1 text-ink-muted hover:text-accent rounded hover:bg-bg-surface3" title="Edit">✎</button>
                      <button @click.stop="handleDeleteEnvelope(budget)" class="p-1 text-ink-muted hover:text-status-danger rounded hover:bg-bg-surface3" title="Delete">✕</button>
                    </div>
                  </div>
                  
                  <div class="shrink-0">
                    <div v-if="budget.isLocked" class="font-mono text-[13px] text-ink-muted">
                      RM {{ budget.planned.toLocaleString() }}
                      <span class="badge badge-gray text-[9px] ml-1">Locked</span>
                    </div>
                    <div v-else class="flex items-center gap-1.5">
                      <span class="text-[11px] text-ink-muted">RM</span>
                      <input :value="budget.planned" type="number" min="0"
                             class="w-24 bg-bg-surface border border-border-strong rounded px-2 py-1
                                    font-mono text-[13px] text-right text-ink
                                    focus:outline-none focus:border-accent/50 transition-colors"
                             @change="onAllocationChange(budget, $event)"
                             @focus="$event.target.select()" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 flex justify-center border-b border-border bg-bg-surface1/30">
            <button class="btn-ghost text-xs py-1.5" @click="openManageEnvelope()">+ Add Envelope</button>
          </div>

          <div class="p-4 bg-bg-surface2/50 flex justify-between items-center">
            <span class="text-[12px] text-ink-muted">Total Allocated</span>
            <span class="font-mono text-[13px]"
                  :class="salStore.unallocated < 0 ? 'text-status-danger' : 'text-ink'">
              RM {{ salStore.totalAllocated.toLocaleString() }}
              <span class="text-[11px] text-ink-muted ml-1">/ RM {{ cycleIncome.toLocaleString() }}</span>
            </span>
          </div>
        </template>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <div class="section-label">Allocation Breakdown</div>
      <div class="card flex flex-col items-center gap-5">

        <!-- Loading skeleton -->
        <template v-if="salStore.loading.cycleBudgets">
          <div class="w-52 h-52 rounded-full bg-bg-surface3 animate-pulse"></div>
          <div class="w-full space-y-2">
            <div v-for="i in 4" :key="i" class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-bg-surface3"></div>
              <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
              <div class="h-2.5 w-16 bg-bg-surface3 rounded"></div>
            </div>
          </div>
        </template>

        <!-- Empty -->
        <div v-else-if="!salStore.activeCycleBudgets.length"
             class="py-12 text-center text-sm text-ink-muted w-full">
          No allocations yet.
        </div>

        <!-- Chart -->
        <template v-else>
          <!-- Donut SVG -->
          <div class="relative w-52 h-52">
            <svg viewBox="0 0 200 200" class="w-full h-full -rotate-90">
              <!-- Background circle -->
              <circle cx="100" cy="100" r="70" fill="none"
                      stroke="var(--color-bg-surface3, #1e1e1e)" stroke-width="36" />
              <!-- Slices -->
              <circle v-for="(slice, i) in pieSlices" :key="i"
                      cx="100" cy="100" r="70"
                      fill="none"
                      :stroke="slice.color"
                      stroke-width="36"
                      :stroke-dasharray="`${slice.dash} ${slice.gap}`"
                      :stroke-dashoffset="-slice.offset"
                      stroke-linecap="butt" />
            </svg>
            <!-- Centre label -->
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <div class="text-[11px] text-ink-muted uppercase tracking-wider">Allocated</div>
              <div class="font-mono text-lg text-ink">RM {{ salStore.totalAllocated.toLocaleString() }}</div>
              <div class="text-[10px]" :class="salStore.unallocated < 0 ? 'text-status-danger' : 'text-ink-muted'">
                {{ salStore.unallocated < 0 ? 'Over by RM ' + Math.abs(salStore.unallocated).toLocaleString() : salStore.unallocated === 0 ? '100% full' : 'RM ' + salStore.unallocated.toLocaleString() + ' free' }}
              </div>
            </div>
          </div>

          <!-- Legend -->
          <div class="w-full flex flex-col gap-2">
            <div v-for="(slice, i) in pieSlices" :key="i"
                 class="flex items-center gap-2.5">
              <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: slice.color }"></div>
              <span class="text-[12px] text-ink flex-1 truncate">{{ slice.label }}</span>
              <span class="font-mono text-[12px] text-ink-muted shrink-0">RM {{ slice.amount.toLocaleString() }}</span>
              <span class="text-[11px] text-ink-faint shrink-0 w-9 text-right">{{ slice.pct }}%</span>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</div>

    <!-- ── TAB: PROGRESS ── -->
    <div v-if="activeTab === 'progress'">
  <div class="grid grid-cols-4 gap-3.5 mb-5">
    <StatCard label="Cycle Income" :value="`RM ${cycleIncome.toLocaleString()}`" variant="accent" />
    <StatCard label="Total Spent" :value="`RM ${totalSpent.toLocaleString()}`"
              :variant="totalSpent > cycleIncome ? 'danger' : 'warn'" />
    <StatCard label="Remaining" :value="`RM ${Math.max(0, cycleIncome - totalSpent).toLocaleString()}`" variant="success" />
    <StatCard label="Cycle Progress"
              :value="`${Math.round(appStore.currentCycle.day / appStore.currentCycle.totalDays * 100)}%`"
              :sub="`Day ${appStore.currentCycle.day} of ${appStore.currentCycle.totalDays}`" />
  </div>

  <div class="mb-5">
    <ProgressBar :value="appStore.currentCycle.day" :max="appStore.currentCycle.totalDays"
                 color="rgba(197,241,53,0.4)" :height="4" />
    <div class="flex justify-between text-[11px] text-ink-muted mt-1.5">
      <span>Day {{ appStore.currentCycle.day }}</span>
      <span>{{ appStore.currentCycle.totalDays - appStore.currentCycle.day }} days remaining</span>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4">

    <!-- Left: Spending vs Plan with inline Envelope Breakdown -->
    <div>
      <div class="section-label">Spending vs Plan — click category for details</div>

      <template v-if="salStore.loading.cycleBudgets || txStore.loading">
        <div class="card">
          <div v-for="i in 6" :key="i" class="py-3 border-t border-border animate-pulse first:border-0">
            <div class="flex justify-between mb-2">
              <div class="h-2.5 w-28 bg-bg-surface3 rounded"></div>
              <div class="h-2.5 w-32 bg-bg-surface3 rounded"></div>
            </div>
            <div class="h-2 bg-bg-surface3 rounded"></div>
          </div>
        </div>
      </template>

      <template v-else-if="!salStore.cycleBudgetsWithSpent.length">
        <div class="card text-center py-8 text-sm text-ink-muted">
          No cycle plan found.
          <button class="text-accent hover:underline ml-1" @click="showStartModal = true">Start a new cycle.</button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col gap-2.5">
          <div v-for="group in salStore.cycleBudgetsWithSpent" :key="group.category"
               class="card overflow-hidden transition-all duration-200">

            <button class="w-full text-left" @click="toggleExpanded(group.category)">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-3 h-3 rounded-full shrink-0" :style="{ background: group.color }"></div>
                  <div class="min-w-0">
                    <div class="text-[14px] font-bold text-ink uppercase tracking-wider">{{ group.category }}</div>
                    <div class="text-[11px] text-ink-muted">{{ group.envelopes.length }} items</div>
                  </div>
                </div>

                <div class="flex items-center gap-3 shrink-0">
                  <div class="text-right">
                    <div class="text-[13px]">
                      <span class="font-mono text-ink">RM {{ group.spent.toLocaleString() }}</span>
                      <span class="text-ink-muted text-[11px] ml-1">/ RM {{ group.planned.toLocaleString() }}</span>
                    </div>
                    <div class="flex items-center justify-end gap-1.5 mt-0.5">
                      <span class="badge text-[10px]"
                            :class="group.pct >= 100 ? 'badge-red' : group.pct >= 80 ? 'badge-yellow' : 'badge-green'">
                        {{ group.pct }}%
                      </span>
                    </div>
                  </div>
                  <div class="text-ink-muted transition-transform duration-200"
                       :class="expandedId === group.category ? 'rotate-180' : ''">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <ProgressBar
                :value="group.spent"
                :max="group.planned"
                :color="group.pct >= 100 ? '#f07070' : group.pct >= 80 ? '#f5b560' : group.color"
                :height="6"
                class="mt-3"
              />
            </button>

            <Transition name="expand">
              <div v-if="expandedId === group.category" class="mt-4 pt-4 border-t border-border">
                <div class="text-[11px] font-bold text-ink-muted uppercase mb-2">Envelope Breakdown</div>
                <div class="grid grid-cols-1 gap-2">
                  <div v-for="env in group.envelopes" :key="env.id"
                       class="flex justify-between items-center bg-bg-surface2 px-3 py-2 rounded-lg">
                    <div class="text-[13px] text-ink">{{ env.name }}</div>
                    <div class="text-right">
                      <div class="text-[12px] font-mono">RM {{ env.spent.toLocaleString() }} / {{ env.planned.toLocaleString() }}</div>
                      <div class="text-[10px]" :class="env.remaining >= 0 ? 'text-status-success' : 'text-status-danger'">
                        {{ env.remaining >= 0 ? 'RM ' + env.remaining.toLocaleString() + ' left' : 'RM ' + Math.abs(env.remaining).toLocaleString() + ' over' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </template>
    </div>

    <!-- Right: Transactions for selected category -->
    <div>
      <div class="section-label">Transactions</div>
      <div class="card min-h-[300px]">
        <template v-if="expandedGroup">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: expandedGroup.color }"></div>
            <span class="text-[13px] font-bold text-ink uppercase tracking-wider">{{ expandedGroup.category }}</span>
          </div>

          <div v-if="!categoryTxs(expandedGroup.category).length"
               class="text-[12px] text-ink-muted text-center py-4 bg-bg-surface2 rounded-lg">
            No transactions for {{ expandedGroup.category }} yet.
          </div>

          <div v-else class="flex flex-col gap-0 rounded-lg overflow-hidden border border-border">
            <div v-for="(tx, i) in categoryTxs(expandedGroup.category)" :key="tx.id"
                 class="flex items-center gap-3 px-3 py-2.5 text-[12.5px]"
                 :class="i % 2 === 0 ? 'bg-bg-surface2' : 'bg-bg-surface'">
              <div class="text-ink-muted shrink-0 w-14 text-[11px]">{{ formatDate(tx.date) }}</div>
              <div class="flex-1 min-w-0 flex items-center gap-1.5">
                <span class="truncate text-ink">{{ tx.description }}</span>
                <span v-if="tx.isCc || tx.destId?.toLowerCase().includes('cc')" 
                  class="badge badge-red text-[9px] shrink-0">CC</span>
              </div>
              <div class="font-mono text-[12.5px] shrink-0"
                   :class="(tx.amount < 0 || tx.destId) ? 'text-status-danger' : 'text-status-success'">
                {{ (tx.amount < 0 || tx.destId) ? '' : '+' }}RM {{ Math.abs(tx.amount).toLocaleString() }}
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2 bg-bg-surface3 border-t border-border">
              <span class="text-[11px] text-ink-muted">Total category spend</span>
              <span class="font-mono text-[12.5px] text-status-danger">RM {{ expandedGroup.spent.toLocaleString() }}</span>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex flex-col items-center justify-center h-full py-16 text-center">
            <div class="text-2xl mb-3 opacity-40">←</div>
            <div class="text-sm text-ink-muted">Select a category<br>to see its transactions</div>
          </div>
        </template>
      </div>
    </div>

  </div>
</div>

    <!-- ── TAB: HISTORY ── -->
    <div v-if="activeTab === 'history'">
      <div class="section-label">Cycle History <span class="text-ink-faint font-normal normal-case">(from transactions)</span></div>

      <template v-if="txStore.loading">
        <div class="card animate-pulse space-y-3 p-5">
          <div v-for="i in 4" :key="i" class="flex gap-3">
            <div class="h-2.5 w-20 bg-bg-surface3 rounded"></div>
            <div class="h-2.5 flex-1 bg-bg-surface3 rounded"></div>
            <div class="h-2.5 w-16 bg-bg-surface3 rounded"></div>
          </div>
        </div>
      </template>
      <div v-else-if="!salStore.cycleHistory.length" class="card text-center py-8 text-sm text-ink-muted">
        No cycle data yet.
      </div>
      <template v-else>
        <div class="card p-0 overflow-hidden mb-5">
          <table class="table-base">
            <thead>
              <tr><th>Cycle</th><th>Income</th><th>Spent</th><th>Saved</th><th>Rate</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="h in salStore.cycleHistory" :key="h.cycleId"
                  :class="h.isActive ? 'bg-accent/[0.03]' : ''">
                <td>
                  <span class="font-mono text-xs">{{ h.cycleId }}</span>
                  <span class="text-ink-muted text-xs ml-2">{{ h.label }}</span>
                </td>
                <td class="amount-pos">RM {{ h.income.toLocaleString() }}</td>
                <td class="amount-neg">RM {{ h.spent.toLocaleString() }}</td>
                <td :class="h.saved >= 0 ? 'amount-pos' : 'amount-neg'">
                  {{ h.saved >= 0 ? '+' : '' }}RM {{ h.saved.toLocaleString() }}
                </td>
                <td>
                  <span class="font-mono text-xs"
                        :class="h.income > 0 && (h.saved/h.income) >= 0.2 ? 'text-status-success' : 'text-status-warn'">
                    {{ h.income > 0 ? Math.round((h.saved / h.income) * 100) + '%' : '—' }}
                  </span>
                </td>
                <td>
                  <span class="badge text-[11px]" :class="h.isActive ? 'badge-accent' : 'badge-gray'">
                    {{ h.isActive ? 'Active' : 'Closed' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- ── MODAL: MANAGE ENVELOPE ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showManageModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4"
             @click.self="closeManageEnvelope">
          <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>
          <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 class="font-display text-lg">{{ manageForm.id ? 'Edit Envelope' : 'Add Envelope' }}</h2>
              <button class="text-ink-muted hover:text-ink text-lg" @click="closeManageEnvelope">✕</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Envelope Name</label>
                <input v-model="manageForm.name" type="text" placeholder="e.g. Groceries" class="input-field" />
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Category</label>
                <select v-model="manageForm.category" class="select-field">
                  <option value="">— Select Category —</option>
                  <option v-for="cat in SALARY_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Planned Amount (RM)</label>
                <input v-model.number="manageForm.planned" type="number" min="0" placeholder="0" class="input-field font-mono" />
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Source Fund</label>
                <select v-model="manageForm.sourceId" class="select-field">
                  <option value="">— Select Fund —</option>
                  <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                    {{ a.bank }} · {{ a.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="flex gap-2 px-5 pb-5">
              <button class="btn-ghost flex-1 justify-center" @click="closeManageEnvelope">Cancel</button>
              <button class="btn-primary flex-1 justify-center" :disabled="savingEnvelope" @click="handleSaveEnvelope">
                {{ savingEnvelope ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── MODAL: START CYCLE ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showStartModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4"
             @click.self="showStartModal = false">
          <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>
          <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 class="font-display text-lg">Start New Cycle</h2>
              <button class="text-ink-muted hover:text-ink text-lg" @click="showStartModal = false">✕</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div class="bg-bg-surface2 rounded-lg p-3 text-[12px] text-ink-muted">
                Creates envelopes from your template. Edit allocations after.
              </div>
              <div class="bg-accent/10 border border-accent/20 rounded-lg p-3 text-[12px] text-accent">
                Cycle Identifier: <span class="font-mono font-bold">{{ startForm.startDate }}</span>
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Income Amount (RM)</label>
                <input v-model.number="startForm.income" type="number" placeholder="9800" class="input-field font-mono" />
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Start Date</label>
                <input v-model="startForm.startDate" type="date" class="input-field font-mono" />
              </div>
              <div>
                <label class="text-[11px] text-ink-muted uppercase tracking-wider block mb-1.5">Income Fund</label>
                <select v-model="startForm.sourceId" class="select-field">
                  <option value="">— Select fund —</option>
                  <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                    {{ a.bank }} · {{ a.label }}
                  </option>
                </select>
              </div>
              <div class="bg-bg-surface2 rounded-lg p-3">
                <div class="text-[11px] text-ink-muted mb-2">Envelopes to create ({{ salStore.envelopes.length }}):</div>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="env in salStore.envelopes" :key="env.id" class="badge badge-gray text-[10px]">
                    {{ env.name }} · RM {{ env.planned }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex gap-2 px-5 pb-5">
              <button class="btn-ghost flex-1 justify-center" @click="showStartModal = false">Cancel</button>
              <button class="btn-primary flex-1 justify-center" :disabled="startingCycle" @click="handleStartCycle">
                {{ startingCycle ? 'Starting…' : '▶ Start Cycle' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── MODAL: CLOSE CYCLE ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCloseModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4"
             @click.self="showCloseModal = false">
          <div class="absolute inset-0 bg-bg/70 backdrop-blur-sm"></div>
          <div class="relative bg-bg-surface border border-border-strong rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div class="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 class="font-display text-lg">Close Cycle — {{ appStore.currentCycle.id }}</h2>
              <button class="text-ink-muted hover:text-ink text-lg" @click="showCloseModal = false">✕</button>
            </div>

            <div class="p-5 overflow-y-auto flex-1">
              <div class="text-[12px] text-ink-muted mb-4">
                Choose what to do with each envelope's leftover. Sweep amounts will transfer to the chosen fund.
              </div>

              <div v-for="(row, i) in closeDecisions" :key="row.budgetId"
                   class="py-3 border-t border-border" :class="{ 'border-t-0': i === 0 }">
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full shrink-0" :style="{ background: row.color }"></div>
                    <div>
                      <div class="text-[13px] text-ink">{{ row.name }}</div>
                      <div class="text-[11px] text-ink-muted">
                        Planned RM {{ row.planned.toLocaleString() }} · Spent RM {{ row.spent.toLocaleString() }}
                      </div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="font-mono text-sm"
                         :class="row.leftover > 0 ? 'text-status-success' : row.leftover < 0 ? 'text-status-danger' : 'text-ink-muted'">
                      {{ row.leftover > 0 ? '+' : '' }}RM {{ row.leftover.toLocaleString() }}
                    </div>
                    <div class="text-[10px] text-ink-muted">leftover</div>
                  </div>
                </div>

                <div v-if="row.leftover < 0" class="text-[11px] text-status-danger bg-status-danger/10 rounded px-2.5 py-1.5">
                  Over budget — nothing to sweep.
                </div>
                <div v-else-if="row.leftover === 0" class="text-[11px] text-ink-muted">Fully spent.</div>
                <div v-else class="flex gap-2 flex-wrap items-center">
                  <div class="flex rounded-lg overflow-hidden border border-border-strong text-[11px]">
                    <button class="px-3 py-1.5 transition-colors"
                            :class="row.action === 'keep' ? 'bg-accent text-bg font-medium' : 'bg-bg-surface3 text-ink-muted hover:text-ink'"
                            @click="row.action = 'keep'; row.destId = ''">Keep</button>
                    <button class="px-3 py-1.5 transition-colors"
                            :class="row.action === 'sweep' ? 'bg-accent text-bg font-medium' : 'bg-bg-surface3 text-ink-muted hover:text-ink'"
                            @click="row.action = 'sweep'">Sweep →</button>
                  </div>
                  <select v-if="row.action === 'sweep'" v-model="row.destId"
                          class="select-field flex-1 text-xs py-1.5">
                    <option value="">— Choose destination —</option>
                    <option v-for="a in accStore.virtualAccounts" :key="a.id" :value="a.id">
                      {{ a.label }} ({{ a.bank }})
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="px-5 py-4 border-t border-border shrink-0 bg-bg-surface2">
              <div class="flex justify-between text-xs text-ink-muted mb-3">
                <span>Sweeping: RM {{ totalSweepAmount.toLocaleString() }} ({{ sweepCount }} envelope(s))</span>
                <span>Keeping: RM {{ totalKeepAmount.toLocaleString() }}</span>
              </div>
              <div v-if="closeError" class="text-xs text-status-danger mb-2">{{ closeError }}</div>
              <div class="flex gap-2">
                <button class="btn-ghost flex-1 justify-center" @click="showCloseModal = false">Cancel</button>
                <button class="btn-primary flex-1 justify-center"
                        :disabled="closingCycle || !closeDecisionsValid" @click="handleCloseCycle">
                  {{ closingCycle ? 'Closing…' : 'Confirm & Close Cycle' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore }                     from '@/stores/app'
import { useAccountStore }                 from '@/stores/accounts'
import { useTransactionStore }             from '@/stores/transactions'
import { useSalaryStore, SALARY_CATEGORIES } from '@/stores/salary'
import { useToast }                        from '@/composables/useToast'
import PageHeader  from '@/components/PageHeader.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import StatCard    from '@/components/StatCard.vue'

const appStore = useAppStore()
const accStore = useAccountStore()
const txStore  = useTransactionStore()
const salStore = useSalaryStore()
const toast    = useToast()

const activeTab       = ref('plan')
const tabs = [{ id: 'plan', label: 'Plan' }, { id: 'progress', label: 'Progress' }, { id: 'history', label: 'History' }]

const showStartModal  = ref(false)
const showCloseModal  = ref(false)
const startingCycle   = ref(false)
const closingCycle    = ref(false)
const closeError      = ref('')

const startForm = ref({
  income:    null,
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 25).toISOString().slice(0, 10),
  sourceId:  '',
})

const showManageModal = ref(false)
const savingEnvelope  = ref(false)
const manageForm = ref({
  id: null,
  name: '',
  category: '',
  planned: 0,
  sourceId: '',
})

onMounted(() => {
  accStore.fetchAccounts()
  txStore.fetchTransactions()
  salStore.fetchEnvelopes()
  salStore.fetchCycleBudgets()
})

// ── Computed ──────────────────────────────────────────────────────────────
const cycleIncome = computed(() =>
  txStore.getTransactionsForCycle(appStore.currentCycle.id)
    .filter(t => t.category === 'Income')
    .reduce((s, t) => s + t.amount, 0)
)

const totalSpent = computed(() =>
  salStore.cycleBudgetsWithSpent.reduce((s, b) => s + b.spent, 0)
)

const pieSlices = computed(() => {
  const total = Math.max(1, cycleIncome.value)
  let offset = 0
  const circ = 440 // 2 * PI * 70
  
  const slices = salStore.cycleBudgetsWithSpent.map(g => {
    const val = g.planned
    const pctFill = val / total
    const dash = pctFill * circ
    const gap = circ - dash
    const currentOffset = offset
    offset += dash
    
    return {
      label: g.category,
      color: g.color,
      amount: val,
      pct: Math.round(pctFill * 100),
      dash,
      gap,
      offset: currentOffset,
    }
  })

  if (salStore.unallocated > 0) {
    const val = salStore.unallocated
    const pctFill = val / total
    const dash = pctFill * circ
    const gap = circ - dash
    slices.push({
      label: 'Unallocated',
      color: '#333333',
      amount: val,
      pct: Math.round(pctFill * 100),
      dash,
      gap,
      offset,
    })
  }

  return slices
})

const canClose = computed(() =>
  salStore.activeCycleBudgets.length > 0 &&
  !salStore.activeCycleBudgets.every(b => b.isLocked)
)

const unseenRollovers = computed(() =>
  salStore.previousCycleRollovers.filter(r => r.leftover > 0 && !r.isLocked)
)

const totalRollover = computed(() =>
  unseenRollovers.value.reduce((s, r) => s + r.leftover, 0)
)

// ── Close modal decisions ─────────────────────────────────────────────────
const closeDecisions = ref([])

watch(showCloseModal, (open) => {
  if (!open) return
  closeError.value = ''
  closeDecisions.value = salStore.cycleBudgetsWithSpent.map(b => ({
    budgetId:  b.id,
    templateId:b.templateId,
    name:      b.name,
    category:  b.category,
    color:     b.color,
    planned:   b.planned,
    spent:     b.spent,
    leftover:  b.remaining,
    sourceId:  b.sourceId,
    action:    b.remaining > 0 ? 'keep' : 'none',
    destId:    '',
  }))
})

const sweepCount       = computed(() => closeDecisions.value.filter(r => r.action === 'sweep' && r.leftover > 0).length)
const totalSweepAmount = computed(() => closeDecisions.value.filter(r => r.action === 'sweep').reduce((s, r) => s + Math.max(0, r.leftover), 0))
const totalKeepAmount  = computed(() => closeDecisions.value.filter(r => r.action === 'keep').reduce((s, r) => s + Math.max(0, r.leftover), 0))
const closeDecisionsValid = computed(() =>
  closeDecisions.value.every(r =>
    r.leftover <= 0 || r.action === 'none' || r.action === 'keep' ||
    (r.action === 'sweep' && r.destId)
  )
)

// ── Progress tab: expand/collapse per envelope ────────────────────────────
const expandedId = ref(null)

const toggleExpanded = (budgetId) => {
  expandedId.value = expandedId.value === budgetId ? null : budgetId
}

const expandedGroup = computed(() =>
  salStore.cycleBudgetsWithSpent.find(g => g.category === expandedId.value) ?? null
)

/** All expense transactions for the active cycle filtered by category */
const categoryTxs = (category) =>
  txStore.getTransactionsForCycle(appStore.currentCycle.id)
    .filter(t => {
      // 1. Exclude Settled CC purchases to prevent double listing with their Funding transactions
      if (t.isCc && t.ccStatus === 'Settled') return false;

      // 2. Must match the category we are looking at
      const isSameCategory = t.category === category;

      // 3. Identify if it's a Salary-linked transaction
      const isFromSalary = t.sourceId?.toLowerCase().includes('salary');

      // 4. Keep standard expenses OR any transfer/payment leaving Salary
      const isExpense = t.amount < 0 || t.destId;

      return isSameCategory && (isExpense || isFromSalary);
    })
    .sort((a, b) => b.date.localeCompare(a.date))

/** Most recent transaction date for a category, formatted */
const latestTxDate = (category) => {
  const txs = categoryTxs(category)
  if (!txs.length) return null
  return formatDate(txs[0].date)
}

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
const isCurrent = (i) => {
  const firstUndone = salStore.paydayStepState.findIndex(s => !s.done)
  return firstUndone === i
}

// ── Allocation change ─────────────────────────────────────────────────────
const onAllocationChange = async (budget, event) => {
  const newValue = Number(event.target.value)
  if (isNaN(newValue) || newValue < 0) return
  try {
    await salStore.updateEnvelopeAllocation(budget.id, newValue)
  } catch {
    event.target.value = budget.planned
  }
}

// ── Start cycle ───────────────────────────────────────────────────────────
const handleStartCycle = async () => {
  if (!startForm.value.income || !startForm.value.sourceId) {
    toast.error('Fill in all fields'); return
  }
  startingCycle.value = true
  try {
    await salStore.startNewCycle({
      cycleId:   startForm.value.startDate, // Use date as ID
      income:    startForm.value.income,
      sourceId:  startForm.value.sourceId,
      startDate: startForm.value.startDate,
    })
    showStartModal.value = false
    startForm.value = { 
      income: null, 
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 25).toISOString().slice(0, 10), 
      sourceId: '' 
    }
  } finally {
    startingCycle.value = false
  }
}

// ── Close cycle ───────────────────────────────────────────────────────────
const handleCloseCycle = async () => {
  closeError.value = ''
  const missingDest = closeDecisions.value.find(r => r.action === 'sweep' && !r.destId && r.leftover > 0)
  if (missingDest) { closeError.value = `Choose a destination for "${missingDest.name}" sweep`; return }

  closingCycle.value = true
  try {
    await salStore.closeCycle({
      cycleId:   appStore.currentCycle.id,
      closeDate: new Date().toISOString().slice(0, 10),
      decisions: closeDecisions.value.map(r => ({
        budget_id:        r.budgetId,
        rollover_action:  r.leftover <= 0 ? 'overspent' : r.action,
        rollover_dest_id: r.destId || '',
        rollover_amount:  Math.max(0, r.leftover),
      })),
    })
    showCloseModal.value = false
  } catch (err) {
    closeError.value = err.message
  } finally {
    closingCycle.value = false
  }
}

// ── Manage Envelope ───────────────────────────────────────────────────────
const openManageEnvelope = (budget = null) => {
  if (budget) {
    manageForm.value = {
      id: budget.id,
      name: budget.name,
      category: budget.category,
      planned: budget.planned,
      sourceId: budget.sourceId,
    }
  } else {
    manageForm.value = {
      id: null,
      name: '',
      category: '',
      planned: 0,
      sourceId: '',
    }
  }
  showManageModal.value = true
}

const closeManageEnvelope = () => {
  showManageModal.value = false
}

const handleSaveEnvelope = async () => {
  if (!manageForm.value.name || !manageForm.value.category || !manageForm.value.sourceId) {
    toast.error('Fill in all fields')
    return
  }
  
  savingEnvelope.value = true
  try {
    if (manageForm.value.id) {
      await salStore.editCycleBudget(manageForm.value.id, manageForm.value)
    } else {
      await salStore.addCycleBudget(manageForm.value)
    }
    showManageModal.value = false
  } catch (err) {
    // error handled in store
  } finally {
    savingEnvelope.value = false
  }
}

const handleDeleteEnvelope = async (budget) => {
  if (!confirm(`Delete envelope "${budget.name}" from this cycle?`)) return
  try {
    await salStore.deleteCycleBudget(budget.id)
  } catch (err) {
    // error handled in store
  }
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* Envelope expand/collapse */
.expand-enter-active { transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.expand-leave-active { transition: all 0.18s ease-in; }
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>