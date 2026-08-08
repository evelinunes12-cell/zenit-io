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

  /**
   * Duplica tarefas selecionadas copiando dados gerais, links, anexos por link e etapas.
   * As cópias sempre nascem com o status "a fazer".
   */
  const bulkDuplicate = useCallback(
    async (taskIds: string[], todoStatus: string) => {
      if (taskIds.length === 0 || !user?.id) return null;
      setIsProcessing(true);

      try {
        const { data: sourceTasks, error: fetchError } = await supabase
          .from("tasks")
          .select("*")
          .in("id", taskIds);
        if (fetchError) throw fetchError;
        if (!sourceTasks || sourceTasks.length === 0) return null;

        // Nomes já existentes (inclusive arquivados) para evitar duplicidade
        const { data: existing } = await supabase
          .from("tasks")
          .select("subject_name")
          .eq("user_id", user.id);

        const usedNames = new Set<string>(
          (existing ?? []).map((task) => task.subject_name.trim().toLowerCase())
        );

        const { data: createdTasks, error: insertError } = await supabase
          .from("tasks")
          .insert(
            sourceTasks.map((task) => {
              const newName = buildCopyName(task.subject_name, usedNames);
              usedNames.add(newName.toLowerCase());
              return {
                user_id: user.id,
                subject_name: newName,
                description: task.description,
                due_date: task.due_date,
                is_group_work: task.is_group_work,
                group_members: task.group_members,
                google_docs_link: task.google_docs_link,
                canva_link: task.canva_link,
                checklist: task.checklist,
                environment_id: task.environment_id,
                status: todoStatus,
                is_archived: false,
              };
            })
          )
          .select("id");
        if (insertError) throw insertError;


        // Mapeia tarefa original -> cópia (mesma ordem do insert)
        const idMap = new Map<string, string>();
        sourceTasks.forEach((task, index) => {
          const created = createdTasks?.[index];
          if (created) idMap.set(task.id, created.id);
        });

        // Copia apenas anexos por link (arquivos no storage não são duplicados)
        const { data: linkAttachments } = await supabase
          .from("task_attachments")
          .select("*")
          .in("task_id", taskIds)
          .eq("is_link", true);

        if (linkAttachments?.length) {
          const rows = linkAttachments
            .filter((att) => idMap.has(att.task_id))
            .map((att) => ({
              task_id: idMap.get(att.task_id)!,
              file_name: att.file_name,
              file_path: att.file_path,
              file_size: att.file_size,
              file_type: att.file_type,
              is_link: true,
            }));
          if (rows.length) await supabase.from("task_attachments").insert(rows);
        }

        // Copia etapas e seus anexos por link
        const { data: steps } = await supabase
          .from("task_steps")
          .select("*")
          .in("task_id", taskIds)
          .order("order_index", { ascending: true });

        if (steps?.length) {
          const stepRows = steps
            .filter((step) => idMap.has(step.task_id))
            .map((step) => ({
              task_id: idMap.get(step.task_id)!,
              title: step.title,
              description: step.description,
              due_date: step.due_date,
              status: "Não Iniciado",
              google_docs_link: step.google_docs_link,
              canva_link: step.canva_link,
              order_index: step.order_index,
              checklist: step.checklist,
            }));

          if (stepRows.length) {
            const { data: createdSteps } = await supabase
              .from("task_steps")
              .insert(stepRows)
              .select("id");

            const stepIdMap = new Map<string, string>();
            steps
              .filter((step) => idMap.has(step.task_id))
              .forEach((step, index) => {
                const created = createdSteps?.[index];
                if (created) stepIdMap.set(step.id, created.id);
              });

            const originalStepIds = Array.from(stepIdMap.keys());
            if (originalStepIds.length) {
              const { data: stepLinks } = await supabase
                .from("task_step_attachments")
                .select("*")
                .in("task_step_id", originalStepIds)
                .eq("is_link", true);

              if (stepLinks?.length) {
                const rows = stepLinks
                  .filter((att) => stepIdMap.has(att.task_step_id))
                  .map((att) => ({
                    task_step_id: stepIdMap.get(att.task_step_id)!,
                    file_name: att.file_name,
                    file_path: att.file_path,
                    file_size: att.file_size,
                    file_type: att.file_type,
                    is_link: true,
                  }));
                if (rows.length) await supabase.from("task_step_attachments").insert(rows);
              }
            }
          }
        }

        return createdTasks?.map((task) => task.id) ?? [];
      } catch (error) {
        logError("Error bulk duplicating tasks", error);
        toast.error("Erro ao duplicar tarefas", { duration: 5000 });
        return null;
      } finally {
        setIsProcessing(false);
        invalidate();
      }
    },
    [user?.id, invalidate]
  );

  return { bulkUpdateStatus, bulkArchive, bulkDelete, bulkDuplicate, isProcessing };
};
