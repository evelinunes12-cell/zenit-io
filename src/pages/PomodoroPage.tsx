import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTimer, PomodoroSettings, DEFAULT_POMODORO_SETTINGS } from "@/contexts/FocusTimerContext";
import { Button } from "@/components/ui/button";
import {
  Flame, Target, Zap, Maximize2, Minimize2, Play, Pause, RotateCcw,
  Coffee, Timer, BookOpen, X, PictureInPicture2, Settings2,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveSubjects } from "@/services/subjects";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const motivationalTips = [
  { icon: Flame, text: "Mantenha o foco por 25 minutos e descanse. Seu cérebro agradece!" },
  { icon: Target, text: "Defina uma meta clara antes de cada sessão de foco." },
  { icon: Zap, text: "Elimine distrações: silencie notificações e feche abas desnecessárias." },
];

const PomodoroPage = () => {
  const {
    timeRemaining, isRunning, isPaused, isBreak, isLongBreak, completedBlocks, totalTime, isCompleted,
    start, pause, resume, reset,
    selectedSubjectId, selectedSubjectName, setSelectedSubject,
    settings, updateSettings,
    pipSupported, pipOpen, pipContainer, openPiP,
  } = useFocusTimer();
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<PomodoroSettings>(settings);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-active", user?.id],
    queryFn: fetchActiveSubjects,
    enabled: !!user,
  });

  const hasStarted = isRunning || isPaused || timeRemaining < totalTime;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const progress = ((totalTime - timeRemaining) / totalTime) * 100;
  const breakLabel = isLongBreak ? "Descanso Longo" : "Pausa Curta";

  const openSettings = () => {
    setDraftSettings(settings);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    updateSettings(draftSettings);
    setSettingsOpen(false);
    if (!hasStarted) reset();
  };

  useEffect(() => {
    if (!hasStarted && isFullscreen) setIsFullscreen(false);
  }, [hasStarted, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const handlePlayPause = () => {
    if (isRunning) pause();
    else if (isPaused) resume();
    else start();
  };

  const handleSubjectChange = (value: string) => {
    if (value === "__none__") {
      setSelectedSubject(null);
      return;
    }
    const subj = subjects.find((s) => s.id === value);
    if (subj) setSelectedSubject({ id: subj.id, name: subj.name });
  };

  const ringColor = isBreak ? "text-success" : "text-primary";
  const timeColor = isBreak ? "text-success" : "text-primary";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-lg font-bold text-foreground">Modo Foco</h1>
        </div>
        <div className="flex items-center gap-2">
          {pipSupported && hasStarted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openPiP}
              disabled={pipOpen}
              className="h-8 gap-2 px-3 rounded-lg border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/70"
              title={pipOpen ? "Miniplayer ativo" : "Abrir miniplayer flutuante"}
            >
              <PictureInPicture2 className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline">Miniplayer</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={openSettings}
            className="h-8 gap-2 px-3 rounded-lg border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/70"
            title="Personalizar Pomodoro"
          >
            <Settings2 className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Personalizar</span>
          </Button>
        </div>
      </header>


      <div className="flex flex-col items-center px-4 py-8 md:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
            {isBreak ? <Coffee className="w-3.5 h-3.5 text-success" /> : <Timer className="w-3.5 h-3.5 text-primary" />}
            <span className="text-xs font-medium uppercase tracking-wider text-foreground">
              {isBreak ? breakLabel : "Modo Foco · Pomodoro"}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            {hasStarted ? (isBreak ? "Hora de respirar" : "Foco total agora") : "Pronto para começar?"}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {selectedSubjectName
              ? <>Estudando <span className="text-primary font-medium">{selectedSubjectName}</span> · {settings.focusMinutes} min de foco + {settings.shortBreakMinutes} min de pausa</>
              : `Inicie um ciclo de ${settings.focusMinutes} minutos. Opcionalmente, escolha uma disciplina para registrar nos seus relatórios.`}
          </p>
          {completedBlocks > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Blocos concluídos:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: settings.blocksBeforeLongBreak }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2 w-2 rounded-full",
                      (completedBlocks % settings.blocksBeforeLongBreak) > i ||
                        (completedBlocks > 0 && completedBlocks % settings.blocksBeforeLongBreak === 0)
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <span className="tabular-nums">({completedBlocks})</span>
            </div>
          )}
        </div>

        {/* Hero Player */}
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/40 backdrop-blur-xl p-6 md:p-8 shadow-elegant">
          {/* Big donut */}
          <div className="relative flex items-center justify-center mb-6">
            <svg className="w-64 h-64 md:w-72 md:h-72 transform -rotate-90">
              <circle
                cx="50%" cy="50%" r="45%"
                stroke="currentColor" strokeWidth="6" fill="none"
                className="text-muted/20"
              />
              <circle
                cx="50%" cy="50%" r="45%"
                stroke="currentColor" strokeWidth="6" fill="none"
                pathLength={100} strokeDasharray="100"
                strokeDashoffset={100 - progress}
                strokeLinecap="round"
                className={cn("transition-all duration-1000", ringColor, isPaused && "text-warning")}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn(
                "font-mono font-bold tabular-nums text-6xl md:text-7xl",
                timeColor, isPaused && "text-warning"
              )}>
                {formattedTime}
              </span>
              <span className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {isRunning && !isBreak && "Focando…"}
                {isRunning && isBreak && "Descansando…"}
                {isPaused && "Pausado"}
                {!hasStarted && "Pronto"}
                {isCompleted && !isRunning && "Concluído"}
              </span>
            </div>
          </div>

          {/* Subject selector */}
          <div className="mb-5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              Disciplina (opcional)
            </label>
            <div className="flex gap-2">
              <Select
                value={selectedSubjectId ?? "__none__"}
                onValueChange={handleSubjectChange}
                disabled={isRunning}
              >
                <SelectTrigger className="flex-1 bg-background/60">
                  <SelectValue placeholder="Sem disciplina associada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem disciplina associada</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSubjectId && !isRunning && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedSubject(null)}
                  aria-label="Remover disciplina"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Primary CTA */}
          <Button
            size="lg"
            onClick={handlePlayPause}
            className={cn(
              "w-full h-14 text-base font-semibold rounded-2xl gap-2 shadow-lg transition-all",
              !isRunning && !isPaused && "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-[1.02]",
              isRunning && "bg-warning hover:bg-warning/90 text-warning-foreground",
              isPaused && "bg-primary hover:bg-primary/90 text-primary-foreground",
            )}
          >
            {isRunning ? (
              <><Pause className="w-5 h-5" /> Pausar</>
            ) : isPaused ? (
              <><Play className="w-5 h-5 ml-0.5" /> Retomar foco</>
            ) : (
              <><Play className="w-5 h-5 ml-0.5" /> {isBreak ? "Iniciar pausa" : "Iniciar Pomodoro"}</>
            )}
          </Button>

          {/* Secondary controls */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!hasStarted && timeRemaining === totalTime}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar
            </Button>
            {hasStarted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(true)}
                className="gap-1.5"
              >
                <Maximize2 className="w-4 h-4" />
                Tela cheia
              </Button>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mt-10">
          {motivationalTips.map((tip, i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center shadow-sm">
              <div className="p-2 rounded-lg bg-primary/10">
                <tip.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in">
          <Button
            variant="ghost" size="icon"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full"
            aria-label="Sair da tela cheia"
          >
            <Minimize2 className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2 mb-4 text-muted-foreground">
            {isBreak ? <Coffee className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
            <span className="text-sm uppercase tracking-widest">
              {isBreak ? breakLabel : "Modo Foco"}
            </span>
          </div>
          {selectedSubjectName && (
            <div className="mb-4 text-sm text-primary font-medium">{selectedSubjectName}</div>
          )}

          <div className="relative">
            <svg className="w-[min(80vw,80vh)] h-[min(80vw,80vh)] transform -rotate-90">
              <circle cx="50%" cy="50%" r="46%" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted/20" />
              <circle
                cx="50%" cy="50%" r="46%"
                stroke="currentColor" strokeWidth="4" fill="none"
                pathLength={100} strokeDasharray="100"
                strokeDashoffset={100 - progress}
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-1000",
                  isRunning && !isBreak && "text-primary",
                  isRunning && isBreak && "text-success",
                  isPaused && "text-warning",
                  isCompleted && "text-success",
                  !hasStarted && "text-muted-foreground"
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(
                "font-mono font-bold tabular-nums text-[clamp(3rem,18vw,12rem)]",
                isRunning && !isBreak && "text-primary",
                isRunning && isBreak && "text-success",
                isPaused && "text-warning",
                isCompleted && "text-success"
              )}>
                {formattedTime}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-10">
            <Button variant="outline" size="icon" onClick={handlePlayPause} className="h-14 w-14 rounded-full">
              {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </Button>
            <Button
              variant="outline" size="icon" onClick={reset}
              className="h-14 w-14 rounded-full"
              disabled={!hasStarted && timeRemaining === totalTime}
            >
              <RotateCcw className="w-6 h-6" />
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            {isRunning && !isBreak && "Focando..."}
            {isRunning && isBreak && "Descansando..."}
            {isPaused && "Pausado"}
            {isCompleted && "🎉 Ciclo concluído!"}
          </p>
        </div>
      )}

      {/* PiP portal */}
      {pipContainer && createPortal(
        <div className="flex flex-col items-center justify-center gap-4 h-screen w-screen p-4 bg-background text-foreground">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 truncate max-w-full text-center px-2">
            {selectedSubjectName || (isBreak ? "Pausa" : "Pomodoro")}
          </div>
          <div className={cn(
            "text-5xl font-bold tabular-nums",
            isRunning && !isBreak && "text-primary",
            isRunning && isBreak && "text-success",
            isPaused && "text-warning",
            isCompleted && "text-success",
            !hasStarted && "text-muted-foreground"
          )}>
            {formattedTime}
          </div>
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg",
              isBreak ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
            )}
            onClick={handlePlayPause}
          >
            {isRunning ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" />
            )}
          </Button>
          <div className="text-[10px] text-muted-foreground/60">
            {isBreak ? "Intervalo" : isRunning ? "Focando" : isPaused ? "Pausado" : "Pronto"}
          </div>
        </div>,
        pipContainer
      )}

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              Personalizar Pomodoro
            </DialogTitle>
            <DialogDescription>
              Defina a duração de cada etapa. As alterações são salvas neste dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="focus-min">Tempo de foco (min)</Label>
              <Input
                id="focus-min"
                type="number"
                min={1}
                max={120}
                value={draftSettings.focusMinutes}
                onChange={(e) => setDraftSettings((s) => ({ ...s, focusMinutes: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="short-break">Descanso entre blocos (min)</Label>
              <Input
                id="short-break"
                type="number"
                min={1}
                max={60}
                value={draftSettings.shortBreakMinutes}
                onChange={(e) => setDraftSettings((s) => ({ ...s, shortBreakMinutes: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="long-break">Descanso longo (min)</Label>
              <Input
                id="long-break"
                type="number"
                min={1}
                max={60}
                value={draftSettings.longBreakMinutes}
                onChange={(e) => setDraftSettings((s) => ({ ...s, longBreakMinutes: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="blocks-count">Blocos até o descanso longo</Label>
              <Input
                id="blocks-count"
                type="number"
                min={2}
                max={12}
                value={draftSettings.blocksBeforeLongBreak}
                onChange={(e) => setDraftSettings((s) => ({ ...s, blocksBeforeLongBreak: Number(e.target.value) }))}
              />
            </div>
            {isRunning && (
              <p className="text-xs text-warning">
                As novas durações serão aplicadas a partir do próximo bloco.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDraftSettings(DEFAULT_POMODORO_SETTINGS)}
            >
              Restaurar padrão
            </Button>
            <Button onClick={saveSettings}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PomodoroPage;
