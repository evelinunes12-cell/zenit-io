import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronRight, ChevronLeft, Sparkles, Check, ChevronsUpDown, GripVertical, Minus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Subject, createSubject } from "@/services/subjects";
import { NewBlock, AdvancedCycleMetadata } from "@/services/studyCycles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import EditalAIImporter, { AIExtractedSubject } from "@/components/study-cycle/EditalAIImporter";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MasteryLevel = "beginner" | "intermediate" | "advanced";
type DedicationType = "per_day" | "per_week";

interface SubjectConfig {
  id: string;
  subject_id: string;
  weight: number;
  mastery: MasteryLevel;
  isNew?: boolean;
  newName?: string;
  fromAI?: boolean;
}

interface EditableBlock {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  allocated_minutes: number;
}

interface StudyCycleAdvancedWizardProps {
  subjects: Subject[];
  onSave: (name: string, blocks: NewBlock[], advancedMeta?: AdvancedCycleMetadata) => Promise<void>;
  onCancel: () => void;
  userId?: string;
  onSubjectsChanged?: () => void;
}

const generateId = () => Math.random().toString(36).slice(2, 9);

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};


// --- Subject Combobox ---
const SubjectCombobox = ({ subjects, value, usedIds, onChange, userId, onCreated }: {
  subjects: Subject[]; value: string; usedIds: string[];
  onChange: (id: string) => void; userId?: string; onCreated?: (s: Subject) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = subjects.find((s) => s.id === value);
  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = subjects.some((s) => s.name.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim().length > 0 && !exactMatch && userId;

  const handleCreate = async () => {
    if (!userId || !search.trim()) return;
    setCreating(true);
    try {
      const ns = await createSubject(search.trim(), userId);
      onCreated?.(ns);
      onChange(ns.id);
      setSearch(""); setOpen(false);
      toast.success(`Disciplina "${ns.name}" criada!`);
    } catch { toast.error("Erro ao criar disciplina."); } finally { setCreating(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {selected.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />}
              {selected.name}
            </span>
          ) : <span className="text-muted-foreground">Selecione a matéria</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar ou criar..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-sm">
                {canCreate ? (
                  <button type="button" disabled={creating} onClick={handleCreate} className="w-full text-left hover:bg-accent rounded p-2 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />{creating ? "Criando..." : `Criar "${search.trim()}"`}
                  </button>
                ) : "Nenhuma disciplina encontrada"}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((s) => {
                const used = usedIds.includes(s.id) && s.id !== value;
                return (
                  <CommandItem key={s.id} value={s.name} disabled={used} onSelect={() => { onChange(s.id); setSearch(""); setOpen(false); }} className={used ? "opacity-50" : ""}>
                    <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex items-center gap-2">
                      {s.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                      {s.name}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {canCreate && filtered.length > 0 && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />{creating ? "Criando..." : `Criar "${search.trim()}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};


const MASTERY_MULTIPLIER: Record<MasteryLevel, number> = {
  beginner: 1.5,
  intermediate: 1.0,
  advanced: 0.8,
};

const MIN_BLOCK = 60;
const MAX_BLOCK = 150;

// --- Engine: Continuous Cycle ("Rodada Base" semanal) ---
function generateCycleBlocks(
  weeklyMinutes: number,
  configs: SubjectConfig[],
  subjects: Subject[]
): EditableBlock[] {
  if (configs.length === 0 || weeklyMinutes <= 0) return [];

  // 1. Score de relevância para cada disciplina
  const scored = configs.map((c) => ({
    ...c,
    score: c.weight * (MASTERY_MULTIPLIER[c.mastery] ?? 1),
  }));
  const totalScore = scored.reduce((s, c) => s + c.score, 0);

  // 2. Minutos totais por disciplina na rodada e fatiamento em blocos
  type RawBlock = { subject_id: string; minutes: number };
  const rawBlocks: RawBlock[] = [];

  scored.forEach((config) => {
    const proportion = config.score / totalScore;
    let totalMinutes = Math.round(weeklyMinutes * proportion);
    totalMinutes = Math.max(totalMinutes, MIN_BLOCK); // garante mínimo

    if (totalMinutes <= MAX_BLOCK) {
      rawBlocks.push({ subject_id: config.subject_id, minutes: totalMinutes });
    } else {
      // Fatiar em múltiplos blocos
      const numBlocks = Math.ceil(totalMinutes / MAX_BLOCK);
      const perBlock = Math.round(totalMinutes / numBlocks);
      for (let i = 0; i < numBlocks; i++) {
        rawBlocks.push({ subject_id: config.subject_id, minutes: perBlock });
      }
    }
  });

  // 3. Intercalação: nunca dois blocos da mesma disciplina lado a lado
  const interleaved = interleaveBlocks(rawBlocks);

  // 4. Converter para EditableBlock
  return interleaved.map((rb) => {
    const subject = subjects.find((s) => s.id === rb.subject_id);
    return {
      id: generateId(),
      subject_id: rb.subject_id,
      subject_name: subject?.name || "Disciplina",
      subject_color: subject?.color || null,
      allocated_minutes: rb.minutes,
    };
  });
}

// Intercala blocos para que a mesma disciplina nunca fique lado a lado
function interleaveBlocks(blocks: { subject_id: string; minutes: number }[]) {
  // Agrupa por disciplina, ordena pelo grupo com mais blocos primeiro
  const groups = new Map<string, { subject_id: string; minutes: number }[]>();
  blocks.forEach((b) => {
    if (!groups.has(b.subject_id)) groups.set(b.subject_id, []);
    groups.get(b.subject_id)!.push(b);
  });
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length);

  const result: { subject_id: string; minutes: number }[] = [];
  while (sorted.some((g) => g.length > 0)) {
    for (const group of sorted) {
      if (group.length === 0) continue;
      // Evitar adjacência
      if (result.length > 0 && result[result.length - 1].subject_id === group[0].subject_id) continue;
      result.push(group.shift()!);
    }
    // Se restaram blocos que não puderam ser inseridos sem adjacência, force
    const remaining = sorted.filter((g) => g.length > 0);
    if (remaining.length > 0 && result.length > 0) {
      const stuck = remaining.find((g) => g[0].subject_id === result[result.length - 1].subject_id);
      if (stuck && remaining.length === 1) {
        result.push(stuck.shift()!);
      }
    }
  }
  return result;
}

// --- Sortable Block Item ---
const SortableBlockItem = ({ block, onUpdateMinutes, onDelete, canDelete }: {
  block: EditableBlock;
  onUpdateMinutes: (id: string, minutes: number) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-2.5 transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/20 z-10"
      )}
    >
      <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      {block.subject_color && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: block.subject_color }} />}
      <span className="text-sm font-medium truncate flex-1 min-w-0">{block.subject_name}</span>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateMinutes(block.id, Math.max(5, block.allocated_minutes - 5))}>
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          min={5}
          max={240}
          value={block.allocated_minutes}
          onChange={(e) => onUpdateMinutes(block.id, Math.max(5, parseInt(e.target.value) || 5))}
          className="h-7 w-16 text-center text-xs px-1"
        />
        <span className="text-xs text-muted-foreground">min</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateMinutes(block.id, Math.min(240, block.allocated_minutes + 5))}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => onDelete(block.id)} disabled={!canDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

// --- Wizard ---
const StudyCycleAdvancedWizard = ({ subjects: initialSubjects, onSave, onCancel, userId, onSubjectsChanged }: StudyCycleAdvancedWizardProps) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");

  // Step 1 - new fields
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [dedicationType, setDedicationType] = useState<DedicationType>("per_day");
  const [hoursValue, setHoursValue] = useState(3);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const [configs, setConfigs] = useState<SubjectConfig[]>([{ id: generateId(), subject_id: "", weight: 3, mastery: "intermediate" }]);
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(initialSubjects);
  const [addBlockOpen, setAddBlockOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { setLocalSubjects(initialSubjects); }, [initialSubjects]);

  const handleSubjectCreated = (ns: Subject) => {
    setLocalSubjects((prev) => [...prev, ns].sort((a, b) => a.name.localeCompare(b.name)));
    onSubjectsChanged?.();
  };

  const addConfig = () => setConfigs((prev) => [...prev, { id: generateId(), subject_id: "", weight: 3, mastery: "intermediate" }]);
  const removeConfig = (id: string) => setConfigs((prev) => prev.filter((c) => c.id !== id));
  const updateConfig = (id: string, field: keyof SubjectConfig, value: string | number) => setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));

  // --- AI Edital Import: Reconciliation ---
  const normalizeStr = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const handleAIImport = (extracted: AIExtractedSubject[]) => {
    const newConfigs: SubjectConfig[] = extracted.map((ext) => {
      const normalized = normalizeStr(ext.name);
      const match = localSubjects.find(
        (s) => normalizeStr(s.name) === normalized
      );

      if (match) {
        return {
          id: generateId(),
          subject_id: match.id,
          weight: Math.min(5, Math.max(1, ext.weight)),
          mastery: "intermediate" as MasteryLevel,
          fromAI: true,
        };
      }

      return {
        id: generateId(),
        subject_id: `new_${generateId()}`,
        weight: Math.min(5, Math.max(1, ext.weight)),
        mastery: "intermediate" as MasteryLevel,
        isNew: true,
        newName: ext.name,
        fromAI: true,
      };
    });

    setConfigs(newConfigs);
    toast.success(`${newConfigs.length} disciplinas importadas! Revise os níveis de domínio.`);
  };

  const usedIds = configs.map((c) => c.subject_id).filter(Boolean);
  const validConfigs = configs.filter((c) => c.subject_id || c.isNew);

  const weeklyMinutes = dedicationType === "per_week" ? hoursValue * 60 : hoursValue * 7 * 60;

  const handleValidateStep1 = () => {
    if (!name.trim()) { toast.error("Dê um nome ao ciclo."); return false; }
    if (!startDate) { toast.error("Selecione a data inicial."); return false; }
    if (!endDate) { toast.error("Selecione a data final."); return false; }
    if (endDate < startDate) { toast.error("A data final deve ser após a data inicial."); return false; }
    if (hoursValue < 1) { toast.error("Defina pelo menos 1 hora."); return false; }
    return true;
  };

  const handleGenerate = async () => {
    if (validConfigs.length === 0) { toast.error("Adicione pelo menos uma disciplina."); return; }

    // Create new subjects from AI import before generating blocks
    const newSubjectConfigs = validConfigs.filter((c) => c.isNew && c.newName);
    let updatedSubjects = [...localSubjects];
    let updatedConfigs = [...configs];

    if (newSubjectConfigs.length > 0 && userId) {
      setSaving(true);
      try {
        for (const config of newSubjectConfigs) {
          const created = await createSubject(config.newName!, userId);
          updatedSubjects = [...updatedSubjects, created].sort((a, b) => a.name.localeCompare(b.name));
          updatedConfigs = updatedConfigs.map((c) =>
            c.id === config.id
              ? { ...c, subject_id: created.id, isNew: false, newName: undefined }
              : c
          );
        }
        setLocalSubjects(updatedSubjects);
        setConfigs(updatedConfigs);
        onSubjectsChanged?.();
        toast.success(`${newSubjectConfigs.length} disciplina(s) nova(s) criada(s)!`);
      } catch {
        toast.error("Erro ao criar disciplinas novas.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    const finalValidConfigs = updatedConfigs.filter((c) => c.subject_id && !c.subject_id.startsWith("new_"));
    const blocks = generateCycleBlocks(weeklyMinutes, finalValidConfigs, updatedSubjects);
    setEditableBlocks(blocks);
    setStep(3);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Dê um nome ao seu ciclo."); return; }
    if (editableBlocks.length === 0) { toast.error("Adicione pelo menos um bloco."); return; }
    setSaving(true);
    try {
      const finalBlocks: NewBlock[] = editableBlocks.map((b) => ({
        subject_id: b.subject_id,
        allocated_minutes: b.allocated_minutes,
      }));
      const meta: AdvancedCycleMetadata = {
        is_advanced: true,
        start_date: format(startDate!, "yyyy-MM-dd"),
        end_date: format(endDate!, "yyyy-MM-dd"),
        ...(dedicationType === "per_day" ? { hours_per_day: hoursValue } : { hours_per_week: hoursValue }),
      };

      await onSave(name.trim(), finalBlocks, meta);
    } catch {
      toast.error("Erro ao salvar o ciclo.");
    } finally {
      setSaving(false);
    }
  };

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditableBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const updateBlockMinutes = (id: string, minutes: number) => {
    setEditableBlocks((prev) => prev.map((b) => b.id === id ? { ...b, allocated_minutes: minutes } : b));
  };

  const deleteBlock = (id: string) => {
    setEditableBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const addNewBlock = (subjectId: string) => {
    const subject = localSubjects.find((s) => s.id === subjectId);
    if (!subject) return;
    setEditableBlocks((prev) => [...prev, {
      id: generateId(),
      subject_id: subject.id,
      subject_name: subject.name,
      subject_color: subject.color || null,
      allocated_minutes: 45,
    }]);
    setAddBlockOpen(false);
  };

  const totalGeneratedMinutes = editableBlocks.reduce((s, b) => s + b.allocated_minutes, 0);
  const genHours = Math.floor(totalGeneratedMinutes / 60);
  const genMins = totalGeneratedMinutes % 60;

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Passo {step} de 3</span>
          <span>{step === 1 ? "Período e Tempo" : step === 2 ? "Disciplinas" : "Revisão"}</span>
        </div>
        <Progress value={(step / 3) * 100} className="h-1.5" />
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adv-name">Nome do Ciclo</Label>
              <Input id="adv-name" placeholder="Ex: Ciclo Intensivo, Plano Mensal..." value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Data Inicial</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !startDate && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setStartDateOpen(false); }} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Data Final</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !endDate && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setEndDateOpen(false); }} disabled={(date) => startDate ? date < startDate : false} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Dedication type */}
            <div className="space-y-2">
              <Label>Como preferes dedicar o teu tempo?</Label>
              <RadioGroup value={dedicationType} onValueChange={(v) => setDedicationType(v as DedicationType)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per_day" id="per_day" />
                  <Label htmlFor="per_day" className="font-normal cursor-pointer">Horas por dia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per_week" id="per_week" />
                  <Label htmlFor="per_week" className="font-normal cursor-pointer">Horas por semana</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Hours input */}
            <div className="space-y-1.5">
              <Label htmlFor="hours-value">
                {dedicationType === "per_day" ? "Quantas horas por dia?" : "Quantas horas por semana?"}
              </Label>
              <Input
                id="hours-value"
                type="number"
                min={1}
                max={dedicationType === "per_day" ? 16 : 80}
                value={hoursValue}
                onChange={(e) => setHoursValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32"
              />
            </div>

            {/* Summary */}
            {startDate && endDate && weeklyMinutes > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rodada base (semanal):</span>
                  <span className="font-semibold text-primary">{Math.floor(weeklyMinutes / 60)}h{weeklyMinutes % 60 > 0 ? ` ${weeklyMinutes % 60}min` : ""}</span>
                </div>
                <p className="text-xs text-muted-foreground">O ciclo será uma esteira contínua. Cada rodada = sua carga semanal distribuída pelas disciplinas.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onCancel}>Cancelar</Button>
              <Button onClick={() => { if (handleValidateStep1()) setStep(2); }}>
                Próximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label>Configuração das Disciplinas</Label>
                <p className="text-xs text-muted-foreground mt-1">Adicione disciplinas, defina o peso (1-5) e o nível de domínio.</p>
              </div>
              <EditalAIImporter onImport={handleAIImport} />
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {configs.map((config, i) => (
                <div key={config.id} className={cn(
                  "rounded-lg border bg-card p-3 space-y-3",
                  config.fromAI && "border-primary/30"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium w-5 shrink-0">{i + 1}.</span>
                    {config.isNew && config.newName ? (
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{config.newName}</span>
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          Nova
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <SubjectCombobox subjects={localSubjects} value={config.subject_id} usedIds={usedIds} onChange={(v) => updateConfig(config.id, "subject_id", v)} userId={userId} onCreated={handleSubjectCreated} />
                        {config.fromAI && (
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                            IA
                          </Badge>
                        )}
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeConfig(config.id)} disabled={configs.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Peso (1-5)</Label>
                      <Select value={String(config.weight)} onValueChange={(v) => updateConfig(config.id, "weight", parseInt(v))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((w) => <SelectItem key={w} value={String(w)}>{w} — {w <= 2 ? "Baixo" : w === 3 ? "Médio" : "Alto"}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Nível de Domínio</Label>
                      <Select value={config.mastery} onValueChange={(v) => updateConfig(config.id, "mastery", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(MASTERY_LABELS) as MasteryLevel[]).map((m) => <SelectItem key={m} value={m}>{MASTERY_LABELS[m]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addConfig} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Disciplina
            </Button>

            {/* Distribution Preview */}
            {validConfigs.length > 0 && weeklyMinutes > 0 && (() => {
              const scored = validConfigs.map((c) => {
                const subj = c.isNew && c.newName ? { name: c.newName, color: null } : localSubjects.find((s) => s.id === c.subject_id);
                return {
                  name: subj?.name || "—",
                  color: (subj && 'color' in subj ? subj.color : null) as string | null,
                  score: c.weight * (MASTERY_MULTIPLIER[c.mastery] ?? 1),
                };
              });
              const totalScore = scored.reduce((s, c) => s + c.score, 0);
              const items = scored.map((s) => ({
                ...s,
                pct: totalScore > 0 ? (s.score / totalScore) * 100 : 0,
                mins: totalScore > 0 ? Math.round((s.score / totalScore) * weeklyMinutes) : 0,
              }));

              return (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Prévia da distribuição na rodada semanal</p>
                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: item.color || `hsl(${(i * 47 + 200) % 360}, 60%, 55%)`,
                        }}
                      />
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color || `hsl(${(i * 47 + 200) % 360}, 60%, 55%)` }}
                        />
                        <span className="truncate text-foreground">{item.name}</span>
                        <span className="text-muted-foreground ml-auto shrink-0">
                          {Math.round(item.pct)}% · {item.mins >= 60 ? `${Math.floor(item.mins / 60)}h${item.mins % 60 > 0 ? `${item.mins % 60}m` : ""}` : `${item.mins}m`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleGenerate} disabled={saving}>
                {saving ? "Criando disciplinas..." : <><Sparkles className="mr-1 h-4 w-4" /> Gerar Ciclo Automático</>}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
            <div>
              <Label>Revisão e Edição dos Blocos</Label>
              <p className="text-xs text-muted-foreground mt-1">Arraste para reordenar, ajuste os minutos ou adicione/remova blocos.</p>
            </div>

            <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
                <SortableContext items={editableBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {editableBlocks.map((block) => (
                    <SortableBlockItem
                      key={block.id}
                      block={block}
                      onUpdateMinutes={updateBlockMinutes}
                      onDelete={deleteBlock}
                      canDelete={editableBlocks.length > 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {editableBlocks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum bloco. Adicione um abaixo.</p>
              )}
            </div>

            {/* Add block */}
            <Popover open={addBlockOpen} onOpenChange={setAddBlockOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Bloco
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Selecionar disciplina..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma disciplina encontrada</CommandEmpty>
                    <CommandGroup>
                      {localSubjects.map((s) => (
                        <CommandItem key={s.id} value={s.name} onSelect={() => addNewBlock(s.id)}>
                          <span className="flex items-center gap-2">
                            {s.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                            {s.name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm text-center">
              <span className="font-semibold text-primary">{editableBlocks.length} bloco{editableBlocks.length !== 1 ? "s" : ""}</span>
              {" · "}
              <span className="text-muted-foreground">
                Tempo total: {genHours > 0 ? `${genHours}h ` : ""}{genMins > 0 ? `${genMins}min` : genHours > 0 ? "" : "0min"}
              </span>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Ajustar
              </Button>
              <Button onClick={handleSave} disabled={saving || editableBlocks.length === 0}>
                {saving ? "Salvando..." : "Guardar Ciclo"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudyCycleAdvancedWizard;
