import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { registerActivity } from "@/services/activity";
import { logXP, XP } from "@/services/scoring";
import { createGoogleCalendarEvent } from "@/services/googleCalendar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, StickyNote, Target, Clock, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  PlannerNote,
  PlannerGoal,
} from "@/services/planner";
import { fetchActiveSubjects } from "@/services/subjects";
import { fetchStudySchedules, StudySchedule } from "@/services/studySchedules";
import { fetchTasks, Task } from "@/services/tasks";
import { NoteDialog } from "@/components/planner/NoteDialog";
import { GoalDialog } from "@/components/planner/GoalDialog";
import { ScheduleBlockDialog } from "@/components/ScheduleBlockDialog";
import { CalendarSidebar } from "@/components/planner/CalendarSidebar";
import { CalendarHeader, PlannerView } from "@/components/planner/CalendarHeader";
import { CalendarMonthView } from "@/components/planner/CalendarMonthView";
import { CalendarWeekView } from "@/components/planner/CalendarWeekView";
import { DayDetailSheet } from "@/components/planner/DayDetailSheet";
import { NotesListView } from "@/components/planner/NotesListView";
import { GoalsListView } from "@/components/planner/GoalsListView";
import {
  createStudySchedule,
  createMultipleStudySchedules,
  updateStudySchedule,
} from "@/services/studySchedules";
import { deleteStudySchedule } from "@/services/studySchedules";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const Planner = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<PlannerView>("month");
  const [filters, setFilters] = useState({ schedules: true, notes: true, goals: true, tasks: true });

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PlannerNote | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlannerGoal | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<StudySchedule | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-active"],
    queryFn: fetchActiveSubjects,
    enabled: !!user,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["planner-notes"],
    queryFn: fetchNotes,
    enabled: !!user,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["planner-goals"],
    queryFn: fetchGoals,
    enabled: !!user,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["study-schedules", user?.id],
    queryFn: () => fetchStudySchedules(user!.id),
    enabled: !!user?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: !!user,
  });

  // Note mutations
  const createNoteMut = useMutation({
    mutationFn: (data: Parameters<typeof createNote>[1]) => createNote(user!.id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planner-notes"] });
      if (user) { registerActivity(user.id); logXP(user.id, "create_note", XP.CREATE_ITEM); }
      queryClient.invalidateQueries({ queryKey: ["user-streak"] });
      toast.success("Anotação criada!");
      if (variables.planned_date) {
        createGoogleCalendarEvent({
          title: variables.title || "Anotação Zenit",
          description: variables.content || null,
          date: variables.planned_date,
        }).then((ok) => {
          if (ok) toast.success("✅ Sincronizado com o Google Calendar!");
        }).catch(() => {});
      }
    },
    onError: () => toast.error("Erro ao criar anotação"),
  });

  const updateNoteMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof updateNote>[1]) => updateNote(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planner-notes"] });
      if (user) {
        registerActivity(user.id);
        if (variables.completed === true) logXP(user.id, "note_completed", XP.NOTE_COMPLETED);
        else logXP(user.id, "edit_basic", XP.EDIT_BASIC);
      }
      queryClient.invalidateQueries({ queryKey: ["user-streak"] });
      toast.success("Anotação atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar anotação"),
  });

  const deleteNoteMut = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-notes"] });
      toast.success("Anotação removida!");
    },
    onError: () => toast.error("Erro ao remover anotação"),
  });

  // Goal mutations
  const createGoalMut = useMutation({
    mutationFn: (data: Parameters<typeof createGoal>[1]) => createGoal(user!.id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planner-goals"] });
      if (user) { registerActivity(user.id); logXP(user.id, "create_goal", XP.CREATE_ITEM); }
      queryClient.invalidateQueries({ queryKey: ["user-streak"] });
      toast.success("Meta criada!");
      if (variables.target_date) {
        createGoogleCalendarEvent({
          title: variables.title,
          description: variables.description || null,
          date: variables.target_date,
        }).then((ok) => {
          if (ok) toast.success("✅ Sincronizado com o Google Calendar!");
        }).catch(() => {});
      }
    },
    onError: () => toast.error("Erro ao criar meta"),
  });

  const updateGoalMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof updateGoal>[1]) => updateGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-goals"] });
      if (user) { registerActivity(user.id); logXP(user.id, "edit_basic", XP.EDIT_BASIC); }
      queryClient.invalidateQueries({ queryKey: ["user-streak"] });
      toast.success("Meta atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar meta"),
  });

  const deleteGoalMut = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-goals"] });
      toast.success("Meta removida!");
    },
    onError: () => toast.error("Erro ao remover meta"),
  });

  // Schedule mutations
  const createScheduleMut = useMutation({
    mutationFn: async (data: { title: string; type: "fixed" | "variable"; days: number[]; start_time: string; end_time: string; color: string; specific_date?: string | null }) => {
      const records = data.days.map((d) => ({
        user_id: user!.id,
        title: data.title,
        type: data.type,
        day_of_week: d,
        start_time: data.start_time,
        end_time: data.end_time,
        color: data.color,
        specific_date: data.type === "variable" ? data.specific_date ?? null : null,
      }));
      if (records.length === 1) {
        await createStudySchedule(records[0]);
      } else {
        await createMultipleStudySchedules(records);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-schedules"] });
      if (user) { registerActivity(user.id); logXP(user.id, "create_schedule", XP.CREATE_SCHEDULE); }
      toast.success("Horário criado!");
    },
    onError: () => toast.error("Erro ao criar horário"),
  });

  const updateScheduleMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; title: string; type: "fixed" | "variable"; day_of_week: number; start_time: string; end_time: string; color: string; specific_date?: string | null }) =>
      updateStudySchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-schedules"] });
      toast.success("Horário atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar horário"),
  });

  const deleteScheduleMut = useMutation({
    mutationFn: deleteStudySchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-schedules"] });
      toast.success("Horário removido!");
    },
    onError: () => toast.error("Erro ao remover horário"),
  });

  // Drag and drop handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overData = over.data.current as { dateStr: string } | undefined;
    if (!overData?.dateStr) return;

    const activeData = active.data.current as { type: string; id: string } | undefined;
    if (!activeData) return;

    const newDate = overData.dateStr;

    if (activeData.type === "note") {
      updateNoteMut.mutate({ id: activeData.id, planned_date: newDate });
    } else if (activeData.type === "goal") {
      updateGoalMut.mutate({ id: activeData.id, target_date: newDate });
    }
  };

  // Handlers
  const handleSaveNote = (data: { title: string; content: string; subject_id: string | null; task_id: string | null; planned_date: string | null }) => {
    if (editingNote) {
      updateNoteMut.mutate({ id: editingNote.id, ...data });
    } else {
      createNoteMut.mutate(data);
    }
    setEditingNote(null);
    setPrefillDate(null);
  };

  const handleSaveGoal = (data: { title: string; description: string | null; subject_id: string | null; target_date: string | null }) => {
    if (editingGoal) {
      updateGoalMut.mutate({ id: editingGoal.id, ...data });
    } else {
      createGoalMut.mutate(data);
    }
    setEditingGoal(null);
  };

  const openNewNote = (date?: string) => {
    setEditingNote(null);
    setPrefillDate(date || null);
    setNoteDialogOpen(true);
  };

  const openEditNote = (note: PlannerNote) => {
    setEditingNote(note);
    setPrefillDate(null);
    setNoteDialogOpen(true);
  };

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalDialogOpen(true);
  };

  const openEditGoal = (goal: PlannerGoal) => {
    setEditingGoal(goal);
    setGoalDialogOpen(true);
  };

  const openNewSchedule = () => {
    setEditingSchedule(null);
    setScheduleDialogOpen(true);
  };

  const openEditSchedule = (schedule: StudySchedule) => {
    setEditingSchedule(schedule);
    setScheduleDialogOpen(true);
  };

  const handleClickDay = (date: Date) => {
    setDayDetailDate(date);
    setDayDetailOpen(true);
  };

  const handleClickTask = (task: Task) => {
    navigate(`/task/${task.id}`);
  };

  const handleFilterChange = (key: "schedules" | "notes" | "goals" | "tasks", value: boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const prefillNote = editingNote || (prefillDate ? { planned_date: prefillDate } as PlannerNote : null);
  const isCalendarView = calendarView === "month" || calendarView === "week";

  const sidebarContent = (
    <CalendarSidebar
      filters={filters}
      onFilterChange={handleFilterChange}
      onCreateNote={() => { openNewNote(); setSidebarOpen(false); }}
      onCreateGoal={() => { openNewGoal(); setSidebarOpen(false); }}
      onCreateSchedule={() => { openNewSchedule(); setSidebarOpen(false); }}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <h1 className="text-lg font-bold">Planner</h1>
          </div>
          {isMobile && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openNewNote()} className="gap-2">
                    <StickyNote className="h-4 w-4 text-amber-500" /> Anotação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openNewGoal()} className="gap-2">
                    <Target className="h-4 w-4 text-emerald-500" /> Meta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openNewSchedule()} className="gap-2">
                    <Clock className="h-4 w-4 text-blue-500" /> Horário
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {isCalendarView && (
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-4">
                    <SheetHeader>
                      <SheetTitle className="text-left">Filtros</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      {sidebarContent}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar - only for calendar views */}
        {!isMobile && isCalendarView && (
          <div className="w-[250px] shrink-0 border-r p-4 hidden md:block">
            {sidebarContent}
          </div>
        )}

        {/* Main area */}
        <main className="flex-1 flex flex-col p-4 md:p-5 min-h-0 overflow-auto">
          <CalendarHeader
            currentDate={currentDate}
            view={calendarView}
            onViewChange={setCalendarView}
            onDateChange={setCurrentDate}
            onToday={() => setCurrentDate(new Date())}
          />

          {isCalendarView ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex-1 border rounded-lg overflow-hidden bg-card">
                {calendarView === "month" ? (
                  <CalendarMonthView
                    currentDate={currentDate}
                    schedules={schedules}
                    notes={notes}
                    goals={goals}
                    tasks={tasks}
                    filters={filters}
                    onClickNote={openEditNote}
                    onClickGoal={openEditGoal}
                    onClickSchedule={openEditSchedule}
                    onClickTask={handleClickTask}
                    onClickDay={handleClickDay}
                  />
                ) : (
                  <CalendarWeekView
                    currentDate={currentDate}
                    schedules={schedules}
                    notes={notes}
                    goals={goals}
                    tasks={tasks}
                    filters={filters}
                    onClickNote={openEditNote}
                    onClickGoal={openEditGoal}
                    onClickSchedule={openEditSchedule}
                    onClickTask={handleClickTask}
                    onClickDay={handleClickDay}
                  />
                )}
              </div>
            </DndContext>
          ) : calendarView === "notes" ? (
            <NotesListView
              notes={notes}
              onEdit={openEditNote}
              onDelete={(id) => deleteNoteMut.mutate(id)}
              onTogglePin={(id, pinned) => updateNoteMut.mutate({ id, pinned })}
              onToggleComplete={(id, completed) => updateNoteMut.mutate({ id, completed })}
              onCreate={() => openNewNote()}
            />
          ) : (
            <GoalsListView
              goals={goals}
              onEdit={openEditGoal}
              onDelete={(id) => deleteGoalMut.mutate(id)}
              onToggleComplete={(id, completed) => updateGoalMut.mutate({ id, completed })}
              onProgressChange={(id, progress) => updateGoalMut.mutate({ id, progress })}
              onCreate={() => openNewGoal()}
            />
          )}
        </main>
      </div>

      {/* Day detail sheet */}
      <DayDetailSheet
        open={dayDetailOpen}
        onOpenChange={setDayDetailOpen}
        date={dayDetailDate}
        schedules={schedules}
        notes={notes}
        goals={goals}
        tasks={tasks}
        filters={filters}
        onEditNote={openEditNote}
        onEditGoal={openEditGoal}
        onEditSchedule={openEditSchedule}
        onClickTask={handleClickTask}
        onDeleteNote={(id) => deleteNoteMut.mutate(id)}
        onDeleteGoal={(id) => deleteGoalMut.mutate(id)}
        onDeleteSchedule={(id) => deleteScheduleMut.mutate(id)}
        onToggleNoteComplete={(id, completed) => updateNoteMut.mutate({ id, completed })}
        onToggleGoalComplete={(id, completed) => updateGoalMut.mutate({ id, completed })}
        onCreateNote={(date) => openNewNote(date)}
        onCreateGoal={() => openNewGoal()}
      />

      {/* Dialogs */}
      <NoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        note={prefillNote}
        subjects={subjects}
        onSave={handleSaveNote}
      />

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
        subjects={subjects}
        onSave={handleSaveGoal}
      />

      <ScheduleBlockDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        editingBlock={editingSchedule}
        onSave={(data) => {
          createScheduleMut.mutate(data);
          setScheduleDialogOpen(false);
        }}
        onUpdate={(id, data) => {
          updateScheduleMut.mutate({ id, ...data });
          setScheduleDialogOpen(false);
        }}
        onDelete={(id) => {
          deleteScheduleMut.mutate(id);
          setScheduleDialogOpen(false);
        }}
      />
    </div>
  );
};

export default Planner;
