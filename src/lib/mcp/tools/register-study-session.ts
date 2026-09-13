import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "register_study_session",
  title: "Registrar estudo",
  description: "Registra uma sessão de estudo com duração, disciplina, questões, assunto e avaliação.",
  inputSchema: {
    started_at: z.string().datetime().describe("Início em ISO 8601 com fuso horário."),
    duration_minutes: z.number().int().min(1).max(1440),
    subject_id: z.string().uuid().optional(),
    study_cycle_id: z.string().uuid().optional(),
    source: z.enum(["manual", "pomodoro", "cycle"]).optional(),
    questions_total: z.number().int().min(0).optional(),
    questions_correct: z.number().int().min(0).optional(),
    topic: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(5000).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const total = input.questions_total ?? 0;
    const correct = input.questions_correct ?? 0;
    if (correct > total) return { content: [{ type: "text", text: "Acertos não podem superar o total de questões." }], isError: true };
    const started = new Date(input.started_at);
    const ended = new Date(started.getTime() + input.duration_minutes * 60_000);
    const { data, error } = await supabaseForUser(ctx).from("focus_sessions").insert({
      user_id: ctx.getUserId(), started_at: started.toISOString(), ended_at: ended.toISOString(),
      duration_minutes: input.duration_minutes, subject_id: input.subject_id ?? null,
      study_cycle_id: input.study_cycle_id ?? null, source: input.source ?? (input.study_cycle_id ? "cycle" : "manual"),
      questions_total: total, questions_correct: correct, topic: input.topic ?? null,
      notes: input.notes ?? null, rating: input.rating ?? null,
    }).select("id, started_at, ended_at, duration_minutes, subject_id, study_cycle_id, source, questions_total, questions_correct, topic, notes, rating").single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { session: data } };
  },
});