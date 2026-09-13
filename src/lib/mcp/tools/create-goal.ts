import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_goal",
  title: "Create goal",
  description:
    "Create a new goal (meta) for the signed-in user via the app's database. Goals can be linked to subjects and have a target date and progress tracking.",
  inputSchema: {
    title: z
      .string()
      .trim()
      .min(1)
      .describe("Title of the goal."),
    description: z
      .string()
      .trim()
      .optional()
      .describe("Optional detailed description of the goal."),
    subject_id: z
      .string()
      .optional()
      .describe("Optional subject ID to associate the goal with."),
    target_date: z
      .string()
      .optional()
      .describe("Optional target date for completing the goal (YYYY-MM-DD format)."),
    progress: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Initial progress percentage (0-100). Defaults to 0."),
    completed: z
      .boolean()
      .optional()
      .describe("Whether the goal is completed. Defaults to false."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, subject_id, target_date, progress, completed }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const insert: Record<string, unknown> = {
      user_id: ctx.getUserId(),
      title,
      description: description || null,
      subject_id: subject_id || null,
      target_date: target_date || null,
      progress: progress ?? 0,
      completed: completed || false,
    };

    const { data, error } = await supabaseForUser(ctx)
      .from("planner_goals")
      .insert(insert)
      .select("id, title, description, subject_id, target_date, progress, completed, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { goal: data },
    };
  },
});
