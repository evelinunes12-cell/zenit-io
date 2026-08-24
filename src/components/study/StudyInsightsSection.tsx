import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyInsight } from "@/lib/studyInsights";

interface StudyInsightsSectionProps {
  insights: StudyInsight[];
}

const toneClasses: Record<StudyInsight["tone"], string> = {
  neutral: "border-border bg-muted/30",
  positive: "border-success/30 bg-success/5",
  attention: "border-warning/30 bg-warning/5",
};

/** Insights descritivos do período — leitura objetiva, sem recomendações. */
const StudyInsightsSection = ({ insights }: StudyInsightsSectionProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 min-w-0 flex-wrap">
          <Lightbulb className="h-4 w-4 text-primary shrink-0" />
          Insights do período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há dados suficientes para gerar insights neste período.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.map((insight) => (
              <li
                key={insight.id}
                className={cn(
                  "rounded-lg border p-3 min-w-0 space-y-1",
                  toneClasses[insight.tone]
                )}
              >
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 break-words">
                  <span aria-hidden="true">{insight.icon}</span>
                  {insight.title}
                </p>
                <p className="text-sm font-medium text-foreground break-words">
                  {insight.description}
                </p>
                {insight.detail && (
                  <p className="text-xs text-muted-foreground break-words">{insight.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default StudyInsightsSection;
