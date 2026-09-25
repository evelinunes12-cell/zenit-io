import { useEffect, useState } from "react";
import { FilePlus2, Save } from "lucide-react";
import { ResponsiveTaskDialog } from "@/components/ResponsiveTaskDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NotebookPage } from "@/services/notebookPages";

interface NotebookPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page?: NotebookPage | null;
  onSave: (title: string) => void;
  isSaving?: boolean;
}

export function NotebookPageDialog({ open, onOpenChange, page, onSave, isSaving = false }: NotebookPageDialogProps) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) setTitle(page?.title ?? "");
  }, [open, page]);

  const handleSubmit = () => {
    const normalizedTitle = title.trim();
    if (normalizedTitle) onSave(normalizedTitle);
  };

  return (
    <ResponsiveTaskDialog
      open={open}
      onOpenChange={onOpenChange}
      title={page ? "Editar página" : "Nova página"}
      description={page ? "Atualize o título desta página." : "Dê um título para organizar esta página no caderno."}
    >
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
        <div className="space-y-2">
          <Label htmlFor="notebook-page-title">Título *</Label>
          <Input
            id="notebook-page-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Fundamentação teórica"
            maxLength={160}
            autoFocus
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" disabled={!title.trim() || isSaving} className="gap-2">
            {page ? <Save className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}
            {isSaving ? "Salvando..." : page ? "Salvar alterações" : "Criar página"}
          </Button>
        </div>
      </form>
    </ResponsiveTaskDialog>
  );
}