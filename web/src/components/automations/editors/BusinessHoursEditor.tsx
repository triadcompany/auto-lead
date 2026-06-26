import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BusinessHoursEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const DAYS = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const DEFAULT_SCHEDULE: Record<string, { enabled: boolean; start: string; end: string }> = {
  mon: { enabled: true, start: "09:00", end: "18:00" },
  tue: { enabled: true, start: "09:00", end: "18:00" },
  wed: { enabled: true, start: "09:00", end: "18:00" },
  thu: { enabled: true, start: "09:00", end: "18:00" },
  fri: { enabled: true, start: "09:00", end: "18:00" },
  sat: { enabled: false, start: "09:00", end: "13:00" },
  sun: { enabled: false, start: "09:00", end: "13:00" },
};

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/New_York", label: "Nova York (GMT-5)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
  { value: "UTC", label: "UTC" },
];

export function BusinessHoursEditor({ config, onChange }: BusinessHoursEditorProps) {
  const schedule = { ...DEFAULT_SCHEDULE, ...(config.schedule || {}) };
  const timezone = config.timezone || "America/Sao_Paulo";

  const updateDay = (
    day: string,
    field: "enabled" | "start" | "end",
    value: string | boolean
  ) => {
    onChange({
      ...config,
      schedule: {
        ...schedule,
        [day]: { ...schedule[day], [field]: value },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-poppins text-xs text-muted-foreground mb-2 block">
          Saída "Dentro" → horário comercial ativo
          <br />
          Saída "Fora" → fora do horário
        </Label>
      </div>

      <div>
        <Label className="font-poppins text-sm font-medium">Fuso horário</Label>
        <Select
          value={timezone}
          onValueChange={(v) => onChange({ ...config, timezone: v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="font-poppins text-sm font-medium mb-2 block">Horários por dia</Label>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = schedule[key] || DEFAULT_SCHEDULE[key];
            return (
              <div
                key={key}
                className={`border border-border rounded-lg p-2.5 transition-colors ${
                  day.enabled ? "bg-background" : "bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-poppins text-sm font-medium">{label}</Label>
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) => updateDay(key, "enabled", v)}
                  />
                </div>
                {day.enabled && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="font-poppins text-[10px] text-muted-foreground">Início</Label>
                      <Input
                        type="time"
                        className="mt-0.5 h-8 text-xs"
                        value={day.start}
                        onChange={(e) => updateDay(key, "start", e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="font-poppins text-[10px] text-muted-foreground">Fim</Label>
                      <Input
                        type="time"
                        className="mt-0.5 h-8 text-xs"
                        value={day.end}
                        onChange={(e) => updateDay(key, "end", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
