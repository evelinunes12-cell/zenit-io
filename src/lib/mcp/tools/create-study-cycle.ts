import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const blockSchema = z.object({ subject_id: z.string().uuid(), allocated_minutes: z.number().int().min(1).max(1440) });

export default defineTool({
  name: "create_study_cycle",
  title: "Criar ciclo de estudos",
  description: "Cria um ciclo com disciplinas, tempos e planejamento temporal opcional.",
  inputSchema: {
    name: z.string().trim().min(1).max(255),
    blocks: z.array(blockSchema).min(1).describe("Blocos na ordem em que serão estudados."),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    hours_per_day: z.number().positive().max(24).optional(),
    hours_per_week: z.number().positive().max(168).optional(),
    activate: z.boolean().optional().describe("Ativa este ciclo e desativa os demais."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ blocks, activate, ...cycleInput }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    if (cycleInput.start_date && cycleInput.end_date && cycleInput.end_date < cycleInput.start_date) return { content: [{ type: "text", text: "A data final deve ser posterior à inicial." }], isError: true };
    const supabase = supabaseForUser(ctx);
    const ids = [...new Set(blocks.map((block) => block.subject_id))];
    const { data: subjects, error: subjectError } = await supabase.from("subjects").select("id").eq("user_id", ctx.getUserId()).eq("is_active", true).in("id", ids);
    if (subjectError || (subjects?.length ?? 0) !== ids.length) return { content: [{ type: "text", text: subjectError?.message ?? "Use apenas disciplinas ativas da sua conta." }], isError: true };
    if (activate) {
      const { error } = await supabase.from("study_cycles").update({ is_active: false }).eq("user_id", ctx.getUserId());
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const { data: cycle, error } = await supabase.from("study_cycles").insert({ ...cycleInput, user_id: ctx.getUserId(), is_active: activate ?? false }).select("id, name, is_active, start_date, end_date, hours_per_day, hours_per_week").single();
    if (error || !cycle) return { content: [{ type: "text", text: error?.message ?? "Não foi possível criar o ciclo." }], isError: true };
    const { data: createdBlocks, error: blocksError } = await supabase.from("study_cycle_blocks").insert(blocks.map((block, index) => ({ cycle_id: cycle.id, ...block, order_index: index }))).select("id, subject_id, allocated_minutes, order_index");
    if (blocksError) {
      await supabase.from("study_cycles").delete().eq("id", cycle.id).eq("user_id", ctx.getUserId());
      return { content: [{ type: "text", text: blocksError.message }], isError: true };
    }
    const result = { ...cycle, blocks: createdBlocks ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: { cycle: result } };
  },
});