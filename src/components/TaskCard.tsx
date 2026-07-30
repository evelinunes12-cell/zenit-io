import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Users, Eye, Trash2, CheckSquare, AlertTriangle, ChevronDown, Archive, MoreVertical } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { registerActivity } from "@/services/activity";
import { TaskQuickView } from "./TaskQuickView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { stripHtml } from "@/utils/sanitize";

export interface TaskCardAssignee {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface TaskCardProps {
  id: string;
  subjectName: string;
  description?: string;
  dueDate: string | null;
  isGroupWork: boolean;
  status: string;
  checklist?: { text: string; completed: boolean }[];
  availableStatuses?: string[];
  assignees?: TaskCardAssignee[];
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
  onArchive?: (id: string) => void;
}

const TaskCard = ({
  id,
  subjectName,
  description,
  dueDate,
  isGroupWork,
  status,
  checklist = [],
  availableStatuses = [],
  assignees = [],
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onDelete,
  onStatusChange,
  onArchive,
}: TaskCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const handleStatusChangeWithActivity = (id: string, newStatus: string) => {
    if (onStatusChange) {
      onStatusChange(id, newStatus);
      // Registra atividade para a ofensiva
      if (user) {
        registerActivity(user.id);
      }
    }
  };

  const plainDescription = stripHtml(description);
  
  const checklistProgress =
    checklist.length > 0
      ? Math.round((checklist.filter((item) => item.completed).length / checklist.length) * 100)
      : 0;

  // Parse date compensating for timezone (dates are stored as YYYY-MM-DD)
  const parseDueDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };

  // Format date with timezone compensation for display
  const formatDateDisplay = (date: Date) => {
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  };

  const dueDateObj = dueDate ? parseDueDate(dueDate) : null;
  const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj) && !status.toLowerCase().includes("conclu");
  const isDueToday = dueDateObj && isToday(dueDateObj);
  const isDueTomorrow = dueDateObj && isTomorrow(dueDateObj);

  const getDateBadgeStyle = () => {
    if (isOverdue) return "bg-destructive/10 text-destructive border-destructive/30";
    if (isDueToday) return "bg-warning/10 text-warning border-warning/30";
    if (isDueTomorrow) return "bg-primary/10 text-primary border-primary/30";
    return "";
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
    <Card 
      className={cn(
        "hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative overflow-hidden",
        isOverdue && "border-destructive/50 shadow-destructive/10",
        selectionMode && selected && "ring-2 ring-primary border-primary"
      )}
      onClick={selectionMode ? () => onToggleSelect?.(id) : undefined}
    >
      {isOverdue && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive animate-pulse" />
      )}
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2 mb-3">
          {selectionMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(id)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Selecionar tarefa"
              className="mt-1.5 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-lg text-foreground break-words">{subjectName}</h3>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  Atrasada
                </Badge>
              )}
            </div>
            {description && plainDescription && (
              <div className="text-sm text-muted-foreground break-words">
                <p className="line-clamp-3">
                  {plainDescription}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickViewOpen(true);
                  }}
                  className="text-primary hover:underline text-xs font-medium mt-1"
                >
                  Exibir mais
                </button>
              </div>
            )}
          </div>
          
          {/* Quick Status Dropdown */}
          {onStatusChange && availableStatuses.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={handleStatusClick}>
                <Button variant="secondary" size="sm" className="h-6 gap-1 text-xs px-2">
                  {status}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                {availableStatuses.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusChangeWithActivity(id, s)}
                    className={cn(
                      "cursor-pointer",
                      s === status && "bg-accent font-medium"
                    )}
                  >
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="secondary">{status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {dueDate && dueDateObj && (
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
          {isGroupWork && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>Em grupo</span>
            </div>
          )}
          {checklist.length > 0 && (
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

        {assignees.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <TooltipProvider delayDuration={200}>
              <div className="flex -space-x-2">
                {assignees.slice(0, 4).map((m) => {
                  const name = m.full_name || m.username || m.email || "Membro";
                  const initials = name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <Tooltip key={m.user_id}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={m.avatar_url || undefined} alt={name} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{name}</TooltipContent>
                    </Tooltip>
                  );
                })}
                {assignees.length > 4 && (
                  <div className="h-6 w-6 rounded-full border-2 border-background bg-muted text-[10px] font-medium flex items-center justify-center text-muted-foreground">
                    +{assignees.length - 4}
                  </div>
                )}
              </div>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/task/${id}`)}
          className="flex-1 gap-2"
        >
          <Eye className="w-4 h-4" />
          Ver completo
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="px-2">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            {onArchive && (
              <DropdownMenuItem onClick={() => onArchive(id)} className="gap-2">
                <Archive className="w-4 h-4" />
                Arquivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(id)} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
    <TaskQuickView
      taskId={quickViewOpen ? id : null}
      open={quickViewOpen}
      onOpenChange={setQuickViewOpen}
      onStatusChange={onStatusChange}
      availableStatuses={availableStatuses}
    />
    </>
  );
};

export default TaskCard;
