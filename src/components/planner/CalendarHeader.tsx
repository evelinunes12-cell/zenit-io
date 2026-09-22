import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export type PlannerView = "month" | "week" | "notes" | "goals";

interface CalendarHeaderProps {
  currentDate: Date;
  view: PlannerView;
  onViewChange: (view: PlannerView) => void;
  onDateChange: (date: Date) => void;
  onToday: () => void;
}

const VIEW_OPTIONS: { value: PlannerView; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "week", label: "Semana" },
  { value: "notes", label: "Notas" },
  { value: "goals", label: "Metas" },
];

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onDateChange,
  onToday,
}: CalendarHeaderProps) {
  const isCalendarView = view === "month" || view === "week";
  const label = format(currentDate, "MMMM yyyy", { locale: ptBR });

  const prev = () =>
    onDateChange(view === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  const next = () =>
    onDateChange(view === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));

  return (
    <div className="flex items-center justify-between pb-4 gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        {isCalendarView && (
          <>
            <Button variant="outline" size="sm" onClick={onToday}>
              Hoje
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-lg font-semibold capitalize">{label}</h2>
          </>
        )}
        {!isCalendarView && (
          <h2 className="text-lg font-semibold">
            {view === "notes" ? "Todas as Anotações" : "Todas as Metas"}
          </h2>
        )}
      </div>

      <div className="flex max-w-full overflow-x-auto rounded-lg border bg-muted p-0.5 scrollbar-none">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onViewChange(opt.value)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              view === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
        <Button asChild variant="ghost" size="sm" className="h-auto rounded-md px-3 py-1 text-xs font-medium">
          <Link to="/planner/cadernos"><BookOpen className="mr-1.5 h-3.5 w-3.5" />Cadernos</Link>
        </Button>
      </div>
    </div>
  );
}
