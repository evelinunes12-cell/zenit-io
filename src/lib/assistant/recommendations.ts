import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Flag,
  History,
  PlayCircle,
  RefreshCw,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Task, parseDueDate } from "@/services/tasks";
import { isTaskOverdue } from "@/hooks/useDashboardFilters";
import { stripHtml } from "@/utils/sanitize";

/**
 * Academic Assistant — recommendation engine (Sprint 2 + 2.1 + 2.2).
 *
 * Pure, data-driven logic that inspects the data the system already has
 * (tasks, study cycles, variable events, goals and notes) and returns:
 *   • a SINGLE, supportive "next best action" (primary recommendation);
 *   • a short list of other items that also deserve attention;
 *   • an overall student state (clear / attention / critical).
 *
 * No new business rules, no generative AI: only interpretation of existing
 * data. The tone is always welcoming and never blaming.
 *
 * Sprint 2.2 notes (this iteration):
 *   1. Priority: every candidate carries an explicit numeric `priority`
 *      (lower = more relevant). Instead of relying on the order the rules run,
 *      candidates are sorted by priority, so an overdue task is never hidden by
 *      a task that only expires tomorrow. The detection rules themselves are
 *      unchanged.
 *   2. Diversity: candidates are de-duplicated by their underlying entity, and
 *      the "Também merece atenção" list favours different categories so the
 *      same task / kind of item is not repeated.
 *   3. Temporal context: past events are ignored, notes are limited to the near
 *      future, and very old overdue goals are dropped.
 *   4. Reason: each candidate exposes a short, objective `reason` explaining why
 *      it was picked, built only from existing data.
 */

export type AssistantCategory = "task" | "cycle" | "event" | "goal" | "note" | "clear";
export type AssistantTone = "default" | "destructive" | "success" | "warning";
export type AssistantStateLevel = "clear" | "attention" | "critical";

export interface AssistantAction {
  label: string;
  to: string;
}

/** A compact key/value chip shown under the primary recommendation. */
export interface AssistantDetail {
  label: string;
  value: string;
}

export interface AssistantRecommendation {
  id: string;
  category: AssistantCategory;
  icon: LucideIcon;
  meta: string;
  title: string;
  message: string;
  tone: AssistantTone;
  /** Lower = more relevant. Drives primary selection and ordering. */
  priority: number;
  /** Stable key of the underlying entity, used to avoid repeating an item. */
  entityKey: string;
  /** Objective, short justification of why this was recommended. */
  reason: string;
  /** Objective context chips (discipline, deadline, status, etc.). */
  details: AssistantDetail[];
  /** One-line description used in the "Também merece atenção" list. */
  summary: string;
  primaryAction: AssistantAction;
  secondaryAction?: AssistantAction;
}

export interface AssistantState {
  level: AssistantStateLevel;
  label: string;
  tone: AssistantTone;
}

export interface AssistantDigest {
  primary: AssistantRecommendation;
  /** Up to 3 other items that also deserve attention (never the primary). */
  secondary: AssistantRecommendation[];
  state: AssistantState;
}

// ---- Minimal data shapes (reuse existing query results) --------------------

export interface AssistantCycle {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  end_date: string | null;
  /** Epoch ms of the most recent focus session linked to this cycle (if any). */
  lastActivityAt?: number | null;
  /** Number of focus sessions already registered for this cycle (if known). */
  sessionCount?: number | null;
}

export interface AssistantEvent {
  id: string;
  title: string;
  /** yyyy-MM-dd */
  specific_date: string | null;
  start_time: string;
}

export interface AssistantNote {
  id: string;
  title: string;
  planned_date: string | null;
}

export interface AssistantGoal {
  id: string;
  title: string;
  target_date: string | null;
}

export interface AssistantInput {
  tasks: Task[];
  cycles: AssistantCycle[];
  events: AssistantEvent[];
  goals: AssistantGoal[];
  notes: AssistantNote[];
  completedStatusName: string;
  /** Names of deactivated subjects — excluded from every recommendation. */
  disabledSubjects?: string[];
  now?: Date;
}

// ---- Thresholds (tuned to be gentle, not alarmist) -------------------------

