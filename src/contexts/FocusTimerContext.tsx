import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { registerActivity, incrementPomodoroCount } from "@/services/activity";
import { createFocusSession } from "@/services/focusSessions";
import { logXP, XP } from "@/services/scoring";
import { setCurrentStudyInfo, clearCurrentStudyInfo } from "@/lib/studyPresence";
import { toast } from "sonner";
import { useDocumentPiP } from "@/hooks/useDocumentPiP";
import PomodoroCompletionDialog from "@/components/PomodoroCompletionDialog";

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  blocksBeforeLongBreak: number;
}

interface FocusTimerContextType {
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  isLongBreak: boolean;
  completedBlocks: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  totalTime: number;
  isCompleted: boolean;
  selectedSubjectId: string | null;
  selectedSubjectName: string | null;
  setSelectedSubject: (subject: { id: string; name: string } | null) => void;
  settings: PomodoroSettings;
  updateSettings: (settings: PomodoroSettings) => void;
  pipSupported: boolean;
  pipOpen: boolean;
  pipContainer: HTMLElement | null;
  openPiP: () => Promise<void>;
}

const FocusTimerContext = createContext<FocusTimerContextType | undefined>(undefined);

const STORAGE_KEY = "focus_timer_state";
const SETTINGS_KEY = "focus_timer_settings";

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  blocksBeforeLongBreak: 4,
};

const clampSettings = (s: PomodoroSettings): PomodoroSettings => ({
  focusMinutes: Math.min(120, Math.max(1, Math.round(s.focusMinutes) || DEFAULT_POMODORO_SETTINGS.focusMinutes)),
  shortBreakMinutes: Math.min(60, Math.max(1, Math.round(s.shortBreakMinutes) || DEFAULT_POMODORO_SETTINGS.shortBreakMinutes)),
  longBreakMinutes: Math.min(60, Math.max(1, Math.round(s.longBreakMinutes) || DEFAULT_POMODORO_SETTINGS.longBreakMinutes)),
  blocksBeforeLongBreak: Math.min(12, Math.max(2, Math.round(s.blocksBeforeLongBreak) || DEFAULT_POMODORO_SETTINGS.blocksBeforeLongBreak)),
});

const loadSettings = (): PomodoroSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return clampSettings({ ...DEFAULT_POMODORO_SETTINGS, ...JSON.parse(stored) });
  } catch {}
  return DEFAULT_POMODORO_SETTINGS;
};

interface StoredTimerState {
  endTime: number | null;
  pausedTimeRemaining: number | null;
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  isLongBreak: boolean;
  completedBlocks: number;
}

