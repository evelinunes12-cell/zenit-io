import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, SkipForward, RotateCcw, X, Coffee, CheckCircle2, ClipboardEdit, PictureInPicture2, ArrowLeft, ChevronUp, ChevronDown, StickyNote, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DonutTimer } from "@/components/DonutTimer";
import { toast } from "sonner";
import StudyLogDialog from "@/components/StudyLogDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StudySessionExtrasFields, {
  emptyStudyExtras,
  normalizeStudyExtras,
  type StudySessionExtrasValue,
} from "@/components/study/StudySessionExtrasFields";
import CycleNoteDialog from "@/components/study-cycle/CycleNoteDialog";
import { useStudyCyclePlayer } from "@/contexts/StudyCyclePlayerContext";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Subject } from "@/services/subjects";

const BREAK_SECONDS = 300;

interface QueueChipProps {
  name: string;
  color: string | null;
  minutes: number;
  isDone: boolean;
  isCurrent?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const QueueChip = ({ name, color, minutes, isDone, isCurrent, onClick, disabled }: QueueChipProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200 text-left w-full",
      isCurrent
        ? "bg-primary/10 border border-primary/20 shadow-sm"
        : "bg-card/60 backdrop-blur-sm border border-border/40 hover:bg-card/80 hover:border-border/60",
      isDone && "opacity-35",
      disabled && "cursor-default"
    )}
  >
    <span
      className={cn("h-2.5 w-2.5 rounded-full shrink-0", isCurrent && "ring-2 ring-primary/30 ring-offset-1 ring-offset-background")}
      style={{ backgroundColor: color || "hsl(var(--muted-foreground))" }}
    />
    <span className={cn("text-sm truncate flex-1", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground", isDone && "line-through")}>
      {name || "—"}
    </span>
    <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">{minutes}min</span>
    {isCurrent && (
      <Badge variant="default" className="text-[10px] h-4 px-1.5 shrink-0">Agora</Badge>
    )}
    {isDone && !isCurrent && <span className="text-xs text-primary shrink-0">✓</span>}
  </button>
);

const StudyCyclePlayer = () => {
  const {
    cycle,
    isExpanded,
    currentIndex,
    elapsedSeconds,
    breakRemaining,
    isRunning,
    isPaused,
    mode,
    targetReached,
    completedBlocks,
    pipSupported,
    pipOpen,
    pipContainer,
    collapse,
    closePlayer,
    togglePlayPause,
    completeBlock,
    skip,
    restart,
    goToBlock,
    setManualLogged,
    openPiP,
  } = useStudyCyclePlayer();

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [questionsTotal, setQuestionsTotal] = useState("");
  const [questionsCorrect, setQuestionsCorrect] = useState("");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [extras, setExtras] = useState<StudySessionExtrasValue>(emptyStudyExtras);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDeltaY = useRef(0);

  // Reset questions inputs when changing block or entering break mode
  useEffect(() => {
    setQuestionsTotal("");
    setQuestionsCorrect("");
    setExtras(emptyStudyExtras());
    setExtrasOpen(false);
  }, [currentIndex, mode]);

  // Collapse sheet when switching to break
  useEffect(() => {
    if (mode === "break") setSheetExpanded(false);
  }, [mode]);

  const handleCompleteBlock = () => {
    const total = Math.max(0, parseInt(questionsTotal) || 0);
    let correct = Math.max(0, parseInt(questionsCorrect) || 0);
    if (correct > total) correct = total;
    const normalized = normalizeStudyExtras(extras);
    void completeBlock(
      { total, correct },
      { topic: normalized.topic, notes: normalized.notes, rating: normalized.rating }
    );
  };

  if (!cycle) return null;

  const blocks = cycle.blocks || [];
  if (blocks.length === 0) return null;

  const currentBlock = blocks[currentIndex];
  const isBreak = mode === "break";

  // Build a unique subject list from the cycle blocks for the note dialog
  const noteSubjects = Array.from(
    new Map(
      blocks
        .filter((b) => b.subject_id)
        .map((b) => [
          b.subject_id,
          { id: b.subject_id, name: b.subject?.name || "—", color: b.subject?.color ?? null } as Subject,
        ])
    ).values()
  );
  const targetSeconds = currentBlock ? currentBlock.allocated_minutes * 60 : 0;
  const isOvertime = !isBreak && elapsedSeconds > targetSeconds && targetSeconds > 0;

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formattedTime = isBreak ? formatTime(breakRemaining) : formatTime(elapsedSeconds);
  const progress = isBreak
    ? ((BREAK_SECONDS - breakRemaining) / BREAK_SECONDS) * 100
    : targetSeconds > 0
    ? (elapsedSeconds / targetSeconds) * 100
    : 0;

  const overtimeSeconds = !isBreak && elapsedSeconds > targetSeconds ? elapsedSeconds - targetSeconds : 0;
  const overtimeText = overtimeSeconds > 0 ? formatTime(overtimeSeconds) : undefined;

  const allDone = completedBlocks.size === blocks.length;
  const subjectColor = isBreak ? "hsl(var(--primary))" : currentBlock?.subject?.color || "hsl(var(--primary))";

  // Full ordered list starting after current block (wraps around), excluding current
  const upcomingBlocks: Array<typeof blocks[number] & { _idx: number }> = [];
  for (let i = 1; i < blocks.length; i++) {
    const idx = (currentIndex + i) % blocks.length;
    upcomingBlocks.push({ ...blocks[idx], _idx: idx });
  }
  const pendingCount = blocks.length - completedBlocks.size - (isBreak ? 0 : 1);

  const handleBack = async () => {
    // Try to open PiP automatically so user keeps seeing the timer,
    // but only if they have actually started the counter at least once.
    if (pipSupported && !pipOpen && !isBreak && elapsedSeconds > 0) {
      try {
        await openPiP();
      } catch {
        // ignore
      }
    } else if (!pipSupported && elapsedSeconds > 0) {
      toast.info("Estudo continua em segundo plano.");
    }
    collapse();
  };

  return (
    <>
      {/* PiP portal — always available when pipContainer exists */}
      {pipContainer && createPortal(
        <div className="flex flex-col items-center justify-center gap-4 h-screen w-screen p-4 bg-background text-foreground">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 truncate max-w-full text-center px-2">
            {currentBlock?.subject?.name || "Disciplina"}
          </div>
          <div
            className="text-5xl font-bold tabular-nums"
            style={{ color: isOvertime ? "hsl(var(--destructive))" : subjectColor }}
          >
            {formattedTime}
          </div>
          {isOvertime && overtimeText && (
            <div className="text-xs text-destructive">+{overtimeText}</div>
          )}
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            style={{ backgroundColor: subjectColor }}
            onClick={togglePlayPause}
            disabled={allDone && !isBreak}
          >
            {isRunning ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-0.5" />
            )}
          </Button>
          <div className="text-[10px] text-muted-foreground/60">
            {isBreak ? "Intervalo" : isRunning ? "Estudando" : isPaused ? "Pausado" : "Pronto"}
          </div>
        </div>,
        pipContainer
      )}

      {/* Fullscreen overlay — only when expanded */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background transition-colors duration-500">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 backdrop-blur-sm bg-background/80">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleBack}
                title="Voltar (continua estudando)"
                aria-label="Voltar e continuar estudando em segundo plano"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground truncate tracking-wide">
                {cycle.name}
              </span>
              {isBreak ? (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Coffee className="h-3 w-3" /> Intervalo
                </Badge>
              ) : (
                <span className="text-[11px] text-muted-foreground/60 tabular-nums font-medium">
                  {currentIndex + 1} / {blocks.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isBreak && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 rounded-lg border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/70"
                  onClick={() => setNoteOpen(true)}
                  title="Adicionar anotação"
                >
                  <StickyNote className="h-4 w-4" />
                  <span className="text-xs font-medium hidden sm:inline">Anotar</span>
                </Button>
              )}
              {pipSupported && !isBreak && elapsedSeconds > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 rounded-lg border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/70"
                  onClick={openPiP}
                  title={pipOpen ? "Janela flutuante ativa" : "Abrir janela flutuante"}
                  disabled={pipOpen}
                >
                  <PictureInPicture2 className="h-4 w-4" />
                  <span className="text-xs font-medium">Miniplayer</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg border border-border/50 bg-card/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40"
                onClick={closePlayer}
                title="Encerrar ciclo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* Player content — dims and recedes when sheet expands */}
            <div
              className={cn(
                "absolute inset-0 overflow-y-auto transition-all duration-500 ease-out",
                sheetExpanded && "scale-[0.92] opacity-30 blur-[2px] pointer-events-none"
              )}
              style={{ paddingBottom: 200 }}
            >
              <div className="min-h-full flex flex-col items-center justify-center px-6 gap-8 max-w-lg mx-auto w-full py-6">
                <DonutTimer
                  timeLeft={formattedTime}
                  progress={progress}
                  mode={isBreak ? "break" : "study"}
                  label={isBreak ? "Intervalo" : (currentBlock?.subject?.name || "Disciplina")}
                  subjectColor={subjectColor}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  isOvertime={isOvertime}
                  overtimeText={overtimeText}
                />

                <div className="flex items-center gap-5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full border-border/50"
                    onClick={restart}
                    disabled={allDone && !isBreak}
                    title="Recomeçar"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>

                  <Button
                    size="icon"
                    className="h-16 w-16 rounded-full shadow-lg transition-shadow duration-300"
                    style={{
                      backgroundColor: subjectColor,
                      boxShadow: isRunning ? `0 0 30px ${subjectColor}44, 0 4px 20px ${subjectColor}33` : undefined,
                    }}
                    onClick={togglePlayPause}
                    disabled={allDone && !isBreak}
                  >
                    {isRunning ? (
                      <Pause className="h-7 w-7 text-white" />
                    ) : (
                      <Play className="h-7 w-7 text-white ml-0.5" />
                    )}
                  </Button>

                  {isBreak && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full border-border/50"
                      onClick={skip}
                      disabled={allDone}
                      title="Pular intervalo"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  )}

                  {!isBreak && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full bg-success/10 border-success/30 text-success hover:bg-success/20 hover:text-success"
                      onClick={handleCompleteBlock}
                      disabled={allDone || (!isRunning && !isPaused && elapsedSeconds === 0)}
                      title="Concluir bloco rapidamente"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {!isBreak && (
                  <div className="w-full max-w-sm rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl p-5 shadow-2xl space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Desempenho no Bloco
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setManualLogOpen(true)}
                        className="h-7 gap-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <ClipboardEdit className="h-3.5 w-3.5" />
                        Registro Manual
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] font-medium text-muted-foreground/80 px-1 uppercase tracking-wider">
                          Resolvidas
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={questionsTotal}
                          onChange={(e) => setQuestionsTotal(e.target.value)}
                          placeholder="0"
                          className="h-11 rounded-xl text-center font-bold text-base"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] font-medium text-muted-foreground/80 px-1 uppercase tracking-wider">
                          Acertos
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={questionsCorrect}
                          onChange={(e) => setQuestionsCorrect(e.target.value)}
                          placeholder="0"
                          className="h-11 rounded-xl text-center font-bold text-base text-success"
                        />
                      </div>
                    </div>

                    <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Mais opções
                          </span>
                          <ChevronDown
                            className={cn("h-3.5 w-3.5 transition-transform", extrasOpen && "rotate-180")}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <StudySessionExtrasFields
                          value={extras}
                          onChange={(patch) => setExtras((prev) => ({ ...prev, ...patch }))}
                          showQuestions={false}
                          idPrefix="cycle-block"
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    <Button
                      onClick={handleCompleteBlock}
                      disabled={allDone || (!isRunning && !isPaused && elapsedSeconds === 0)}
                      className="w-full h-12 rounded-xl text-sm font-bold bg-success text-success-foreground hover:bg-success/90 shadow-lg gap-2"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      Concluir Bloco de Estudo
                    </Button>
                  </div>
                )}

                {isBreak && (
                  <Button variant="ghost" size="sm" onClick={skip} className="text-xs text-muted-foreground hover:text-foreground">
                    Pular intervalo e ir para a próxima matéria →
                  </Button>
                )}
              </div>
            </div>

            {/* Dim backdrop behind sheet when expanded */}
            {sheetExpanded && (
              <button
                aria-label="Recolher lista"
                onClick={() => setSheetExpanded(false)}
                className="absolute inset-0 bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-300"
              />
            )}

            {/* Expandable bottom sheet */}
            <div
              className={cn(
                "absolute left-0 right-0 bottom-0 bg-card/95 backdrop-blur-xl border-t border-border/60 rounded-t-3xl shadow-2xl flex flex-col transition-[height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                sheetExpanded ? "h-[85%]" : "h-[200px]"
              )}
              onWheel={(e) => {
                if (isBreak) return;
                const el = sheetScrollRef.current;
                if (!sheetExpanded && e.deltaY < -10) setSheetExpanded(true);
                else if (sheetExpanded && el && el.scrollTop <= 0 && e.deltaY > 10) setSheetExpanded(false);
              }}
              onTouchStart={(e) => {
                dragStartY.current = e.touches[0].clientY;
                dragDeltaY.current = 0;
              }}
              onTouchMove={(e) => {
                if (dragStartY.current == null) return;
                dragDeltaY.current = e.touches[0].clientY - dragStartY.current;
              }}
              onTouchEnd={() => {
                if (isBreak) { dragStartY.current = null; return; }
                const d = dragDeltaY.current;
                const el = sheetScrollRef.current;
                if (!sheetExpanded && d < -40) setSheetExpanded(true);
                else if (sheetExpanded && d > 60 && (!el || el.scrollTop <= 0)) setSheetExpanded(false);
                dragStartY.current = null;
                dragDeltaY.current = 0;
              }}
            >
              {/* Drag handle */}
              <button
                onClick={() => !isBreak && setSheetExpanded((v) => !v)}
                className="w-full flex flex-col items-center pt-2.5 pb-1 group"
                aria-label={sheetExpanded ? "Recolher lista" : "Expandir lista"}
                disabled={isBreak}
              >
                <span className="h-1.5 w-12 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors" />
              </button>

              <div className="flex items-center justify-between px-5 pt-1 pb-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {isBreak ? "Próximas disciplinas" : "Disciplinas do ciclo"}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums px-1.5 py-0.5 rounded-full bg-muted/60">
                    {completedBlocks.size}/{blocks.length}
                  </span>
                </div>
                {!isBreak && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => setSheetExpanded((v) => !v)}
                  >
                    {sheetExpanded ? (
                      <>Recolher <ChevronDown className="h-3.5 w-3.5" /></>
                    ) : (
                      <>Ver todas <ChevronUp className="h-3.5 w-3.5" /></>
                    )}
                  </Button>
                )}
              </div>

              <div ref={sheetScrollRef} className="flex-1 overflow-y-auto px-5 pb-5 space-y-1.5">
                {!isBreak && (
                  <QueueChip
                    name={currentBlock?.subject?.name || "—"}
                    color={currentBlock?.subject?.color || null}
                    minutes={currentBlock?.allocated_minutes || 0}
                    isDone={false}
                    isCurrent
                    disabled
                  />
                )}
                {upcomingBlocks.map((block, i) => {
                  const isDone = completedBlocks.has(block._idx);
                  return (
                    <QueueChip
                      key={`${block.id}-${i}`}
                      name={block.subject?.name || "—"}
                      color={block.subject?.color || null}
                      minutes={block.allocated_minutes}
                      isDone={isDone}
                      onClick={() => {
                        if (isBreak) return;
                        goToBlock(block._idx);
                        setSheetExpanded(false);
                      }}
                      disabled={isBreak}
                    />
                  );
                })}
                {!isBreak && !sheetExpanded && pendingCount > 0 && (
                  <p className="text-[10px] text-muted-foreground/50 pt-1 text-center">
                    Arraste para cima para ver todas
                  </p>
                )}
              </div>
            </div>
          </div>

          <StudyLogDialog
            open={manualLogOpen}
            onOpenChange={setManualLogOpen}
            defaultCycleId={cycle.id}
            defaultSubjectId={currentBlock?.subject_id ?? null}
            showMarkCompleted
            onLogged={({ markCompleted }) =>
              setManualLogged({ blockIndex: currentIndex, markCompleted })
            }
          />

          {user && (
            <CycleNoteDialog
              open={noteOpen}
              onOpenChange={setNoteOpen}
              userId={user.id}
              cycles={[cycle]}
              subjects={noteSubjects}
              defaultCycleId={cycle.id}
              defaultSubjectId={currentBlock?.subject_id ?? null}
              lockCycle
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["cycle-notes", user.id] })}
            />
          )}
        </div>
      )}
    </>
  );
};

export default StudyCyclePlayer;
