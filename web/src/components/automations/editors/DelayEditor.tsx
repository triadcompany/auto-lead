import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DelayEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const unitOptions = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
];

export function DelayEditor({ config, onChange }: DelayEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="font-poppins text-sm font-medium">Tempo de espera</Label>
        <Input
          type="number"
          min={1}
          className="mt-1.5"
          placeholder="1"
          value={config.amount || ""}
          onChange={(e) =>
            onChange({ ...config, amount: parseInt(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <Label className="font-poppins text-sm font-medium">Unidade</Label>
        <Select
          value={config.unit || "hours"}
          onValueChange={(v) => onChange({ ...config, unit: v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitOptions.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
