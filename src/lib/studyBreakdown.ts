import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FocusSessionWithDetails } from "@/services/studyAnalytics";
import { getPeriodLengthInDays, type StudyPeriod } from "@/lib/studyPeriod";
import { comparePercent, comparePoints, type MetricComparison } from "@/lib/studyMetrics";

/* -------------------------------------------------------------------------- */
/* Evolução temporal                                                          */
/* -------------------------------------------------------------------------- */

export type StudyGranularity = "day" | "week" | "month";

export interface StudyTimeBucket {
  key: string;
  /** rótulo curto usado em eixos/gráficos (ex.: "Seg", "12/08", "ago") */
  label: string;
  /** rótulo completo para tooltips e leitores de tela */
  fullLabel: string;
  from: Date;
  to: Date;
  minutes: number;
  questions: number;
  correct: number;
  /** null quando não houve questões no bucket (≠ 0%) */
  accuracy: number | null;
  sessionsCount: number;
  /** true quando o bucket existe no calendário mas não teve nenhuma sessão */
  isEmpty: boolean;
}

/** Escolhe a granularidade adequada ao tamanho do período selecionado. */
export const resolveGranularity = (period: StudyPeriod): StudyGranularity => {
  const days = getPeriodLengthInDays(period);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
};

const buildBuckets = (
  period: StudyPeriod,
  granularity: StudyGranularity
): Omit<StudyTimeBucket, "minutes" | "questions" | "correct" | "accuracy" | "sessionsCount" | "isEmpty">[] => {
  if (granularity === "day") {
    return eachDayOfInterval({ start: period.from, end: period.to }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label:
        getPeriodLengthInDays(period) <= 8
          ? format(d, "EEE", { locale: ptBR }).replace(".", "")
          : format(d, "dd/MM", { locale: ptBR }),
      fullLabel: format(d, "dd 'de' MMM", { locale: ptBR }),
      from: d,
      to: endOfDay(d),
    }));
  }

  if (granularity === "week") {
    const buckets = [];
    let cursor = startOfWeek(period.from, { locale: ptBR, weekStartsOn: 1 });
    while (isBefore(cursor, period.to)) {
      const end = endOfWeek(cursor, { locale: ptBR, weekStartsOn: 1 });
      buckets.push({
        key: format(cursor, "yyyy-MM-dd"),
        label: format(cursor, "dd/MM", { locale: ptBR }),
        fullLabel: `Semana de ${format(cursor, "dd/MM", { locale: ptBR })}`,
        from: cursor,
        to: end,
      });
      cursor = addDays(end, 1);
    }
    return buckets;
  }

  const buckets = [];
  let cursor = startOfMonth(period.from);
  while (isBefore(cursor, period.to)) {
    buckets.push({
      key: format(cursor, "yyyy-MM"),
      label: format(cursor, "MMM", { locale: ptBR }).replace(".", ""),
      fullLabel: format(cursor, "MMMM 'de' yyyy", { locale: ptBR }),
      from: cursor,
      to: endOfMonth(cursor),
    });
    cursor = addMonths(cursor, 1);
  }
  return buckets;
};

/**
 * Agrega sessões em buckets contínuos do período.
 * Buckets sem sessão permanecem visíveis com 0h (isEmpty = true) — "não estudou"
 * é informação, não ausência de dado.
 */
export const buildStudyTimeSeries = (
  sessions: FocusSessionWithDetails[],
  period: StudyPeriod,
  granularity: StudyGranularity = resolveGranularity(period)
): StudyTimeBucket[] => {
  const base = buildBuckets(period, granularity);
  const series: StudyTimeBucket[] = base.map((b) => ({
    ...b,
    minutes: 0,
    questions: 0,
    correct: 0,
    accuracy: null,
    sessionsCount: 0,
    isEmpty: true,
  }));

  for (const s of sessions) {
    const t = new Date(s.started_at).getTime();
    const bucket = series.find((b) => t >= b.from.getTime() && t <= b.to.getTime());
    if (!bucket) continue;
    bucket.minutes += s.duration_minutes || 0;
    const q = s.questions_total || 0;
    if (q > 0) {
      bucket.questions += q;
      bucket.correct += Math.min(q, s.questions_correct || 0);
    }
    bucket.sessionsCount += 1;
    bucket.isEmpty = false;
  }

  for (const b of series) {
    b.accuracy = b.questions > 0 ? (b.correct / b.questions) * 100 : null;
  }

  return series;
};

export interface StudyStreakInfo {
  /** buckets com estudo ÷ total de buckets (0-100) */
  consistency: number;
  studiedBuckets: number;
  totalBuckets: number;
  bestBucket: StudyTimeBucket | null;
}

