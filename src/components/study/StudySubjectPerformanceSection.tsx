import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Layers } from "lucide-react";
import { formatComparison, formatStudyMinutes, type MetricComparison } from "@/lib/studyMetrics";
import type { SubjectPerformanceRow } from "@/lib/studyBreakdown";

interface StudySubjectPerformanceSectionProps {
  rows: SubjectPerformanceRow[];
}

const Trend = ({ comparison }: { comparison: MetricComparison | null }) => {
  const text = comparison ? formatComparison(comparison) : null;
  if (!text) return null;
  const Icon =
    comparison!.direction === "up"
      ? ArrowUpRight
      : comparison!.direction === "down"
      ? ArrowDownRight
      : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        comparison!.direction === "up" && "text-success",
        comparison!.direction === "down" && "text-destructive",
        comparison!.direction === "flat" && "text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {text}
    </span>
  );
};

const SubjectRow = ({ row }: { row: SubjectPerformanceRow }) => {
  const [open, setOpen] = useState(false);
  const hasTopics = row.topics.length > 0;

  return (
    <div className="px-3 sm:px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: row.color || "hsl(var(--muted-foreground))" }}
          />
          <span className="font-medium text-foreground truncate">{row.name}</span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formatStudyMinutes(row.minutes)}
          </p>
          <Trend comparison={row.timeComparison} />
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, row.timeShare)}%`,
            backgroundColor: row.color || "hsl(var(--primary))",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {row.questions > 0 ? `${row.questions} questões` : "Sem questões"}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          Acerto:{" "}
          <span className={cn("font-medium", row.accuracy !== null && "text-foreground")}>
            {row.accuracy === null ? "—" : `${Math.round(row.accuracy)}%`}
          </span>
          {row.canCompareAccuracy ? (
            <Trend comparison={row.accuracyComparison} />
          ) : row.questions > 0 && row.previous ? (
            <span className="text-[11px]">· dados insuficientes para comparação</span>
          ) : null}
        </span>
        <span className="tabular-nums">{row.sessionsCount} sessões</span>
        <span className="tabular-nums">{Math.round(row.timeShare)}% do tempo</span>
      </div>

      {hasTopics && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 -ml-1 text-[11px] text-muted-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <ChevronDown className={cn("h-3 w-3 mr-1 transition-transform", open && "rotate-180")} />
            {open ? "Ocultar assuntos" : `Ver assuntos (${row.topics.length})`}
          </Button>
          {open && (
            <ul className="space-y-1 pl-4 border-l border-border">
              {row.topics.map((t) => (
                <li
                  key={t.topic}
                  className="flex items-center justify-between gap-3 text-xs min-w-0"
                >
                  <span className="text-foreground truncate min-w-0">{t.topic}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatStudyMinutes(t.minutes)}
                    {t.questions > 0 ? ` · ${t.questions} q.` : ""}
                    {t.accuracy !== null ? ` · ${Math.round(t.accuracy)}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export const StudySubjectPerformanceSection = ({
  rows,
}: StudySubjectPerformanceSectionProps) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary shrink-0" />
        <h2 className="text-lg font-bold text-foreground">Desempenho por disciplina</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhuma disciplina estudada neste período.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <SubjectRow key={row.key} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default StudySubjectPerformanceSection;
