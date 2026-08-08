import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  Trash2,
  X,
  CheckCheck,
  ChevronUp,
  Loader2,
  Copy,
  MoreVertical,
  Eraser,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onDuplicate: () => void;
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
  onDuplicate,
  onDelete,
}: BulkActionsBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMobile = useIsMobile();

  if (selectedCount === 0) return null;

  const statusMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 min-h-11 md:min-h-9 flex-1 md:flex-none"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          <span className="truncate">{isMobile ? "Status" : "Alterar status"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="z-50 bg-popover max-h-64 overflow-y-auto">
        {availableStatuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => onChangeStatus(status)}
            className="cursor-pointer break-words"
          >
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-20 md:px-4 md:pb-6 pointer-events-none">
        <div className="pointer-events-auto mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          {isMobile ? (
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {selectedCount}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {selectedCount === 1 ? "tarefa selecionada" : "tarefas selecionadas"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={onExitSelectionMode}
                  aria-label="Sair do modo de seleção"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {availableStatuses.length > 0 && statusMenu}

                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 flex-1 gap-1"
                  onClick={onDuplicate}
                  disabled={isProcessing}
                >
                  <Copy className="h-4 w-4" />
                  <span className="truncate">Duplicar</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      disabled={isProcessing}
                      aria-label="Mais ações"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="z-50 bg-popover">
                    {selectedCount < totalCount && (
                      <DropdownMenuItem onClick={onSelectAll} className="cursor-pointer">
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Selecionar todas
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onArchive} className="cursor-pointer">
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onClearSelection} className="cursor-pointer">
                      <Eraser className="mr-2 h-4 w-4" />
                      Limpar seleção
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2">
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

                {availableStatuses.length > 0 && statusMenu}

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
                  className="gap-1"
                  onClick={onDuplicate}
                  disabled={isProcessing}
                >
                  <Copy className="h-4 w-4" />
                  Duplicar
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
          )}
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
