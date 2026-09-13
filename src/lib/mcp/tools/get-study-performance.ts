import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_study_performance",
  title: "Consultar desempenho de estudos",
  description: "Resume tempo, sessões, questões, acertos e desempenho por disciplina em um período.",
  inputSchema: {
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data inicial em YYYY-MM-DD."),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data final em YYYY-MM-DD."),
    subject_id: z.string().uuid().optional(),
    study_cycle_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, subject_id, study_cycle_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let query = supabaseForUser(ctx).from("focus_sessions")
      .select("id, duration_minutes, questions_total, questions_correct, rating, topic, source, subject_id, subjects(name), study_cycle_id, study_cycles(name)")
      .eq("user_id", ctx.getUserId()).gte("started_at", `${from_date}T00:00:00-03:00`).lte("started_at", `${to_date}T23:59:59.999-03:00`);
    if (subject_id) query = query.eq("subject_id", subject_id);
    if (study_cycle_id) query = query.eq("study_cycle_id", study_cycle_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const bySubject: Record<string, { subject_id: string | null; name: string; minutes: number; sessions: number; questions: number; correct: number; accuracy: number | null }> = {};
    let minutes = 0, questions = 0, correct = 0, ratingSum = 0, ratingCount = 0;
    for (const row of rows) {
      const q = row.questions_total ?? 0;
      const c = Math.min(q, row.questions_correct ?? 0);
      minutes += row.duration_minutes ?? 0; questions += q; correct += c;
      if (row.rating) { ratingSum += row.rating; ratingCount += 1; }
      const relation = row.subjects as { name?: string } | null;
      const key = row.subject_id ?? "sem-disciplina";
      const current = bySubject[key] ?? { subject_id: row.subject_id, name: relation?.name ?? "Sem disciplina", minutes: 0, sessions: 0, questions: 0, correct: 0, accuracy: null };
      current.minutes += row.duration_minutes ?? 0; current.sessions += 1; current.questions += q; current.correct += c;
      current.accuracy = current.questions ? (current.correct / current.questions) * 100 : null;
      bySubject[key] = current;
    }
    const result = { period: { from: from_date, to: to_date }, total_minutes: minutes, sessions: rows.length, questions, correct, accuracy: questions ? (correct / questions) * 100 : null, average_rating: ratingCount ? ratingSum / ratingCount : null, by_subject: Object.values(bySubject).sort((a, b) => b.minutes - a.minutes) };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});