const NEAR_DUE_DAYS = 2; // vence hoje / amanhã / depois
const IN_PROGRESS_STALE_DAYS = 7; // em andamento há muitos dias
const CREATED_STALE_DAYS = 14; // criada há muito tempo sem atualização
const CYCLE_IDLE_DAYS = 4; // ciclo sem novos registros
const CYCLE_NEAR_END_DAYS = 3; // ciclo perto da data final
const GOAL_NEAR_DAYS = 3; // meta próxima do vencimento
const GOAL_OVERDUE_LIMIT_DAYS = 30; // não recomendar metas vencidas há muito tempo
const NOTE_NEAR_DAYS = 3; // anotações de hoje / amanhã / próximas
const NOTE_STALE_LIMIT_DAYS = 14; // ignorar anotações planejadas há muito tempo

// ---- Priority scale (lower number = higher relevance) ----------------------
// Order requested by the product: tarefas atrasadas > vencendo hoje > amanhã >
// ciclos abandonados > metas vencidas > metas próximas > eventos > anotações.

const PRIORITY = {
  TASK_OVERDUE: 100,
  TASK_DUE: 200, // + days (0 = hoje, 1 = amanhã, 2 = depois)
  CYCLE_IDLE: 350,
  CYCLE_NEAR_END: 360,
  GOAL_OVERDUE: 400,
  GOAL_NEAR: 450,
  EVENT_TODAY: 500,
  TASK_STALLED: 600,
  TASK_FORGOTTEN: 650,
  NOTE: 700,
} as const;

// ---- Helpers ---------------------------------------------------------------

const isCompleted = (task: Task, completedStatusName: string) => {
  const s = task.status.toLowerCase();
  return s === completedStatusName.toLowerCase() || s.includes("conclu");
};

const isInProgress = (task: Task) => {
  const s = task.status.toLowerCase();
  return s.includes("andamento") || s.includes("progresso") || s.includes("progress");
};

const description = (task: Task, fallback: string) => stripHtml(task.description ?? "").trim() || fallback;

const daysSince = (isoOrMs: string | number, now: Date) => {
  const date = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  return differenceInCalendarDays(now, date);
};

