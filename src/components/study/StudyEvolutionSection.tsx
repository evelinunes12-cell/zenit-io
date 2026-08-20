import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatStudyMinutes } from "@/lib/studyMetrics";
import { buildConsistency, type StudyTimeBucket } from "@/lib/studyBreakdown";

type EvolutionMetric = "minutes" | "questions" | "accuracy";

const METRIC_LABEL: Record<EvolutionMetric, string> = {
  minutes: "Tempo estudado",
  questions: "Questões",
  accuracy: "Taxa de acerto",
};

interface StudyEvolutionSectionProps {
  series: StudyTimeBucket[];
  granularityLabel: string;
}

const formatMetric = (metric: EvolutionMetric, bucket: StudyTimeBucket): string => {
  if (metric === "minutes") return formatStudyMinutes(bucket.minutes);
  if (metric === "questions") return String(bucket.questions);
  return bucket.accuracy === null ? "—" : `${Math.round(bucket.accuracy)}%`;
};

export const StudyEvolutionSection = ({
  series,
  granularityLabel,
}: StudyEvolutionSectionProps) => {
  const [metric, setMetric] = useState<EvolutionMetric>("minutes");

  const consistency = useMemo(() => buildConsistency(series), [series]);

  const chartData = useMemo(
    () =>
      series.map((b) => ({
        ...b,
        // Barras de acerto só existem quando há questões (não vira 0%)
        value:
          metric === "minutes"
            ? b.minutes
            : metric === "questions"
            ? b.questions
            : b.accuracy ?? 0,
        hasValue:
          metric === "accuracy" ? b.accuracy !== null : !b.isEmpty,
      })),
    [series, metric]
  );

  const hasAnyData = series.some((b) => !b.isEmpty);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-bold text-foreground">Evolução</h2>
          <span className="text-xs text-muted-foreground truncate">
            por {granularityLabel}
          </span>
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as EvolutionMetric)}>
          <TabsList className="h-8">
            <TabsTrigger value="minutes" className="text-xs px-2">Tempo</TabsTrigger>
            <TabsTrigger value="questions" className="text-xs px-2">Questões</TabsTrigger>
            <TabsTrigger value="accuracy" className="text-xs px-2">Acerto</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{METRIC_LABEL[metric]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAnyData ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum registro neste período.
            </p>
          ) : (
            <>
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={metric === "accuracy" ? [0, 100] : undefined}
                      tickFormatter={(v: number) =>
                        metric === "minutes"
                          ? formatStudyMinutes(v)
                          : metric === "accuracy"
                          ? `${v}%`
                          : String(v)
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const b = payload[0].payload as StudyTimeBucket;
                        return (
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="font-medium text-foreground">{b.fullLabel}</p>
                            <p className="text-muted-foreground">
                              {formatStudyMinutes(b.minutes)} ·{" "}
                              {b.questions > 0 ? `${b.questions} questões` : "sem questões"}
                            </p>
                            <p className="text-muted-foreground">
                              Acerto: {b.accuracy === null ? "—" : `${Math.round(b.accuracy)}%`}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {chartData.map((b) => (
                        <Cell
                          key={b.key}
                          fill={b.hasValue ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Estudou em{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {consistency.studiedBuckets}
                  </span>{" "}
                  de {consistency.totalBuckets} {granularityLabel}s (
                  {Math.round(consistency.consistency)}%)
                </span>
                {consistency.bestBucket && (
                  <span>
                    Melhor: {consistency.bestBucket.fullLabel} ·{" "}
                    {formatStudyMinutes(consistency.bestBucket.minutes)}
                  </span>
                )}
              </div>

              {/* Detalhamento tabular — responsivo, sem overflow acidental */}
              <div className="rounded-lg border border-border divide-y divide-border max-h-72 overflow-y-auto">
                {series.map((b) => (
                  <div
                    key={b.key}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2 text-sm min-w-0",
                      b.isEmpty && "bg-muted/30"
                    )}
                  >
                    <span className="text-foreground truncate min-w-0">{b.fullLabel}</span>
                    <span className="flex items-center gap-3 shrink-0 tabular-nums text-xs">
                      <span className={cn(b.isEmpty ? "text-muted-foreground" : "text-foreground")}>
                        {formatStudyMinutes(b.minutes)}
                      </span>
                      <span className="text-muted-foreground hidden sm:inline">
                        {b.questions > 0 ? `${b.questions} q.` : "—"}
                      </span>
                      <span className="text-muted-foreground w-10 text-right">
                        {formatMetric("accuracy", b)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dias sem registro aparecem como 0h. Ausência de questões é exibida como “—”,
                não como 0% de acerto.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default StudyEvolutionSection;
