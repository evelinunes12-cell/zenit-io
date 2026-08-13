import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";

export interface FocusSessionWithDetails {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  created_at: string;
  subject_id: string | null;
  subject_name: string | null;
  subject_color: string | null;
  study_cycle_id: string | null;
  study_cycle_name: string | null;
  questions_total: number;
  questions_correct: number;
  notes: string | null;
  topic: string | null;
  rating: number | null;
  source: "pomodoro" | "cycle" | "manual";
}

export const fetchFocusSessionsWithDetails = async (
  userId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<FocusSessionWithDetails[]> => {
  if (!userId) return [];

  try {
    let query = supabase
      .from("focus_sessions")
      .select("*, subjects(name, color), study_cycles(name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (fromDate) {
      query = query.gte("started_at", fromDate.toISOString());
    }
    if (toDate) {
      // Use end of day to include all sessions on the selected date
      const endOfToDate = new Date(toDate);
      endOfToDate.setHours(23, 59, 59, 999);
      query = query.lte("started_at", endOfToDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_minutes: s.duration_minutes,
      created_at: s.created_at,
      subject_id: s.subject_id,
      subject_name: s.subjects?.name ?? null,
      subject_color: s.subjects?.color ?? null,
      study_cycle_id: s.study_cycle_id,
      study_cycle_name: s.study_cycles?.name ?? null,
      questions_total: s.questions_total ?? 0,
      questions_correct: s.questions_correct ?? 0,
      notes: s.notes ?? null,
      topic: s.topic ?? null,
      rating: s.rating ?? null,
      source: (s.source as any) ?? (s.study_cycle_id ? "cycle" : "pomodoro"),
    }));
  } catch (error) {
    logError("Erro ao buscar sessões com detalhes", error);
    return [];
  }
};

// Keep backward compat export
export type FocusSessionWithSubject = FocusSessionWithDetails;
export const fetchFocusSessionsWithSubjects = fetchFocusSessionsWithDetails;