const parsePlanner = (dateStr: string): Date => {
  // Planner dates may be yyyy-MM-dd or full ISO; normalize to local date.
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const dueLabel = (days: number) => {
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
};

const daysLabel = (days: number) => {
  if (days <= 0) return "hoje";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
};

const formatDate = (date: Date) => format(date, "dd 'de' MMM", { locale: ptBR });

const staleLabel = (days: number) => (days <= 0 ? "atualizada hoje" : `há ${daysLabel(days)}`);

/** Objective chips for a task recommendation. */
const taskDetails = (task: Task, now: Date): AssistantDetail[] => {
  const details: AssistantDetail[] = [];
  if (task.subject_name) details.push({ label: "Disciplina", value: task.subject_name });
  if (task.due_date) details.push({ label: "Prazo", value: formatDate(parseDueDate(task.due_date)) });
  details.push({ label: "Sem atualização", value: staleLabel(daysSince(task.updated_at, now)) });
  if (task.status) details.push({ label: "Status", value: task.status });
  return details;
};

const normalizeName = (name: string) => name.trim().toLowerCase();

// ---- Candidate collection --------------------------------------------------

/**
 * Builds every applicable recommendation. Each rule contributes at most one
 * candidate, tagged with an explicit `priority`, an `entityKey` (for
 * de-duplication) and a short `reason`. The caller sorts by priority.
 */
function collectCandidates(input: AssistantInput, now: Date): AssistantRecommendation[] {
  const { tasks, cycles, events, goals, notes, completedStatusName } = input;
  const candidates: AssistantRecommendation[] = [];

  const disabled = new Set((input.disabledSubjects ?? []).map(normalizeName));
  const isEnabledSubject = (task: Task) => !task.subject_name || !disabled.has(normalizeName(task.subject_name));

  const openTasks = tasks.filter((t) => !isCompleted(t, completedStatusName) && isEnabledSubject(t));

  // 1a. Tarefas próximas do vencimento (hoje / amanhã / depois de amanhã)
  const nearDue = openTasks
    .filter((t) => t.due_date && !isTaskOverdue(t))
    .map((t) => ({ task: t, days: differenceInCalendarDays(parseDueDate(t.due_date), now) }))
    .filter(({ days }) => days >= 0 && days <= NEAR_DUE_DAYS)
    .sort((a, b) => a.days - b.days)[0];
  if (nearDue) {
    const { task, days } = nearDue;
    candidates.push({
      id: `task-due-${task.id}`,
      category: "task",
      icon: CalendarClock,
      meta: `${task.subject_name} · vence ${dueLabel(days)}`,
      title: `Sua prioridade pode ser ${task.subject_name}`,
      message: description(task, `Essa entrega de ${task.subject_name} vence ${dueLabel(days)}. Que tal dar o próximo passo agora?`),
      tone: days === 0 ? "warning" : "default",
      priority: PRIORITY.TASK_DUE + days,
      entityKey: `task:${task.id}`,
      reason: `Recomendado porque vence ${dueLabel(days)}.`,
      details: taskDetails(task, now),
      summary: `${task.subject_name} vence ${dueLabel(days)}.`,
      primaryAction: { label: "Abrir tarefa", to: `/task/${task.id}` },
      secondaryAction: { label: "Ver todas as tarefas", to: "/dashboard" },
    });
  }

  // 1b. Tarefas atrasadas
  const overdue = openTasks
    .filter((t) => t.due_date && isTaskOverdue(t))
    .sort((a, b) => parseDueDate(a.due_date).getTime() - parseDueDate(b.due_date).getTime())[0];
  if (overdue) {
    const days = Math.abs(differenceInCalendarDays(parseDueDate(overdue.due_date), now));
    candidates.push({
      id: `task-overdue-${overdue.id}`,
      category: "task",
      icon: AlertTriangle,
      meta: `${overdue.subject_name} · pendente há ${daysLabel(days)}`,
      title: `Que tal retomar ${overdue.subject_name}?`,
      message: description(overdue, `Essa tarefa de ${overdue.subject_name} ficou para trás. Um pequeno passo já ajuda a colocá-la em dia.`),
      tone: "destructive",
      priority: PRIORITY.TASK_OVERDUE,
      entityKey: `task:${overdue.id}`,
      reason: `Está atrasada há ${daysLabel(days)}.`,
      details: taskDetails(overdue, now),
      summary: `${overdue.subject_name} atrasada há ${daysLabel(days)}.`,
      primaryAction: { label: "Abrir tarefa", to: `/task/${overdue.id}` },
      secondaryAction: { label: "Ver todas as tarefas", to: "/dashboard" },
    });
  }

  // 1c. Em andamento há muitos dias
  const stalledInProgress = openTasks
    .filter((t) => isInProgress(t) && daysSince(t.updated_at, now) >= IN_PROGRESS_STALE_DAYS)
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())[0];
  if (stalledInProgress) {
    const days = daysSince(stalledInProgress.updated_at, now);
    candidates.push({
      id: `task-stalled-${stalledInProgress.id}`,
      category: "task",
      icon: History,
      meta: `${stalledInProgress.subject_name} · em andamento há ${daysLabel(days)}`,
      title: `Vale a pena retomar ${stalledInProgress.subject_name}`,
      message: description(stalledInProgress, `Você tem uma tarefa em andamento há ${daysLabel(days)}. Talvez seja um bom momento para dar continuidade.`),
      tone: "default",
      priority: PRIORITY.TASK_STALLED,
      entityKey: `task:${stalledInProgress.id}`,
      reason: `Em andamento sem atualização há ${daysLabel(days)}.`,
      details: taskDetails(stalledInProgress, now),
      summary: `${stalledInProgress.subject_name} em andamento há ${daysLabel(days)}.`,
      primaryAction: { label: "Abrir tarefa", to: `/task/${stalledInProgress.id}` },
      secondaryAction: { label: "Registrar estudo", to: "/estudos/pomodoro" },
    });
  }

  // 1d. Criada há muito tempo sem atualização
  const forgotten = openTasks
    .filter((t) => daysSince(t.created_at, now) >= CREATED_STALE_DAYS && daysSince(t.updated_at, now) >= CREATED_STALE_DAYS)
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())[0];
  if (forgotten) {
    const days = daysSince(forgotten.updated_at, now);
    candidates.push({
      id: `task-forgotten-${forgotten.id}`,
      category: "task",
      icon: RefreshCw,
      meta: `${forgotten.subject_name} · sem atualização há ${daysLabel(days)}`,
      title: `Que tal revisar ${forgotten.subject_name}?`,
      message: description(forgotten, `Essa tarefa está parada há um tempo. Vale a pena revisar se ela ainda faz sentido ou dar o próximo passo.`),
      tone: "default",
      priority: PRIORITY.TASK_FORGOTTEN,
      entityKey: `task:${forgotten.id}`,
      reason: `Está sem atualização há ${daysLabel(days)}.`,
      details: taskDetails(forgotten, now),
      summary: `${forgotten.subject_name} sem atualização há ${daysLabel(days)}.`,
      primaryAction: { label: "Abrir tarefa", to: `/task/${forgotten.id}` },
      secondaryAction: { label: "Ver todas as tarefas", to: "/dashboard" },
    });
  }

  // 2. CICLOS DE ESTUDO ----------------------------------------------------
  const activeCycles = cycles.filter((c) => c.is_active);

  const cycleSessionDetail = (cycle: AssistantCycle): AssistantDetail[] => {
    const details: AssistantDetail[] = [];
    const timing = getCycleTiming(cycle, now);
    if (timing.startFormatted) details.push({ label: "Início", value: timing.startFormatted });
    if (timing.endFormatted) details.push({ label: "Fim", value: timing.endFormatted });
    if (typeof cycle.sessionCount === "number") {
      details.push({ label: "Sessões registradas", value: String(cycle.sessionCount) });
    }
    return details;
  };

  // 2a. Planejamento temporal do ciclo (Sprint 4.2): começando / terminando.
  const timedCycles = activeCycles
    .map((c) => ({ cycle: c, timing: getCycleTiming(c, now) }))
    .filter(({ timing }) => timing.hasDates);

  // Ciclo que começa em breve (até 3 dias).
  const startingCycle = timedCycles
    .filter(({ timing }) => timing.status === "upcoming" && (timing.daysToStart ?? 99) <= CYCLE_STARTING_SOON_DAYS)
    .sort((a, b) => (a.timing.daysToStart ?? 0) - (b.timing.daysToStart ?? 0))[0];
  if (startingCycle) {
    const { cycle, timing } = startingCycle;
    const when = relativeDaysLabel(timing.daysToStart ?? 0);
    candidates.push({
      id: `cycle-start-${cycle.id}`,
      category: "cycle",
      icon: CalendarClock,
      meta: `Ciclo · começa ${when}`,
      title: `Seu ciclo "${cycle.name}" começa ${when}`,
      message: `Seu ciclo "${cycle.name}" começa ${when}. Prepare-se para começar seu planejamento.`,
      tone: "default",
      priority: PRIORITY.CYCLE_STARTING_SOON,
      entityKey: `cycle:${cycle.id}`,
      reason: `O planejamento do ciclo começa ${when}.`,
      details: cycleSessionDetail(cycle),
      summary: `Ciclo "${cycle.name}" começa ${when}.`,
      primaryAction: { label: "Abrir ciclo", to: "/estudos/ciclo" },
    });
  }

  // Ciclo em andamento próximo do fim (ending_soon) ou apenas em andamento.
  const endingCycle = timedCycles
    .filter(({ timing }) => timing.status === "ending_soon")
    .sort((a, b) => (a.timing.daysToEnd ?? 0) - (b.timing.daysToEnd ?? 0))[0];
  const runningCycle = timedCycles
    .filter(({ timing }) => timing.status === "active" && timing.daysToEnd !== null)
    .sort((a, b) => (a.timing.daysToEnd ?? 0) - (b.timing.daysToEnd ?? 0))[0];

  if (endingCycle) {
    const { cycle, timing } = endingCycle;
    const days = timing.daysToEnd ?? 0;
    const when = days === 0 ? "hoje" : relativeDaysLabel(days);
    candidates.push({
      id: `cycle-end-${cycle.id}`,
      category: "cycle",
      icon: AlarmClock,
      meta: `Ciclo · termina ${when}`,
      title: `Reta final do ciclo "${cycle.name}"`,
      message: `Seu ciclo "${cycle.name}" termina ${when}. Você ainda tem tempo para concluir seu planejamento.`,
      tone: "warning",
      priority: PRIORITY.CYCLE_NEAR_END,
      entityKey: `cycle:${cycle.id}`,
      reason: `Seu ciclo termina ${when}.`,
      details: cycleSessionDetail(cycle),
      summary: `Ciclo "${cycle.name}" termina ${when}.`,
      primaryAction: { label: "Abrir ciclo", to: "/estudos/ciclo" },
      secondaryAction: { label: "Registrar estudo", to: "/estudos/pomodoro" },
    });
  } else if (runningCycle) {
    const { cycle, timing } = runningCycle;
    const remaining = daysCountLabel(timing.daysToEnd ?? 0);
    candidates.push({
      id: `cycle-running-${cycle.id}`,
      category: "cycle",
      icon: CalendarDays,
      meta: `Ciclo · ${remaining} restantes`,
      title: `Ciclo "${cycle.name}" em andamento`,
      message: `Seu ciclo "${cycle.name}" está em andamento e termina em ${remaining}. Continue avançando no seu planejamento.`,
      tone: "default",
      priority: PRIORITY.CYCLE_RUNNING,
      entityKey: `cycle:${cycle.id}`,
      reason: `Ciclo em andamento com ${remaining} restantes.`,
      details: cycleSessionDetail(cycle),
      summary: `Ciclo "${cycle.name}" termina em ${remaining}.`,
      primaryAction: { label: "Abrir ciclo", to: "/estudos/ciclo" },
      secondaryAction: { label: "Registrar estudo", to: "/estudos/pomodoro" },
    });
  }


  // 2b. Ciclo sem novos registros há muitos dias
  const idleCycle = activeCycles
    .map((c) => {
      const ref = c.lastActivityAt ?? new Date(c.created_at).getTime();
      return { cycle: c, days: daysSince(ref, now) };
    })
    .filter(({ days }) => days >= CYCLE_IDLE_DAYS)
    .sort((a, b) => b.days - a.days)[0];
  if (idleCycle) {
    const { cycle, days } = idleCycle;
    const details = cycleSessionDetail(cycle);
    details.push({ label: "Sem registros", value: `há ${daysLabel(days)}` });
    candidates.push({
      id: `cycle-idle-${cycle.id}`,
      category: "cycle",
      icon: PlayCircle,
      meta: `Ciclo · sem registros há ${daysLabel(days)}`,
      title: `Que tal retomar o ciclo "${cycle.name}"?`,
      message: `Seu ciclo de estudos "${cycle.name}" está há ${daysLabel(days)} sem novos registros. Uma sessão curta já mantém o ritmo.`,
      tone: "default",
      priority: PRIORITY.CYCLE_IDLE,
      entityKey: `cycle:${cycle.id}`,
      reason: `Seu ciclo está sem estudos há ${daysLabel(days)}.`,
      details,
      summary: `Ciclo "${cycle.name}" sem registros há ${daysLabel(days)}.`,
      primaryAction: { label: "Registrar estudo", to: "/estudos/pomodoro" },
      secondaryAction: { label: "Abrir ciclo", to: "/estudos/ciclo" },
    });
  }

  // 3. EVENTOS VARIÁVEIS (apenas futuros) ---------------------------------
  const upcomingEvent = events
    .filter((e) => e.specific_date)
    .map((e) => {
      const [h, m] = e.start_time.split(":").map(Number);
      const when = parsePlanner(e.specific_date!);
      when.setHours(h || 0, m || 0, 0, 0);
      return { event: e, when };
    })
    .filter(({ when }) => when.getTime() >= now.getTime())
    .sort((a, b) => a.when.getTime() - b.when.getTime())[0];
  if (upcomingEvent) {
    const { event } = upcomingEvent;
    const time = event.start_time.slice(0, 5);
    const details: AssistantDetail[] = [{ label: "Horário", value: `${time}` }];
    if (event.specific_date) details.push({ label: "Data", value: formatDate(parsePlanner(event.specific_date)) });
    candidates.push({
      id: `event-${event.id}`,
      category: "event",
      icon: CalendarDays,
      meta: `Evento · hoje às ${time}`,
      title: event.title,
      message: `Você possui um evento agendado para hoje às ${time}. Vale a pena conferir sua agenda.`,
      tone: "default",
      priority: PRIORITY.EVENT_TODAY,
      entityKey: `event:${event.id}`,
      reason: `Acontece hoje às ${time}.`,
      details,
      summary: `${event.title} hoje às ${time}.`,
      primaryAction: { label: "Visualizar agenda", to: "/planner" },
    });
  }

  // 4. METAS (próximas ou vencidas dentro de um período razoável) ----------
  const goal = goals
    .filter((g) => g.target_date)
    .map((g) => ({ goal: g, days: differenceInCalendarDays(parsePlanner(g.target_date!), now) }))
    .filter(({ days }) => days <= GOAL_NEAR_DAYS && days >= -GOAL_OVERDUE_LIMIT_DAYS)
    .sort((a, b) => a.days - b.days)[0];
  if (goal) {
    const { goal: g, days } = goal;
    const overdueGoal = days < 0;
    candidates.push({
      id: `goal-${g.id}`,
      category: "goal",
      icon: Flag,
      meta: overdueGoal ? "Meta · esquecida" : `Meta · vence ${dueLabel(days)}`,
      title: g.title,
      message: overdueGoal
        ? `Essa meta ficou para trás. Que tal retomá-la e seguir avançando no seu objetivo?`
        : `Sua meta vence ${dueLabel(days)}. Pequenos passos hoje aproximam você do objetivo.`,
      tone: "default",
      priority: overdueGoal ? PRIORITY.GOAL_OVERDUE : PRIORITY.GOAL_NEAR,
      entityKey: `goal:${g.id}`,
      reason: overdueGoal ? `Esta meta venceu há ${daysLabel(Math.abs(days))}.` : `Esta meta vence ${dueLabel(days)}.`,
      details: g.target_date ? [{ label: "Data prevista", value: formatDate(parsePlanner(g.target_date)) }] : [],
      summary: overdueGoal ? `Meta "${g.title}" ficou para trás.` : `Meta "${g.title}" vence ${dueLabel(days)}.`,
      primaryAction: { label: "Visualizar meta", to: "/planner" },
    });
  }

  // 5. ANOTAÇÕES (apenas de hoje / amanhã / próximas) ---------------------
  const note = notes
    .filter((n) => n.planned_date)
    .map((n) => ({ note: n, days: differenceInCalendarDays(parsePlanner(n.planned_date!), now) }))
    .filter(({ days }) => days <= NOTE_NEAR_DAYS && days >= -NOTE_STALE_LIMIT_DAYS)
    .sort((a, b) => a.days - b.days)[0];
  if (note) {
    const { note: n, days } = note;
    candidates.push({
      id: `note-${n.id}`,
      category: "note",
      icon: StickyNote,
      meta: "Anotação planejada",
      title: n.title,
      message: "Você tem uma anotação planejada. Que tal revisá-la para manter tudo em dia?",
      tone: "default",
      priority: PRIORITY.NOTE,
      entityKey: `note:${n.id}`,
      reason: days < 0
        ? `Planejada há ${daysLabel(Math.abs(days))}.`
        : `Planejada para ${dueLabel(days)}.`,
      details: n.planned_date ? [{ label: "Planejada para", value: formatDate(parsePlanner(n.planned_date)) }] : [],
      summary: `Anotação "${n.title}" planejada.`,
      primaryAction: { label: "Ver no planner", to: "/planner" },
    });
  }

  // De-duplicate by underlying entity (keep the most relevant) and sort.
  const byEntity = new Map<string, AssistantRecommendation>();
  for (const candidate of candidates) {
    const existing = byEntity.get(candidate.entityKey);
    if (!existing || candidate.priority < existing.priority) {
      byEntity.set(candidate.entityKey, candidate);
    }
  }

  return Array.from(byEntity.values()).sort((a, b) => a.priority - b.priority);
}

