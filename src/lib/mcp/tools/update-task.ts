import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export default defineTool({
  name: "update_task",
  title: "Atualizar tarefa",
  description: "Atualiza título, descrição, entrega, status, links ou arquivamento de uma tarefa pessoal.",
  inputSchema: {
    task_id: z.string().uuid().describe("ID da tarefa."),
    subject_name: z.string().trim().min(1).optional().describe("Novo título da tarefa."),
    description: z.string().trim().nullable().optional().describe("Nova descrição; null remove o conteúdo."),
    due_date: dateSchema.optional().describe("Data em YYYY-MM-DD; null remove a data."),
    status: z.string().trim().min(1).optional().describe("Nome exato do novo status."),
    google_docs_link: z.string().url().nullable().optional().describe("Link do Google Docs; null remove."),
    canva_link: z.string().url().nullable().optional().describe("Link do Canva; null remove."),
    is_archived: z.boolean().optional().describe("Arquiva ou restaura a tarefa."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, ...updates }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    if (Object.keys(updates).length === 0) return { content: [{ type: "text", text: "Informe ao menos um campo para atualizar." }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .update(updates)
      .eq("id", task_id)
      .eq("user_id", ctx.getUserId())
      .select("id, subject_name, description, due_date, status, google_docs_link, canva_link, is_archived, updated_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { task: data } };
  },
});