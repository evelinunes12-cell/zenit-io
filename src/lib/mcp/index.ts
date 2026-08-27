import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import listStudyCyclesTool from "./tools/list-study-cycles";
import getLeaderboardTool from "./tools/get-leaderboard";
import createSubjectTool from "./tools/create-subject";
import createNoteTool from "./tools/create-note";
import createGoalTool from "./tools/create-goal";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref
// (Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build time, so this
// stays import-safe with no runtime env read). The fallback only keeps the
// issuer well-formed during the throwaway manifest-extract eval.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "zenit-mcp",
  title: "Zenit MCP",
  version: "0.1.0",
  instructions:
    "Tools for Zenit, a study, focus and productivity app. Use `list_tasks` and `create_task` to manage tasks, `list_study_cycles` to inspect study cycles, `get_leaderboard` to read the XP ranking, `create_subject` to create disciplines, `create_note` to add notes, and `create_goal` to set study goals.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTasksTool, createTaskTool, listStudyCyclesTool, getLeaderboardTool, createSubjectTool, createNoteTool, createGoalTool],
});
