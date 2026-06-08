import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './assets/main.css'

// Views
import Dashboard from './views/Dashboard.vue'
import Ledger from './views/Ledger.vue'
import SalaryCycle from './views/SalaryCycle.vue'
import VirtualTabung from './views/VirtualTabung.vue'
import CCBridge from './views/CCBridge.vue'
import IpoTracker from './views/IpoTracker.vue'
import PartnerView from './views/PartnerView.vue'
import Reconciliation from './views/Reconciliation.vue'

const routes = [
  { 
    path: '/', 
    redirect: () => {
      const pref = localStorage.getItem('tabung_device_mode')
      if (pref === 'Phone') return '/phone'
      if (pref === 'PC') return '/dashboard'
      return '/welcome'
    }
  },
  { path: '/welcome', component: () => import('./views/WelcomeGateway.vue'), meta: { label: 'Welcome' } },
  { path: '/phone', component: () => import('./views/PhoneDashboard.vue'), meta: { label: 'Phone' } },
  { path: '/dashboard', component: Dashboard, meta: { label: 'Dashboard' } },
  { path: '/ledger', component: Ledger, meta: { label: 'Ledger' } },
  { path: '/salary', component: SalaryCycle, meta: { label: 'Salary Cycle' } },
  { path: '/tabung', component: VirtualTabung, meta: { label: 'Virtual Tabung' } },
  { path: '/cc', component: CCBridge, meta: { label: 'CC Bridge' } },
  { path: '/ipo', component: IpoTracker, meta: { label: 'IPO Tracker' } },
  { path: '/bursa', component: () => import('./views/BursaTracker.vue'), meta: { label: 'Bursa Tracker' } },
  { path: '/house-fund', component: () => import('./views/HouseFund.vue'), meta: { label: 'House Fund' } },
  { path: '/partner', component: PartnerView, meta: { label: 'Partner View' } },
  { path: '/recon', component: Reconciliation, meta: { label: 'Reconciliation' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
