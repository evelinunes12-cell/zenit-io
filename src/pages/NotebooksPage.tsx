import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { NotebookCard } from "@/components/notebooks/NotebookCard";
import { NotebookDialog } from "@/components/notebooks/NotebookDialog";
import { CreateNotebookDialog } from "@/components/notebooks/CreateNotebookDialog";
import { useAuth } from "@/hooks/useAuth";
import { deleteNotebook, fetchNotebooks, updateNotebook, type Notebook, type NotebookInput } from "@/services/notebooks";
import { Link, useNavigate } from "react-router-dom";

export default function NotebooksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(null);

  const notebooksQuery = useQuery({
    queryKey: ["notebooks", user?.id],
    queryFn: () => fetchNotebooks(user?.id ?? ""),
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: NotebookInput }) => {
      if (!user) throw new Error("Usuário não autenticado.");
      return updateNotebook(user.id, id, input);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setEditingNotebook(null);
      toast.success("Caderno atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar caderno"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      return deleteNotebook(user.id, id);
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setDeletingNotebook(null);
      toast.success("Caderno excluído!");
    },
    onError: () => toast.error("Erro ao excluir caderno"),
  });

  const notebooks = notebooksQuery.data ?? [];
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredNotebooks = useMemo(() => {
    if (!normalizedSearch) return notebooks;
    return notebooks.filter((notebook) =>
      notebook.title.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
      || notebook.description?.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    );
  }, [notebooks, normalizedSearch]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground"><Link to="/planner" className="hover:text-foreground">Planner</Link> / Cadernos</p>
              <h1 className="truncate text-lg font-bold">Cadernos</h1>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="shrink-0 gap-2">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo caderno</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Seus cadernos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Espaços para organizar seus conteúdos no Zenit.</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cadernos..." className="pl-9" aria-label="Buscar cadernos" />
          </div>
        </div>

        {notebooksQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Carregando cadernos">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-44 w-full" />)}
          </div>
        ) : notebooksQuery.isError ? (
          <EmptyContent
            icon={RefreshCw}
            title="Não foi possível carregar seus cadernos"
            description="Tente novamente para continuar."
            actionLabel="Tentar novamente"
            onAction={() => notebooksQuery.refetch()}
          />
        ) : notebooks.length === 0 ? (
          <EmptyContent
            icon={BookOpen}
            title="Você ainda não criou nenhum caderno"
            description="Crie um espaço para organizar conteúdos de uma disciplina, projeto ou objetivo."
            actionLabel="Criar primeiro caderno"
            onAction={() => setCreateOpen(true)}
          />
        ) : filteredNotebooks.length === 0 ? (
          <EmptyContent icon={Search} title="Nenhum caderno encontrado" description="Tente buscar por outro nome ou descrição." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNotebooks.map((notebook) => (
              <NotebookCard key={notebook.id} notebook={notebook} onOpen={(item) => navigate(`/planner/cadernos/${item.id}`)} onEdit={setEditingNotebook} onDelete={setDeletingNotebook} />
            ))}
          </div>
        )}
      </main>

      <CreateNotebookDialog open={createOpen} onOpenChange={setCreateOpen} />
      <NotebookDialog
        open={!!editingNotebook}
        onOpenChange={(open) => { if (!open) setEditingNotebook(null); }}
        notebook={editingNotebook}
        onSave={(input) => { if (editingNotebook) updateMutation.mutate({ id: editingNotebook.id, input }); }}
        isSaving={updateMutation.isPending}
      />

      <AlertDialog open={!!deletingNotebook} onOpenChange={(open) => { if (!open) setDeletingNotebook(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir caderno?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação excluirá o caderno “{deletingNotebook?.title}”.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => { if (deletingNotebook) deleteMutation.mutate(deletingNotebook.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyContent({ icon: Icon, title, description, actionLabel, onAction }: { icon: typeof BookOpen; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Icon className="h-8 w-8 text-muted-foreground" /></span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && <Button onClick={onAction} className="mt-5 gap-2"><Plus className="h-4 w-4" />{actionLabel}</Button>}
    </div>
  );
}
