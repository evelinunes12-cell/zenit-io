import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { StudyCycle, saveCycleProgress, incrementCycleElapsedTime, resetCycleElapsedTime } from "@/services/studyCycles";
import { createFocusSession, updateFocusSession } from "@/services/focusSessions";
import { registerActivity } from "@/services/activity";
import { logXP, XP } from "@/services/scoring";
import { useAuth } from "@/hooks/useAuth";
import { setCurrentStudyInfo, clearCurrentStudyInfo } from "@/lib/studyPresence";
import { toast } from "sonner";
import { useDocumentPiP } from "@/hooks/useDocumentPiP";

const BREAK_SECONDS = 300;

/**
 * Persists the focus_session id for the block currently being studied so the
 * record survives provider remounts (navigation / PiP / tab switches). This
 * guarantees ONE record per block instead of fragmented 1-min records.
 */
const ACTIVE_SESSION_KEY = "zenit_cycle_active_session";
interface ActiveSessionMarker {
  cycleId: string;
  blockIndex: number;
  sessionId: string;
}
const readActiveSession = (cycleId: string, blockIndex: number): string | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as ActiveSessionMarker;
    if (m.cycleId === cycleId && m.blockIndex === blockIndex && m.sessionId) {
      return m.sessionId;
    }
  } catch {
    // ignore
  }
  return null;
};
const writeActiveSession = (cycleId: string, blockIndex: number, sessionId: string) => {
  try {
    localStorage.setItem(
      ACTIVE_SESSION_KEY,
      JSON.stringify({ cycleId, blockIndex, sessionId } satisfies ActiveSessionMarker)
    );
  } catch {
    // ignore
  }
};
const clearActiveSession = () => {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore
  }
};

export type CycleMode = "study" | "break";

interface StudyCyclePlayerContextValue {
  cycle: StudyCycle | null;
  isExpanded: boolean;
  currentIndex: number;
  elapsedSeconds: number;
  breakRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  mode: CycleMode;
  targetReached: boolean;
  completedBlocks: Set<number>;
  pipSupported: boolean;
  pipOpen: boolean;
  pipContainer: HTMLElement | null;

  playCycle: (cycle: StudyCycle) => void;
  collapse: () => void;
  expand: () => void;
  closePlayer: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  togglePlayPause: () => void;
  completeBlock: (questions?: { total: number; correct: number }) => Promise<void>;
  skip: () => void;
  restart: () => void;
  goToBlock: (idx: number) => void;
  setManualLogged: (args: { blockIndex: number; markCompleted: boolean }) => void;
  openPiP: () => Promise<void>;
}

const Ctx = createContext<StudyCyclePlayerContextValue | undefined>(undefined);

