import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, Trash2, X, CheckCheck, ChevronUp, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  availableStatuses: string[];
  isProcessing?: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExitSelectionMode: () => void;
  onChangeStatus: (status: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  availableStatuses,
  isProcessing = false,
  onSelectAll,
  onClearSelection,
  onExitSelectionMode,
  onChangeStatus,
  onArchive,
  onDelete,
}: BulkActionsBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-20 md:pb-6 pointer-events-none">
        <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              {selectedCount}
            </Badge>
            <span className="text-sm font-medium text-foreground break-words">
              {selectedCount === 1 ? "tarefa selecionada" : "tarefas selecionadas"}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {selectedCount < totalCount && (
              <Button variant="ghost" size="sm" onClick={onSelectAll} className="gap-1">
                <CheckCheck className="h-4 w-4" />
                Selecionar todas
              </Button>
            )}

            {availableStatuses.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" disabled={isProcessing}>
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                    Alterar status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="bg-popover">
                  {availableStatuses.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onChangeStatus(status)}
                      className="cursor-pointer"
                    >
                      {status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={onArchive}
              disabled={isProcessing}
            >
              <Archive className="h-4 w-4" />
              Arquivar
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>

            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Limpar seleção
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onExitSelectionMode}
              aria-label="Sair do modo de seleção"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedCount} tarefa(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As tarefas selecionadas serão removidas
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
