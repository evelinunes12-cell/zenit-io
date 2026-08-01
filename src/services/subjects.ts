import { supabase } from "@/integrations/supabase/client";
import { subjectStatusSchema } from "@/lib/validation";

export interface Subject {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Validate subject data before database operations
const validateSubject = (name: string, color?: string | null): void => {
  const validation = subjectStatusSchema.safeParse({ name, color: color || undefined });
  if (!validation.success) {
    throw new Error(validation.error.errors.map(e => e.message).join(', '));
  }
};

export const fetchSubjects = async () => {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("name");
  
  if (error) throw error;
  return data as Subject[];
};

/** Apenas disciplinas ativas — usar em criação de tarefas, ciclos, metas e anotações. */
export const fetchActiveSubjects = async () => {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as Subject[];
};



export const fetchSubjectNames = async () => {
  const { data, error } = await supabase
    .from("subjects")
    .select("name")
    .order("name");
  
  if (error) throw error;
  return data.map(s => s.name);
};

/** Names of subjects the user has deactivated (excluded from recommendations). */
export const fetchInactiveSubjectNames = async () => {
  const { data, error } = await supabase
    .from("subjects")
    .select("name")
    .eq("is_active", false);

  if (error) throw error;
  return (data || []).map((s) => s.name);
};

export const setSubjectActive = async (id: string, isActive: boolean) => {
  const { error } = await supabase
    .from("subjects")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw error;
};

export const ensureSubjectExists = async (
  subjectName: string,
  userId: string
) => {
  // Validate subject name
  validateSubject(subjectName);

  // Check if subject already exists
  const { data: existingSubject } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", subjectName)
    .eq("user_id", userId)
    .single();

  // Create if doesn't exist
  if (!existingSubject) {
    const { error } = await supabase
      .from("subjects")
      .insert({
        name: subjectName,
        user_id: userId,
        color: null,
      });
    
    if (error) throw error;
  }
};

export const createSubject = async (
  name: string,
  userId: string,
  color?: string
) => {
  // Validate subject data
  validateSubject(name, color);

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name,
      user_id: userId,
      color: color || null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as Subject;
};

export const updateSubject = async (
  id: string,
  updates: { name?: string; color?: string | null }
) => {
  // Validate if name is being updated
  if (updates.name) {
    validateSubject(updates.name, updates.color);
  }

  const { error } = await supabase
    .from("subjects")
    .update(updates)
    .eq("id", id);
  
  if (error) throw error;
};

export const deleteSubject = async (id: string) => {
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
};
