import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_leaderboard",
  title: "Get ranking",
  description:
    "Get the XP leaderboard (ranking) of users for a given period. Returns top users ordered by total XP.",
  inputSchema: {
    period: z
      .enum(["daily", "weekly", "monthly", "all_time"])
      .optional()
      .describe("Ranking period. Defaults to 'weekly'."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max number of entries to return. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ period, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx).rpc("get_leaderboard", {
      period_type: period ?? "weekly",
    });

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = (data ?? []).slice(0, limit ?? 20);
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { leaderboard: rows },
    };
  },
});
