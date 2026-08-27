import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description:
    "List the signed-in user's tasks (studies/assignments), optionally filtered by status and whether archived.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Optional status filter, e.g. the exact status name of a task."),
    include_archived: z
      .boolean()
      .optional()
      .describe("Include archived tasks. Defaults to false."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max number of tasks to return. Defaults to 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, include_archived, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("tasks")
      .select("id, subject_name, description, due_date, status, is_group_work, is_archived, created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (!include_archived) query = query.eq("is_archived", false);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
