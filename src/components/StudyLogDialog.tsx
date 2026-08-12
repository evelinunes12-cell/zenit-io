import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveSubjects } from "@/services/subjects";
import { fetchStudyCycles } from "@/services/studyCycles";
import { createFocusSession } from "@/services/focusSessions";
import { registerActivity } from "@/services/activity";
import { logXP, XP } from "@/services/scoring";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface StudyLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-seleciona uma disciplina (opcional) */
  defaultSubjectId?: string | null;
  /** Pré-seleciona um ciclo (opcional) */
  defaultCycleId?: string | null;
  /** Exibe a opção de marcar o bloco atual do ciclo como concluído */
  showMarkCompleted?: boolean;
  onLogged?: (info: { markCompleted: boolean }) => void;
}

type TimeMode = "duration" | "range";

const pad = (n: number) => String(n).padStart(2, "0");

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const nowTime = () => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/** Registro manual de estudo — não exige Pomodoro nem ciclo ativo. */
const StudyLogDialog = ({
  open,
  onOpenChange,
  defaultSubjectId,
  defaultCycleId,
  showMarkCompleted = false,
  onLogged,
}: StudyLogDialogProps) => {
  const { user } = useAuth();

  const { data: subjects = [] } = useQuery({
    queryKey: ["active-subjects-study-log"],
    queryFn: fetchActiveSubjects,
    enabled: open,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["study-cycles-list"],
    queryFn: fetchStudyCycles,
    enabled: open,
  });

  const [subjectId, setSubjectId] = useState("none");
  const [cycleId, setCycleId] = useState("none");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState(nowTime());
  const [timeMode, setTimeMode] = useState<TimeMode>("duration");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [endTime, setEndTime] = useState(nowTime());
  const [questionsTotal, setQuestionsTotal] = useState("");
  const [questionsCorrect, setQuestionsCorrect] = useState("");
  const [notes, setNotes] = useState("");
  const [markCompleted, setMarkCompleted] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubjectId(defaultSubjectId || "none");
    setCycleId(defaultCycleId || "none");
    setDate(todayISO());
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    setEndTime(nowTime());
    setTimeMode("duration");
    setHours("1");
    setMinutes("0");
    setQuestionsTotal("");
    setQuestionsCorrect("");
    setNotes("");
    setMarkCompleted(true);
  }, [open, defaultSubjectId, defaultCycleId]);

  const totalMinutes = useMemo(() => {
    if (timeMode === "duration") {
      return (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    }
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60; // atravessou a meia-noite
    return diff;
  }, [timeMode, hours, minutes, startTime, endTime]);

  const formatTotal = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const handleSave = async () => {
    if (!user) return;
    if (totalMinutes <= 0) {
      toast.error("Informe um tempo maior que zero.");
      return;
    }
    const [y, mo, d] = date.split("-").map(Number);
    const [sh, sm] = startTime.split(":").map(Number);
    if (!y || !mo || !d || Number.isNaN(sh) || Number.isNaN(sm)) {
      toast.error("Informe uma data e um horário válidos.");
      return;
    }
    const startedAt = new Date(y, mo - 1, d, sh, sm, 0, 0);
    const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000);
    if (endedAt > new Date()) {
      toast.error("A data/hora não pode ficar no futuro.");
      return;
    }

    const qTotal = Math.max(0, parseInt(questionsTotal) || 0);
    let qCorrect = Math.max(0, parseInt(questionsCorrect) || 0);
    if (qCorrect > qTotal) qCorrect = qTotal;

    setSaving(true);
    const created = await createFocusSession(
      user.id,
      startedAt,
      totalMinutes,
      subjectId === "none" ? null : subjectId,
      cycleId === "none" ? null : cycleId,
      qTotal,
      qCorrect,
      { notes: notes.trim() || null, source: "manual" }
    );
    setSaving(false);

    if (!created) {
      toast.error("Erro ao registrar estudo.");
      return;
    }

    await registerActivity(user.id);
    logXP(user.id, "study_block_completed", XP.STUDY_BLOCK_COMPLETED);
    toast.success(`Estudo registrado: ${formatTotal(totalMinutes)}`);
    onLogged?.({ markCompleted: showMarkCompleted && markCompleted });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar estudo</DialogTitle>
          <DialogDescription>
            Registre uma sessão de estudo que aconteceu fora do Pomodoro ou de um ciclo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="study-log-date">Data</Label>
              <Input
                id="study-log-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="study-log-start">Início</Label>
              <Input
                id="study-log-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tempo estudado</Label>
            <Tabs value={timeMode} onValueChange={(v) => setTimeMode(v as TimeMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="duration">Duração</TabsTrigger>
                <TabsTrigger value="range">Horário de término</TabsTrigger>
              </TabsList>
            </Tabs>

            {timeMode === "duration" ? (
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
            ) : (
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="Horário de término"
              />
            )}

            <p className="text-xs text-muted-foreground">
              Total: <span className="font-medium text-foreground">{formatTotal(totalMinutes)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Desempenho em questões (opcional)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min={0}
                  value={questionsTotal}
                  onChange={(e) => setQuestionsTotal(e.target.value)}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground mt-1 text-center">total</p>
              </div>
              <span className="text-muted-foreground pb-5">/</span>
              <div className="flex-1">
                <Input
                  type="number"
                  min={0}
                  value={questionsCorrect}
                  onChange={(e) => setQuestionsCorrect(e.target.value)}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground mt-1 text-center">acertos</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ciclo de estudos (opcional)</Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem ciclo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem ciclo</SelectItem>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="study-log-notes">Observação (opcional)</Label>
            <Textarea
              id="study-log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que você estudou, dificuldades, próximos passos..."
              rows={3}
              maxLength={1000}
            />
          </div>
          {showMarkCompleted && (
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="study-log-mark-completed"
                checked={markCompleted}
                onCheckedChange={(checked) => setMarkCompleted(!!checked)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="study-log-mark-completed" className="cursor-pointer">
                  Marcar bloco como concluído
                </Label>
                <p className="text-xs text-muted-foreground">
                  Avança o ciclo para o próximo bloco automaticamente.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Registrar estudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudyLogDialog;
