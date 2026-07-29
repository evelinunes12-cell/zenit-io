import { useState, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  Calendar as CalendarIcon,
  Link as LinkIconLucide,
  FileText,
  Presentation,
  AlignLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface EditableStep {
  id: string;
  title: string;
  status: string;
  order_index: number;
  description?: string | null;
  due_date?: string | null;
  google_docs_link?: string | null;
  canva_link?: string | null;
}

interface Props {
  taskId: string;
  steps: EditableStep[];
  onStepsChange: (steps: EditableStep[]) => void;
}

const DONE = "Concluído";
const DOING = "Em Progresso";
const TODO = "Não Iniciado";

const STEP_STATUSES = [TODO, DOING, DONE];

const statusStyles: Record<string, string> = {
  [TODO]: "bg-muted text-muted-foreground",
  [DOING]: "bg-primary/15 text-primary",
  [DONE]: "bg-success/15 text-success",
};

const parseDbDate = (dateStr: string): Date => {
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(dateStr);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + tzOffset);
};

const formatDateDb = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isOverdue = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDbDate(dateStr).getTime() < today.getTime();
};

export default function EditableStepsChecklist({ taskId, steps, onStepsChange }: Props) {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openDateStepId, setOpenDateStepId] = useState<string | null>(null);

  const sorted = [...steps].sort((a, b) => a.order_index - b.order_index);
  const completed = sorted.filter((s) => s.status === DONE).length;

  const updateStepField = async (
    step: EditableStep,
    patch: Partial<EditableStep>,
  ) => {
    const prev = steps;
    onStepsChange(steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s)));
    try {
      const { error } = await supabase
        .from("task_steps")
        .update(patch as any)
        .eq("id", step.id);
      if (error) throw error;
    } catch (err) {
      logError("update step", err);
      onStepsChange(prev);
      toast({ variant: "destructive", title: "Erro ao atualizar etapa" });
    }
  };

  const saveTitle = async (step: EditableStep) => {
    const title = editDraft.trim();
    if (!title || title === step.title) {
      setEditingTitleId(null);
      return;
    }
    setSavingId(step.id);
    await updateStepField(step, { title });
    setSavingId(null);
    setEditingTitleId(null);
  };

  const remove = async (step: EditableStep) => {
    const prev = steps;
    onStepsChange(steps.filter((s) => s.id !== step.id));
    try {
      const { error } = await supabase.from("task_steps").delete().eq("id", step.id);
      if (error) throw error;
    } catch (err) {
      logError("delete step", err);
      onStepsChange(prev);
      toast({ variant: "destructive", title: "Erro ao excluir etapa" });
    }
  };

  const addStep = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setIsAddingNew(true);
    try {
      const nextIndex = sorted.length ? Math.max(...sorted.map((s) => s.order_index)) + 1 : 0;
      const { data, error } = await supabase
        .from("task_steps")
        .insert({
          task_id: taskId,
          title,
          status: TODO,
          order_index: nextIndex,
        })
        .select()
        .single();
      if (error) throw error;
      onStepsChange([
        ...steps,
        {
          id: data.id,
          title: data.title,
          status: data.status,
          order_index: data.order_index,
          description: data.description,
          due_date: data.due_date,
          google_docs_link: data.google_docs_link,
          canva_link: data.canva_link,
        },
      ]);
      setNewTitle("");
      setExpandedId(data.id);
    } catch (err) {
      logError("add step", err);
      toast({ variant: "destructive", title: "Erro ao criar etapa" });
    } finally {
      setIsAddingNew(false);
    }
  };

  const handleEditKey = (e: KeyboardEvent<HTMLInputElement>, step: EditableStep) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(step);
    } else if (e.key === "Escape") {
      setEditingTitleId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5" />
          Etapas {sorted.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({completed}/{sorted.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && !showNewInput && (
          <p className="text-sm text-muted-foreground">Nenhuma etapa ainda.</p>
        )}

        {sorted.map((step) => {
          const isDone = step.status === DONE;
          const isEditing = editingTitleId === step.id;
          const isExpanded = expandedId === step.id;
          return (
            <div key={step.id} className="rounded-md border">
              <div className="group flex items-start gap-2 px-2 py-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : step.id)}
                  className="text-muted-foreground hover:text-foreground shrink-0 mt-1"
                  aria-label={isExpanded ? "Recolher etapa" : "Expandir etapa"}
                >
                  <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                </button>

                <div className="flex-1 min-w-0 space-y-1.5">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => saveTitle(step)}
                      onKeyDown={(e) => handleEditKey(e, step)}
                      disabled={savingId === step.id}
                      className="h-8"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitleId(step.id);
                        setEditDraft(step.title);
                      }}
                      className={cn(
                        "w-full text-left text-sm font-medium break-words [overflow-wrap:anywhere] cursor-text",
                        isDone && "line-through text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </button>
                  )}

                  {/* Resumo das informações da etapa */}
                  {!isExpanded && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {step.due_date && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 font-normal",
                            !isDone && isOverdue(step.due_date) && "border-destructive text-destructive",
                          )}
                        >
                          <CalendarIcon className="w-3 h-3" />
                          {format(parseDbDate(step.due_date), "dd MMM yyyy", { locale: ptBR })}
                        </Badge>
                      )}
                      {step.google_docs_link && (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <FileText className="w-3 h-3" /> Trabalho escrito
                        </Badge>
                      )}
                      {step.canva_link && (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <Presentation className="w-3 h-3" /> Apresentação
                        </Badge>
                      )}
                    </div>
                  )}

                  {!isExpanded && step.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 break-words [overflow-wrap:anywhere] flex items-start gap-1">
                      <AlignLeft className="w-3 h-3 mt-0.5 shrink-0" />
                      {step.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Select
                    value={STEP_STATUSES.includes(step.status) ? step.status : TODO}
                    onValueChange={(value) => updateStepField(step, { status: value })}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-7 w-[140px] text-xs border-0",
                        statusStyles[step.status] ?? statusStyles[TODO],
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => remove(step)}
                    aria-label="Excluir etapa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-8 pb-3 pt-1 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descrição</Label>
                    <Textarea
                      defaultValue={step.description ?? ""}
                      placeholder="Adicione uma descrição..."
                      rows={3}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const current = (step.description ?? "").trim();
                        if (v !== current) updateStepField(step, { description: v || null });
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data de entrega</Label>
                      <Popover
                        open={openDateStepId === step.id}
                        onOpenChange={(o) => setOpenDateStepId(o ? step.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start font-normal">
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {step.due_date
                              ? format(parseDbDate(step.due_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })
                              : "Sem data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker
                            mode="single"
                            selected={step.due_date ? parseDbDate(step.due_date) : undefined}
                            onSelect={(date) => {
                              updateStepField(step, { due_date: date ? formatDateDb(date) : null });
                              setOpenDateStepId(null);
                            }}
                            locale={ptBR}
                            initialFocus
                          />
                          {step.due_date && (
                            <div className="p-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  updateStepField(step, { due_date: null });
                                  setOpenDateStepId(null);
                                }}
                              >
                                Remover data
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <LinkIconLucide className="w-3 h-3" /> Trabalho escrito
                    </Label>
                    <Input
                      defaultValue={step.google_docs_link ?? ""}
                      placeholder="https://..."
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const current = (step.google_docs_link ?? "").trim();
                        if (v !== current) updateStepField(step, { google_docs_link: v || null });
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <LinkIconLucide className="w-3 h-3" /> Apresentação
                    </Label>
                    <Input
                      defaultValue={step.canva_link ?? ""}
                      placeholder="https://..."
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const current = (step.canva_link ?? "").trim();
                        if (v !== current) updateStepField(step, { canva_link: v || null });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-2">
          {showNewInput ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Nome da etapa..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStep();
                  } else if (e.key === "Escape") {
                    setShowNewInput(false);
                    setNewTitle("");
                  }
                }}
                disabled={isAddingNew}
                className="h-9"
              />
              <Button size="sm" onClick={addStep} disabled={isAddingNew || !newTitle.trim()}>
                {isAddingNew && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewInput(false);
                  setNewTitle("");
                }}
                disabled={isAddingNew}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground w-full justify-start"
              onClick={() => setShowNewInput(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova etapa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
