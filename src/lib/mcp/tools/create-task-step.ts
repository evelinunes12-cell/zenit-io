import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task_step",
  title: "Criar etapa de tarefa",
  description: "Cria uma etapa detalhada em uma tarefa pessoal do usuário.",
  inputSchema: {
    task_id: z.string().uuid().describe("ID da tarefa."),
    title: z.string().trim().min(1).describe("Título da etapa."),
    description: z.string().trim().optional().describe("Descrição da etapa."),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data em YYYY-MM-DD."),
    status: z.enum(["Não Iniciado", "Em Progresso", "Concluído"]).optional().describe("Status inicial."),
    google_docs_link: z.string().url().optional().describe("Link do Google Docs."),
    canva_link: z.string().url().optional().describe("Link do Canva."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: task, error: taskError } = await supabase.from("tasks").select("id").eq("id", task_id).eq("user_id", ctx.getUserId()).single();
    if (taskError || !task) return { content: [{ type: "text", text: taskError?.message ?? "Tarefa não encontrada" }], isError: true };
    const { count } = await supabase.from("task_steps").select("id", { count: "exact", head: true }).eq("task_id", task_id);
    const { data, error } = await supabase.from("task_steps").insert({
      task_id,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      status: input.status ?? "Não Iniciado",
      google_docs_link: input.google_docs_link ?? null,
      canva_link: input.canva_link ?? null,
      order_index: count ?? 0,
      checklist: [],
    }).select("id, task_id, title, description, due_date, status, google_docs_link, canva_link, order_index").single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { step: data } };
  },
});