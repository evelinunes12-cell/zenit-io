import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_study_cycle",
  title: "Atualizar ciclo de estudos",
  description: "Atualiza nome, datas, dedicação planejada ou estado ativo de um ciclo do usuário.",
  inputSchema: {
    cycle_id: z.string().uuid(),
    name: z.string().trim().min(1).max(255).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    hours_per_day: z.number().positive().max(24).nullable().optional(),
    hours_per_week: z.number().positive().max(168).nullable().optional(),
    is_active: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ cycle_id, is_active, ...updates }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const patch: Record<string, unknown> = { ...updates };
    if (is_active !== undefined) patch.is_active = is_active;
    if (Object.keys(patch).length === 0) return { content: [{ type: "text", text: "Informe ao menos um campo para atualizar." }], isError: true };
    const supabase = supabaseForUser(ctx);
    if (is_active) {
      const { error } = await supabase.from("study_cycles").update({ is_active: false }).eq("user_id", ctx.getUserId()).neq("id", cycle_id);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const { data, error } = await supabase.from("study_cycles").update(patch).eq("id", cycle_id).eq("user_id", ctx.getUserId()).select("id, name, is_active, start_date, end_date, hours_per_day, hours_per_week, current_block_index").single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { cycle: data } };
  },
});