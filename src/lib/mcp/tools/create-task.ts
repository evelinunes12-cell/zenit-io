import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Create a new task (study/assignment) for the signed-in user via the app's database.",
  inputSchema: {
    subject_name: z
      .string()
      .trim()
      .min(1)
      .describe("Subject or title of the task."),
    description: z
      .string()
      .trim()
      .optional()
      .describe("Optional details about the task."),
    due_date: z
      .string()
      .optional()
      .describe("Optional due date in YYYY-MM-DD format."),
    status: z
      .string()
      .optional()
      .describe("Optional status name. Defaults to the app's default status."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ subject_name, description, due_date, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const insert: Record<string, unknown> = {
      user_id: ctx.getUserId(),
      subject_name,
    };
    if (description) insert.description = description;
    if (due_date) insert.due_date = due_date;
    if (status) insert.status = status;

    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .insert(insert)
      .select("id, subject_name, status, due_date")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { task: data },
    };
  },
});