// ---- Secondary list (favor category diversity) -----------------------------

function pickSecondary(sorted: AssistantRecommendation[], primary: AssistantRecommendation, limit = 3): AssistantRecommendation[] {
  const pool = sorted.filter((c) => c.entityKey !== primary.entityKey);
  const chosen: AssistantRecommendation[] = [];
  const usedCategories = new Set<AssistantCategory>([primary.category]);

  // Pass 1: prefer categories not shown yet, to maximize diversity.
  for (const candidate of pool) {
    if (chosen.length >= limit) break;
    if (!usedCategories.has(candidate.category)) {
      chosen.push(candidate);
      usedCategories.add(candidate.category);
    }
  }

  // Pass 2: fill remaining slots with the next most relevant items.
  for (const candidate of pool) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }

  return chosen;
}

// ---- Clear state (nothing pending) -----------------------------------------

function clearRecommendation(): AssistantRecommendation {
  return {
    id: "clear",
    category: "clear",
    icon: Sparkles,
    meta: "Tudo em dia",
    title: "Excelente! Você não possui pendências críticas hoje.",
    message: "Aproveite este momento para revisar conteúdos ou adiantar atividades futuras. Você está em um ótimo ritmo!",
    tone: "success",
    priority: Number.MAX_SAFE_INTEGER,
    entityKey: "clear",
    reason: "Você não tem pendências críticas no momento.",
    details: [],
    summary: "Nenhuma pendência crítica no momento.",
    primaryAction: { label: "Iniciar foco", to: "/estudos/pomodoro" },
    secondaryAction: { label: "Abrir planner", to: "/planner" },
  };
}

