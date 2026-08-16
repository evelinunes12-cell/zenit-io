import { differenceInCalendarDays } from "date-fns";
import { parseCycleDate, getCycleTiming, type CycleTimingInput, type CyclePlanningInput } from "./studyCycleTiming";

/**
 * Sprint 4.3 — progresso real do ciclo.
 *
 * Separa duas dimensões distintas:
 * - calendário (quanto do período já passou);
 * - estudo (quanto o usuário efetivamente estudou).
 *
 * Reutiliza os helpers temporais da Sprint 4.2 e os registros já existentes
 * em `focus_sessions` (relacionados ao ciclo via `study_cycle_id`).
 */

export interface CycleSessionInput {
  started_at: string;
  duration_minutes: number;
  study_cycle_id: string | null;
}

export interface CycleProgress {
  /** Calendário */
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  temporalProgress: number;
  /** Estudo */
  studiedDays: number;
  daysWithoutStudy: number;
  studiedMinutes: number;
  /** Planejamento (null quando o ciclo não tem dedicação planejada) */
  plannedTotalMinutes: number | null;
  plannedElapsedMinutes: number | null;
  plannedRemainingMinutes: number | null;
  studyProgress: number | null;
  compliance: number | null;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Minutos planejados por dia, derivados da dedicação já existente no ciclo. */
export const getPlannedMinutesPerDay = (cycle: CyclePlanningInput): number | null => {
  if (cycle.hours_per_day != null && cycle.hours_per_day > 0) return cycle.hours_per_day * 60;
  if (cycle.hours_per_week != null && cycle.hours_per_week > 0) return (cycle.hours_per_week * 60) / 7;
  return null;
};

/** "14h30" / "45min" / "0min" */
export const formatMinutes = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

export const computeCycleProgress = (
  cycle: CycleTimingInput & CyclePlanningInput & { id: string },
  sessions: CycleSessionInput[],
  now: Date = new Date()
): CycleProgress | null => {
  if (!cycle.start_date || !cycle.end_date) return null;

  const start = parseCycleDate(cycle.start_date);
  const end = parseCycleDate(cycle.end_date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const timing = getCycleTiming(cycle, now);

  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const elapsedDays =
    timing.status === "upcoming"
      ? 0
      : Math.max(0, Math.min(totalDays, differenceInCalendarDays(today, start) + 1));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const temporalProgress = Math.round((elapsedDays / totalDays) * 100);

  // Somente sessões deste ciclo e dentro do período planejado.
  const inCycle = sessions.filter((s) => {
    if (s.study_cycle_id !== cycle.id) return false;
    const d = new Date(s.started_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return day >= start && day <= end;
  });

  const studiedMinutes = inCycle.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const studiedDaySet = new Set(inCycle.filter((s) => s.duration_minutes > 0).map((s) => dayKey(new Date(s.started_at))));
  const studiedDays = studiedDaySet.size;
  const daysWithoutStudy = Math.max(0, elapsedDays - studiedDays);

  const perDay = getPlannedMinutesPerDay(cycle);
  const plannedTotalMinutes = perDay != null ? perDay * totalDays : null;
  const plannedElapsedMinutes = perDay != null ? perDay * elapsedDays : null;
  const plannedRemainingMinutes = perDay != null ? perDay * remainingDays : null;

  const studyProgress =
    plannedTotalMinutes && plannedTotalMinutes > 0
      ? Math.min(100, Math.round((studiedMinutes / plannedTotalMinutes) * 100))
      : null;
  const compliance =
    plannedElapsedMinutes && plannedElapsedMinutes > 0
      ? Math.round((studiedMinutes / plannedElapsedMinutes) * 100)
      : null;

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    temporalProgress,
    studiedDays,
    daysWithoutStudy,
    studiedMinutes,
    plannedTotalMinutes,
    plannedElapsedMinutes,
    plannedRemainingMinutes,
    studyProgress,
    compliance,
  };
};
