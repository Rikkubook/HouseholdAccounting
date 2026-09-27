import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
  {
    path: "/reset-password",
    name: "reset-password",
    component: () => import("@/views/ResetPasswordView.vue"),
    meta: { public: true },
  },
  { path: "/", name: "dashboard", component: () => import("@/views/DashboardView.vue") },
  {
    path: "/transactions/new",
    name: "transaction-create",
    component: () => import("@/views/TransactionCreateView.vue"),
  },
  { path: "/transactions", name: "transactions", component: () => import("@/views/TransactionListView.vue") },
  { path: "/stats", name: "stats", component: () => import("@/views/StatsView.vue") },
  { path: "/year", name: "year-summary", component: () => import("@/views/YearSummaryView.vue") },
  { path: "/budget", name: "budget", component: () => import("@/views/BudgetView.vue"), meta: { admin: true } },
  {
    path: "/subscriptions",
    name: "subscriptions",
    component: () => import("@/views/SubscriptionsView.vue"),
    meta: { admin: true },
  },
  { path: "/members", name: "members", component: () => import("@/views/MembersView.vue"), meta: { admin: true } },
  {
    path: "/categories",
    name: "categories",
    component: () => import("@/views/CategoriesView.vue"),
    meta: { admin: true },
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.public) return true;
  if (!auth.isAuthenticated) {
    await auth.restore();
    if (!auth.isAuthenticated) return { name: "login" };
  }
  // ADMIN 頁面一般成員不可進入（側欄也不顯示）
  if (to.meta.admin && !auth.isAdmin) return { name: "dashboard" };
  return true;
});
