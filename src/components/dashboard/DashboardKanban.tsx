import { Task } from "@/services/tasks";
import { KanbanBoard, KanbanStatus } from "@/components/KanbanBoard";
import SwipeableTaskCard from "@/components/SwipeableTaskCard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import EmptyState from "@/components/EmptyState";

interface DashboardKanbanProps {
  tasks: Task[];
  filteredTasks: Task[];
  tasksLoading: boolean;
  viewMode: "list" | "board";
  availableStatuses: string[];
  kanbanStatuses: KanbanStatus[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  onDelete: (id: string) => void;
  onArchive: (taskId: string) => void;
  clearAllFilters: () => void;
  selectionMode?: boolean;
  isSelected?: (taskId: string) => boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function DashboardKanban({
  tasks,
  filteredTasks,
  tasksLoading,
  viewMode,
  availableStatuses,
  kanbanStatuses,
  onStatusChange,
  onDelete,
  onArchive,
  clearAllFilters,
  selectionMode = false,
  isSelected,
  onToggleSelect,
}: DashboardKanbanProps) {
  const completedStatusName = availableStatuses.find(s => s.toLowerCase().includes("conclu")) || "Concluído";

  if (tasksLoading) {
    return <DashboardSkeleton viewMode={viewMode} />;
  }

  if (tasks.length === 0) {
    return <EmptyState type="tasks" />;
  }

  if (filteredTasks.length === 0) {
    return <EmptyState type="filtered" onClearFilters={clearAllFilters} />;
  }

  if (viewMode === "list") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTasks.map(task => (
          <SwipeableTaskCard
            key={task.id}
            id={task.id}
            subjectName={task.subject_name}
            description={task.description}
            dueDate={task.due_date}
            isGroupWork={task.is_group_work}
            status={task.status}
            checklist={task.checklist}
            availableStatuses={availableStatuses}
            completedStatusName={completedStatusName}
            selectionMode={selectionMode}
            selected={isSelected?.(task.id) || false}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onArchive={onArchive}
          />
        ))}
      </div>
    );
  }

  return (
    <KanbanBoard
      tasks={filteredTasks}
      availableStatuses={availableStatuses}
      kanbanStatuses={kanbanStatuses}
      onStatusChange={onStatusChange}
      onDelete={onDelete}
      onArchive={onArchive}
      selectionMode={selectionMode}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
    />
  );
}
