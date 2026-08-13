import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudySessionRatingProps {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
}

const LABELS: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Boa",
  5: "Excelente",
};

/** Avaliação opcional da sessão (1 a 5 estrelas). Clicar na nota atual limpa. */
const StudySessionRating = ({ value, onChange, id }: StudySessionRatingProps) => {
  return (
    <div className="flex items-center gap-2 flex-wrap" id={id}>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Avaliação da sessão">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (value ?? 0) >= n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} - ${LABELS[n]}`}
              onClick={() => onChange(value === n ? null : n)}
              className={cn(
                "rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-warning" : "text-muted-foreground/50"
              )}
            >
              <Star className={cn("h-5 w-5", active && "fill-current")} />
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {value ? LABELS[value] : "Sem avaliação"}
      </span>
    </div>
  );
};

export default StudySessionRating;
