import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/barangay-clearance' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue')
    },
    {
      path: '/barangay-clearance',
      name: 'barangay-clearance',
      component: () => import('@/views/BarangayClearance.vue')
    },
    {
      path: '/citizens',
      name: 'citizens',
      component: () => import('@/views/CitizenList.vue')
    },
    {
      path: '/certificate/:id',
      name: 'certificate',
      component: () => import('@/views/CertificatePreview.vue')
    },
    { path: '/blotter', name: 'blotter', component: () => import('@/views/Blotter.vue') },
    {
      path: '/blotter/new',
      name: 'blotter-new',
      component: () => import('@/views/BlotterReport.vue')
    },
    {
      path: '/blotter/:id/report',
      name: 'blotter-report',
      component: () => import('@/views/BlotterReport.vue')
    },
    {
      path: '/blotter/:id/mediate/new',
      name: 'blotter-mediation-new',
      component: () => import('@/views/BlotterMediation.vue')
    },
    {
      path: '/blotter/:id/mediate/:mid',
      name: 'blotter-mediation',
      component: () => import('@/views/BlotterMediation.vue')
    },
    {
      path: '/clearances',
      name: 'clearances',
      component: () => import('@/views/Clearances.vue')
    },
    { path: '/health', name: 'health', component: () => import('@/views/HealthSocial.vue') },
    {
      path: '/disaster',
      name: 'disaster',
      component: () => import('@/views/DisasterWatch.vue')
    },
    {
      path: '/sessions',
      name: 'sessions',
      component: () => import('@/views/SessionMinutes.vue')
    },
    { path: '/budget', name: 'budget', component: () => import('@/views/BudgetSK.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue') }
  ]
})
