// Map of route path → dynamic import factory.
// Used to prefetch route chunks on hover/focus to make navigation feel instant.
const routeImports: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/planner": () => import("@/pages/Planner"),
  "/planner/cadernos": () => import("@/pages/NotebooksPage"),
  "/shared-environments": () => import("@/pages/SharedEnvironments"),
  "/subjects": () => import("@/pages/Subjects"),
  "/task-statuses": () => import("@/pages/TaskStatuses"),
  "/archived": () => import("@/pages/ArchivedTasks"),
  "/reports": () => import("@/pages/Reports"),
  "/ranking": () => import("@/pages/RankingPage"),
  "/settings": () => import("@/pages/Settings"),
  "/estudos/pomodoro": () => import("@/pages/PomodoroPage"),
  "/estudos/ciclo": () => import("@/pages/StudyCyclePage"),
  "/estudos/desempenho": () => import("@/pages/StudyAnalyticsPage"),
  "/admin": () => import("@/pages/admin/AdminDashboard"),
  "/admin/users": () => import("@/pages/AdminUsers"),
  "/admin/banners": () => import("@/pages/AdminBanners"),
  "/admin/notifications": () => import("@/pages/admin/AdminNotifications"),
  "/admin/feedback": () => import("@/pages/admin/AdminFeedback"),
  "/admin/version": () => import("@/pages/admin/AdminVersion"),
  "/task/new": () => import("@/pages/TaskForm"),
};

const prefetched = new Set<string>();

export const prefetchRoute = (path: string) => {
  if (prefetched.has(path)) return;
  const loader = path.startsWith("/planner/cadernos/")
    ? () => import("@/pages/NotebookDetailPage")
    : routeImports[path];
  if (!loader) return;
  prefetched.add(path);
  // Fire-and-forget; failures are silent (the user-facing nav will retry).
  loader().catch(() => {
    prefetched.delete(path);
  });
};
