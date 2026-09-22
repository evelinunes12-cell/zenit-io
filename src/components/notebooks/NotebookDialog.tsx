import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveTaskDialog } from "@/components/ResponsiveTaskDialog";
import { fetchActiveSubjects } from "@/services/subjects";
import type { Notebook, NotebookInput } from "@/services/notebooks";
import { cn } from "@/lib/utils";
import { NOTEBOOK_COLORS } from "./notebookAppearance";

interface NotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebook?: Notebook | null;
  onSave: (input: NotebookInput) => void;
  isSaving?: boolean;
}

export function NotebookDialog({ open, onOpenChange, notebook, onSave, isSaving = false }: NotebookDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string | null>("primary");
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects-active"],
    queryFn: fetchActiveSubjects,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setTitle(notebook?.title ?? "");
    setDescription(notebook?.description ?? "");
    setIcon(notebook?.icon ?? "");
    setColor(notebook?.color ?? "primary");
    setSubjectId(notebook?.subject_id ?? null);
  }, [notebook, open]);

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSave({
      title: trimmedTitle,
      description: description.trim() || null,
      icon: icon.trim() || null,
      color,
      subject_id: subjectId,
    });
  };

  return (
    <ResponsiveTaskDialog
      open={open}
      onOpenChange={onOpenChange}
      title={notebook ? "Editar caderno" : "Novo caderno"}
      description="Organize um espaço para reunir seus conteúdos acadêmicos."
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="notebook-title">Nome do caderno *</Label>
          <Input
            id="notebook-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: TCC 2"
            maxLength={120}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notebook-description">Descrição</Label>
          <Textarea
            id="notebook-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex: Organização do meu TCC..."
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="notebook-icon">Ícone</Label>
            <Input
              id="notebook-icon"
              value={icon}
              onChange={(event) => setIcon(Array.from(event.target.value).slice(0, 2).join(""))}
              placeholder="📘"
              className="text-center text-xl"
              aria-describedby="notebook-icon-help"
            />
            <p id="notebook-icon-help" className="text-xs text-muted-foreground">Use um emoji.</p>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex min-h-10 flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor do caderno">
              {NOTEBOOK_COLORS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="icon"
                  role="radio"
                  aria-checked={color === option.value}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setColor(option.value)}
                  className={cn("h-9 w-9 rounded-full", color === option.value && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
                >
                  <span className={cn("h-5 w-5 rounded-full", option.swatch)} aria-hidden="true" />
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Disciplina relacionada</Label>
          <Select value={subjectId ?? "none"} onValueChange={(value) => setSubjectId(value === "none" ? null : value)} disabled={subjectsLoading}>
            <SelectTrigger>
              <SelectValue placeholder={subjectsLoading ? "Carregando disciplinas..." : "Nenhuma disciplina"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma disciplina</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit} disabled={!title.trim() || isSaving} className="gap-2">
            <BookOpen className="h-4 w-4" />
            {isSaving ? "Salvando..." : notebook ? "Salvar alterações" : "Criar caderno"}
          </Button>
        </div>
      </div>
    </ResponsiveTaskDialog>
  );
}
