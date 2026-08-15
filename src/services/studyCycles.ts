import { supabase } from "@/integrations/supabase/client";

export interface StudyCycle {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  current_block_index: number;
  current_block_remaining_seconds: number | null;
  start_date: string | null;
  end_date: string | null;
  is_advanced: boolean;
  hours_per_day: number | null;
  hours_per_week: number | null;
  current_block_elapsed_time?: number | null;
  blocks?: StudyCycleBlock[];
}

export interface StudyCycleBlock {
  id: string;
  cycle_id: string;
  subject_id: string;
  allocated_minutes: number;
  order_index: number;
  subject?: { name: string; color: string | null };
}

export interface NewBlock {
  subject_id: string;
  allocated_minutes: number;
}

/**
 * Planejamento temporal compartilhado entre Ciclos Simples e Avançados.
 * Reutiliza as colunas já existentes em `study_cycles`:
 * start_date / end_date / hours_per_day / hours_per_week.
 * A frequência (`daily` | `weekly`) é derivada de qual coluna de horas está preenchida.
 */
export interface CyclePlanningMetadata {
  start_date?: string | null;
  end_date?: string | null;
  hours_per_day?: number | null;
  hours_per_week?: number | null;
  /** true apenas para ciclos gerados pelo wizard avançado. */
  is_advanced?: boolean;
}

export type AdvancedCycleMetadata = CyclePlanningMetadata & {
  start_date: string;
  end_date: string;
};


export const fetchStudyCycles = async (): Promise<StudyCycle[]> => {
  const { data, error } = await supabase
    .from("study_cycles")
    .select("*, study_cycle_blocks(*, subjects(name, color))")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((cycle) => ({
    ...cycle,
    blocks: (cycle.study_cycle_blocks || [])
      .map((b: any) => ({
        id: b.id,
        cycle_id: b.cycle_id,
        subject_id: b.subject_id,
        allocated_minutes: b.allocated_minutes,
        order_index: b.order_index,
        subject: b.subjects,
      }))
      .sort((a: StudyCycleBlock, b: StudyCycleBlock) => a.order_index - b.order_index),
  }));
};

export const createStudyCycle = async (
  userId: string,
  name: string,
  blocks: NewBlock[],
  advancedMeta?: AdvancedCycleMetadata
): Promise<StudyCycle> => {
  const insertData: any = { user_id: userId, name };
  if (advancedMeta) {
    insertData.is_advanced = true;
    insertData.start_date = advancedMeta.start_date;
    insertData.end_date = advancedMeta.end_date;
    if (advancedMeta.hours_per_day != null) insertData.hours_per_day = advancedMeta.hours_per_day;
    if (advancedMeta.hours_per_week != null) insertData.hours_per_week = advancedMeta.hours_per_week;
  }

  const { data: cycle, error: cycleError } = await supabase
    .from("study_cycles")
    .insert(insertData)
    .select()
    .single();

  if (cycleError) throw cycleError;

  if (blocks.length > 0) {
    const blockRows = blocks.map((b, i) => ({
      cycle_id: cycle.id,
      subject_id: b.subject_id,
      allocated_minutes: b.allocated_minutes,
      order_index: i,
    }));

    const { error: blocksError } = await supabase
      .from("study_cycle_blocks")
      .insert(blockRows);

    if (blocksError) throw blocksError;
  }

  return cycle as StudyCycle;
};

export const updateStudyCycle = async (
  cycleId: string,
  name: string,
  blocks: NewBlock[]
) => {
  const { error: cycleError } = await supabase
    .from("study_cycles")
    .update({ name, current_block_index: 0, current_block_remaining_seconds: null })
    .eq("id", cycleId);

  if (cycleError) throw cycleError;

  // Delete old blocks then insert new ones
  const { error: deleteError } = await supabase
    .from("study_cycle_blocks")
    .delete()
    .eq("cycle_id", cycleId);

  if (deleteError) throw deleteError;

  if (blocks.length > 0) {
    const blockRows = blocks.map((b, i) => ({
      cycle_id: cycleId,
      subject_id: b.subject_id,
      allocated_minutes: b.allocated_minutes,
      order_index: i,
    }));

    const { error: insertError } = await supabase
      .from("study_cycle_blocks")
      .insert(blockRows);

    if (insertError) throw insertError;
  }
};

export const deleteStudyCycle = async (cycleId: string) => {
  const { error } = await supabase
    .from("study_cycles")
    .delete()
    .eq("id", cycleId);

  if (error) throw error;
};

export const toggleCycleActive = async (cycleId: string, isActive: boolean) => {
  const { error } = await supabase
    .from("study_cycles")
    .update({ is_active: isActive })
    .eq("id", cycleId);

  if (error) throw error;
};

export const saveCycleProgress = async (
  cycleId: string,
  currentBlockIndex: number,
  remainingSeconds: number | null
) => {
  const { error } = await supabase
    .from("study_cycles")
    .update({
      current_block_index: currentBlockIndex,
      current_block_remaining_seconds: remainingSeconds,
    })
    .eq("id", cycleId);

  if (error) throw error;
};

export const incrementCycleElapsedTime = async (cycleId: string, seconds: number) => {
  if (!seconds || seconds <= 0) return;
  const { error } = await (supabase.rpc as any)("increment_cycle_elapsed_time", {
    _cycle_id: cycleId,
    _seconds: Math.round(seconds),
  });
  if (error) throw error;
};

export const resetCycleElapsedTime = async (cycleId: string) => {
  const { error } = await (supabase.rpc as any)("reset_cycle_elapsed_time", {
    _cycle_id: cycleId,
  });
  if (error) throw error;
};
