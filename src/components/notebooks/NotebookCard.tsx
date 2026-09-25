import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BookOpen, FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Notebook } from "@/services/notebooks";
import { cn } from "@/lib/utils";
import { getNotebookAccent } from "./notebookAppearance";

interface NotebookCardProps {
  notebook: Notebook;
  onOpen: (notebook: Notebook) => void;
  onEdit: (notebook: Notebook) => void;
  onDelete: (notebook: Notebook) => void;
}

export function NotebookCard({ notebook, onOpen, onEdit, onDelete }: NotebookCardProps) {
  const accent = getNotebookAccent(notebook.color);
  const updatedLabel = formatDistanceToNow(new Date(notebook.updated_at), { addSuffix: true, locale: ptBR });

  return (
    <Card className={cn("group min-w-0 overflow-hidden transition-shadow hover:shadow-md", accent.border)}>
      <CardContent className="p-0">
        <div className={cn("h-1.5", accent.background)} aria-hidden="true" />
        <div className="p-4">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpen(notebook)}
              className="h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left hover:bg-transparent"
              aria-label={`Abrir caderno ${notebook.title}`}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl", accent.background, accent.text)}>
                {notebook.icon || <BookOpen className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{notebook.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{notebook.page_count} {notebook.page_count === 1 ? "página" : "páginas"}</span>
                  <span>Atualizado {updatedLabel}</span>
                </span>
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Ações de ${notebook.title}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(notebook)} className="gap-2">
                  <Pencil className="h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(notebook)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {notebook.description && <p className="mt-4 line-clamp-2 break-words text-sm text-muted-foreground">{notebook.description}</p>}
          {notebook.subject && <Badge variant="secondary" className="mt-3 max-w-full truncate">{notebook.subject.name}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
