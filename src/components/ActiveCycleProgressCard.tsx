import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchStudyCycles, type StudyCycle } from "@/services/studyCycles";
import { fetchFocusSessionsWithDetails, type FocusSessionWithDetails } from "@/services/studyAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, Target, AlertTriangle, BookOpen, CalendarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCycleTiming, cycleTimingBadgeClass, formatPlannedDedication } from "@/lib/studyCycleTiming";
import { computeCycleProgress, formatMinutes } from "@/lib/studyCycleProgress";
import { parseISO } from "date-fns";

/** Ordem de exibição dos cards (Sprint 4.3 — múltiplos ciclos). */
const TIMING_RANK: Record<string, number> = {
  active: 0,
  ending_soon: 1,
  upcoming: 2,
  completed: 3,
  undated: 4,
};

/**
 * Container: busca todos os ciclos com planejamento temporal e as sessões do
 * período completo em UMA única query, e renderiza um card por ciclo.
 */
const ActiveCycleProgressCard = () => {
  const { user } = useAuth();

  const { data: cycles = [] } = useQuery({
    queryKey: ["study-cycles-list"],
    queryFn: fetchStudyCycles,
    enabled: !!user?.id,
  });

  // Somente ciclos com planejamento temporal (start_date + end_date).
  const plannedCycles = useMemo(() => {
    const dated = cycles.filter((c) => c.start_date && c.end_date);
    return [...dated].sort((a, b) => {
      const ra = TIMING_RANK[getCycleTiming(a).status] - TIMING_RANK[getCycleTiming(b).status];
      if (ra !== 0) return ra;
      return (a.start_date || "").localeCompare(b.start_date || "");
    });
  }, [cycles]);

  // Janela global (menor início → maior fim) para evitar N+1 queries.
  const range = useMemo(() => {
    if (plannedCycles.length === 0) return null;
    const starts = plannedCycles.map((c) => c.start_date!).sort();
    const ends = plannedCycles.map((c) => c.end_date!).sort();
    return { from: starts[0], to: ends[ends.length - 1] };
  }, [plannedCycles]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["focus-sessions-cycles", range?.from, range?.to],
    queryFn: () => {
      if (!user?.id || !range) return [];
      return fetchFocusSessionsWithDetails(user.id, parseISO(range.from), parseISO(range.to));
    },
    enabled: !!user?.id && !!range,
  });

  // Agrupa as sessões por ciclo — nenhuma sessão cruza de um ciclo para outro.
  const sessionsByCycle = useMemo(() => {
    const map = new Map<string, FocusSessionWithDetails[]>();
    sessions.forEach((s) => {
      if (!s.study_cycle_id) return;
      const list = map.get(s.study_cycle_id) ?? [];
      list.push(s);
      map.set(s.study_cycle_id, list);
    });
    return map;
  }, [sessions]);

  if (plannedCycles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {plannedCycles.map((cycle) => (
        <CycleProgressCard
          key={cycle.id}
          cycle={cycle}
          sessions={sessionsByCycle.get(cycle.id) ?? []}
        />
      ))}
    </div>
  );
};

interface CycleProgressCardProps {
  cycle: StudyCycle;
  sessions: FocusSessionWithDetails[];
}

/** Apresentação de um único ciclo. */
export const CycleProgressCard = ({ cycle, sessions }: CycleProgressCardProps) => {
  const activeCycle = cycle;
  const timing = activeCycle ? getCycleTiming(activeCycle) : null;
  const progress = useMemo(
    () => (activeCycle ? computeCycleProgress(activeCycle, sessions) : null),
    [activeCycle, sessions]
  );

  if (!activeCycle || !timing || !progress) return null;

  const dedication = formatPlannedDedication(activeCycle);
  const isUpcoming = timing.status === "upcoming";
  const isCompleted = timing.status === "completed";

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-start gap-2 min-w-0 flex-wrap">
          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span className="break-words">Progresso do Ciclo: {activeCycle.name}</span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-5 ${cycleTimingBadgeClass(timing.status)}`}
          >
            {timing.label}
          </Badge>
          <p className="text-xs text-muted-foreground break-words">
            {timing.startFormatted} → {timing.endFormatted}
          </p>
          {dedication && (
            <p className="text-xs text-muted-foreground break-words">• {dedication}</p>
          )}
        </div>
        {timing.contextLabel && (
          <p
            className={`text-xs font-medium flex items-center gap-1 ${
              timing.status === "ending_soon" ? "text-warning" : "text-muted-foreground"
            }`}
          >
            {timing.status === "ending_soon" ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="break-words">{timing.contextLabel}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Dimensão 1 — calendário */}
        {!isUpcoming && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Calendário
              </span>
              <span className="font-medium">
                {progress.elapsedDays} de {progress.totalDays} dias ({progress.temporalProgress}%)
              </span>
            </div>
            <Progress value={progress.temporalProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isCompleted
                ? "Período encerrado"
                : `${progress.remainingDays} ${progress.remainingDays === 1 ? "dia restante" : "dias restantes"}`}
            </p>
          </div>
        )}

        {/* Dimensão 2 — estudo */}
        {!isUpcoming && (
          <div className="space-y-2">
            {progress.studyProgress !== null && (
              <>
                <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Estudo
                  </span>
                  <span className="font-medium">
                    {formatMinutes(progress.studiedMinutes)} de {formatMinutes(progress.plannedTotalMinutes!)} (
                    {progress.studyProgress}%)
                  </span>
                </div>
                <Progress value={progress.studyProgress} className="h-2" />
              </>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-border bg-muted/30 p-2.5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3 w-3 shrink-0" /> Dias estudados
                </p>
                <p className="text-sm font-semibold break-words">{progress.studiedDays}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-2.5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarOff className="h-3 w-3 shrink-0" /> Dias sem estudo
                </p>
                <p className="text-sm font-semibold break-words">{progress.daysWithoutStudy}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-2.5 min-w-0">
                <p className="text-xs text-muted-foreground">Tempo estudado</p>
                <p className="text-sm font-semibold break-words">{formatMinutes(progress.studiedMinutes)}</p>
              </div>
              {progress.plannedRemainingMinutes !== null && !isCompleted && (
                <div className="rounded-lg border border-border bg-muted/30 p-2.5 min-w-0">
                  <p className="text-xs text-muted-foreground">Planejamento restante</p>
                  <p className="text-sm font-semibold break-words">
                    {formatMinutes(progress.plannedRemainingMinutes)}
                  </p>
                </div>
              )}
            </div>

            {progress.compliance !== null && !isUpcoming && (
              <p className="text-xs text-muted-foreground break-words">
                Cumprimento do planejado até hoje:{" "}
                <span className="font-medium text-foreground">{progress.compliance}%</span>
              </p>
            )}
          </div>
        )}

        {isUpcoming && (
          <p className="text-sm text-muted-foreground break-words">
            O ciclo ainda não começou. O acompanhamento de dias e tempo estudado aparece aqui a partir do início.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveCycleProgressCard;
