import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FollowupEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const channelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
];

export function FollowupEditor({ config, onChange }: FollowupEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="font-poppins text-sm font-medium">Canal</Label>
        <Select
          value={config.channel || "whatsapp"}
          onValueChange={(v) => onChange({ ...config, channel: v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channelOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="font-poppins text-sm font-medium">
          Enviar após (horas)
        </Label>
        <Input
          type="number"
          min={0}
          className="mt-1.5"
          placeholder="0 = imediato"
          value={config.delay_hours ?? ""}
          onChange={(e) =>
            onChange({ ...config, delay_hours: parseInt(e.target.value) || 0 })
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          0 = imediato · 24 = 1 dia · 48 = 2 dias
        </p>
      </div>

      <div>
        <Label className="font-poppins text-sm font-medium">Mensagem</Label>
        <Textarea
          className="mt-1.5 min-h-[100px] font-poppins text-sm"
          placeholder="Olá {nome}, tudo bem? Aqui é {vendedor}..."
          value={config.message || ""}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Variáveis: {"{nome}"} · {"{vendedor}"} · {"{empresa}"}
        </p>
      </div>
    </div>
  );
}
