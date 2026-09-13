import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_subjects",
  title: "Listar disciplinas",
  description: "Lista as disciplinas do usuário para localizar IDs e verificar quais estão ativas.",
  inputSchema: {
    include_inactive: z.boolean().optional().describe("Inclui disciplinas desativadas. Padrão: false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let query = supabaseForUser(ctx)
      .from("subjects")
      .select("id, name, color, is_active, created_at")
      .eq("user_id", ctx.getUserId())
      .order("name");
    if (!include_inactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { subjects: data ?? [] } };
  },
});