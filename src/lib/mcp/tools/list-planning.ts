import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_planning",
  title: "Consultar planejamento",
  description: "Lista anotações, metas e horários do usuário, com filtros opcionais de data.",
  inputSchema: {
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial em YYYY-MM-DD."),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final em YYYY-MM-DD."),
    include_completed: z.boolean().optional().describe("Inclui itens concluídos. Padrão: false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, include_completed }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let notesQuery = supabase.from("planner_notes").select("id, title, content, subject_id, task_id, planned_date, pinned, completed, updated_at").eq("user_id", ctx.getUserId()).order("planned_date");
    let goalsQuery = supabase.from("planner_goals").select("id, title, description, subject_id, target_date, progress, completed, updated_at").eq("user_id", ctx.getUserId()).order("target_date");
    if (!include_completed) {
      notesQuery = notesQuery.eq("completed", false);
      goalsQuery = goalsQuery.eq("completed", false);
    }
    if (from_date) {
      notesQuery = notesQuery.gte("planned_date", from_date);
      goalsQuery = goalsQuery.gte("target_date", from_date);
    }
    if (to_date) {
      notesQuery = notesQuery.lte("planned_date", to_date);
      goalsQuery = goalsQuery.lte("target_date", to_date);
    }
    const [notes, goals, schedules] = await Promise.all([
      notesQuery,
      goalsQuery,
      supabase.from("study_schedules").select("id, title, type, day_of_week, specific_date, start_time, end_time, color").eq("user_id", ctx.getUserId()).order("start_time"),
    ]);
    const error = notes.error ?? goals.error ?? schedules.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const result = { notes: notes.data ?? [], goals: goals.data ?? [], schedules: schedules.data ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});