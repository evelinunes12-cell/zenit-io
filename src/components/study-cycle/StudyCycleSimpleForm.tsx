import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Subject, createSubject } from "@/services/subjects";
import { NewBlock, StudyCycle, CyclePlanningMetadata } from "@/services/studyCycles";
import CyclePlanningFields, { CyclePlanningFormValue, emptyCyclePlanning } from "@/components/study-cycle/CyclePlanningFields";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

interface StudyCycleSimpleFormProps {
  subjects: Subject[];
  onSave: (name: string, blocks: NewBlock[]) => Promise<void>;
  cycleToEdit?: StudyCycle | null;
  userId?: string;
  onSubjectsChanged?: () => void;
  onCancel: () => void;
}

interface BlockRow {
  id: string;
  subject_id: string;
  allocated_minutes: number;
}

const generateId = () => Math.random().toString(36).slice(2, 9);

// --- Subject Combobox ---
interface SubjectComboboxProps {
  subjects: Subject[];
  value: string;
  usedSubjectIds: string[];
  onChange: (subjectId: string) => void;
  userId?: string;
  onSubjectCreated?: (subject: Subject) => void;
}

const SubjectCombobox = ({ subjects, value, usedSubjectIds, onChange, userId, onSubjectCreated }: SubjectComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedSubject = subjects.find((s) => s.id === value);
  const filteredSubjects = subjects.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = subjects.some((s) => s.name.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim().length > 0 && !exactMatch && userId;

  const handleCreateSubject = async () => {
    if (!userId || !search.trim()) return;
    setCreating(true);
    try {
      const newSubject = await createSubject(search.trim(), userId);
      onSubjectCreated?.(newSubject);
      onChange(newSubject.id);
      setSearch("");
      setOpen(false);
      toast.success(`Disciplina "${newSubject.name}" criada!`);
    } catch {
      toast.error("Erro ao criar disciplina.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 min-w-0 justify-between font-normal">
          {selectedSubject ? (
            <span className="flex items-center gap-2 truncate">
              {selectedSubject.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedSubject.color }} />}
              {selectedSubject.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione a matéria</span>
          )}
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
                  <button type="button" disabled={creating} onClick={handleCreateSubject} className="w-full text-left hover:bg-accent rounded p-2 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    {creating ? "Criando..." : `Criar "${search.trim()}"`}
                  </button>
                ) : "Nenhuma disciplina encontrada"}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredSubjects.map((s) => {
                const isUsed = usedSubjectIds.includes(s.id) && s.id !== value;
                return (
                  <CommandItem key={s.id} value={s.name} disabled={isUsed} onSelect={() => { onChange(s.id); setSearch(""); setOpen(false); }} className={isUsed ? "opacity-50" : ""}>
                    <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex items-center gap-2">
                      {s.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                      {s.name}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {canCreate && filteredSubjects.length > 0 && (
              <CommandGroup>
                <CommandItem onSelect={handleCreateSubject} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  {creating ? "Criando..." : `Criar "${search.trim()}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// --- Sortable Block Item ---
interface SortableBlockProps {
  block: BlockRow;
  index: number;
  subjects: Subject[];
  usedSubjectIds: string[];
  onUpdate: (id: string, field: keyof BlockRow, value: string | number) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  userId?: string;
  onSubjectCreated?: (subject: Subject) => void;
}

const SortableBlockItem = ({ block, index, subjects, usedSubjectIds, onUpdate, onRemove, canRemove, userId, onSubjectCreated }: SortableBlockProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
      <button type="button" className="touch-none cursor-grab active:cursor-grabbing shrink-0 p-1 -ml-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground font-medium w-5 shrink-0">{index + 1}.</span>
      <SubjectCombobox subjects={subjects} value={block.subject_id} usedSubjectIds={usedSubjectIds} onChange={(val) => onUpdate(block.id, "subject_id", val)} userId={userId} onSubjectCreated={onSubjectCreated} />
      <div className="flex items-center gap-1 shrink-0">
        <Input type="number" min={5} max={480} value={block.allocated_minutes} onChange={(e) => onUpdate(block.id, "allocated_minutes", Math.max(5, parseInt(e.target.value) || 5))} className="w-20 text-center" />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onRemove(block.id)} disabled={!canRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

// --- Main Simple Form ---
const StudyCycleSimpleForm = ({ subjects: initialSubjects, onSave, cycleToEdit, userId, onSubjectsChanged, onCancel }: StudyCycleSimpleFormProps) => {
  const [name, setName] = useState("");
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(initialSubjects);
  const isEditing = !!cycleToEdit;

  useEffect(() => { setLocalSubjects(initialSubjects); }, [initialSubjects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (cycleToEdit) {
      setName(cycleToEdit.name);
      setBlocks((cycleToEdit.blocks || []).map((b) => ({ id: generateId(), subject_id: b.subject_id, allocated_minutes: b.allocated_minutes })));
    } else {
      setName("");
      setBlocks([{ id: generateId(), subject_id: "", allocated_minutes: 60 }]);
    }
  }, [cycleToEdit]);

  const handleSubjectCreated = (newSubject: Subject) => {
    setLocalSubjects((prev) => [...prev, newSubject].sort((a, b) => a.name.localeCompare(b.name)));
    onSubjectsChanged?.();
  };

  const addBlock = () => setBlocks((prev) => [...prev, { id: generateId(), subject_id: "", allocated_minutes: 60 }]);
  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const updateBlock = (id: string, field: keyof BlockRow, value: string | number) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const totalMinutes = blocks.reduce((sum, b) => sum + (b.allocated_minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Dê um nome ao seu ciclo."); return; }
    const validBlocks = blocks.filter((b) => b.subject_id);
    if (validBlocks.length === 0) { toast.error("Adicione pelo menos uma disciplina ao ciclo."); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), validBlocks.map((b) => ({ subject_id: b.subject_id, allocated_minutes: b.allocated_minutes })));
    } catch {
      toast.error("Erro ao salvar o ciclo.");
    } finally {
      setSaving(false);
    }
  };

  const usedSubjectIds = blocks.map((b) => b.subject_id).filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="cycle-name">Nome do Ciclo</Label>
        <Input id="cycle-name" placeholder="Ex: Ciclo Semanal, Revisão Final..." value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </div>

      <div className="space-y-2">
        <Label>Disciplinas do Ciclo</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <SortableBlockItem key={block.id} block={block} index={index} subjects={localSubjects} usedSubjectIds={usedSubjectIds} onUpdate={updateBlock} onRemove={removeBlock} canRemove={blocks.length > 1} userId={userId} onSubjectCreated={handleSubjectCreated} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button variant="outline" size="sm" onClick={addBlock} className="w-full mt-2">
          <Plus className="h-4 w-4 mr-1" /> Adicionar Disciplina
        </Button>
      </div>

      {blocks.some((b) => b.subject_id) && (
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm text-center">
          <span className="font-semibold text-primary">{blocks.filter((b) => b.subject_id).length} disciplina(s)</span>
          {" · "}
          <span className="text-muted-foreground">Tempo total: {hours > 0 ? `${hours}h ` : ""}{mins > 0 ? `${mins}min` : hours > 0 ? "" : "0min"}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : isEditing ? "Atualizar Ciclo" : "Salvar Ciclo"}</Button>
      </div>
    </div>
  );
};

export default StudyCycleSimpleForm;
