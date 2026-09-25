import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, FilePlus2, FileText, Pencil, Plus, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotebookDialog } from "@/components/notebooks/NotebookDialog";
import { NotebookPageCard } from "@/components/notebooks/NotebookPageCard";
import { NotebookPageDialog } from "@/components/notebooks/NotebookPageDialog";
import { getNotebookAccent } from "@/components/notebooks/notebookAppearance";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { fetchNotebook, updateNotebook, type NotebookInput } from "@/services/notebooks";
import { createNotebookPage, deleteNotebookPage, fetchNotebookPages, updateNotebookPage, type NotebookPage } from "@/services/notebookPages";

export default function NotebookDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editNotebookOpen, setEditNotebookOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<NotebookPage | null>(null);
  const [deletingPage, setDeletingPage] = useState<NotebookPage | null>(null);

  const notebookQuery = useQuery({
    queryKey: ["notebook", id, user?.id],
    queryFn: () => fetchNotebook(user?.id ?? "", id),
    enabled: !!id && !!user?.id,
  });
  const pagesQuery = useQuery({
    queryKey: ["notebook-pages", id],
    queryFn: () => fetchNotebookPages(id),
    enabled: !!id && !!notebookQuery.data,
  });

  const refreshNotebookData = () => {
    queryClient.invalidateQueries({ queryKey: ["notebook-pages", id] });
    queryClient.invalidateQueries({ queryKey: ["notebook", id] });
    queryClient.invalidateQueries({ queryKey: ["notebooks"] });
  };

  const createMutation = useMutation({
    mutationFn: (title: string) => createNotebookPage(id, title),
    onSuccess: () => { refreshNotebookData(); setCreateOpen(false); toast.success("Página criada!"); },
    onError: () => toast.error("Erro ao criar página"),
  });
  const updatePageMutation = useMutation({
    mutationFn: ({ pageId, title }: { pageId: string; title: string }) => updateNotebookPage(id, pageId, title),
    onSuccess: () => { refreshNotebookData(); setEditingPage(null); toast.success("Página atualizada!"); },
    onError: () => toast.error("Erro ao atualizar página"),
  });
  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) => deleteNotebookPage(id, pageId),
    onSuccess: () => { refreshNotebookData(); setDeletingPage(null); toast.success("Página excluída!"); },
    onError: () => toast.error("Erro ao excluir página"),
  });
  const updateNotebookMutation = useMutation({
    mutationFn: (input: NotebookInput) => {
      if (!user) throw new Error("Usuário não autenticado.");
      return updateNotebook(user.id, id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebook", id] });
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setEditNotebookOpen(false);
      toast.success("Caderno atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar caderno"),
  });

  const notebook = notebookQuery.data;
  const pages = pagesQuery.data ?? [];
  const accent = getNotebookAccent(notebook?.color);

  if (notebookQuery.isLoading) return <NotebookDetailSkeleton />;

  if (notebookQuery.isError) {
    return <NotebookUnavailable title="Não foi possível carregar o caderno" description="Tente novamente para continuar." onRetry={() => notebookQuery.refetch()} />;
  }

  if (!notebook) {
    return <NotebookUnavailable title="Caderno não encontrado" description="Ele pode ter sido excluído ou não estar disponível para sua conta." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex min-w-0 items-center gap-2 px-4 py-3 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Voltar para Cadernos"><Link to="/planner/cadernos"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground"><Link to="/planner/cadernos" className="hover:text-foreground">Cadernos</Link> / {notebook.title}</p>
            <h1 className="truncate text-lg font-bold">{notebook.title}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-6">
        <section className="flex min-w-0 flex-col gap-5 border-b pb-7 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-2xl", accent.background, accent.text)}>{notebook.icon || <BookOpen className="h-6 w-6" />}</span>
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-bold">{notebook.title}</h2>
              {notebook.description && <p className="mt-2 max-w-2xl break-words text-sm text-muted-foreground">{notebook.description}</p>}
              {notebook.subject && <Badge variant="secondary" className="mt-3 max-w-full truncate">{notebook.subject.name}</Badge>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-2 self-start" onClick={() => setEditNotebookOpen(true)}><Pencil className="h-4 w-4" />Editar caderno</Button>
        </section>

        <section className="space-y-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Páginas</h2><p className="mt-1 text-sm text-muted-foreground">{pages.length} {pages.length === 1 ? "página" : "páginas"} neste caderno</p></div>
            <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />Nova página</Button>
          </div>

          {pagesQuery.isLoading ? (
            <div className="space-y-3" aria-label="Carregando páginas">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[74px] w-full" />)}</div>
          ) : pagesQuery.isError ? (
            <EmptyPages icon={RefreshCw} title="Não foi possível carregar as páginas" description="Tente novamente para continuar." actionLabel="Tentar novamente" onAction={() => pagesQuery.refetch()} />
          ) : pages.length === 0 ? (
            <EmptyPages icon={FileText} title="Este caderno ainda não possui páginas" description="Crie uma página para começar a organizar seu conteúdo." actionLabel="Nova página" onAction={() => setCreateOpen(true)} />
          ) : (
            <div className="space-y-3">{pages.map((page) => <NotebookPageCard key={page.id} page={page} onEdit={setEditingPage} onDelete={setDeletingPage} />)}</div>
          )}
        </section>
      </main>

      <NotebookPageDialog open={createOpen} onOpenChange={setCreateOpen} onSave={(title) => createMutation.mutate(title)} isSaving={createMutation.isPending} />
      <NotebookPageDialog open={!!editingPage} onOpenChange={(open) => { if (!open) setEditingPage(null); }} page={editingPage} onSave={(title) => { if (editingPage) updatePageMutation.mutate({ pageId: editingPage.id, title }); }} isSaving={updatePageMutation.isPending} />
      <NotebookDialog open={editNotebookOpen} onOpenChange={setEditNotebookOpen} notebook={notebook} onSave={(input) => updateNotebookMutation.mutate(input)} isSaving={updateNotebookMutation.isPending} />

      <AlertDialog open={!!deletingPage} onOpenChange={(open) => { if (!open) setDeletingPage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir página?</AlertDialogTitle><AlertDialogDescription>Essa ação excluirá a página “{deletingPage?.title}”.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deletePageMutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deletePageMutation.isPending} onClick={() => { if (deletingPage) deletePageMutation.mutate(deletingPage.id); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletePageMutation.isPending ? "Excluindo..." : "Excluir"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyPages({ icon: Icon, title, description, actionLabel, onAction }: { icon: typeof FileText; title: string; description: string; actionLabel: string; onAction: () => void }) {
  return <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center"><span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Icon className="h-8 w-8 text-muted-foreground" /></span><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p><Button onClick={onAction} className="mt-5 gap-2"><FilePlus2 className="h-4 w-4" />{actionLabel}</Button></div>;
}

function NotebookUnavailable({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center"><BookOpen className="mb-4 h-12 w-12 text-muted-foreground" /><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p><div className="mt-5 flex flex-wrap justify-center gap-2">{onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}<Button asChild variant="outline"><Link to="/planner/cadernos">Voltar para Cadernos</Link></Button></div></div>;
}

function NotebookDetailSkeleton() {
  return <div className="min-h-screen bg-background"><div className="border-b p-4 md:p-6"><Skeleton className="h-8 w-64" /></div><main className="mx-auto max-w-5xl space-y-8 p-4 md:p-6"><div className="flex gap-4 border-b pb-7"><Skeleton className="h-14 w-14" /><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-72 max-w-full" /></div></div><div className="space-y-3"><Skeleton className="h-8 w-40" />{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[74px] w-full" />)}</div></main></div>;
}