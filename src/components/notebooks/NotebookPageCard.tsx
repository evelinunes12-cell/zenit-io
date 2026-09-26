import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { NotebookPage } from "@/services/notebookPages";

interface NotebookPageCardProps {
  page: NotebookPage;
  onOpen: (page: NotebookPage) => void;
  onEdit: (page: NotebookPage) => void;
  onDelete: (page: NotebookPage) => void;
}

export function NotebookPageCard({ page, onOpen, onEdit, onDelete }: NotebookPageCardProps) {
  const updatedLabel = formatDistanceToNow(new Date(page.updated_at), { addSuffix: true, locale: ptBR });

  return (
    <Card className="min-w-0 transition-shadow hover:shadow-sm">
      <CardContent className="flex min-w-0 items-center gap-3 p-4">
        <Button type="button" variant="ghost" onClick={() => onOpen(page)} className="h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left hover:bg-transparent" aria-label={`Abrir página ${page.title}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">{page.title}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Atualizada {updatedLabel}</span>
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Ações de ${page.title}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(page)} className="gap-2"><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(page)} className="gap-2 text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" />Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}