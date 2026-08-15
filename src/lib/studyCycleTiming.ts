import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Sprint 4.2 — planejamento temporal dos Ciclos de Estudo.
 *
 * Helpers puros que derivam o estado temporal de um ciclo a partir das datas
 * já armazenadas (`start_date` / `end_date`, no formato yyyy-MM-dd).
 * As datas são de planejamento (sem hora), por isso são sempre convertidas
 * para uma data LOCAL, evitando o deslocamento de um dia causado por UTC.
 */

export type CycleTemporalStatus = "upcoming" | "active" | "ending_soon" | "completed" | "undated";

/** Janela (em dias) na qual um ciclo ativo passa a ser "terminando em breve". */
export const CYCLE_ENDING_SOON_DAYS = 7;

/** Converte "yyyy-MM-dd" (ou ISO completo) em Date local, sem efeito de timezone. */
export const parseCycleDate = (value: string): Date => {
  const [y, m, d] = value.split("T")[0].split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const formatCycleDate = (value: string): string =>
  format(parseCycleDate(value), "dd/MM/yyyy", { locale: ptBR });

const startOfToday = (now: Date = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate());

export interface CycleTimingInput {
  start_date?: string | null;
  end_date?: string | null;
}

export interface CycleTiming {
  status: CycleTemporalStatus;
  /** Rótulo curto do estado ("Em andamento", "Encerrado", ...). */
  label: string;
  /** Frase contextual ("Começa amanhã", "Termina em 5 dias", ...). */
  contextLabel: string | null;
  /** Dias até o início (negativo se já começou). null se sem data. */
  daysToStart: number | null;
  /** Dias até o fim (negativo se já terminou). null se sem data. */
  daysToEnd: number | null;
  startFormatted: string | null;
  endFormatted: string | null;
  hasDates: boolean;
}

/** "hoje" / "amanhã" / "em N dias" — com singular/plural correto. */
export const relativeDaysLabel = (days: number): string => {
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
};

/** "1 dia" / "N dias". */
export const daysCountLabel = (days: number): string =>
  `${days} ${days === 1 ? "dia" : "dias"}`;

/**
 * Estado temporal único do ciclo. Prioridade: completed → upcoming →
 * ending_soon → active. Nunca depende de texto exibido na interface.
 */
export const getCycleTiming = (cycle: CycleTimingInput, now: Date = new Date()): CycleTiming => {
  const today = startOfToday(now);
  const start = cycle.start_date ? parseCycleDate(cycle.start_date) : null;
  const end = cycle.end_date ? parseCycleDate(cycle.end_date) : null;

  const daysToStart = start ? differenceInCalendarDays(start, today) : null;
  const daysToEnd = end ? differenceInCalendarDays(end, today) : null;

  const base = {
    daysToStart,
    daysToEnd,
    startFormatted: cycle.start_date ? formatCycleDate(cycle.start_date) : null,
    endFormatted: cycle.end_date ? formatCycleDate(cycle.end_date) : null,
    hasDates: !!(start || end),
  };

  if (!start && !end) {
    return { ...base, status: "undated", label: "Sem planejamento temporal", contextLabel: null };
  }

  // 1. Encerrado
  if (daysToEnd !== null && daysToEnd < 0) {
    return {
      ...base,
      status: "completed",
      label: "Encerrado",
      contextLabel: `Encerrado em ${base.endFormatted}`,
    };
  }

  // 2. Ainda não iniciado
  if (daysToStart !== null && daysToStart > 0) {
    return {
      ...base,
      status: "upcoming",
      label: "Ainda não iniciado",
      contextLabel: `Começa ${relativeDaysLabel(daysToStart)}`,
    };
  }

  // 3. Terminando em breve (continua sendo um ciclo em andamento)
  if (daysToEnd !== null && daysToEnd <= CYCLE_ENDING_SOON_DAYS) {
    return {
      ...base,
      status: "ending_soon",
      label: "Terminando em breve",
      contextLabel: daysToEnd === 0 ? "Termina hoje" : `Termina ${relativeDaysLabel(daysToEnd)}`,
    };
  }

  // 4. Em andamento
  return {
    ...base,
    status: "active",
    label: "Em andamento",
    contextLabel:
      daysToEnd !== null
        ? `Termina em ${daysCountLabel(daysToEnd)}`
        : daysToStart === 0
          ? "Começa hoje"
          : null,
  };
};

/** Classes de badge por estado, usando apenas tokens semânticos do tema. */
export const cycleTimingBadgeClass = (status: CycleTemporalStatus): string => {
  switch (status) {
    case "upcoming":
      return "bg-primary/10 text-primary border-primary/20";
    case "ending_soon":
      return "bg-warning/10 text-warning border-warning/20";
    case "completed":
      return "bg-muted text-muted-foreground border-border";
    case "active":
      return "bg-success/10 text-success border-success/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

/**
 * Dedicação planejada (compartilhada por Ciclos Simples e Avançados).
 * A frequência é derivada da coluna preenchida: hours_per_day => diária,
 * hours_per_week => semanal. Apenas armazenamento/exibição (Sprint 4.2).
 */
export type CyclePlanningFrequency = "daily" | "weekly";

export interface CyclePlanningInput {
  hours_per_day?: number | null;
  hours_per_week?: number | null;
}

export const getPlanningFrequency = (
  cycle: CyclePlanningInput
): CyclePlanningFrequency | null => {
  if (cycle.hours_per_day != null) return "daily";
  if (cycle.hours_per_week != null) return "weekly";
  return null;
};

/** "2h30 por dia" / "10h por semana" / null quando não planejado. */
export const formatPlannedDedication = (cycle: CyclePlanningInput): string | null => {
  const frequency = getPlanningFrequency(cycle);
  if (!frequency) return null;
  const hours = frequency === "daily" ? cycle.hours_per_day! : cycle.hours_per_week!;
  if (!hours || hours <= 0) return null;

  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const time = h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : `${m}min`;
  return `${time} ${frequency === "daily" ? "por dia" : "por semana"}`;
};
