import { useCallback, useMemo, useState } from "react";

/**
 * Controla o modo de seleção múltipla de tarefas (lista e Kanban).
 */
export const useTaskSelection = () => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleTask = useCallback((taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectAll = useCallback((ids: string[]) => setSelectedIds(ids), []);

  const enterSelectionMode = useCallback(() => setSelectionMode(true), []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds([]);
      return !prev;
    });
  }, []);

  const isSelected = useCallback((taskId: string) => selectedSet.has(taskId), [selectedSet]);

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected,
    toggleTask,
    clearSelection,
    selectAll,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
  };
};

export type TaskSelection = ReturnType<typeof useTaskSelection>;
