import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createNotebook, type NotebookInput } from "@/services/notebooks";
import { NotebookDialog } from "./NotebookDialog";

interface CreateNotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateNotebookDialog({ open, onOpenChange, onCreated }: CreateNotebookDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: NotebookInput) => {
      if (!user) throw new Error("Usuário não autenticado.");
      return createNotebook(user.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Caderno criado!");
      onOpenChange(false);
      onCreated?.();
    },
    onError: () => toast.error("Erro ao criar caderno"),
  });

  return <NotebookDialog open={open} onOpenChange={onOpenChange} onSave={(input) => mutation.mutate(input)} isSaving={mutation.isPending} />;
}
