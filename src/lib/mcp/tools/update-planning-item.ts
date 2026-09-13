import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_planning_item",
  title: "Atualizar anotação ou meta",
  description: "Atualiza uma anotação ou meta do usuário, incluindo progresso e conclusão.",
  inputSchema: {
    item_type: z.enum(["note", "goal"]).describe("Tipo do item."),
    item_id: z.string().uuid().describe("ID da anotação ou meta."),
    title: z.string().trim().min(1).optional(),
    description_or_content: z.string().trim().nullable().optional().describe("Descrição da meta ou conteúdo da anotação."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("Data planejada ou data-alvo."),
    completed: z.boolean().optional(),
    progress: z.number().int().min(0).max(100).optional().describe("Progresso da meta; ignorado em anotações."),
    pinned: z.boolean().optional().describe("Fixação da anotação; ignorada em metas."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ item_type, item_id, description_or_content, date, progress, pinned, ...common }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const isNote = item_type === "note";
    const updates: Record<string, unknown> = { ...common };
    if (description_or_content !== undefined) updates[isNote ? "content" : "description"] = description_or_content;
    if (date !== undefined) updates[isNote ? "planned_date" : "target_date"] = date;
    if (isNote && pinned !== undefined) updates.pinned = pinned;
    if (!isNote && progress !== undefined) updates.progress = progress;
    if (Object.keys(updates).length === 0) return { content: [{ type: "text", text: "Informe ao menos um campo para atualizar." }], isError: true };
    const table = isNote ? "planner_notes" : "planner_goals";
    const { data, error } = await supabaseForUser(ctx).from(table).update(updates).eq("id", item_id).eq("user_id", ctx.getUserId()).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { item: data } };
  },
});