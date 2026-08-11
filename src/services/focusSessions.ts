import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";

export type StudySessionSource = "pomodoro" | "cycle" | "manual";

export interface FocusSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  created_at: string;
  subject_id: string | null;
  questions_total?: number;
  questions_correct?: number;
  notes?: string | null;
  source?: StudySessionSource | null;
}

export interface CreateFocusSessionExtras {
  notes?: string | null;
  source?: StudySessionSource;
}

export const createFocusSession = async (
  userId: string,
  startedAt: Date,
  durationMinutes: number,
  subjectId?: string | null,
  studyCycleId?: string | null,
  questionsTotal?: number,
  questionsCorrect?: number,
  extras?: CreateFocusSessionExtras
): Promise<FocusSession | null> => {
  if (!userId) return null;

  try {
    const endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    const insertData: any = {
      user_id: userId,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      ...(subjectId ? { subject_id: subjectId } : {}),
      ...(studyCycleId ? { study_cycle_id: studyCycleId } : {}),
      questions_total: Math.max(0, Math.floor(questionsTotal || 0)),
      questions_correct: Math.max(0, Math.floor(questionsCorrect || 0)),
      ...(extras?.notes ? { notes: extras.notes } : {}),
      source: extras?.source || (studyCycleId ? "cycle" : "pomodoro"),
    };

    const { data, error } = await supabase
      .from("focus_sessions")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data as FocusSession;
  } catch (error) {
    logError("Erro ao criar sessão de foco", error);
    return null;
  }
};


export const fetchFocusSessions = async (
  userId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<FocusSession[]> => {
  if (!userId) return [];

  try {
    let query = supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (fromDate) {
      query = query.gte("started_at", fromDate.toISOString());
    }
    if (toDate) {
      query = query.lte("started_at", toDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as FocusSession[];
  } catch (error) {
    logError("Erro ao buscar sessões de foco", error);
    return [];
  }
};

export const getTotalFocusMinutes = async (
  userId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<number> => {
  const sessions = await fetchFocusSessions(userId, fromDate, toDate);
  return sessions.reduce((acc, session) => acc + session.duration_minutes, 0);
};

export interface UpdateFocusSessionInput {
  startedAt?: Date;
  durationMinutes?: number;
  questionsTotal?: number;
  questionsCorrect?: number;
  subjectId?: string | null;
  studyCycleId?: string | null;
  notes?: string | null;
}

export const updateFocusSession = async (
  sessionId: string,
  input: UpdateFocusSessionInput
): Promise<boolean> => {
  try {
    const patch: any = {};
    const started = input.startedAt;
    const duration = input.durationMinutes;
    if (started && typeof duration === "number") {
      patch.started_at = started.toISOString();
      patch.ended_at = new Date(started.getTime() + duration * 60 * 1000).toISOString();
      patch.duration_minutes = duration;
    } else if (started) {
      patch.started_at = started.toISOString();
    } else if (typeof duration === "number") {
      patch.duration_minutes = duration;
    }
    if (typeof input.questionsTotal === "number") {
      patch.questions_total = Math.max(0, Math.floor(input.questionsTotal));
    }
    if (typeof input.questionsCorrect === "number") {
      patch.questions_correct = Math.max(0, Math.floor(input.questionsCorrect));
    }
    if (input.subjectId !== undefined) {
      patch.subject_id = input.subjectId;
    }
    if (input.studyCycleId !== undefined) {
      patch.study_cycle_id = input.studyCycleId;
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes;
    }

    const { error } = await supabase
      .from("focus_sessions")
      .update(patch)
      .eq("id", sessionId);

    if (error) throw error;
    return true;
  } catch (error) {
    logError("Erro ao atualizar sessão de foco", error);
    return false;
  }
};

export const deleteFocusSession = async (sessionId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("focus_sessions")
      .delete()
      .eq("id", sessionId);
    if (error) throw error;
    return true;
  } catch (error) {
    logError("Erro ao excluir sessão de foco", error);
    return false;
  }
};

