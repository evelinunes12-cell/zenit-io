import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  subDays,
  differenceInCalendarDays,
  format,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type StudyPeriodPreset =
  | "today"
  | "this-week"
  | "last-7"
  | "this-month"
  | "last-30"
  | "custom";

export interface StudyPeriod {
  from: Date;
  to: Date;
}

export const STUDY_PERIOD_PRESETS: { value: StudyPeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "this-week", label: "Esta semana" },
  { value: "last-7", label: "Últimos 7 dias" },
  { value: "this-month", label: "Este mês" },
  { value: "last-30", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

/** Normalizes any range to full days (00:00 → 23:59:59.999). */
export const normalizePeriod = (from: Date, to: Date): StudyPeriod => ({
  from: startOfDay(from),
  to: endOfDay(to),
});

export const getPeriodFromPreset = (
  preset: StudyPeriodPreset,
  reference: Date = new Date()
): StudyPeriod => {
  switch (preset) {
    case "today":
      return normalizePeriod(reference, reference);
    case "this-week":
      // Semana corrente (segunda → hoje), respeitando pt-BR
      return normalizePeriod(
        startOfWeek(reference, { locale: ptBR, weekStartsOn: 1 }),
        reference
      );
    case "last-7":
      return normalizePeriod(subDays(reference, 6), reference);
    case "this-month":
      return normalizePeriod(startOfMonth(reference), reference);
    case "last-30":
      return normalizePeriod(subDays(reference, 29), reference);
    default:
      return normalizePeriod(subDays(reference, 29), reference);
  }
};

/** Duração do período em dias corridos (mínimo 1). */
export const getPeriodLengthInDays = (period: StudyPeriod): number =>
  Math.max(1, differenceInCalendarDays(period.to, period.from) + 1);

/**
 * Período anterior imediatamente adjacente, com exatamente a mesma duração.
 * Ex.: 10/08 → 16/08 gera 03/08 → 09/08.
 */
export const getPreviousPeriod = (period: StudyPeriod): StudyPeriod => {
  const days = getPeriodLengthInDays(period);
  const previousTo = subDays(period.from, 1);
  const previousFrom = subDays(previousTo, days - 1);
  return normalizePeriod(previousFrom, previousTo);
};

export const formatPeriodLabel = (period: StudyPeriod): string => {
  if (isSameDay(period.from, period.to)) {
    return format(period.from, "dd 'de' MMM 'de' yyyy", { locale: ptBR });
  }
  return `${format(period.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(
    period.to,
    "dd/MM/yyyy",
    { locale: ptBR }
  )}`;
};

/** Rótulo curto usado como título da visão geral. */
export const getPeriodTitle = (
  preset: StudyPeriodPreset,
  period: StudyPeriod
): string => {
  if (preset === "custom") return "Período selecionado";
  return STUDY_PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? "Período";
};

export const isWithinPeriod = (date: Date, period: StudyPeriod): boolean =>
  date.getTime() >= period.from.getTime() && date.getTime() <= period.to.getTime();
