import type { FocusSessionWithDetails } from "@/services/studyAnalytics";

export interface StudyOverviewMetrics {
  totalMinutes: number;
  totalQuestions: number;
  totalCorrect: number;
  /** total de acertos ÷ total de questões (0-100). null quando não há questões. */
  accuracy: number | null;
  subjectsCount: number;
  sessionsCount: number;
  /** média das avaliações informadas (1-5). null quando nenhuma sessão foi avaliada. */
  averageRating: number | null;
  ratedSessionsCount: number;
  sessionsWithQuestionsCount: number;
}

export const EMPTY_OVERVIEW: StudyOverviewMetrics = {
  totalMinutes: 0,
  totalQuestions: 0,
  totalCorrect: 0,
  accuracy: null,
  subjectsCount: 0,
  sessionsCount: 0,
  averageRating: null,
  ratedSessionsCount: 0,
  sessionsWithQuestionsCount: 0,
};

/** Agrega uma lista de sessões já filtradas em métricas de visão geral. */
export const buildStudyOverview = (
  sessions: FocusSessionWithDetails[]
): StudyOverviewMetrics => {
  if (sessions.length === 0) return EMPTY_OVERVIEW;

  let totalMinutes = 0;
  let totalQuestions = 0;
  let totalCorrect = 0;
  let ratingSum = 0;
  let ratedSessionsCount = 0;
  let sessionsWithQuestionsCount = 0;
  const subjectKeys = new Set<string>();

  for (const s of sessions) {
    totalMinutes += s.duration_minutes || 0;

    const questions = s.questions_total || 0;
    if (questions > 0) {
      totalQuestions += questions;
      totalCorrect += Math.min(questions, s.questions_correct || 0);
      sessionsWithQuestionsCount += 1;
    }

    if (s.rating && s.rating >= 1 && s.rating <= 5) {
      ratingSum += s.rating;
      ratedSessionsCount += 1;
    }

    if (s.subject_id) subjectKeys.add(s.subject_id);
  }

  return {
    totalMinutes,
    totalQuestions,
    totalCorrect,
    accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : null,
    subjectsCount: subjectKeys.size,
    sessionsCount: sessions.length,
    averageRating: ratedSessionsCount > 0 ? ratingSum / ratedSessionsCount : null,
    ratedSessionsCount,
    sessionsWithQuestionsCount,
  };
};

export type ComparisonKind = "percent" | "points";

export interface MetricComparison {
  kind: ComparisonKind;
  /** variação: % relativa ou pontos percentuais */
  delta: number | null;
  previousValue: number | null;
  direction: "up" | "down" | "flat";
}

/** Variação percentual relativa entre dois valores absolutos. */
export const comparePercent = (
  current: number,
  previous: number
): MetricComparison => {
  if (!previous) {
    return {
      kind: "percent",
      delta: null,
      previousValue: previous,
      direction: "flat",
    };
  }
  const delta = ((current - previous) / previous) * 100;
  return {
    kind: "percent",
    delta,
    previousValue: previous,
    direction: delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat",
  };
};

/** Variação em pontos percentuais (para taxa de acerto). */
export const comparePoints = (
  current: number | null,
  previous: number | null
): MetricComparison => {
  if (current === null || previous === null) {
    return { kind: "points", delta: null, previousValue: previous, direction: "flat" };
  }
  const delta = current - previous;
  return {
    kind: "points",
    delta,
    previousValue: previous,
    direction: delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat",
  };
};

export const formatStudyMinutes = (mins: number): string => {
  const safe = Math.max(0, Math.round(mins));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
};

export const formatComparison = (comparison: MetricComparison): string | null => {
  if (comparison.delta === null) return null;
  const rounded =
    comparison.kind === "points"
      ? Math.round(comparison.delta)
      : Math.round(comparison.delta);
  if (rounded === 0) return comparison.kind === "points" ? "0 p.p." : "0%";
  const sign = rounded > 0 ? "+" : "";
  return comparison.kind === "points"
    ? `${sign}${rounded} p.p.`
    : `${sign}${rounded}%`;
};

/** Poucos dados: evita conclusões fortes sobre evolução. */
export const hasEnoughDataForTrend = (
  current: StudyOverviewMetrics,
  previous: StudyOverviewMetrics
): boolean => current.sessionsCount >= 2 && previous.sessionsCount >= 1;
