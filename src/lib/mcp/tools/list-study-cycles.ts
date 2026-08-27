import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "list_study_cycles",
  title: "List study cycles",
  description:
    "List the signed-in user's study cycles with their blocks (subjects and allocated minutes).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("study_cycles")
      .select(
        "id, name, is_active, start_date, end_date, study_cycle_blocks(allocated_minutes, order_index, subjects(name))",
      )
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false });

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { cycles: data ?? [] },
    };
  },
});
