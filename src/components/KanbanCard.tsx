import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/services/tasks";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar, Users, GripVertical, Eye, Archive, Trash2,
  CheckSquare, AlertTriangle, MoreVertical,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDueDate } from "@/services/tasks";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { stripHtml } from "@/utils/sanitize";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface KanbanCardProps {
  task: Task;
  availableStatuses: string[];
  completedStatusName: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onArchive: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
  isDragging?: boolean;
}

export function KanbanCard({
  task,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onDelete,
  onArchive,
  onTaskClick,
  isDragging = false,
}: KanbanCardProps) {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, transform, isDragging: isCurrentlyDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  // Checklist progress
  const checklist = task.checklist || [];
  const completedItems = checklist.filter((item: any) => item.completed).length;
  const totalItems = checklist.length;
  const checklistProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Date logic
  const dueDateObj = task.due_date ? parseDueDate(task.due_date) : null;
  const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj) && !task.status.toLowerCase().includes("conclu");
  const isDueToday = dueDateObj && isToday(dueDateObj);
  const isDueTomorrow = dueDateObj && isTomorrow(dueDateObj);

  const formatDateDisplay = (date: Date) => format(date, "dd 'de' MMMM", { locale: ptBR });
  const plainDescription = stripHtml(task.description);

  const getDateBadgeStyle = () => {
    if (isOverdue) return "bg-destructive/10 text-destructive border-destructive/30";
    if (isDueToday) return "bg-warning/10 text-warning border-warning/30";
    if (isDueTomorrow) return "bg-primary/10 text-primary border-primary/30";
    return "";
  };

  // Drag overlay (simplified)
  if (isDragging) {
    return (
      <Card className="cursor-grabbing shadow-xl border-primary overflow-hidden">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-lg text-foreground break-words">{task.subject_name}</h3>
          {plainDescription && (
            <p className="text-sm text-muted-foreground break-words line-clamp-2 mt-1">{plainDescription}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative overflow-hidden",
        isCurrentlyDragging && "opacity-50 scale-95",
        isOverdue && "border-destructive/50 shadow-destructive/10"
      )}
    >
      {isOverdue && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive animate-pulse" />
      )}

      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Drag handle + content */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Arrastar tarefa"
            >
              <GripVertical className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-lg text-foreground break-words [overflow-wrap:anywhere] min-w-0">{task.subject_name}</h3>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    Atrasada
                  </Badge>
                )}
              </div>
              {plainDescription && (
                <div className="text-sm text-muted-foreground break-words">
                  <p className="line-clamp-3 break-words [overflow-wrap:anywhere]">{plainDescription}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick ? onTaskClick(task.id) : navigate(`/task/${task.id}`);
                    }}
                    className="text-primary hover:underline text-xs font-medium mt-1"
                  >
                    Exibir mais
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status badge */}
          <Badge variant="secondary" className="shrink-0">{task.status}</Badge>
        </div>

        {/* Meta info row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {task.due_date && dueDateObj && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full border",
              getDateBadgeStyle()
            )}>
              <Calendar className="w-4 h-4" />
              <span>
                {isDueToday ? "Hoje" : isDueTomorrow ? "Amanhã" : formatDateDisplay(dueDateObj)}
              </span>
            </div>
          )}
          {task.is_group_work && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>Em grupo</span>
            </div>
          )}
          {totalItems > 0 && (
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              <div className="flex items-center gap-2 min-w-[100px]">
                <Progress
                  value={checklistProgress}
                  className={cn(
                    "h-2 w-16",
                    checklistProgress === 100 && "[&>div]:bg-success"
                  )}
                />
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-1.5 py-0",
                    checklistProgress === 100
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {checklistProgress}%
                </Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Footer - same structure as TaskCard */}
      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTaskClick ? onTaskClick(task.id) : navigate(`/task/${task.id}`)}
          className="flex-1 gap-2"
        >
          <Eye className="w-4 h-4" />
          Ver detalhes
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="px-2">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => onArchive(task.id)} className="gap-2">
              <Archive className="w-4 h-4" />
              Arquivar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(task.id)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}
