import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Repeat, Plus, BookOpen, Clock, Trash2, Power, PowerOff, Play, Pencil, NotebookPen, CalendarRange, AlertTriangle } from "lucide-react";
import { getCycleTiming, cycleTimingBadgeClass, formatPlannedDedication } from "@/lib/studyCycleTiming";
import StudyLogDialog from "@/components/StudyLogDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { fetchActiveSubjects, Subject } from "@/services/subjects";
import {
  fetchStudyCycles,
  createStudyCycle,
  updateStudyCycle,
  deleteStudyCycle,
  toggleCycleActive,
  StudyCycle,
  NewBlock,
  CyclePlanningMetadata,
} from "@/services/studyCycles";
import StudyCycleDialog from "@/components/StudyCycleDialog";
import CycleNotesSection from "@/components/study-cycle/CycleNotesSection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudyCyclePlayer } from "@/contexts/StudyCyclePlayerContext";
import { toast } from "sonner";
import { logXP, XP } from "@/services/scoring";
import { registerActivity } from "@/services/activity";

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

const StudyCyclePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<StudyCycle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [studyLogOpen, setStudyLogOpen] = useState(false);
  const { playCycle } = useStudyCyclePlayer();

  const { data: cycles = [], isLoading: loadingCycles } = useQuery({
    queryKey: ["study-cycles", user?.id],
    queryFn: fetchStudyCycles,
    enabled: !!user,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["subjects-active", user?.id],
    queryFn: fetchActiveSubjects,
    enabled: !!user,
  });

  const loading = loadingCycles || loadingSubjects;

  const reloadCycles = () => queryClient.invalidateQueries({ queryKey: ["study-cycles", user?.id] });
  const reloadSubjects = () => queryClient.invalidateQueries({ queryKey: ["subjects-active", user?.id] });

  const handleSave = async (name: string, blocks: NewBlock[], planning?: CyclePlanningMetadata) => {
    if (!user) return;
    if (editingCycle) {
      await updateStudyCycle(editingCycle.id, name, blocks, planning);
      toast.success("Ciclo atualizado com sucesso!");
      logXP(user.id, "edit_basic", XP.EDIT_BASIC);
      registerActivity(user.id);
    } else {
      await createStudyCycle(user.id, name, blocks, planning);
      toast.success("Ciclo criado com sucesso!");
      logXP(user.id, "create_cycle", XP.CREATE_ITEM);
      registerActivity(user.id);
    }
    setEditingCycle(null);
    reloadCycles();
  };

  const handleOpenEdit = (cycle: StudyCycle) => {
    setEditingCycle(cycle);
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingCycle(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteStudyCycle(deleteId);
      toast.success("Ciclo excluído.");
      reloadCycles();
    } catch {
      toast.error("Erro ao excluir o ciclo.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggle = async (cycle: StudyCycle) => {
    try {
      await toggleCycleActive(cycle.id, !cycle.is_active);
      reloadCycles();
      toast.success(cycle.is_active ? "Ciclo desativado." : "Ciclo ativado!");
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const getTotalMinutes = (cycle: StudyCycle) =>
    (cycle.blocks || []).reduce((sum, b) => sum + b.allocated_minutes, 0);

  const formatTime = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <StudyLogDialog
        open={studyLogOpen}
        onOpenChange={setStudyLogOpen}
        onLogged={reloadCycles}
      />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4 py-3 flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-base sm:text-lg font-bold text-foreground truncate">Ciclo de Estudos</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStudyLogOpen(true)}
          className="ml-auto gap-1.5"
          title="Registrar estudo manualmente"
        >
          <NotebookPen className="h-4 w-4" />
          <span className="hidden sm:inline">Registrar estudo</span>
        </Button>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 sm:hidden">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </header>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="hidden sm:flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Repeat className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ciclo de Estudos</h1>
              <p className="text-sm text-muted-foreground">Monte seu ciclo como uma playlist</p>
            </div>
          </div>
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Criar Ciclo
          </Button>
        </div>

        <Tabs defaultValue="ciclos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
            <TabsTrigger value="ciclos">Ciclos</TabsTrigger>
            <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
          </TabsList>

          <TabsContent value="ciclos" className="mt-0 space-y-3 sm:space-y-4">
        {/* Loading */}
        {loading && (
          <div className="space-y-3 sm:space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 sm:gap-4 rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && cycles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <div className="p-4 rounded-2xl bg-primary/10 mb-6">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Nenhum ciclo criado</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm px-4">
              Crie seu primeiro ciclo de estudos adicionando suas disciplinas e definindo o tempo dedicado a cada uma.
            </p>
            <Button onClick={handleOpenCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Criar Primeiro Ciclo
            </Button>
          </div>
        )}

        {/* Cycles List */}
        {!loading && cycles.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {cycles.map((cycle) => {
              const blockCount = cycle.blocks?.length || 0;
              const totalMin = getTotalMinutes(cycle);
              const timing = getCycleTiming(cycle);
              const plannedDedication = formatPlannedDedication(cycle);

              return (
                <Card
                  key={cycle.id}
                  className={`transition-all hover:shadow-md ${!cycle.is_active ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-semibold text-sm sm:text-base text-foreground truncate min-w-0">{cycle.name}</h3>
                          <Badge
                            variant={cycle.is_active ? "default" : "secondary"}
                            className="shrink-0 text-[10px] px-1.5 py-0 h-5"
                          >
                            {cycle.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                          {timing.hasDates && (
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] px-1.5 py-0 h-5 ${cycleTimingBadgeClass(timing.status)}`}
                            >
                              {timing.label}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {blockCount} disc.
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(totalMin)}
                          </span>
                        </div>

                        {/* Planejamento temporal (Sprint 4.2) */}
                        {timing.hasDates && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 min-w-0">
                              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                              <span className="break-words">
                                {timing.startFormatted ?? "—"} → {timing.endFormatted ?? "—"}
                              </span>
                            </span>
                            {timing.contextLabel && (
                              <span
                                className={`flex items-center gap-1 font-medium ${
                                  timing.status === "ending_soon"
                                    ? "text-warning"
                                    : timing.status === "completed"
                                      ? "text-muted-foreground"
                                      : "text-foreground"
                                }`}
                              >
                                {timing.status === "ending_soon" ? (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="break-words">{timing.contextLabel}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Dedicação planejada (opcional, Simples ou Avançado) */}
                        {plannedDedication && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Target className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-words">{plannedDedication}</span>
                          </div>
                        )}




                        {/* Block chips */}
                        {cycle.blocks && cycle.blocks.length > 0 && (
                          <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2 sm:mt-3">
                            {cycle.blocks.slice(0, 6).map((block) => (
                              <span
                                key={block.id}
                                className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                              >
                                {block.subject?.color && (
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: block.subject.color }}
                                  />
                                )}
                                <span className="truncate max-w-[80px] sm:max-w-none">{block.subject?.name || "—"}</span>
                                <span className="text-muted-foreground hidden sm:inline">· {block.allocated_minutes}min</span>
                              </span>
                            ))}
                            {cycle.blocks.length > 6 && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground self-center">
                                +{cycle.blocks.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                        {cycle.is_active && (cycle.blocks?.length || 0) > 0 && (
                          <Button
                            variant="default"
                            size="icon"
                            className="h-9 w-9 rounded-full"
                            onClick={() => playCycle(cycle)}
                            title="Iniciar ciclo"
                            aria-label="Iniciar ciclo"
                          >
                            <Play className="h-4 w-4 ml-0.5" />
                          </Button>
                        )}
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleOpenEdit(cycle)}
                            title="Editar ciclo"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleToggle(cycle)}
                            title={cycle.is_active ? "Desativar" : "Ativar"}
                            aria-label={cycle.is_active ? "Desativar" : "Ativar"}
                          >
                            {cycle.is_active ? (
                              <PowerOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Power className="h-4 w-4 text-primary" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(cycle.id)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>

          <TabsContent value="anotacoes" className="mt-0">
            {user && (
              <CycleNotesSection userId={user.id} cycles={cycles} subjects={subjects} />
            )}
          </TabsContent>
        </Tabs>
      </div>


      {/* Create/Edit Dialog */}
      <StudyCycleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subjects={subjects}
        onSave={handleSave}
        cycleToEdit={editingCycle}
        userId={user?.id}
        onSubjectsChanged={async () => {
          reloadSubjects();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Todos os blocos vinculados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default StudyCyclePage;
