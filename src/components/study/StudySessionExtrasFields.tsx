import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import StudySessionRating from "@/components/study/StudySessionRating";

export interface StudySessionExtrasValue {
  topic: string;
  questionsTotal: string;
  questionsCorrect: string;
  rating: number | null;
  notes: string;
}

interface StudySessionExtrasFieldsProps {
  value: StudySessionExtrasValue;
  onChange: (patch: Partial<StudySessionExtrasValue>) => void;
  /** Oculta questões/acertos quando o fluxo já coleta esses dados em outro lugar */
  showQuestions?: boolean;
  idPrefix?: string;
}

/** Campos complementares de um registro de estudo — todos opcionais. */
const StudySessionExtrasFields = ({
  value,
  onChange,
  showQuestions = true,
  idPrefix = "study-extras",
}: StudySessionExtrasFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-topic`}>Assunto estudado</Label>
        <Input
          id={`${idPrefix}-topic`}
          value={value.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
          placeholder="Ex.: Controle de Constitucionalidade"
          maxLength={200}
        />
      </div>

      {showQuestions && (
        <div className="space-y-2">
          <Label>Desempenho em questões</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={value.questionsTotal}
                onChange={(e) => onChange({ questionsTotal: e.target.value })}
                placeholder="0"
                aria-label="Questões resolvidas"
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-center">resolvidas</p>
            </div>
            <span className="text-muted-foreground pb-5">/</span>
            <div className="flex-1 min-w-0">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={value.questionsCorrect}
                onChange={(e) => onChange({ questionsCorrect: e.target.value })}
                placeholder="0"
                aria-label="Acertos"
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-center">acertos</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Como você avalia esta sessão?</Label>
        <StudySessionRating
          value={value.rating}
          onChange={(rating) => onChange({ rating })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-notes`}>Observação</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Dificuldades, próximos passos..."
          rows={3}
          maxLength={1000}
        />
      </div>
    </div>
  );
};

export const emptyStudyExtras = (): StudySessionExtrasValue => ({
  topic: "",
  questionsTotal: "",
  questionsCorrect: "",
  rating: null,
  notes: "",
});

/** Normaliza os campos complementares para gravação. */
export const normalizeStudyExtras = (value: StudySessionExtrasValue) => {
  const qTotal = Math.max(0, Math.floor(Number(value.questionsTotal) || 0));
  let qCorrect = Math.max(0, Math.floor(Number(value.questionsCorrect) || 0));
  if (qCorrect > qTotal) qCorrect = qTotal;
  const rating = value.rating && value.rating >= 1 && value.rating <= 5 ? value.rating : null;
  return {
    questionsTotal: qTotal,
    questionsCorrect: qCorrect,
    topic: value.topic.trim() || null,
    notes: value.notes.trim() || null,
    rating,
  };
};

export default StudySessionExtrasFields;
