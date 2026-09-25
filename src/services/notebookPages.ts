import { supabase } from "@/integrations/supabase/client";

export interface NotebookPage {
  id: string;
  notebook_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

const NOTEBOOK_PAGE_SELECT = "id, notebook_id, title, position, created_at, updated_at";

export const fetchNotebookPages = async (notebookId: string) => {
  const { data, error } = await supabase
    .from("notebook_pages")
    .select(NOTEBOOK_PAGE_SELECT)
    .eq("notebook_id", notebookId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as NotebookPage[];
};

export const createNotebookPage = async (notebookId: string, title: string) => {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Informe o título da página.");

  const { data, error } = await supabase
    .from("notebook_pages")
    .insert({ notebook_id: notebookId, title: normalizedTitle })
    .select(NOTEBOOK_PAGE_SELECT)
    .single();

  if (error) throw error;
  return data as NotebookPage;
};

export const updateNotebookPage = async (notebookId: string, pageId: string, title: string) => {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Informe o título da página.");

  const { data, error } = await supabase
    .from("notebook_pages")
    .update({ title: normalizedTitle })
    .eq("id", pageId)
    .eq("notebook_id", notebookId)
    .select(NOTEBOOK_PAGE_SELECT)
    .single();

  if (error) throw error;
  return data as NotebookPage;
};

export const deleteNotebookPage = async (notebookId: string, pageId: string) => {
  const { error } = await supabase
    .from("notebook_pages")
    .delete()
    .eq("id", pageId)
    .eq("notebook_id", notebookId);

  if (error) throw error;
};