// ---- State (traffic light) -------------------------------------------------

function computeState(input: AssistantInput, now: Date, candidates: AssistantRecommendation[]): AssistantState {
  const { tasks, completedStatusName } = input;
  const disabled = new Set((input.disabledSubjects ?? []).map(normalizeName));
  const openTasks = tasks.filter(
    (t) => !isCompleted(t, completedStatusName) && (!t.subject_name || !disabled.has(normalizeName(t.subject_name))),
  );

  const overdueCount = openTasks.filter((t) => t.due_date && isTaskOverdue(t)).length;
  const nearDueCount = openTasks.filter((t) => {
    if (!t.due_date || isTaskOverdue(t)) return false;
    const days = differenceInCalendarDays(parseDueDate(t.due_date), now);
    return days >= 0 && days <= NEAR_DUE_DAYS;
  }).length;

  // "Important" signals: overdue + near due tasks + other flagged candidates.
  const otherSignals = candidates.filter((c) => c.category === "cycle" || c.category === "goal").length;
  const importantCount = overdueCount + nearDueCount + otherSignals;

  if (overdueCount >= 1 || importantCount >= 3) {
    return { level: "critical", label: "Prioridades críticas", tone: "destructive" };
  }
  if (candidates.length > 0) {
    return { level: "attention", label: "Itens importantes", tone: "warning" };
  }
  return { level: "clear", label: "Tudo em dia", tone: "success" };
}

// ---- Public API ------------------------------------------------------------

/**
 * Backwards-compatible single recommendation (Sprint 2 API).
 */
export function buildAssistantRecommendation(input: AssistantInput): AssistantRecommendation {
  const now = input.now ?? new Date();
  const candidates = collectCandidates(input, now);
  return candidates[0] ?? clearRecommendation();
}

/**
 * Full digest (Sprint 2.1+): primary recommendation, secondary items and state.
 */
export function buildAssistantDigest(input: AssistantInput): AssistantDigest {
  const now = input.now ?? new Date();
  const candidates = collectCandidates(input, now);
  const state = computeState(input, now, candidates);

  if (candidates.length === 0) {
    return { primary: clearRecommendation(), secondary: [], state };
  }

  const primary = candidates[0];
  return {
    primary,
    secondary: pickSecondary(candidates, primary),
    state,
  };
}
