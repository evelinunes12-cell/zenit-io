import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchFocusSessionsWithDetails, FocusSessionWithDetails } from "@/services/studyAnalytics";
import { deleteFocusSession } from "@/services/focusSessions";
import { fetchStudyCycles } from "@/services/studyCycles";
import { fetchSubjects } from "@/services/subjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StudyPeriodPicker from "@/components/study/StudyPeriodPicker";
import StudyOverviewSection from "@/components/study/StudyOverviewSection";
import { buildStudyOverview } from "@/lib/studyMetrics";
import {
  getPeriodFromPreset,
  getPeriodTitle,
  getPreviousPeriod,
  type StudyPeriod,
  type StudyPeriodPreset,
} from "@/lib/studyPeriod";
import { Badge } from "@/components/ui/badge";
import { Clock, Repeat, Timer, CheckCircle, TrendingUp, BookOpen, Target, Pencil, ListChecks, Trash2, X, Plus, NotebookPen, Star } from "lucide-react";
import { toast } from "sonner";

import ActiveCycleProgressCard from "@/components/ActiveCycleProgressCard";
import EditFocusSessionDialog from "@/components/EditFocusSessionDialog";
import StudyLogDialog from "@/components/StudyLogDialog";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { startOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;


const COLORS = [
  "hsl(262, 83%, 58%)", "hsl(142, 76%, 36%)", "hsl(38, 92%, 50%)",
  "hsl(200, 80%, 50%)", "hsl(340, 75%, 55%)", "hsl(170, 60%, 45%)",
  "hsl(25, 95%, 55%)", "hsl(280, 60%, 55%)",
];

type OriginFilter = "all" | "cycle" | "pomodoro" | "manual";
const StudyAnalyticsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");
  const [editingSession, setEditingSession] = useState<FocusSessionWithDetails | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<FocusSessionWithDetails | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refreshAnalytics = () => {
    queryClient.invalidateQueries({ queryKey: ["study-analytics"] });
  };

  const handleDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleting(true);
    const ok = await deleteFocusSession(deletingSession.id);
    setDeleting(false);
    if (ok) {
      toast.success("Registro excluído.");
      setDeletingSession(null);
      refreshAnalytics();
    } else {
      toast.error("Erro ao excluir registro.");
    }
  };

  const sessionsQueryKey = ["study-analytics", user?.id, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()];
  const { data: allSessions = [], isLoading } = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: () => fetchFocusSessionsWithDetails(user!.id, dateRange?.from, dateRange?.to),
    enabled: !!user?.id,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["study-cycles-list"],
    queryFn: fetchStudyCycles,
    enabled: !!user?.id,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-list", user?.id],
    queryFn: fetchSubjects,
    enabled: !!user?.id,
  });



  // Apply origin + cycle filters
  const sessions = useMemo(() => {
    let filtered = allSessions;

    if (originFilter === "cycle") {
      filtered = filtered.filter((s) => s.source === "cycle" || (s.study_cycle_id !== null && s.source !== "manual"));
    } else if (originFilter === "pomodoro") {
      filtered = filtered.filter((s) => s.source === "pomodoro");
    } else if (originFilter === "manual") {
      filtered = filtered.filter((s) => s.source === "manual");
    }

    if (selectedCycleId !== "all" && originFilter !== "pomodoro") {
      filtered = filtered.filter((s) => s.study_cycle_id === selectedCycleId);
    }

    return filtered;
  }, [allSessions, originFilter, selectedCycleId]);

  const analytics = useMemo(() => {
    const totalMinutes = sessions.reduce((a, s) => a + s.duration_minutes, 0);
    const cycleMinutes = sessions
      .filter((s) => s.source === "cycle" || (s.source !== "manual" && s.study_cycle_id))
      .reduce((a, s) => a + s.duration_minutes, 0);
    const pomodoroMinutes = sessions
      .filter((s) => s.source !== "manual" && !s.study_cycle_id)
      .reduce((a, s) => a + s.duration_minutes, 0);
    const manualMinutes = sessions
      .filter((s) => s.source === "manual")
      .reduce((a, s) => a + s.duration_minutes, 0);
    const totalSessions = sessions.length;

    // By subject
    const subjectMap = new Map<string, { name: string; color: string | null; minutes: number }>();
    sessions.forEach((s) => {
      const key = s.subject_name || "Sem Matéria Definida";
      const existing = subjectMap.get(key);
      if (existing) {
        existing.minutes += s.duration_minutes;
      } else {
        subjectMap.set(key, { name: key, color: s.subject_color, minutes: s.duration_minutes });
      }
    });
    const bySubject = Array.from(subjectMap.values()).sort((a, b) => b.minutes - a.minutes);

    // By cycle (only sessions with study_cycle_id)
    const cycleMap = new Map<string, { name: string; minutes: number }>();
    sessions.forEach((s) => {
      if (!s.study_cycle_id || !s.study_cycle_name) return;
      const existing = cycleMap.get(s.study_cycle_id);
      if (existing) {
        existing.minutes += s.duration_minutes;
      } else {
        cycleMap.set(s.study_cycle_id, { name: s.study_cycle_name, minutes: s.duration_minutes });
      }
    });
    const byCycle = Array.from(cycleMap.values()).sort((a, b) => b.minutes - a.minutes);

    // Questions performance
    const totalQuestions = sessions.reduce((a, s) => a + (s.questions_total || 0), 0);
    const totalCorrect = sessions.reduce((a, s) => a + (s.questions_correct || 0), 0);
    const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const subjectQMap = new Map<string, { name: string; color: string | null; total: number; correct: number }>();
    sessions.forEach((s) => {
      if (!s.questions_total) return;
      const key = s.subject_name || "Sem Matéria Definida";
      const existing = subjectQMap.get(key);
      if (existing) {
        existing.total += s.questions_total;
        existing.correct += s.questions_correct || 0;
      } else {
        subjectQMap.set(key, {
          name: key,
          color: s.subject_color,
          total: s.questions_total,
          correct: s.questions_correct || 0,
        });
      }
    });
    const questionsBySubject = Array.from(subjectQMap.values())
      .map((s) => ({ ...s, accuracy: s.total > 0 ? (s.correct / s.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    return {
      totalMinutes, cycleMinutes, pomodoroMinutes, manualMinutes, totalSessions, bySubject, byCycle,
      totalQuestions, totalCorrect, overallAccuracy, questionsBySubject,
    };
  }, [sessions]);

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  };

  const showCycleFilter = originFilter !== "pomodoro";
  const originActive = originFilter !== "all";
  const cycleActive = selectedCycleId !== "all";
  const hasActiveFilters = originActive || cycleActive;
  const selectedCycleName = cycles.find((c) => c.id === selectedCycleId)?.name;
  const originLabel =
    originFilter === "cycle"
      ? "Apenas Ciclos"
      : originFilter === "pomodoro"
      ? "Apenas Pomodoro"
      : originFilter === "manual"
      ? "Apenas Registros Manuais"
      : "";

  const clearFilters = () => {
    setOriginFilter("all");
    setSelectedCycleId("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Desempenho de Estudos</h1>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setLogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Registrar estudo
        </Button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} defaultPreset="this-month" />

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Origem</label>
              <Select value={originFilter} onValueChange={(v) => { setOriginFilter(v as OriginFilter); setSelectedCycleId("all"); }}>
                <SelectTrigger className={`w-[160px] h-9 ${originActive ? "border-primary ring-1 ring-primary/30 text-primary font-medium" : ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tudo</SelectItem>
                  <SelectItem value="cycle">Apenas Ciclos</SelectItem>
                  <SelectItem value="pomodoro">Apenas Pomodoro</SelectItem>
                  <SelectItem value="manual">Apenas Registros Manuais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCycleFilter && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ciclo</label>
                <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
                  <SelectTrigger className={`w-[180px] h-9 ${cycleActive ? "border-primary ring-1 ring-primary/30 text-primary font-medium" : ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Ciclos</SelectItem>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {originActive && (
                <Badge variant="secondary" className="gap-1">
                  Origem: {originLabel}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setOriginFilter("all"); setSelectedCycleId("all"); }} />
                </Badge>
              )}
              {cycleActive && (
                <Badge variant="secondary" className="gap-1">
                  Ciclo: {selectedCycleName}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCycleId("all")} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
            <Skeleton className="h-72 rounded-xl sm:col-span-2 lg:col-span-4" />
          </div>
        ) : (
          <>
            {/* Visão geral do período */}
            <StudyOverviewSection
              title={getPeriodTitle(periodPreset, period)}
              period={period}
              previousPeriod={previousPeriod}
              current={currentOverview}
              previous={previousOverview}
            />

            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Ainda não há dados suficientes para analisar este período.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajuste o período ou os filtros, ou registre um estudo para começar a acompanhar seu desempenho.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setLogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Registrar estudo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
            {/* Active Cycle Progress */}
            <ActiveCycleProgressCard />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Clock} label="Tempo Total" value={formatTime(analytics.totalMinutes)} />
              <KpiCard icon={Repeat} label="Foco em Ciclos" value={formatTime(analytics.cycleMinutes)} />
              <KpiCard icon={Timer} label="Foco em Pomodoro" value={formatTime(analytics.pomodoroMinutes)} />
              <KpiCard icon={CheckCircle} label="Sessões Realizadas" value={String(analytics.totalSessions)} />
            </div>


            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie - by subject */}
              <Card>
                <CardHeader><CardTitle className="text-base">Tempo por Disciplina</CardTitle></CardHeader>
                <CardContent>
                  {analytics.bySubject.length > 0 ? (
                    <div className="flex flex-col items-center gap-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={analytics.bySubject}
                            dataKey="minutes"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={95}
                            paddingAngle={2}
                          >
                            {analytics.bySubject.map((entry, index) => (
                              <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [formatTime(value), "Tempo"]} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Custom legend */}
                      <div className="w-full space-y-1.5">
                        {analytics.bySubject.map((entry, index) => {
                          const pct = analytics.totalMinutes > 0 ? ((entry.minutes / analytics.totalMinutes) * 100).toFixed(0) : "0";
                          return (
                            <div key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }} />
                                <span className="text-foreground truncate">{entry.name}</span>
                              </div>
                              <span className="text-muted-foreground shrink-0">{formatTime(entry.minutes)} ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Bar - by cycle */}
              <Card>
                <CardHeader><CardTitle className="text-base">Tempo por Ciclo</CardTitle></CardHeader>
                <CardContent>
                  {analytics.byCycle.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.byCycle}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => [formatTime(value), "Tempo"]} />
                        <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">Nenhum ciclo registrado no período</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance in Questions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Desempenho em Questões</h2>
              </div>

              {analytics.totalQuestions === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <Target className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma questão registrada ainda. Use os campos no Ciclo de Estudos ou no registro manual para acompanhar seu desempenho.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Overall accuracy donut */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Taxa de Acerto Geral</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <ResponsiveContainer width={220} height={220}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "Acertos", value: analytics.totalCorrect },
                                  { name: "Erros", value: Math.max(0, analytics.totalQuestions - analytics.totalCorrect) },
                                ]}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                startAngle={90}
                                endAngle={-270}
                              >
                                <Cell fill={
                                  analytics.overallAccuracy >= 75
                                    ? "hsl(var(--success, 142 76% 36%))"
                                    : analytics.overallAccuracy >= 50
                                    ? "hsl(38 92% 50%)"
                                    : "hsl(var(--destructive))"
                                } />
                                <Cell fill="hsl(var(--muted))" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-foreground tabular-nums">
                              {analytics.overallAccuracy.toFixed(0)}%
                            </span>
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">acerto</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="font-semibold text-foreground tabular-nums">{analytics.totalQuestions}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Acertos</p>
                            <p className="font-semibold text-foreground tabular-nums">{analytics.totalCorrect}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Erros</p>
                            <p className="font-semibold text-foreground tabular-nums">
                              {Math.max(0, analytics.totalQuestions - analytics.totalCorrect)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Per-subject accuracy */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Raio-X por Disciplina</CardTitle></CardHeader>
                    <CardContent>
                      {analytics.questionsBySubject.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">Sem dados por disciplina</p>
                      ) : (
                        <div className="space-y-3">
                          {analytics.questionsBySubject.map((s) => {
                            const barColor =
                              s.accuracy >= 75
                                ? "hsl(var(--success, 142 76% 36%))"
                                : s.accuracy >= 50
                                ? "hsl(38 92% 50%)"
                                : "hsl(var(--destructive))";
                            return (
                              <div key={s.name} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-sm min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {s.color && (
                                      <span
                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: s.color }}
                                      />
                                    )}
                                    <span className="truncate text-foreground">{s.name}</span>
                                  </div>
                                  <span className="text-muted-foreground tabular-nums shrink-0">
                                    {s.correct}/{s.total} · {s.accuracy.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, s.accuracy)}%`,
                                      backgroundColor: barColor,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Registros */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Registros de Estudo</h2>
              </div>
              <Card>
                <CardContent className="p-0">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 px-4 space-y-3">
                      <p className="text-muted-foreground text-sm">Nenhum registro encontrado.</p>
                      <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Registrar estudo
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {sessions.map((s) => {
                        const accuracy =
                          s.questions_total > 0
                            ? Math.round((s.questions_correct / s.questions_total) * 100)
                            : null;
                        const isEditable =
                          Date.now() - new Date(s.started_at).getTime() <= EDIT_WINDOW_MS;
                        return (
                          <li
                            key={s.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                          >
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{
                                backgroundColor: s.subject_color || "hsl(var(--muted-foreground))",
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground truncate">
                                  {s.subject_name || "Sem disciplina"}
                                </span>
                                {s.study_cycle_name && (
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                    {s.study_cycle_name}
                                  </span>
                                )}
                                {s.source === "manual" ? (
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                                    Manual
                                  </span>
                                ) : (
                                  !s.study_cycle_id && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      Pomodoro
                                    </span>
                                  )
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>
                                  {format(new Date(s.started_at), "dd 'de' MMM, HH:mm", {
                                    locale: ptBR,
                                  })}
                                </span>
                                <span>·</span>
                                <span>{formatTime(s.duration_minutes)}</span>
                                {s.questions_total > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {s.questions_correct}/{s.questions_total} ({accuracy}%)
                                    </span>
                                  </>
                                )}
                                {s.rating ? (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5 text-warning">
                                      <Star className="h-3 w-3 fill-current" />
                                      {s.rating}/5
                                    </span>
                                  </>
                                ) : null}
                              </div>
                              {s.topic && (
                                <p className="text-xs text-muted-foreground mt-1 break-words">
                                  Assunto: <span className="text-foreground">{s.topic}</span>
                                </p>
                              )}
                              {s.notes && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1 break-words">
                                  <NotebookPen className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span className="line-clamp-2">{s.notes}</span>
                                </p>
                              )}
                            </div>
                            {isEditable ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingSession(s);
                                    setEditOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeletingSession(s)}
                                  aria-label="Excluir registro"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                Bloqueado p/ edição
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
              </>
            )}
          </>

        )}
      </div>

      <StudyLogDialog open={logOpen} onOpenChange={setLogOpen} onLogged={refreshAnalytics} />

      <EditFocusSessionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        session={editingSession}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
        onSaved={refreshAnalytics}
      />

      <AlertDialog
        open={!!deletingSession}
        onOpenChange={(open) => { if (!open) setDeletingSession(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tempo e o desempenho desta sessão
              serão removidos dos seus relatórios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default StudyAnalyticsPage;
