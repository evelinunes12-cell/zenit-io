import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import listStudyCyclesTool from "./tools/list-study-cycles";
import getLeaderboardTool from "./tools/get-leaderboard";
import createSubjectTool from "./tools/create-subject";
import createNoteTool from "./tools/create-note";
import createGoalTool from "./tools/create-goal";
import listSubjectsTool from "./tools/list-subjects";
import getTaskDetailsTool from "./tools/get-task-details";
import updateTaskTool from "./tools/update-task";
import createTaskStepTool from "./tools/create-task-step";
import listPlanningTool from "./tools/list-planning";
import updatePlanningItemTool from "./tools/update-planning-item";
import createStudyScheduleTool from "./tools/create-study-schedule";
import registerStudySessionTool from "./tools/register-study-session";
import getStudyPerformanceTool from "./tools/get-study-performance";
import createStudyCycleTool from "./tools/create-study-cycle";
import updateStudyCycleTool from "./tools/update-study-cycle";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref
// (Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build time, so this
// stays import-safe with no runtime env read). The fallback only keeps the
// issuer well-formed during the throwaway manifest-extract eval.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "zenit-io",
  title: "zenit-io",
  version: "0.2.0",
  instructions:
    "Ferramentas do Zenit para gerenciar tarefas e etapas, planejamento, disciplinas, ciclos, sessões de estudo e desempenho. Antes de criar vínculos, use as ferramentas de listagem para localizar IDs válidos do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTasksTool,
    getTaskDetailsTool,
    createTaskTool,
    updateTaskTool,
    createTaskStepTool,
    listSubjectsTool,
    createSubjectTool,
    listPlanningTool,
    createNoteTool,
    createGoalTool,
    updatePlanningItemTool,
    createStudyScheduleTool,
    listStudyCyclesTool,
    createStudyCycleTool,
    updateStudyCycleTool,
    registerStudySessionTool,
    getStudyPerformanceTool,
    getLeaderboardTool,
  ],
});
