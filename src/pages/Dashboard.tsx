import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useDashboardFilters, isTaskOverdue, filterAndSortTasks } from "@/hooks/useDashboardFilters";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardNotifications } from "@/hooks/useDashboardNotifications";
import Navbar from "@/components/Navbar";

import StreakCard from "@/components/StreakCard";
import { StreakKeeper } from "@/components/StreakKeeper";

import { OnboardingProgress } from "@/components/OnboardingProgress";
import { IncompleteProfileAlert } from "@/components/IncompleteProfileAlert";
import DashboardBannerCarousel from "@/components/DashboardBannerCarousel";
import { supabase } from "@/integrations/supabase/client";
import { formatUsername } from "@/lib/username";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { TodaySummary } from "@/components/dashboard/TodaySummary";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { DashboardKanban } from "@/components/dashboard/DashboardKanban";
import { BulkActionsBar } from "@/components/dashboard/BulkActionsBar";
import { useTaskSelection } from "@/hooks/useTaskSelection";
import { useBulkTaskActions } from "@/hooks/useBulkTaskActions";
import { Button } from "@/components/ui/button";
import { CheckSquare, X } from "lucide-react";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useOnboarding();

  const filters = useDashboardFilters();
  const {
    statusFilter, setStatusFilter,
    environmentFilter, setEnvironmentFilter,
    subjectFilter, setSubjectFilter,
    groupWorkFilter, setGroupWorkFilter,
    overdueFilter, setOverdueFilter,
    sortBy, setSortBy,
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    activeFiltersCount, clearAllFilters,
  } = filters;

  const {
    tasks, tasksLoading,
    availableSubjects, availableStatuses,
    kanbanStatuses, environments,
  } = useDashboardData();

  const { handleDeleteTask, handleStatusChange, handleArchiveTask } = useDashboardMutations();

  useDashboardNotifications(tasks);

  const selection = useTaskSelection();
  const { bulkUpdateStatus, bulkArchive, bulkDelete, bulkDuplicate, isProcessing } = useBulkTaskActions();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const filteredTasks = filterAndSortTasks(tasks, filters);
  const overdueCount = tasks.filter(isTaskOverdue).length;

  const { data: streakData } = useUserStreak();
  const currentStreak = streakData?.streak || 0;
  const completedToday = streakData?.lastActivity
    ? new Date().toDateString() === streakData.lastActivity.toDateString()
    : false;

  const completedStatusName = availableStatuses.find(s => s.toLowerCase().includes("conclu")) || "Concluído";
  const [displayUsername, setDisplayUsername] = useState("@usuario");

  useEffect(() => {
    if (!user?.id) return;

    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayUsername(formatUsername(data?.username));
      });
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  const handleDuplicateTask = async (taskId: string) => {
    const todoStatus =
      availableStatuses.find((s) => s.toLowerCase().includes("fazer")) || "A fazer";
    const newIds = await bulkDuplicate([taskId], todoStatus);
    if (newIds && newIds.length > 0) {
      toast.success("Tarefa duplicada.", {
        action: { label: "Abrir", onClick: () => navigate(`/task/${newIds[0]}`) },
      });
    }
  };

  return (
    <div className="min-h-screen min-w-0 flex-1 overflow-x-hidden bg-background">
      <StreakKeeper />
      <Navbar />
      <main className="w-full min-w-0 px-4 py-8">
        <div className="mb-4 flex justify-end">
          <StreakCard streak={currentStreak} completedToday={completedToday} />
        </div>

        {/* Banner institucional (quando existir) */}
        <DashboardBannerCarousel />
        <OnboardingProgress />
        <IncompleteProfileAlert />

        {/* Painel do Dia + Seu foco de hoje */}
        <DashboardOverview
          username={displayUsername}
          tasks={tasks}
          completedStatusName={completedStatusName}
        />

        {/* O que merece sua atenção hoje + Planejamento do dia */}
        <TodaySummary
          tasks={tasks}
          onStatusChange={handleStatusChange}
          completedStatusName={completedStatusName}
        />




        {/* Modo de seleção múltipla */}
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {selection.selectionMode && selection.selectedCount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => selection.selectAll(filteredTasks.map((t) => t.id))}
            >
              <CheckSquare className="h-4 w-4" />
              Selecionar todas
            </Button>
          )}
          <Button
            variant={selection.selectionMode ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={selection.toggleSelectionMode}
          >
            {selection.selectionMode ? (
              <>
                <X className="h-4 w-4" />
                Sair da seleção
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                Selecionar tarefas
              </>
            )}
          </Button>
        </div>

        {/* Filters */}
        <DashboardFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          subjectFilter={subjectFilter}
          setSubjectFilter={setSubjectFilter}
          environmentFilter={environmentFilter}
          setEnvironmentFilter={setEnvironmentFilter}
          groupWorkFilter={groupWorkFilter}
          setGroupWorkFilter={setGroupWorkFilter}
          overdueFilter={overdueFilter}
          setOverdueFilter={setOverdueFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          activeFiltersCount={activeFiltersCount}
          clearAllFilters={clearAllFilters}
          availableSubjects={availableSubjects}
          availableStatuses={availableStatuses}
          environments={environments}
          overdueCount={overdueCount}
        />

        {/* Task Board / List */}
        <DashboardKanban
          tasks={tasks}
          filteredTasks={filteredTasks}
          tasksLoading={tasksLoading}
          viewMode={viewMode}
          availableStatuses={availableStatuses}
          kanbanStatuses={kanbanStatuses}
          onStatusChange={handleStatusChange}
          onDelete={(id) => handleDeleteTask(id, tasks)}
          onArchive={handleArchiveTask}
          onDuplicate={handleDuplicateTask}
          clearAllFilters={clearAllFilters}
          selectionMode={selection.selectionMode}
          isSelected={selection.isSelected}
          onToggleSelect={selection.toggleTask}
        />
      </main>

      <BulkActionsBar
        selectedCount={selection.selectedCount}
        totalCount={filteredTasks.length}
        availableStatuses={availableStatuses}
        isProcessing={isProcessing}
        onSelectAll={() => selection.selectAll(filteredTasks.map((t) => t.id))}
        onClearSelection={selection.clearSelection}
        onExitSelectionMode={selection.exitSelectionMode}
        onChangeStatus={async (status) => {
          const ok = await bulkUpdateStatus(selection.selectedIds, status);
          if (ok) selection.clearSelection();
        }}
        onArchive={async () => {
          const ok = await bulkArchive(selection.selectedIds);
          if (ok) selection.clearSelection();
        }}
        onDuplicate={async () => {
          const todoStatus =
            availableStatuses.find((s) => s.toLowerCase().includes("fazer")) || "A fazer";
          const newIds = await bulkDuplicate(selection.selectedIds, todoStatus);
          if (newIds && newIds.length > 0) {
            selection.clearSelection();
            toast.success(newIds.length === 1 ? "Tarefa duplicada." : `${newIds.length} tarefas duplicadas.`, {
              action: {
                label: "Abrir",
                onClick: () => navigate(`/task/${newIds[0]}`),
              },
            });
          }
        }}
        onDelete={async () => {
          const ok = await bulkDelete(selection.selectedIds);
          if (ok) selection.clearSelection();
        }}
      />
    </div>
  );
};

export default Dashboard;
