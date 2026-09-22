import { supabase } from "@/integrations/supabase/client";

export interface Notebook {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  subject_id: string | null;
  created_at: string;
  updated_at: string;
  subject?: { name: string; color: string | null } | null;
}

export interface NotebookInput {
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  subject_id: string | null;
}

const NOTEBOOK_SELECT = "id, user_id, title, description, icon, color, subject_id, created_at, updated_at, subject:subjects(name, color)";

export const fetchNotebooks = async (userId: string) => {
  const { data, error } = await supabase
    .from("notebooks")
    .select(NOTEBOOK_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as Notebook[];
};

export const createNotebook = async (userId: string, input: NotebookInput) => {
  const title = input.title.trim();
  if (!title) throw new Error("Informe o nome do caderno.");

  const { data, error } = await supabase
    .from("notebooks")
    .insert({ user_id: userId, ...input, title })
    .select(NOTEBOOK_SELECT)
    .single();

  if (error) throw error;
  return data as Notebook;
};

export const updateNotebook = async (userId: string, id: string, input: NotebookInput) => {
  const title = input.title.trim();
  if (!title) throw new Error("Informe o nome do caderno.");

  const { data, error } = await supabase
    .from("notebooks")
    .update({ ...input, title })
    .eq("id", id)
    .eq("user_id", userId)
    .select(NOTEBOOK_SELECT)
    .single();

  if (error) throw error;
  return data as Notebook;
};

export const deleteNotebook = async (userId: string, id: string) => {
  const { error } = await supabase
    .from("notebooks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
};
