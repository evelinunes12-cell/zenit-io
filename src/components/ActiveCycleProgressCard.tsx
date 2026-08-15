import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchStudyCycles } from "@/services/studyCycles";
import { fetchFocusSessionsWithDetails } from "@/services/studyAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCycleTiming, cycleTimingBadgeClass } from "@/lib/studyCycleTiming";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ActiveCycleProgressCard = () => {
  const { user } = useAuth();

  const { data: cycles = [] } = useQuery({
    queryKey: ["study-cycles-list"],
    queryFn: fetchStudyCycles,
    enabled: !!user?.id,
  });

  // Find the most recent advanced cycle with dates
  // Sprint 4.2: escolhe o ciclo pelo estado temporal (nunca trata um ciclo
  // futuro ou encerrado como "em andamento" só por ser o mais recente).
  const activeCycle = useMemo(() => {
    const dated = cycles.filter((c) => c.start_date && c.end_date);
    const rank: Record<string, number> = { ending_soon: 0, active: 1, upcoming: 2, completed: 3, undated: 4 };
    return [...dated].sort((a, b) => {
      const ra = rank[getCycleTiming(a).status] - rank[getCycleTiming(b).status];
      if (ra !== 0) return ra;
      return (a.is_active === b.is_active) ? 0 : a.is_active ? -1 : 1;
    })[0];
  }, [cycles]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["focus-sessions-cycle", activeCycle?.id, activeCycle?.start_date, activeCycle?.end_date],
    queryFn: () => {
      if (!user?.id || !activeCycle?.start_date || !activeCycle?.end_date) return [];
      return fetchFocusSessionsWithDetails(
        user.id,
        parseISO(activeCycle.start_date),
        parseISO(activeCycle.end_date)
      );
    },
    enabled: !!user?.id && !!activeCycle,
  });

  const analytics = useMemo(() => {
    if (!activeCycle?.start_date || !activeCycle?.end_date) return null;

    const start = parseISO(activeCycle.start_date);
    const end = parseISO(activeCycle.end_date);
    const today = new Date();
    const totalDays = differenceInDays(end, start) + 1;
    const elapsedDays = Math.max(0, Math.min(totalDays, differenceInDays(today, start) + 1));
    const temporalProgress = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;

    // Calculate planned hours
    const blocksMinutes = (activeCycle.blocks || []).reduce((s, b) => s + b.allocated_minutes, 0);
    const plannedHours = Math.round(blocksMinutes / 60 * 10) / 10;

    // Calculate focused hours from sessions that match cycle subjects
    const cycleSubjectIds = new Set((activeCycle.blocks || []).map((b) => b.subject_id));
    const focusedMinutes = sessions
      .filter((s) => s.subject_id && cycleSubjectIds.has(s.subject_id))
      .reduce((a, s) => a + s.duration_minutes, 0);
    const focusedHours = Math.round(focusedMinutes / 60 * 10) / 10;
    const focusProgress = plannedHours > 0 ? Math.min(100, Math.round((focusedHours / plannedHours) * 100)) : 0;

    const timing = getCycleTiming(activeCycle);

    return {
      timing,
      cycleName: activeCycle.name,
      startFormatted: format(start, "dd MMM", { locale: ptBR }),
      endFormatted: format(end, "dd MMM yyyy", { locale: ptBR }),
      totalDays,
      elapsedDays,
      temporalProgress,
      plannedHours,
      focusedHours,
      focusProgress,
      isActive: activeCycle.is_active,
    };
  }, [activeCycle, sessions]);

  if (!analytics) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Progresso do Ciclo: {analytics.cycleName}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-5 ${cycleTimingBadgeClass(analytics.timing.status)}`}
          >
            {analytics.timing.label}
          </Badge>
          <p className="text-xs text-muted-foreground break-words">
            {analytics.timing.startFormatted} → {analytics.timing.endFormatted}
          </p>
        </div>
        {analytics.timing.contextLabel && (
          <p
            className={`text-xs font-medium flex items-center gap-1 ${
              analytics.timing.status === "ending_soon" ? "text-warning" : "text-muted-foreground"
            }`}
          >
            {analytics.timing.status === "ending_soon" ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="break-words">{analytics.timing.contextLabel}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Temporal progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Progresso temporal
            </span>
            <span className="font-medium">
              {analytics.elapsedDays}/{analytics.totalDays} dias ({analytics.temporalProgress}%)
            </span>
          </div>
          <Progress value={analytics.temporalProgress} className="h-2" />
        </div>

        {/* Focus progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Horas de foco
            </span>
            <span className="font-medium">
              {analytics.focusedHours}h / {analytics.plannedHours}h ({analytics.focusProgress}%)
            </span>
          </div>
          <Progress value={analytics.focusProgress} className="h-2" />
        </div>

        {/* Encouragement (apenas para ciclos em andamento) */}
        {(analytics.timing.status === "active" || analytics.timing.status === "ending_soon") && (
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-center">
          {analytics.focusProgress >= analytics.temporalProgress ? (
            <p className="text-sm text-primary font-medium flex items-center justify-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Estás no ritmo certo! Continua assim 💪
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Faltam <span className="font-semibold text-foreground">{Math.round(analytics.plannedHours - analytics.focusedHours)}h</span> para completar o plano. Vamos lá! 🚀
            </p>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveCycleProgressCard;
