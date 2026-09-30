import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, ArrowLeft, Check, FileText, Loader2, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { fetchNotebookPage, saveNotebookPage } from "@/services/notebookPages";
import { fetchNotebook } from "@/services/notebooks";

const normalizeContent = (value: string) => value === "<p></p>" ? "" : value;

export default function NotebookPageEditor() {
  const { notebookId = "", pageId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedPageId = useRef<string | null>(null);
  const pendingPath = useRef<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const notebookQuery = useQuery({
    queryKey: ["notebook", notebookId, user?.id],
    queryFn: () => fetchNotebook(user?.id ?? "", notebookId),
    enabled: !!notebookId && !!user?.id,
  });
  const pageQuery = useQuery({
    queryKey: ["notebook-page", notebookId, pageId],
    queryFn: () => fetchNotebookPage(notebookId, pageId),
    enabled: !!notebookId && !!pageId && !!notebookQuery.data,
  });

  useEffect(() => {
    const page = pageQuery.data;
    if (!page || initializedPageId.current === page.id) return;
    const initialContent = normalizeContent(page.content ?? "");
    initializedPageId.current = page.id;
    setTitle(page.title);
    setContent(initialContent);
    setSavedTitle(page.title);
    setSavedContent(initialContent);
  }, [pageQuery.data]);

  const normalizedTitle = title.trim();
  const normalizedContent = normalizeContent(content);
  const isDirty = normalizedTitle !== savedTitle || normalizedContent !== savedContent;

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const interceptLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.origin !== window.location.origin) return;
      const nextPath = `${target.pathname}${target.search}${target.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;
      event.preventDefault();
      event.stopPropagation();
      pendingPath.current = nextPath;
      setLeaveDialogOpen(true);
    };
    document.addEventListener("click", interceptLinks, true);
    return () => document.removeEventListener("click", interceptLinks, true);
  }, [isDirty]);

  const saveMutation = useMutation({
    mutationFn: () => saveNotebookPage(notebookId, pageId, normalizedTitle, normalizedContent),
    onSuccess: (savedPage) => {
      setTitle(savedPage.title);
      setContent(normalizeContent(savedPage.content));
      setSavedTitle(savedPage.title);
      setSavedContent(normalizeContent(savedPage.content));
      queryClient.setQueryData(["notebook-page", notebookId, pageId], savedPage);
      queryClient.invalidateQueries({ queryKey: ["notebook-pages", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Página salva!");
    },
    onError: () => toast.error("Não foi possível salvar. Suas alterações continuam aqui."),
  });

  const leaveWithoutSaving = () => {
    const destination = pendingPath.current;
    pendingPath.current = null;
    setSavedTitle(normalizedTitle);
    setSavedContent(normalizedContent);
    setLeaveDialogOpen(false);
    if (destination) navigate(destination);
  };

  const handleBack = () => {
    const destination = `/cadernos/${notebookId}`;
    if (!isDirty) {
      navigate(destination);
      return;
    }
    pendingPath.current = destination;
    setLeaveDialogOpen(true);
  };

  if (notebookQuery.isLoading || pageQuery.isLoading) return <EditorSkeleton />;

  if (notebookQuery.isError || pageQuery.isError) {
    return (
      <EditorUnavailable
        title="Não foi possível carregar a página"
        description="Tente novamente para continuar."
        backPath={`/cadernos/${notebookId}`}
        onRetry={() => { notebookQuery.refetch(); pageQuery.refetch(); }}
      />
    );
  }

  const notebook = notebookQuery.data;
  const page = pageQuery.data;
  if (!notebook || !page) {
    return <EditorUnavailable title="Página não encontrada" description="Ela pode ter sido excluída ou não estar disponível para sua conta." backPath={notebook ? `/cadernos/${notebookId}` : "/cadernos"} />;
  }

  const updatedLabel = formatDistanceToNow(new Date(page.updated_at), { addSuffix: true, locale: ptBR });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-5xl min-w-0 items-center gap-2 px-4 py-3 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Voltar para ${notebook.title}`} onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{notebook.title}</p>
            <p className="truncate text-sm font-medium">{page.title}</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || !normalizedTitle || saveMutation.isPending} className="shrink-0 gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saveMutation.isPending ? "Salvando..." : "Salvar"}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <div className="space-y-3 border-b pb-6">
          <Input
            value={title}
            onChange={(event) => { setTitle(event.target.value); if (saveMutation.isError) saveMutation.reset(); }}
            aria-label="Título da página"
            maxLength={160}
            className="h-auto border-0 bg-transparent px-0 py-1 text-2xl font-bold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-3xl"
          />
          {!normalizedTitle && <p className="text-sm text-destructive">O título da página é obrigatório.</p>}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
            <span>Última atualização: {updatedLabel}</span>
            <span className={cn("inline-flex items-center gap-1 font-medium", isDirty && "text-warning", saveMutation.isError && "text-destructive", !isDirty && !saveMutation.isError && "text-success")}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveMutation.isError ? <AlertCircle className="h-3.5 w-3.5" /> : !isDirty ? <Check className="h-3.5 w-3.5" /> : null}
              {saveMutation.isPending ? "Salvando..." : saveMutation.isError ? "Erro ao salvar" : isDirty ? "Alterações não salvas" : "Salvo"}
            </span>
          </div>
        </div>

        <section className="py-6" aria-label="Conteúdo da página">
          <RichTextEditor
            content={content}
            onChange={(value) => { setContent(normalizeContent(value)); if (saveMutation.isError) saveMutation.reset(); }}
            showToolbar={false}
            placeholder="Comece a escrever..."
            ariaLabel="Conteúdo da página"
            minHeight="min(58vh, 680px)"
            className="border-0 bg-transparent shadow-none"
          />
        </section>

        <div className="sticky bottom-16 flex justify-end border-t bg-background/95 py-3 backdrop-blur md:bottom-0">
          <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || !normalizedTitle || saveMutation.isPending} className="w-full gap-2 sm:w-auto">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveMutation.isPending ? "Salvando..." : saveMutation.isError ? "Tentar salvar novamente" : "Salvar"}
          </Button>
        </div>
      </main>

      <AlertDialog open={leaveDialogOpen} onOpenChange={(open) => { setLeaveDialogOpen(open); if (!open) pendingPath.current = null; }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>As alterações feitas nesta página serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={leaveWithoutSaving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sair sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditorUnavailable({ title, description, backPath, onRetry }: { title: string; description: string; backPath: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
        <Button asChild variant="outline"><Link to={backPath}>Voltar ao caderno</Link></Button>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 md:px-6"><Skeleton className="h-10 w-full max-w-sm" /></div>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
        <div className="space-y-3 border-b pb-6"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-4 w-64" /></div>
        <Skeleton className="h-[55vh] w-full" />
      </main>
    </div>
  );
}