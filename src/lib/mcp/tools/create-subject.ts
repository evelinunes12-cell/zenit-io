import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "create_subject",
  title: "Create subject",
  description:
    "Create a new subject (discipline) for the signed-in user via the app's database.",
  inputSchema: {
    name: z
      .string()
      .trim()
      .min(1)
      .describe("Name of the subject (discipline)."),
    color: z
      .string()
      .optional()
      .describe("Optional color for the subject (e.g., '#FF5733' or 'blue')."),
    is_active: z
      .boolean()
      .optional()
      .describe("Whether the subject is active. Defaults to true."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, color, is_active }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const insert: Record<string, unknown> = {
      user_id: ctx.getUserId(),
      name,
      color: color || null,
      is_active: is_active !== false,
    };

    const { data, error } = await supabaseForUser(ctx)
      .from("subjects")
      .insert(insert)
      .select("id, name, color, is_active, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { subject: data },
    };
  },
});
