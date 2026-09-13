import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_study_schedule",
  title: "Criar horário no planejamento",
  description: "Cria um horário fixo semanal ou um evento único na agenda do usuário.",
  inputSchema: {
    title: z.string().trim().min(1).max(255),
    type: z.enum(["fixed", "variable"]).describe("fixed repete semanalmente; variable é um evento único."),
    day_of_week: z.number().int().min(0).max(6).describe("Dia da semana: 0 domingo até 6 sábado."),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    specific_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Obrigatória para evento variable."),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    if (input.start_time >= input.end_time) return { content: [{ type: "text", text: "O horário final deve ser posterior ao inicial." }], isError: true };
    if (input.type === "variable" && !input.specific_date) return { content: [{ type: "text", text: "Eventos únicos exigem specific_date." }], isError: true };
    const { data, error } = await supabaseForUser(ctx).from("study_schedules").insert({ ...input, specific_date: input.type === "variable" ? input.specific_date : null, user_id: ctx.getUserId() }).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { schedule: data } };
  },
});