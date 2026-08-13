import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateFocusSession } from "@/services/focusSessions";
import StudySessionExtrasFields, {
  emptyStudyExtras,
  normalizeStudyExtras,
  type StudySessionExtrasValue,
} from "@/components/study/StudySessionExtrasFields";

interface PomodoroCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  subjectName?: string | null;
  durationMinutes?: number;
  onSaved?: () => void;
}

/** Etapa de encerramento do Pomodoro — todos os campos são opcionais. */
const PomodoroCompletionDialog = ({
  open,
  onOpenChange,
  sessionId,
  subjectName,
  durationMinutes,
  onSaved,
}: PomodoroCompletionDialogProps) => {
  const [extras, setExtras] = useState<StudySessionExtrasValue>(emptyStudyExtras);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setExtras(emptyStudyExtras());
  }, [open]);

  const handleSave = async () => {
    if (!sessionId) {
      onOpenChange(false);
      return;
    }
    const normalized = normalizeStudyExtras(extras);
    setSaving(true);
    const ok = await updateFocusSession(sessionId, {
      questionsTotal: normalized.questionsTotal,
      questionsCorrect: normalized.questionsCorrect,
      topic: normalized.topic,
      notes: normalized.notes,
      rating: normalized.rating,
    });
    setSaving(false);
    if (ok) {
      toast.success("Detalhes da sessão salvos.");
      onSaved?.();
      onOpenChange(false);
    } else {
      toast.error("Erro ao salvar os detalhes da sessão.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🍅 Pomodoro concluído!</DialogTitle>
          <DialogDescription>
            Como foi essa sessão
            {subjectName ? ` de ${subjectName}` : ""}
            {durationMinutes ? ` (${durationMinutes} min)` : ""}? Os campos abaixo são opcionais.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <StudySessionExtrasFields
            value={extras}
            onChange={(patch) => setExtras((prev) => ({ ...prev, ...patch }))}
            idPrefix="pomodoro-done"
          />
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Concluir sem detalhes
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar detalhes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PomodoroCompletionDialog;
