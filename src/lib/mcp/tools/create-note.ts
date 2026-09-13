import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_note",
  title: "Create note",
  description:
    "Create a new note for the signed-in user via the app's database. Notes can be linked to subjects and scheduled for specific dates.",
  inputSchema: {
    title: z
      .string()
      .trim()
      .min(1)
      .describe("Title of the note."),
    content: z
      .string()
      .trim()
      .min(1)
      .describe("Content/text of the note."),
    subject_id: z
      .string()
      .optional()
      .describe("Optional subject ID to associate the note with."),
    task_id: z
      .string()
      .optional()
      .describe("Optional task ID to associate the note with."),
    planned_date: z
      .string()
      .optional()
      .describe("Optional date when the note is planned (YYYY-MM-DD format)."),
    color: z
      .string()
      .optional()
      .describe("Optional color for the note."),
    pinned: z
      .boolean()
      .optional()
      .describe("Whether the note is pinned. Defaults to false."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, subject_id, task_id, planned_date, color, pinned }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const insert: Record<string, unknown> = {
      user_id: ctx.getUserId(),
      title,
      content,
      subject_id: subject_id || null,
      task_id: task_id || null,
      planned_date: planned_date || null,
      color: color || null,
      pinned: pinned || false,
      completed: false,
    };

    const { data, error } = await supabaseForUser(ctx)
      .from("planner_notes")
      .insert(insert)
      .select("id, title, content, subject_id, task_id, planned_date, color, pinned, completed, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { note: data },
    };
  },
});
