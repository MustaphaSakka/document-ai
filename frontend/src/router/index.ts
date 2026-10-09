import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import DocumentDetailView from '../views/DocumentDetailView.vue';
import DocumentListView from '../views/DocumentListView.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'documents' } },
  { path: '/documents', name: 'documents', component: DocumentListView },
  {
    path: '/documents/:id',
    name: 'document-detail',
    component: DocumentDetailView,
    // Passes the route param as a typed prop instead of reading $route in the view.
    props: true,
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'documents' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
