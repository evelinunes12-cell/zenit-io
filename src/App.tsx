import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/AppSidebar";
import { SwipeToOpenSidebar } from "@/components/SwipeToOpenSidebar";
import { ConfettiProvider } from "@/hooks/useConfetti";
import { PullToRefresh } from "@/components/PullToRefresh";
import { FocusTimerProvider } from "@/contexts/FocusTimerContext";
import { StudyCyclePlayerProvider } from "@/contexts/StudyCyclePlayerContext";
import GlobalStudyCyclePlayer from "@/components/GlobalStudyCyclePlayer";
import { lazy, Suspense, useState, useCallback } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import PageTransition from "./components/PageTransition";
import PageLoadingFallback from "./components/PageLoadingFallback";
import { BottomNav } from "./components/BottomNav";
import SplashScreen from "./components/SplashScreen";

const Auth = lazy(() => import("./pages/Auth"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TaskForm = lazy(() => import("./pages/TaskForm"));
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const Subjects = lazy(() => import("./pages/Subjects"));
const TaskStatuses = lazy(() => import("./pages/TaskStatuses"));
const Settings = lazy(() => import("./pages/Settings"));
const SharedEnvironments = lazy(() => import("./pages/SharedEnvironments"));
const EnvironmentForm = lazy(() => import("./pages/EnvironmentForm"));
const EnvironmentDetail = lazy(() => import("./pages/EnvironmentDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const ArchivedTasks = lazy(() => import("./pages/ArchivedTasks"));
const Planner = lazy(() => import("./pages/Planner"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Support = lazy(() => import("./pages/Support"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminBanners = lazy(() => import("./pages/AdminBanners"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback"));
const AdminVersion = lazy(() => import("./pages/admin/AdminVersion"));
const PomodoroPage = lazy(() => import("./pages/PomodoroPage"));
const StudyCyclePage = lazy(() => import("./pages/StudyCyclePage"));
const StudyAnalyticsPage = lazy(() => import("./pages/StudyAnalyticsPage"));

const RankingPage = lazy(() => import("./pages/RankingPage"));
const StudyGroups = lazy(() => import("./pages/StudyGroupsComingSoon"));
const StudyGroupDetail = lazy(() => import("./pages/StudyGroupsComingSoon"));
import ZenitCommand from "./components/ZenitCommand";
import RouteMeta from "./components/RouteMeta";
import XpGainSignal from "./components/XpGainSignal";
import { AdminRoute } from "./components/AdminRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import AppUpdatePrompt from "./components/AppUpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — reduces refetch storms on navigation
      gcTime: 5 * 60_000, // keep cached data 5 min after unmount
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SidebarShell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Keep behavior consistent with the previous routing setup:
  // only show the sidebar on the routes that previously rendered <AppSidebar />.
  const showSidebar =
    pathname === "/dashboard" ||
    pathname === "/subjects" ||
    pathname === "/task-statuses" ||
    pathname === "/settings" ||
    pathname === "/shared-environments" ||
    pathname === "/reports" ||
    pathname === "/archived" ||
    pathname === "/planner" ||
    pathname === "/ranking" ||
    pathname === "/task/new" ||
    pathname === "/estudos/pomodoro" ||
    pathname === "/estudos/ciclo" ||
    pathname === "/estudos/desempenho" ||
    pathname === "/grupos-de-estudo" ||
    
    pathname === "/admin" ||
    pathname === "/admin/users" ||
    pathname === "/admin/banners" ||
    pathname === "/admin/notifications" ||
    pathname === "/admin/feedback" ||
    pathname === "/admin/version" ||
    /^\/task\/edit\/.+/.test(pathname) ||
    /^\/environment\/[^/]+$/.test(pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {showSidebar ? <AppSidebar /> : null}
        <SwipeToOpenSidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden pb-16 md:pb-0">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
        <BottomNav />
      </div>
    </SidebarProvider>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem("zenit-splash-seen");
    return !seen;
  });

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("zenit-splash-seen", "1");
    setShowSplash(false);
  }, []);

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <ConfettiProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PWAInstallPrompt />
              <AppUpdatePrompt />
              <BrowserRouter>
                <RouteMeta />
                <ZenitCommand />
                <XpGainSignal />
                <FocusTimerProvider>
                  <StudyCyclePlayerProvider>
                    <GlobalStudyCyclePlayer />
                    <Suspense fallback={<PageLoadingFallback />}>
                      <SidebarShell>
                      <Routes>
                        <Route path="/" element={<Navigate to="/auth" replace />} />
                        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
                        <Route path="/.lovable/oauth/consent" element={<PageTransition><OAuthConsent /></PageTransition>} />
                        <Route path="/onboarding" element={<ProtectedRoute><PageTransition><Onboarding /></PageTransition></ProtectedRoute>} />
                        <Route path="/invite/:token" element={<PageTransition><InvitePage /></PageTransition>} />
                        <Route path="/apoie" element={<PageTransition><Support /></PageTransition>} />
                        <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
                        <Route path="/subjects" element={<ProtectedRoute><PageTransition><Subjects /></PageTransition></ProtectedRoute>} />
                        <Route path="/task-statuses" element={<ProtectedRoute><PageTransition><TaskStatuses /></PageTransition></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
                        <Route path="/shared-environments" element={<ProtectedRoute><PageTransition><SharedEnvironments /></PageTransition></ProtectedRoute>} />
                        <Route path="/reports" element={<ProtectedRoute><PageTransition><Reports /></PageTransition></ProtectedRoute>} />
                        <Route path="/archived" element={<ProtectedRoute><PageTransition><ArchivedTasks /></PageTransition></ProtectedRoute>} />
                        <Route path="/planner" element={<ProtectedRoute><PageTransition><Planner /></PageTransition></ProtectedRoute>} />
                        <Route path="/ranking" element={<ProtectedRoute><PageTransition><RankingPage /></PageTransition></ProtectedRoute>} />
                        <Route path="/environment/new" element={<ProtectedRoute><PageTransition><EnvironmentForm /></PageTransition></ProtectedRoute>} />
                        <Route path="/environment/:id/edit" element={<ProtectedRoute><PageTransition><EnvironmentForm /></PageTransition></ProtectedRoute>} />
                        <Route path="/environment/:id" element={<ProtectedRoute><PageTransition><EnvironmentDetail /></PageTransition></ProtectedRoute>} />
                        <Route path="/task/new" element={<ProtectedRoute><PageTransition><TaskForm /></PageTransition></ProtectedRoute>} />
                        <Route path="/task/edit/:id" element={<ProtectedRoute><PageTransition><TaskForm /></PageTransition></ProtectedRoute>} />
                        <Route path="/task/:id" element={<ProtectedRoute><PageTransition><TaskDetail /></PageTransition></ProtectedRoute>} />
                        <Route path="/estudos/pomodoro" element={<ProtectedRoute><PageTransition><PomodoroPage /></PageTransition></ProtectedRoute>} />
                        <Route path="/estudos/ciclo" element={<ProtectedRoute><PageTransition><StudyCyclePage /></PageTransition></ProtectedRoute>} />
                        <Route path="/estudos/desempenho" element={<ProtectedRoute><PageTransition><StudyAnalyticsPage /></PageTransition></ProtectedRoute>} />
                        <Route path="/grupos-de-estudo" element={<ProtectedRoute><PageTransition><StudyGroups /></PageTransition></ProtectedRoute>} />
                        <Route path="/grupos-de-estudo/:id" element={<ProtectedRoute><PageTransition><StudyGroupDetail /></PageTransition></ProtectedRoute>} />
                        <Route path="/admin" element={<AdminRoute><PageTransition><AdminDashboard /></PageTransition></AdminRoute>} />
                        <Route path="/admin/users" element={<AdminRoute><PageTransition><AdminUsers /></PageTransition></AdminRoute>} />
                        <Route path="/admin/banners" element={<AdminRoute><PageTransition><AdminBanners /></PageTransition></AdminRoute>} />
                        <Route path="/admin/notifications" element={<AdminRoute><PageTransition><AdminNotifications /></PageTransition></AdminRoute>} />
                        <Route path="/admin/feedback" element={<AdminRoute><PageTransition><AdminFeedback /></PageTransition></AdminRoute>} />
                        <Route path="/admin/version" element={<AdminRoute><PageTransition><AdminVersion /></PageTransition></AdminRoute>} />
                        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                      </Routes>
                    </SidebarShell>
                  </Suspense>
                  </StudyCyclePlayerProvider>
                </FocusTimerProvider>
              </BrowserRouter>
            </TooltipProvider>
          </ConfettiProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