export const FocusTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const focusSeconds = settings.focusMinutes * 60;

  const [timeRemaining, setTimeRemaining] = useState(focusSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [isLongBreak, setIsLongBreak] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completedMinutes, setCompletedMinutes] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const SUBJECT_STORAGE_KEY = "focus_timer_subject";
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(SUBJECT_STORAGE_KEY + "_id"); } catch { return null; }
  });
  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(() => {
    try { return sessionStorage.getItem(SUBJECT_STORAGE_KEY + "_name"); } catch { return null; }
  });
  const setSelectedSubject = useCallback((subject: { id: string; name: string } | null) => {
    setSelectedSubjectId(subject?.id ?? null);
    setSelectedSubjectName(subject?.name ?? null);
    try {
      if (subject) {
        sessionStorage.setItem(SUBJECT_STORAGE_KEY + "_id", subject.id);
        sessionStorage.setItem(SUBJECT_STORAGE_KEY + "_name", subject.name);
      } else {
        sessionStorage.removeItem(SUBJECT_STORAGE_KEY + "_id");
        sessionStorage.removeItem(SUBJECT_STORAGE_KEY + "_name");
      }
    } catch {}
  }, []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCompletedRef = useRef(false);

  const { open: openPiPHook, isOpen: pipOpen, pipContainer, isSupported: pipSupported } = useDocumentPiP({ width: 280, height: 320 });

  const openPiP = useCallback(async () => {
    try {
      await openPiPHook();
    } catch {
      toast.error("Seu navegador não suporta janela flutuante. Tente Chrome ou Edge.");
    }
  }, [openPiPHook]);

  // Load state from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const state: StoredTimerState = JSON.parse(stored);
        setIsBreak(state.isBreak || false);
        setIsLongBreak(state.isLongBreak || false);
        setCompletedBlocks(state.completedBlocks || 0);

        if (state.isRunning && state.endTime) {
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((state.endTime - now) / 1000));
          if (remaining > 0) {
            setTimeRemaining(remaining);
            setEndTime(state.endTime);
            setIsRunning(true);
            setIsPaused(false);
          } else {
            // Timer expired while away - handle completion
            handleTimerComplete(state.isBreak || false);
          }
        } else if (state.isPaused && state.pausedTimeRemaining !== null) {
          setTimeRemaining(state.pausedTimeRemaining);
          setIsRunning(false);
          setIsPaused(true);
        }
      } catch {
        // Invalid stored state, use defaults
      }
    }
  }, []);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    const state: StoredTimerState = {
      endTime: isRunning ? endTime : null,
      pausedTimeRemaining: isPaused ? timeRemaining : null,
      isRunning,
      isPaused,
      isBreak,
      isLongBreak,
      completedBlocks,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isRunning, isPaused, endTime, timeRemaining, isBreak, isLongBreak, completedBlocks]);

  const updateSettings = useCallback((next: PomodoroSettings) => {
    const clamped = clampSettings(next);
    setSettings(clamped);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(clamped)); } catch {}
  }, []);

  // When idle (not started), keep the displayed focus time in sync with settings
  useEffect(() => {
    if (!isRunning && !isPaused && !isBreak) {
      setTimeRemaining(settings.focusMinutes * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focusMinutes]);

  const handleTimerComplete = useCallback(async (wasBreak: boolean) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    const cfg = settingsRef.current;

    setIsRunning(false);
    setIsPaused(false);
    setIsCompleted(true);
    clearCurrentStudyInfo();

    if (!wasBreak && user) {
      // Registra atividade para a ofensiva
      await registerActivity(user.id);
      // Incrementa contador de Pomodoros para onboarding
      await incrementPomodoroCount(user.id);

      // Registra a sessão de foco no histórico
      if (sessionStartTime) {
        const created = await createFocusSession(
          user.id,
          sessionStartTime,
          cfg.focusMinutes,
          selectedSubjectId,
          null,
          0,
          0,
          { source: "pomodoro" }
        );
        setSessionStartTime(null);
        if (created?.id) {
          setCompletedSessionId(created.id);
          setCompletedMinutes(cfg.focusMinutes);
          setCompletionOpen(true);
        }
      }

      // Invalida os caches para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['user-streak', user.id] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-status', user.id] });
      queryClient.invalidateQueries({ queryKey: ['focus-sessions', user.id] });
      toast.success("🍅 Ciclo Pomodoro concluído! +1 para sua ofensiva.");
      logXP(user.id, "pomodoro_completed", XP.POMODORO_COMPLETED);
    }

    // Alterna para pausa ou foco
    if (!wasBreak) {
      const newCount = completedBlocks + 1;
      setCompletedBlocks(newCount);
      const isLong = newCount % cfg.blocksBeforeLongBreak === 0;
      setIsLongBreak(isLong);
      setIsBreak(true);
      if (isLong) {
        toast(`☕ Descanso longo! (${cfg.longBreakMinutes} min)`);
        setTimeRemaining(cfg.longBreakMinutes * 60);
      } else {
        toast(`☕ Hora do descanso! (${cfg.shortBreakMinutes} min)`);
        setTimeRemaining(cfg.shortBreakMinutes * 60);
      }
    } else {
      toast(`🍅 Voltar ao trabalho! (${cfg.focusMinutes} min)`);
      setTimeRemaining(cfg.focusMinutes * 60);
      setIsBreak(false);
      setIsLongBreak(false);
    }

    hasCompletedRef.current = false;
  }, [user, queryClient, sessionStartTime, selectedSubjectId, completedBlocks]);

  // Timer tick effect
  useEffect(() => {
    if (isRunning && endTime) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          handleTimerComplete(isBreak);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, endTime, isBreak, handleTimerComplete]);

  const currentDuration = useCallback(() => {
    if (!isBreak) return settings.focusMinutes * 60;
    return (isLongBreak ? settings.longBreakMinutes : settings.shortBreakMinutes) * 60;
  }, [isBreak, isLongBreak, settings]);

  const start = useCallback(() => {
    const now = Date.now();
    const duration = currentDuration();
    const newEndTime = now + duration * 1000;
    setEndTime(newEndTime);
    setTimeRemaining(duration);
    setIsRunning(true);
    setIsPaused(false);
    setIsCompleted(false);

    // Track session start time for focus sessions (not breaks)
    if (!isBreak) {
      setSessionStartTime(new Date());
      setCurrentStudyInfo({ source: "pomodoro", subject: "Pomodoro", startedAt: now });
      if (user) logXP(user.id, "pomodoro_started", XP.POMODORO_STARTED);
    } else {
      clearCurrentStudyInfo();
    }
  }, [isBreak, user, currentDuration]);

  const pause = useCallback(() => {
    setIsRunning(false);
    setIsPaused(true);
    setEndTime(null);
    clearCurrentStudyInfo();
  }, []);

  const resume = useCallback(() => {
    const now = Date.now();
    const newEndTime = now + timeRemaining * 1000;
    setEndTime(newEndTime);
    setIsRunning(true);
    setIsPaused(false);
    if (!isBreak) {
      setCurrentStudyInfo({ source: "pomodoro", subject: "Pomodoro", startedAt: now });
      if (user) logXP(user.id, "pomodoro_started", XP.POMODORO_STARTED);
    }
  }, [timeRemaining, isBreak, user]);

  const reset = useCallback(() => {
    setTimeRemaining(settings.focusMinutes * 60);
    setIsRunning(false);
    setIsPaused(false);
    setIsBreak(false);
    setIsLongBreak(false);
    setCompletedBlocks(0);
    setIsCompleted(false);
    setEndTime(null);
    setSessionStartTime(null);
    clearCurrentStudyInfo();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [settings.focusMinutes]);

  const totalTime = currentDuration();

  return (
    <FocusTimerContext.Provider
      value={{
        timeRemaining,
        isRunning,
        isPaused,
        isBreak,
        isLongBreak,
        completedBlocks,
        start,
        pause,
        resume,
        reset,
        totalTime,
        isCompleted,
        selectedSubjectId,
        selectedSubjectName,
        setSelectedSubject,
        settings,
        updateSettings,
        pipSupported,
        pipOpen,
        pipContainer,
        openPiP,
      }}
    >
      {children}
      <PomodoroCompletionDialog
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        sessionId={completedSessionId}
        subjectName={selectedSubjectName}
        durationMinutes={completedMinutes}
        onSaved={() => {
          if (user) {
            queryClient.invalidateQueries({ queryKey: ["focus-sessions", user.id] });
            queryClient.invalidateQueries({ queryKey: ["study-analytics"] });
          }
        }}
      />
    </FocusTimerContext.Provider>
  );
};

export const useFocusTimer = () => {
  const context = useContext(FocusTimerContext);
  if (context === undefined) {
    throw new Error("useFocusTimer must be used within a FocusTimerProvider");
  }
  return context;
};
