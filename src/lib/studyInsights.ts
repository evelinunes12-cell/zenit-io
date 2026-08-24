import {
  buildConsistency,
  MIN_QUESTIONS_FOR_COMPARISON,
  type StudyTimeBucket,
  type SubjectPerformanceRow,
} from "@/lib/studyBreakdown";
import {
  comparePercent,
  comparePoints,
  formatComparison,
  formatStudyMinutes,
  type StudyOverviewMetrics,
} from "@/lib/studyMetrics";

/** Variação mínima (em p.p.) para considerar uma mudança relevante por disciplina. */
export const MIN_ACCURACY_SHIFT_POINTS = 5;

/** Amostra mínima de questões para eleger melhor/pior desempenho. */
export const MIN_QUESTIONS_FOR_INSIGHT = MIN_QUESTIONS_FOR_COMPARISON;

export type StudyInsightTone = "neutral" | "positive" | "attention";

export interface StudyInsight {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** informação complementar opcional (percentual, amostra, etc.) */
  detail?: string;
  tone: StudyInsightTone;
}

const consistencyLabel = (pct: number): string => {
  if (pct < 40) return "baixa frequência";
  if (pct < 70) return "frequência moderada";
  if (pct < 90) return "boa frequência";
  return "alta frequência";
};

const formatAccuracy = (value: number) => `${Math.round(value)}%`;

export interface BuildStudyInsightsInput {
  overview: StudyOverviewMetrics;
  previousOverview: StudyOverviewMetrics;
  series: StudyTimeBucket[];
  subjects: SubjectPerformanceRow[];
  /** rótulo do bucket ("dia", "semana", "mês") usado nos textos de consistência */
  granularityLabel: string;
}

/**
 * Insights descritivos do período — apenas interpretação dos dados já carregados.
 * Sem recomendações, sem IA e sem novas queries.
 */
