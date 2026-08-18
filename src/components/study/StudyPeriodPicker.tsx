import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STUDY_PERIOD_PRESETS,
  formatPeriodLabel,
  getPeriodFromPreset,
  normalizePeriod,
  type StudyPeriod,
  type StudyPeriodPreset,
} from "@/lib/studyPeriod";

interface StudyPeriodPickerProps {
  preset: StudyPeriodPreset;
  period: StudyPeriod;
  onChange: (preset: StudyPeriodPreset, period: StudyPeriod) => void;
  className?: string;
}

export function StudyPeriodPicker({
  preset,
  period,
  onChange,
  className,
}: StudyPeriodPickerProps) {
  const [open, setOpen] = React.useState(false);

  const handlePresetChange = (value: string) => {
    const next = value as StudyPeriodPreset;
    if (next === "custom") {
      onChange("custom", period);
      setOpen(true);
      return;
    }
    onChange(next, getPeriodFromPreset(next));
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;
    onChange("custom", normalizePeriod(range.from, range.to ?? range.from));
  };

  return (
    <div className={cn("flex flex-col sm:flex-row gap-2", className)}>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger
          className="w-full sm:w-[180px] h-9"
          aria-label="Selecionar período"
        >
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {STUDY_PERIOD_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full sm:w-auto h-9 justify-start text-left font-normal",
              preset === "custom" && "border-primary ring-1 ring-primary/30 text-primary"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{formatPeriodLabel(period)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={period.from}
            selected={{ from: period.from, to: period.to }}
            onSelect={handleCalendarSelect}
            numberOfMonths={1}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default StudyPeriodPicker;
