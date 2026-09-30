import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FilePlus2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ResponsiveTaskDialog } from "@/components/ResponsiveTaskDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { createNotebookPage } from "@/services/notebookPages";
import { fetchNotebooks } from "@/services/notebooks";

interface CreateNotebookPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNotebook: () => void;
}

export function CreateNotebookPageDialog({ open, onOpenChange, onCreateNotebook }: CreateNotebookPageDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notebookId, setNotebookId] = useState("");
  const [title, setTitle] = useState("");

  const notebooksQuery = useQuery({
    queryKey: ["notebooks", user?.id],
    queryFn: () => fetchNotebooks(user?.id ?? ""),
    enabled: open && !!user?.id,
  });

  useEffect(() => {
    if (!open) return;
    setNotebookId("");
    setTitle("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => createNotebookPage(notebookId, title),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["notebook-pages", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      onOpenChange(false);
      toast.success("Página criada!");
      navigate(`/cadernos/${notebookId}/paginas/${page.id}`);
    },
    onError: () => toast.error("Erro ao criar página"),
  });

  const notebooks = notebooksQuery.data ?? [];
  const canSubmit = !!notebookId && !!title.trim() && !mutation.isPending;

  return (
    <ResponsiveTaskDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nova página"
      description="Escolha o caderno e dê um título para a página."
    >
      {notebooksQuery.isLoading ? (
        <div className="space-y-5 py-1" aria-label="Carregando cadernos">
          <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>
        </div>
      ) : notebooksQuery.isError ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
          <RefreshCw className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Não foi possível carregar seus cadernos</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente novamente para continuar.</p>
          <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => notebooksQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />Tentar novamente
          </Button>
        </div>
      ) : notebooks.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Você ainda não possui cadernos</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie um caderno antes de adicionar sua primeira página.</p>
          <Button type="button" className="mt-4 gap-2" onClick={() => { onOpenChange(false); onCreateNotebook(); }}>
            <BookOpen className="h-4 w-4" />Criar caderno
          </Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (canSubmit) mutation.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="new-page-notebook">Caderno *</Label>
            <Select value={notebookId} onValueChange={setNotebookId} disabled={mutation.isPending}>
              <SelectTrigger id="new-page-notebook">
                <SelectValue placeholder="Selecione um caderno" />
              </SelectTrigger>
              <SelectContent>
                {notebooks.map((notebook) => (
                  <SelectItem key={notebook.id} value={notebook.id}>
                    {notebook.icon ? `${notebook.icon} ` : ""}{notebook.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-page-title">Título *</Label>
            <Input
              id="new-page-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Fundamentação teórica"
              maxLength={160}
              disabled={mutation.isPending}
              autoFocus
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit} className="gap-2">
              <FilePlus2 className="h-4 w-4" />
              {mutation.isPending ? "Criando..." : "Criar página"}
            </Button>
          </div>
        </form>
      )}
    </ResponsiveTaskDialog>
  );
}