export const buildStudyInsights = ({
  overview,
  previousOverview,
  series,
  subjects,
  granularityLabel,
}: BuildStudyInsightsInput): StudyInsight[] => {
  const insights: StudyInsight[] = [];
  if (overview.sessionsCount === 0) return insights;

  const plural = granularityLabel === "mês" ? "meses" : `${granularityLabel}s`;

  /* Disciplina mais estudada -------------------------------------------- */
  const topSubject = subjects.find((s) => s.minutes > 0);
  if (topSubject) {
    insights.push({
      id: "top-subject",
      icon: "📚",
      title: "Disciplina mais estudada",
      description: `${topSubject.name} — ${formatStudyMinutes(topSubject.minutes)}`,
      detail: `${Math.round(topSubject.timeShare)}% do seu tempo de estudo no período`,
      tone: "neutral",
    });
  }

  /* Melhor / menor desempenho em questões -------------------------------- */
  const eligible = subjects.filter(
    (s) => s.accuracy !== null && s.questions >= MIN_QUESTIONS_FOR_INSIGHT
  );

  if (eligible.length === 0) {
    if (overview.totalQuestions > 0) {
      insights.push({
        id: "accuracy-insufficient",
        icon: "🎯",
        title: "Desempenho em questões",
        description:
          "Ainda não há questões suficientes para identificar seu melhor desempenho.",
        detail: `São necessárias ao menos ${MIN_QUESTIONS_FOR_INSIGHT} questões em uma disciplina`,
        tone: "neutral",
      });
    }
  } else {
    const sorted = [...eligible].sort((a, b) => (b.accuracy! - a.accuracy!));
    const best = sorted[0];
    insights.push({
      id: "best-accuracy",
      icon: "🎯",
      title: "Melhor taxa de acerto no período",
      description: `${best.name} — ${formatAccuracy(best.accuracy!)}`,
      detail: `${best.questions} questões resolvidas`,
      tone: "positive",
    });

    const worst = sorted[sorted.length - 1];
    if (sorted.length > 1) {
      insights.push({
        id: "worst-accuracy",
        icon: "⚠️",
        title: "Menor taxa de acerto no período",
        description: `${worst.name} — ${formatAccuracy(worst.accuracy!)}`,
        detail: `${worst.questions} questões resolvidas`,
        tone: "attention",
      });
    }
  }

  /* Consistência --------------------------------------------------------- */
  const consistency = buildConsistency(series);
  if (consistency.totalBuckets > 0) {
    const unit = consistency.totalBuckets === 1 ? granularityLabel : plural;
    insights.push({
      id: "consistency",
      icon: "🔥",
      title: "Consistência",
      description: `Você estudou em ${consistency.studiedBuckets} de ${consistency.totalBuckets} ${unit} do período.`,
      detail:
        consistency.studiedBuckets > 1
          ? `${Math.round(consistency.consistency)}% · ${consistencyLabel(consistency.consistency)}`
          : undefined,
      tone: "neutral",
    });
  }

  /* Ritmo médio ---------------------------------------------------------- */
  if (consistency.studiedBuckets > 0 && overview.totalMinutes > 0) {
    const average = overview.totalMinutes / consistency.studiedBuckets;
    insights.push({
      id: "pace",
      icon: "⏱️",
      title: "Ritmo médio",
      description: `${formatStudyMinutes(average)} por ${granularityLabel} estudado`,
      detail: `${formatStudyMinutes(overview.totalMinutes)} em ${consistency.studiedBuckets} ${
        consistency.studiedBuckets === 1 ? granularityLabel : plural
      }`,
      tone: "neutral",
    });
  }

  /* Prática -------------------------------------------------------------- */
  if (overview.totalQuestions > 0) {
    insights.push({
      id: "practice",
      icon: "📝",
      title: "Prática",
      description: `Você resolveu ${overview.totalQuestions} questões no período, com ${formatAccuracy(
        overview.accuracy ?? 0
      )} de acerto.`,
      detail: `${overview.totalCorrect} acertos em ${overview.sessionsWithQuestionsCount} ${
        overview.sessionsWithQuestionsCount === 1 ? "sessão" : "sessões"
      }`,
      tone: "neutral",
    });
  }

  /* Percepção das sessões ------------------------------------------------ */
  if (overview.ratedSessionsCount > 0 && overview.averageRating !== null) {
    insights.push({
      id: "rating",
      icon: "⭐",
      title: "Percepção das sessões",
      description: `Você avaliou suas sessões em média com ${overview.averageRating
        .toFixed(1)
        .replace(".", ",")}/5.`,
      detail: `${overview.ratedSessionsCount} de ${overview.sessionsCount} sessões avaliadas`,
      tone: "neutral",
    });
  }

  /* Comparação com o período anterior ------------------------------------ */
  if (previousOverview.sessionsCount > 0) {
    if (previousOverview.totalMinutes > 0 && overview.totalMinutes > 0) {
      const cmp = comparePercent(overview.totalMinutes, previousOverview.totalMinutes);
      const label = formatComparison(cmp);
      if (label && cmp.direction !== "flat") {
        insights.push({
          id: "time-trend",
          icon: cmp.direction === "up" ? "📈" : "📉",
          title: "Evolução do tempo de estudo",
          description: `Você estudou ${Math.abs(Math.round(cmp.delta!))}% ${
            cmp.direction === "up" ? "mais" : "menos"
          } tempo que no período anterior.`,
          detail: `Anterior: ${formatStudyMinutes(previousOverview.totalMinutes)}`,
          tone: cmp.direction === "up" ? "positive" : "attention",
        });
      }
    }

    if (previousOverview.totalQuestions > 0 && overview.totalQuestions > 0) {
      const cmp = comparePercent(overview.totalQuestions, previousOverview.totalQuestions);
      if (cmp.delta !== null && cmp.direction !== "flat") {
        insights.push({
          id: "questions-trend",
          icon: cmp.direction === "up" ? "📈" : "📉",
          title: "Volume de questões",
          description: `Você resolveu ${Math.abs(Math.round(cmp.delta))}% ${
            cmp.direction === "up" ? "mais" : "menos"
          } questões que no período anterior.`,
          detail: `Anterior: ${previousOverview.totalQuestions} questões`,
          tone: cmp.direction === "up" ? "positive" : "attention",
        });
      }
    }

    if (
      overview.accuracy !== null &&
      previousOverview.accuracy !== null &&
      overview.totalQuestions >= MIN_QUESTIONS_FOR_INSIGHT &&
      previousOverview.totalQuestions >= MIN_QUESTIONS_FOR_INSIGHT
    ) {
      const cmp = comparePoints(overview.accuracy, previousOverview.accuracy);
      if (cmp.delta !== null && Math.abs(cmp.delta) >= 1) {
        const up = cmp.delta > 0;
        insights.push({
          id: "accuracy-trend",
          icon: up ? "📈" : "📉",
          title: "Taxa de acerto",
          description: `Sua taxa de acerto ${up ? "aumentou" : "diminuiu"} ${Math.abs(
            Math.round(cmp.delta)
          )} p.p. em relação ao período anterior.`,
          detail: `${formatAccuracy(previousOverview.accuracy)} → ${formatAccuracy(overview.accuracy)}`,
          tone: up ? "positive" : "attention",
        });
      }
    }
  }

  /* Maior evolução / maior queda por disciplina --------------------------- */
  const comparable = subjects.filter(
    (s) =>
      s.canCompareAccuracy &&
      s.accuracyComparison?.delta !== null &&
      s.accuracyComparison !== null
  );

  if (comparable.length > 0) {
    const byDelta = [...comparable].sort(
      (a, b) => (b.accuracyComparison!.delta ?? 0) - (a.accuracyComparison!.delta ?? 0)
    );
    const rise = byDelta[0];
    const fall = byDelta[byDelta.length - 1];

    if ((rise.accuracyComparison!.delta ?? 0) >= MIN_ACCURACY_SHIFT_POINTS) {
      insights.push({
        id: "subject-rise",
        icon: "📈",
        title: "Maior evolução por disciplina",
        description: `${rise.name} passou de ${formatAccuracy(
          rise.previous!.accuracy!
        )} para ${formatAccuracy(rise.accuracy!)} de acerto.`,
        detail: `${rise.questions} questões no período atual`,
        tone: "positive",
      });
    }

    if (
      fall.key !== rise.key &&
      (fall.accuracyComparison!.delta ?? 0) <= -MIN_ACCURACY_SHIFT_POINTS
    ) {
      insights.push({
        id: "subject-fall",
        icon: "📉",
        title: "Maior queda por disciplina",
        description: `${fall.name} passou de ${formatAccuracy(
          fall.previous!.accuracy!
        )} para ${formatAccuracy(fall.accuracy!)} de acerto.`,
        detail: `${fall.questions} questões no período atual`,
        tone: "attention",
      });
    }
  }

  return insights;
};