export const StudyCyclePlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cycle, setCycle] = useState<StudyCycle | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<CycleMode>("study");
  const [targetReached, setTargetReached] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState<Set<number>>(new Set());
  const [breakRemaining, setBreakRemaining] = useState(BREAK_SECONDS);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const elapsedAtStartRef = useRef(0);
  const breakEndTimeRef = useRef<number | null>(null);
  /** Total seconds (within current block) already persisted to DB. */
  const lastSavedElapsedRef = useRef(0);
  /** Latest elapsedSeconds value, kept in a ref to use in cleanup/listeners. */
  const elapsedSecondsRef = useRef(0);
  const cycleRef = useRef<StudyCycle | null>(null);
  const currentIndexRef = useRef(0);
  const modeRef = useRef<CycleMode>("study");
  const userIdRef = useRef<string | null>(null);
  const currentBlockRef = useRef<any>(null);
  /** Focus session id for the block currently being studied (one record per block). */
  const currentBlockSessionIdRef = useRef<string | null>(null);
  /**
   * Seconds of this block already registered by PREVIOUS focus sessions
   * (e.g. the block was paused/closed and is now being resumed). The current
   * session must only register the time studied after this baseline.
   */
  const sessionBaseSecondsRef = useRef(0);


  const { open: openPiPHook, isOpen: pipOpen, pipContainer, isSupported: pipSupported } = useDocumentPiP({ width: 280, height: 320 });

  const blocks = cycle?.blocks || [];
  const currentBlock = blocks[currentIndex];
  const isBreak = mode === "break";
  const targetSeconds = currentBlock ? currentBlock.allocated_minutes * 60 : 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
    breakEndTimeRef.current = null;
  }, []);

  // Keep refs in sync for use in cleanup/listeners
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { cycleRef.current = cycle; }, [cycle]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { userIdRef.current = user?.id || null; }, [user]);
  useEffect(() => { currentBlockRef.current = currentBlock; }, [currentBlock]);

  /**
   * Persists studied time for the current block WITHOUT fragmenting it:
   * - increments current_block_elapsed_time in the DB (for resume)
   * - keeps a SINGLE focus_session per block, updated to the total elapsed time
   *   (block-based record instead of one record per minute)
   * - registers daily activity / streak
   */
  const saveProgressAndLogTime = useCallback(async () => {
    const c = cycleRef.current;
    if (!c) return;
    if (modeRef.current !== "study") return;
    const totalElapsed = elapsedSecondsRef.current;
    if (totalElapsed <= 0) return;

    // Persist resume time to the cycle (delta vs last saved)
    const unsavedSec = totalElapsed - lastSavedElapsedRef.current;
    if (unsavedSec > 0) {
      try {
        await incrementCycleElapsedTime(c.id, unsavedSec);
        lastSavedElapsedRef.current = totalElapsed;
      } catch {
        // keep baseline so it can retry next time
      }
    }

    // Upsert a SINGLE focus session covering only THIS study session of the block
    const uid = userIdRef.current;
    if (!uid) return;
    // Only the time studied after the baseline already registered previously
    const sessionElapsed = totalElapsed - sessionBaseSecondsRef.current;
    if (sessionElapsed <= 0) return;
    const minutes = Math.max(1, Math.round(sessionElapsed / 60));
    const block = currentBlockRef.current;
    const blockIdx = currentIndexRef.current;
    const startedAt = new Date(Date.now() - sessionElapsed * 1000);

    try {
      // Resolve the block's session id from memory or persisted marker so a
      // remount never causes a new fragmented record.
      const sessionId = currentBlockSessionIdRef.current || readActiveSession(c.id, blockIdx);
      if (sessionId) {
        await updateFocusSession(sessionId, {
          startedAt,
          durationMinutes: minutes,
        });
        currentBlockSessionIdRef.current = sessionId;
        writeActiveSession(c.id, blockIdx, sessionId);
      } else {
        const created = await createFocusSession(uid, startedAt, minutes, block?.subject_id, c.id);
        currentBlockSessionIdRef.current = created?.id ?? null;
        if (created?.id) writeActiveSession(c.id, blockIdx, created.id);
      }
      await registerActivity(uid);
    } catch {
      // silent
    }
  }, []);

  const persistProgress = useCallback(async (cycleId: string, blockIdx: number) => {
    try {
      await saveCycleProgress(cycleId, blockIdx, null);
    } catch {
      // silent
    }
  }, []);

  const playAlarm = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // silent
    }
  }, []);

  const playCycle = useCallback((newCycle: StudyCycle) => {
    clearTimer();
    const savedIndex = Math.min(newCycle.current_block_index || 0, Math.max((newCycle.blocks?.length || 1) - 1, 0));
    const set = new Set<number>();
    for (let i = 0; i < savedIndex; i++) set.add(i);
    const savedElapsed = Math.max(0, newCycle.current_block_elapsed_time || 0);
    setCycle(newCycle);
    setCurrentIndex(savedIndex);
    setCompletedBlocks(set);
    setElapsedSeconds(savedElapsed);
    lastSavedElapsedRef.current = savedElapsed;
    currentBlockSessionIdRef.current = null;
    setBreakRemaining(BREAK_SECONDS);
    setMode("study");
    setIsRunning(false);
    setIsPaused(false);
    setTargetReached(false);
    setIsExpanded(true);
  }, [clearTimer]);

  const collapse = useCallback(() => setIsExpanded(false), []);
  const expand = useCallback(() => setIsExpanded(true), []);

  const closePlayer = useCallback(() => {
    clearTimer();
    clearCurrentStudyInfo();
    // Save any in-flight time before tearing down
    void saveProgressAndLogTime();
    if (cycle && mode === "study") {
      persistProgress(cycle.id, currentIndex);
    }
    setIsExpanded(false);
    setCycle(null);
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    lastSavedElapsedRef.current = 0;
    currentBlockSessionIdRef.current = null;
    setMode("study");
  }, [clearTimer, cycle, mode, currentIndex, persistProgress, saveProgressAndLogTime]);

  const startTimer = useCallback(() => {
    if (!cycle) return;
    if (isBreak) {
      breakEndTimeRef.current = Date.now() + breakRemaining * 1000;
      clearCurrentStudyInfo();
    } else {
      startTimeRef.current = Date.now();
      elapsedAtStartRef.current = elapsedSeconds;
      const subjName = currentBlock?.subject?.name?.trim();
      if (subjName) {
        setCurrentStudyInfo({
          source: "cycle",
          subject: subjName,
          startedAt: Date.now() - elapsedSeconds * 1000,
        });
      }
      if (user) logXP(user.id, "study_block_started", XP.STUDY_BLOCK_STARTED);
    }
    setIsRunning(true);
    setIsPaused(false);
  }, [cycle, isBreak, breakRemaining, elapsedSeconds, currentBlock, user]);

  const pauseTimer = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setIsPaused(true);
    clearCurrentStudyInfo();
    if (cycle && mode === "study") {
      persistProgress(cycle.id, currentIndex);
      void saveProgressAndLogTime();
    }
  }, [clearTimer, cycle, mode, currentIndex, persistProgress, saveProgressAndLogTime]);

  const togglePlayPause = useCallback(() => {
    if (isRunning) pauseTimer();
    else startTimer();
  }, [isRunning, pauseTimer, startTimer]);

  const advanceToNextBlock = useCallback(() => {
    if (!cycle) return;
    const nextIdx = currentIndex + 1 < blocks.length ? currentIndex + 1 : 0;
    setCurrentIndex(nextIdx);
    setElapsedSeconds(0);
    lastSavedElapsedRef.current = 0;
    currentBlockSessionIdRef.current = null;
    clearActiveSession();
    setTargetReached(false);
    setMode("study");
    setIsRunning(false);
    setIsPaused(false);
    persistProgress(cycle.id, nextIdx);
    resetCycleElapsedTime(cycle.id).catch(() => {});
  }, [cycle, currentIndex, blocks.length, persistProgress]);

  const completeBlock = useCallback(async (questions?: { total: number; correct: number }) => {
    if (!cycle) return;
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    clearCurrentStudyInfo();

    const realElapsed = elapsedSeconds; // total accumulated for this block
    const realMinutes = Math.max(1, Math.round(realElapsed / 60));
    // Seconds not yet persisted to the cycle (for resume tracking)
    const unsavedSec = Math.max(0, realElapsed - lastSavedElapsedRef.current);

    const qTotal = Math.max(0, Math.floor(questions?.total || 0));
    let qCorrect = Math.max(0, Math.floor(questions?.correct || 0));
    if (qCorrect > qTotal) qCorrect = qTotal;

    const target = (blocks[currentIndex]?.allocated_minutes || 0) * 60;
    const blockFinished = target > 0 ? realElapsed >= target : realElapsed > 0;

    // Upsert the SINGLE block record with the full studied time + questions
    if (user && (realElapsed > 0 || qTotal > 0)) {
      await registerActivity(user.id);
      const block = blocks[currentIndex];
      const minutes = realElapsed > 0 ? realMinutes : 0;
      const startedAt = new Date(Date.now() - Math.max(realElapsed, 1) * 1000);
      try {
        const sessionId = currentBlockSessionIdRef.current || readActiveSession(cycle.id, currentIndex);
        if (sessionId) {
          await updateFocusSession(sessionId, {
            startedAt,
            durationMinutes: minutes,
            questionsTotal: qTotal,
            questionsCorrect: qCorrect,
            subjectId: block?.subject_id ?? null,
          });
          currentBlockSessionIdRef.current = sessionId;
          if (!blockFinished) writeActiveSession(cycle.id, currentIndex, sessionId);
        } else {
          const created = await createFocusSession(
            user.id,
            startedAt,
            minutes,
            block?.subject_id,
            cycle.id,
            qTotal,
            qCorrect,
          );
          currentBlockSessionIdRef.current = created?.id ?? null;
          if (created?.id && !blockFinished) writeActiveSession(cycle.id, currentIndex, created.id);
        }
      } catch {
        // silent
      }
    }

    if (!blockFinished) {
      // Condition A: Fractional study — persist delta, keep block active, exit player.
      // The single block record stays open and continues updating on resume.
      if (unsavedSec > 0) {
        try {
          await incrementCycleElapsedTime(cycle.id, unsavedSec);
        } catch {
          // silent
        }
      }
      lastSavedElapsedRef.current = realElapsed;
      const remainingMin = Math.max(0, Math.ceil((target - realElapsed) / 60));
      toast.success(
        `⏸️ ${currentBlock?.subject?.name || "Bloco"} pausado (${realMinutes}min). Faltam ~${remainingMin}min — você retoma de onde parou.`
      );
      // Update in-memory cycle so reopening reflects new accumulated time
      setCycle((prev) => prev ? { ...prev, current_block_elapsed_time: realElapsed } : prev);
      setIsExpanded(false);
      return;
    }

    // Condition B: Block completed (target reached or overtime) — finalize and advance
    setCompletedBlocks((prev) => new Set(prev).add(currentIndex));
    if (user) {
      logXP(user.id, "study_block_completed", XP.STUDY_BLOCK_COMPLETED);
    }
    try {
      await resetCycleElapsedTime(cycle.id);
    } catch {
      // silent
    }
    lastSavedElapsedRef.current = 0;
    currentBlockSessionIdRef.current = null; // next block starts a fresh record
    clearActiveSession();
    setCycle((prev) => prev ? { ...prev, current_block_elapsed_time: 0 } : prev);

    toast.success(`✅ ${currentBlock?.subject?.name || "Bloco"} concluído! (${realMinutes}min)`);

    setMode("break");
    setBreakRemaining(BREAK_SECONDS);
    setElapsedSeconds(0);
    setTargetReached(false);
  }, [cycle, currentIndex, elapsedSeconds, user, blocks, currentBlock, clearTimer]);

  const handleBreakComplete = useCallback(() => {
    if (!cycle) return;
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    playAlarm();
    if (completedBlocks.size >= blocks.length) {
      toast.success("🎉 Ciclo completo! Parabéns!");
      setMode("study");
      persistProgress(cycle.id, 0);
      return;
    }
    advanceToNextBlock();
  }, [cycle, clearTimer, completedBlocks, blocks.length, advanceToNextBlock, persistProgress, playAlarm]);

  const skip = useCallback(async () => {
    if (!cycle) return;
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    if (isBreak) {
      advanceToNextBlock();
      return;
    }
    // Finalize the current block as a single record before switching, then
    // clear the marker so the next block starts a fresh record.
    await saveProgressAndLogTime();
    currentBlockSessionIdRef.current = null;
    clearActiveSession();
    setCompletedBlocks((prev) => new Set(prev).add(currentIndex));
    if (currentIndex < blocks.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setElapsedSeconds(0);
      lastSavedElapsedRef.current = 0;
      setTargetReached(false);
      persistProgress(cycle.id, nextIdx);
      resetCycleElapsedTime(cycle.id).catch(() => {});
    } else {
      toast.success("🎉 Ciclo completo!");
      persistProgress(cycle.id, 0);
      resetCycleElapsedTime(cycle.id).catch(() => {});
      lastSavedElapsedRef.current = 0;
    }
  }, [cycle, clearTimer, isBreak, advanceToNextBlock, currentIndex, blocks.length, persistProgress, saveProgressAndLogTime]);

  const restart = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    setTargetReached(false);
    if (isBreak) {
      setBreakRemaining(BREAK_SECONDS);
    } else {
      setElapsedSeconds(0);
      lastSavedElapsedRef.current = 0;
      currentBlockSessionIdRef.current = null;
      clearActiveSession();
      if (cycle) resetCycleElapsedTime(cycle.id).catch(() => {});
    }
  }, [clearTimer, isBreak, cycle]);

  const goToBlock = useCallback(async (index: number) => {
    if (!cycle || isBreak) return;
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    // Finalize current block's record before switching, then clear the marker.
    await saveProgressAndLogTime();
    currentBlockSessionIdRef.current = null;
    clearActiveSession();
    setCurrentIndex(index);
    setElapsedSeconds(0);
    lastSavedElapsedRef.current = 0;
    setTargetReached(false);
    persistProgress(cycle.id, index);
    resetCycleElapsedTime(cycle.id).catch(() => {});
  }, [cycle, isBreak, clearTimer, persistProgress, saveProgressAndLogTime]);

  const setManualLogged = useCallback(({ blockIndex, markCompleted }: { blockIndex: number; markCompleted: boolean }) => {
    if (!cycle || !markCompleted || blockIndex < 0) return;
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    setCompletedBlocks((prev) => new Set(prev).add(blockIndex));
    if (blockIndex === currentIndex) {
      const nextIdx = currentIndex + 1 < blocks.length ? currentIndex + 1 : 0;
      setCurrentIndex(nextIdx);
      setElapsedSeconds(0);
      lastSavedElapsedRef.current = 0;
      currentBlockSessionIdRef.current = null;
      clearActiveSession();
      setTargetReached(false);
      setMode("study");
      saveCycleProgress(cycle.id, nextIdx, null).catch(() => {});
      resetCycleElapsedTime(cycle.id).catch(() => {});
    }
  }, [cycle, currentIndex, blocks.length, clearTimer]);

  // Study tick
  useEffect(() => {
    if (isRunning && !isBreak && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = elapsedAtStartRef.current + Math.floor((now - startTimeRef.current!) / 1000);
        setElapsedSeconds(elapsed);
      }, 250);
    }
    return () => {
      if (intervalRef.current && !isBreak) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isBreak]);

  // Break tick
  useEffect(() => {
    if (isRunning && isBreak && breakEndTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((breakEndTimeRef.current! - now) / 1000));
        setBreakRemaining(remaining);
      }, 250);
    }
    return () => {
      if (intervalRef.current && isBreak) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isBreak]);

  // Target reached
  useEffect(() => {
    if (!isBreak && elapsedSeconds >= targetSeconds && targetSeconds > 0 && !targetReached && isRunning) {
      setTargetReached(true);
      playAlarm();
      toast.success("⏰ Tempo planejado concluído! Você está no tempo extra.");
    }
  }, [elapsedSeconds, targetSeconds, targetReached, isBreak, isRunning, playAlarm]);

  // Break complete
  useEffect(() => {
    if (isRunning && isBreak && breakRemaining <= 0 && breakEndTimeRef.current) {
      handleBreakComplete();
    }
  }, [isRunning, isBreak, breakRemaining, handleBreakComplete]);

  const openPiP = useCallback(async () => {
    try {
      await openPiPHook();
    } catch {
      toast.error("Seu navegador não suporta janela flutuante. Tente Chrome ou Edge.");
    }
  }, [openPiPHook]);

  // Persist progress when the user closes the tab / switches away,
  // and as a final safety net when the provider unmounts.
  useEffect(() => {
    const flush = () => { void saveProgressAndLogTime(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [saveProgressAndLogTime]);


  const value: StudyCyclePlayerContextValue = {
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
    playCycle,
    collapse,
    expand,
    closePlayer,
    startTimer,
    pauseTimer,
    togglePlayPause,
    completeBlock,
    skip,
    restart,
    goToBlock,
    setManualLogged,
    openPiP,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useStudyCyclePlayer = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudyCyclePlayer must be used within StudyCyclePlayerProvider");
  return ctx;
};
