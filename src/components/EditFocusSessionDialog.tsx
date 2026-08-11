import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteFocusSession,
  updateFocusSession,
} from "@/services/focusSessions";
import type { FocusSessionWithDetails } from "@/services/studyAnalytics";

interface SubjectOption {
  id: string;
  name: string;
  color: string | null;
}

interface EditFocusSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: FocusSessionWithDetails | null;
  subjects?: SubjectOption[];
  onSaved?: () => void;
}

const toLocalDatetimeInput = (iso: string) => {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const EditFocusSessionDialog = ({
  open,
  onOpenChange,
  session,
  subjects = [],
  onSaved,
}: EditFocusSessionDialogProps) => {
  const [startedAt, setStartedAt] = useState("");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [qTotal, setQTotal] = useState("");
  const [qCorrect, setQCorrect] = useState("");
  const [subjectId, setSubjectId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && session) {
      setStartedAt(toLocalDatetimeInput(session.started_at));
      const total = session.duration_minutes || 0;
      setHours(String(Math.floor(total / 60)));
      setMinutes(String(total % 60));
      setQTotal(session.questions_total ? String(session.questions_total) : "");
      setQCorrect(session.questions_correct ? String(session.questions_correct) : "");
      setSubjectId(session.subject_id || "none");
      setNotes(session.notes || "");
    }
  }, [open, session]);

  if (!session) return null;

  const handleSave = async () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) {
      toast.error("Informe um tempo maior que zero.");
      return;
    }
    const started = startedAt ? new Date(startedAt) : new Date(session.started_at);
    const ended = new Date(started.getTime() + totalMinutes * 60 * 1000);
    if (ended > new Date()) {
      toast.error("A data/hora não pode ficar no futuro.");
      return;
    }
    let total = Math.max(0, parseInt(qTotal) || 0);
    let correct = Math.max(0, parseInt(qCorrect) || 0);
    if (correct > total) correct = total;

    setSaving(true);
    const ok = await updateFocusSession(session.id, {
      startedAt: started,
      durationMinutes: totalMinutes,
      questionsTotal: total,
      questionsCorrect: correct,
      subjectId: subjectId === "none" ? null : subjectId,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (ok) {
      toast.success("Registro atualizado.");
      onSaved?.();
      onOpenChange(false);
    } else {
      toast.error("Erro ao atualizar registro.");
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const ok = await deleteFocusSession(session.id);
    setSaving(false);
    setConfirmDelete(false);
    if (ok) {
      toast.success("Registro excluído.");
      onSaved?.();
      onOpenChange(false);
    } else {
      toast.error("Erro ao excluir registro.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar registro de estudo</DialogTitle>
            <DialogDescription>
              Ajuste data, tempo, disciplina e desempenho desta sessão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {subjects.length > 0 && (
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem disciplina</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          {s.color && (
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                          )}
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-started-at">Quando estudou</Label>
              <Input
                id="edit-started-at"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tempo estudado</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 text-center">horas</p>
                </div>
                <span className="text-muted-foreground pb-5">:</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 text-center">minutos</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Desempenho em questões</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={qTotal}
                    onChange={(e) => setQTotal(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 text-center">total</p>
                </div>
                <span className="text-muted-foreground pb-5">/</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={qCorrect}
                    onChange={(e) => setQCorrect(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 text-center">acertos</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Observação</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre esta sessão"
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tempo e o desempenho desta sessão
              serão removidos dos seus relatórios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditFocusSessionDialog;
