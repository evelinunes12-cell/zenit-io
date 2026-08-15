import { CalendarRange, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CyclePlanningFrequency } from "@/lib/studyCycleTiming";

/**
 * Planejamento temporal opcional, compartilhado entre Ciclo Simples e Avançado.
 * Persiste nas colunas já existentes (start_date / end_date / hours_per_day / hours_per_week).
 */
export interface CyclePlanningFormValue {
  startDate: string;
  endDate: string;
  frequency: CyclePlanningFrequency;
  /** Tempo planejado em horas, como texto (permite vazio). */
  hours: string;
}

export const emptyCyclePlanning: CyclePlanningFormValue = {
  startDate: "",
  endDate: "",
  frequency: "daily",
  hours: "",
};

interface CyclePlanningFieldsProps {
  value: CyclePlanningFormValue;
  onChange: (value: CyclePlanningFormValue) => void;
}

const CyclePlanningFields = ({ value, onChange }: CyclePlanningFieldsProps) => {
  const set = (patch: Partial<CyclePlanningFormValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold">Planejamento (opcional)</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Defina um período e uma dedicação planejada para acompanhar o ciclo no tempo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cycle-start-date" className="text-xs">Data de início</Label>
          <Input
            id="cycle-start-date"
            type="date"
            value={value.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cycle-end-date" className="text-xs">Data de fim</Label>
          <Input
            id="cycle-end-date"
            type="date"
            value={value.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Dedicação planejada
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <RadioGroup
            value={value.frequency}
            onValueChange={(v) => set({ frequency: v as CyclePlanningFrequency })}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="daily" id="cycle-freq-daily" />
              <Label htmlFor="cycle-freq-daily" className="text-sm font-normal cursor-pointer">Por dia</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="weekly" id="cycle-freq-weekly" />
              <Label htmlFor="cycle-freq-weekly" className="text-sm font-normal cursor-pointer">Por semana</Label>
            </div>
          </RadioGroup>

          <div className="flex items-center gap-2 sm:ml-auto">
            <Input
              id="cycle-planned-hours"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder="Ex: 2.5"
              aria-label="Tempo planejado em horas"
              value={value.hours}
              onChange={(e) => set({ hours: e.target.value })}
              className="w-28"
            />
            <span className="text-xs text-muted-foreground">horas</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CyclePlanningFields;
