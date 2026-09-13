import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_task_details",
  title: "Consultar tarefa completa",
  description: "Consulta uma tarefa do usuário com checklist, links e etapas detalhadas.",
  inputSchema: { task_id: z.string().uuid().describe("ID da tarefa.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .select("id, subject_name, description, due_date, status, google_docs_link, canva_link, checklist, is_archived, created_at, updated_at, task_steps(id, title, description, due_date, status, google_docs_link, canva_link, order_index, checklist)")
      .eq("id", task_id)
      .eq("user_id", ctx.getUserId())
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { task: data } };
  },
});