export const buildConsistency = (series: StudyTimeBucket[]): StudyStreakInfo => {
  const studied = series.filter((b) => !b.isEmpty);
  const best = studied.reduce<StudyTimeBucket | null>(
    (acc, b) => (!acc || b.minutes > acc.minutes ? b : acc),
    null
  );
  return {
    consistency: series.length > 0 ? (studied.length / series.length) * 100 : 0,
    studiedBuckets: studied.length,
    totalBuckets: series.length,
    bestBucket: best,
  };
};

/* -------------------------------------------------------------------------- */
/* Desempenho por disciplina                                                  */
/* -------------------------------------------------------------------------- */

export const NO_SUBJECT_KEY = "__no_subject__";
export const NO_SUBJECT_LABEL = "Sem disciplina";

/** Amostra mínima de questões para permitir conclusões de variação. */
export const MIN_QUESTIONS_FOR_COMPARISON = 10;

export interface SubjectTopicBreakdown {
  topic: string;
  minutes: number;
  questions: number;
  correct: number;
  accuracy: number | null;
}

export interface SubjectAggregate {
  key: string;
  name: string;
  color: string | null;
  minutes: number;
  questions: number;
  correct: number;
  /** null quando a disciplina não teve questões no período */
  accuracy: number | null;
  sessionsCount: number;
  topics: SubjectTopicBreakdown[];
}

const aggregateSubjects = (
  sessions: FocusSessionWithDetails[]
): Map<string, SubjectAggregate> => {
  const map = new Map<string, SubjectAggregate>();
  const topicMaps = new Map<string, Map<string, SubjectTopicBreakdown>>();

  for (const s of sessions) {
    const key = s.subject_id ?? NO_SUBJECT_KEY;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        name: s.subject_name || NO_SUBJECT_LABEL,
        color: s.subject_color,
        minutes: 0,
        questions: 0,
        correct: 0,
        accuracy: null,
        sessionsCount: 0,
        topics: [],
      };
      map.set(key, entry);
      topicMaps.set(key, new Map());
    }

    entry.minutes += s.duration_minutes || 0;
    entry.sessionsCount += 1;

    const q = s.questions_total || 0;
    if (q > 0) {
      entry.questions += q;
      entry.correct += Math.min(q, s.questions_correct || 0);
    }

    const topic = s.topic?.trim();
    if (topic) {
      const topics = topicMaps.get(key)!;
      const existing = topics.get(topic) ?? {
        topic,
        minutes: 0,
        questions: 0,
        correct: 0,
        accuracy: null,
      };
      existing.minutes += s.duration_minutes || 0;
      if (q > 0) {
        existing.questions += q;
        existing.correct += Math.min(q, s.questions_correct || 0);
      }
      topics.set(topic, existing);
    }
  }

  for (const [key, entry] of map) {
    entry.accuracy = entry.questions > 0 ? (entry.correct / entry.questions) * 100 : null;
    entry.topics = Array.from(topicMaps.get(key)?.values() ?? [])
      .map((t) => ({
        ...t,
        accuracy: t.questions > 0 ? (t.correct / t.questions) * 100 : null,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  return map;
};

export interface SubjectPerformanceRow extends SubjectAggregate {
  /** dados da disciplina no período anterior (ausente quando não estudou) */
  previous: SubjectAggregate | null;
  timeComparison: MetricComparison | null;
  questionsComparison: MetricComparison | null;
  accuracyComparison: MetricComparison | null;
  /** false quando a amostra é pequena demais para concluir algo */
  canCompareAccuracy: boolean;
  /** participação da disciplina no tempo total do período (0-100) */
  timeShare: number;
}

/**
 * Consolida disciplinas do período atual e anexa comparações com o anterior.
 * Taxa de acerto = soma de acertos ÷ soma de questões (nunca média das sessões).
 */
export const buildSubjectPerformance = (
  sessions: FocusSessionWithDetails[],
  previousSessions: FocusSessionWithDetails[]
): SubjectPerformanceRow[] => {
  const current = aggregateSubjects(sessions);
  const previous = aggregateSubjects(previousSessions);
  const totalMinutes = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);

  return Array.from(current.values())
    .map<SubjectPerformanceRow>((entry) => {
      const prev = previous.get(entry.key) ?? null;
      const canCompareAccuracy =
        !!prev &&
        entry.accuracy !== null &&
        prev.accuracy !== null &&
        entry.questions >= MIN_QUESTIONS_FOR_COMPARISON &&
        prev.questions >= MIN_QUESTIONS_FOR_COMPARISON;

      return {
        ...entry,
        previous: prev,
        timeComparison: prev && prev.minutes > 0 ? comparePercent(entry.minutes, prev.minutes) : null,
        questionsComparison:
          prev && prev.questions > 0 ? comparePercent(entry.questions, prev.questions) : null,
        accuracyComparison: canCompareAccuracy ? comparePoints(entry.accuracy, prev!.accuracy) : null,
        canCompareAccuracy,
        timeShare: totalMinutes > 0 ? (entry.minutes / totalMinutes) * 100 : 0,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
};
