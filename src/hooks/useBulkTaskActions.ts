import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/services/tasks";
import { registerActivity } from "@/services/activity";
import { toast } from "sonner";
import { logError } from "@/lib/logger";

/**
 * Ações em lote sobre tarefas selecionadas (status, arquivar, excluir).
 * Reutiliza a mesma chave de cache das mutações individuais do dashboard.
 */
export const useBulkTaskActions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["archived-tasks", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["user-streak", user?.id] });
  }, [queryClient, user?.id]);

  const bulkUpdateStatus = useCallback(
    async (taskIds: string[], newStatus: string) => {
      if (taskIds.length === 0) return false;
      setIsProcessing(true);
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", user?.id]);
      queryClient.setQueryData<Task[]>(["tasks", user?.id], (old) =>
        old?.map((task) => (taskIds.includes(task.id) ? { ...task, status: newStatus } : task)) || []
      );

      try {
        const { error } = await supabase.from("tasks").update({ status: newStatus }).in("id", taskIds);
        if (error) throw error;
        if (user?.id) await registerActivity(user.id);
        toast.success(`${taskIds.length} tarefa(s) atualizada(s) para "${newStatus}"`, { duration: 3000 });
        return true;
      } catch (error) {
        logError("Error bulk updating status", error);
        if (previousTasks) queryClient.setQueryData(["tasks", user?.id], previousTasks);
        toast.error("Erro ao atualizar status das tarefas", { duration: 5000 });
        return false;
      } finally {
        setIsProcessing(false);
        invalidate();
      }
    },
    [queryClient, user?.id, invalidate]
  );

  const bulkArchive = useCallback(
    async (taskIds: string[]) => {
      if (taskIds.length === 0) return false;
      setIsProcessing(true);
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", user?.id]);
      queryClient.setQueryData<Task[]>(["tasks", user?.id], (old) =>
        old?.filter((task) => !taskIds.includes(task.id)) || []
      );

      try {
        const { error } = await supabase.from("tasks").update({ is_archived: true }).in("id", taskIds);
        if (error) throw error;
        toast.success(`${taskIds.length} tarefa(s) arquivada(s)`, {
          description: "Você pode encontrá-las em Tarefas Arquivadas.",
        });
        return true;
      } catch (error) {
        logError("Error bulk archiving tasks", error);
        if (previousTasks) queryClient.setQueryData(["tasks", user?.id], previousTasks);
        toast.error("Erro ao arquivar tarefas", { duration: 5000 });
        return false;
      } finally {
        setIsProcessing(false);
        invalidate();
      }
    },
    [queryClient, user?.id, invalidate]
  );

  const bulkDelete = useCallback(
    async (taskIds: string[]) => {
      if (taskIds.length === 0) return false;
      setIsProcessing(true);
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", user?.id]);
      queryClient.setQueryData<Task[]>(["tasks", user?.id], (old) =>
        old?.filter((task) => !taskIds.includes(task.id)) || []
      );

      try {
        const { error } = await supabase.from("tasks").delete().in("id", taskIds);
        if (error) throw error;
        toast.success(`${taskIds.length} tarefa(s) excluída(s)`, { duration: 4000 });
        return true;
      } catch (error) {
        logError("Error bulk deleting tasks", error);
        if (previousTasks) queryClient.setQueryData(["tasks", user?.id], previousTasks);
        toast.error("Erro ao excluir tarefas", { duration: 5000 });
        return false;
      } finally {
        setIsProcessing(false);
        invalidate();
      }
    },
    [queryClient, user?.id, invalidate]
  );

  return { bulkUpdateStatus, bulkArchive, bulkDelete, isProcessing };
};
