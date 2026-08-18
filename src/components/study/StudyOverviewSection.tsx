import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CheckCircle, Clock, Star, Target, Layers } from "lucide-react";
import {
  formatComparison,
  formatStudyMinutes,
  comparePercent,
  comparePoints,
  hasEnoughDataForTrend,
  type MetricComparison,
  type StudyOverviewMetrics,
} from "@/lib/studyMetrics";
import { formatPeriodLabel, type StudyPeriod } from "@/lib/studyPeriod";

interface StudyOverviewSectionProps {
  title: string;
  period: StudyPeriod;
  previousPeriod: StudyPeriod;
  current: StudyOverviewMetrics;
  previous: StudyOverviewMetrics;
}

const MetricCard = ({
  icon: Icon,
  label,
  value,
  comparison,
  showComparison,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  comparison?: MetricComparison;
  showComparison: boolean;
  hint?: string;
}) => {
  const text = comparison && showComparison ? formatComparison(comparison) : null;
  const direction = comparison?.direction ?? "flat";
  const TrendIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium truncate">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums break-words">{value}</p>
        {text ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              direction === "up" && "text-success",
              direction === "down" && "text-destructive",
              direction === "flat" && "text-muted-foreground"
            )}
          >
            <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{text}</span>
            <span className="text-muted-foreground font-normal">vs. período anterior</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{hint ?? "Sem base de comparação"}</p>
        )}
      </CardContent>
    </Card>
  );
};

export const StudyOverviewSection = ({
  title,
  period,
  previousPeriod,
  current,
  previous,
}: StudyOverviewSectionProps) => {
  const showComparison = hasEnoughDataForTrend(current, previous);

  const timeComparison = comparePercent(current.totalMinutes, previous.totalMinutes);
  const questionsComparison = comparePercent(current.totalQuestions, previous.totalQuestions);
  const sessionsComparison = comparePercent(current.sessionsCount, previous.sessionsCount);
  const accuracyComparison = comparePoints(current.accuracy, previous.accuracy);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground break-words">
            {formatPeriodLabel(period)} · comparando com {formatPeriodLabel(previousPeriod)}
          </p>
        </div>
        {current.averageRating !== null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-warning fill-current" aria-hidden />
            Avaliação média: {current.averageRating.toFixed(1).replace(".", ",")}/5
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          icon={Clock}
          label="Tempo estudado"
          value={formatStudyMinutes(current.totalMinutes)}
          comparison={timeComparison}
          showComparison={showComparison}
        />
        <MetricCard
          icon={Target}
          label="Questões"
          value={String(current.totalQuestions)}
          comparison={questionsComparison}
          showComparison={showComparison}
          hint={current.totalQuestions === 0 ? "Nenhuma questão registrada" : undefined}
        />
        <MetricCard
          icon={CheckCircle}
          label="Taxa de acerto"
          value={current.accuracy === null ? "—" : `${Math.round(current.accuracy)}%`}
          comparison={accuracyComparison}
          showComparison={showComparison && current.accuracy !== null}
          hint={
            current.accuracy === null
              ? "Sem questões no período"
              : `${current.totalCorrect} de ${current.totalQuestions} questões`
          }
        />
        <MetricCard
          icon={Layers}
          label="Disciplinas"
          value={String(current.subjectsCount)}
          showComparison={false}
          hint={current.subjectsCount === 0 ? "Nenhuma disciplina vinculada" : "Disciplinas distintas estudadas"}
        />
        <MetricCard
          icon={BookOpen}
          label="Sessões"
          value={String(current.sessionsCount)}
          comparison={sessionsComparison}
          showComparison={showComparison}
        />
      </div>

      {!showComparison && current.sessionsCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Ainda há poucos registros neste período para indicar evolução ou queda com segurança.
        </p>
      )}
    </section>
  );
};

export default StudyOverviewSection;
