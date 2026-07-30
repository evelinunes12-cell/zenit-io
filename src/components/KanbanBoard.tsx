import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { Task } from "@/services/tasks";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { TaskQuickView } from "./TaskQuickView";

export interface KanbanStatus {
  id: string;
  name: string;
  color: string | null;
  show_in_kanban: boolean;
  children?: KanbanStatus[];
}

interface KanbanBoardProps {
  tasks: Task[];
  availableStatuses: string[];
  kanbanStatuses: KanbanStatus[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  onDelete: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  selectionMode?: boolean;
  isSelected?: (taskId: string) => boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function KanbanBoard({
  tasks,
  availableStatuses,
  kanbanStatuses,
  onStatusChange,
  onDelete,
  onArchive,
  selectionMode = false,
  isSelected,
  onToggleSelect,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [quickViewTaskId, setQuickViewTaskId] = useState<string | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Configure sensors for both pointer and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  // Group tasks by column - matching parent status or any of its children
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    
    kanbanStatuses.forEach((parentStatus) => {
      // Collect all status names that belong to this column (parent + children)
      const columnStatusNames = [
        parentStatus.name,
        ...(parentStatus.children?.map(c => c.name) || [])
      ];
      
      grouped[parentStatus.id] = tasks.filter((task) => 
        columnStatusNames.includes(task.status)
      );
    });
    
    return grouped;
  }, [tasks, kanbanStatuses]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetColumn = kanbanStatuses.find((col) => col.id === overId);
    
    if (targetColumn) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        // Get all status names for this column
        const columnStatusNames = [
          targetColumn.name,
          ...(targetColumn.children?.map(c => c.name) || [])
        ];
        
        // Only change if task is not already in this column
        if (!columnStatusNames.includes(task.status)) {
          onStatusChange(taskId, targetColumn.name);
        }
      }
    }
  };

  const handleTaskClick = (taskId: string) => {
    setQuickViewTaskId(taskId);
    setQuickViewOpen(true);
  };

  const completedStatusName =
    availableStatuses.find((s) => s.toLowerCase().includes("conclu")) ||
    "Concluído";

  // Determine if any status has children (hierarchical) or all are flat
  const isFlatLayout = kanbanStatuses.every(
    (s) => !s.children || s.children.length === 0
  );

  // If no kanban statuses configured, show fallback message
  if (kanbanStatuses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum status configurado para exibição no Kanban.</p>
        <p className="text-sm mt-2">Configure seus status em Configurações → Status.</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Mobile: vertical stack. Desktop: proportional if flat, scrollable if hierarchical */}
        <div className={cn(
          "flex flex-col gap-6",
          !isFlatLayout && "md:overflow-x-auto md:pb-4"
        )}>
          <div className={cn(
            "flex flex-col gap-6 md:flex-row md:gap-6",
            isFlatLayout && "md:w-full"
          )}>
            {kanbanStatuses.map((status) => (
              <KanbanColumn
                key={status.id}
                id={status.id}
                title={status.name}
                color={status.color ? `bg-[${status.color}]` : "bg-muted-foreground"}
                colorHex={status.color}
                tasks={tasksByColumn[status.id] || []}
                availableStatuses={availableStatuses}
                completedStatusName={completedStatusName}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onArchive={onArchive}
                onTaskClick={handleTaskClick}
                flexible={isFlatLayout}
                selectionMode={selectionMode}
                isSelected={isSelected}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay - shows the card being dragged */}
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 rotate-3 scale-105">
              <KanbanCard
                task={activeTask}
                availableStatuses={availableStatuses}
                completedStatusName={completedStatusName}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onArchive={onArchive}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Quick View Modal/Drawer */}
      <TaskQuickView
        taskId={quickViewTaskId}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        onStatusChange={onStatusChange}
        availableStatuses={availableStatuses}
      />
    </>
  );
}
