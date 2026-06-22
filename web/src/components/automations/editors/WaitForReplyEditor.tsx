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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquareReply } from "lucide-react";

interface WaitForReplyEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const unitOptions = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
];

export function WaitForReplyEditor({ config, onChange }: WaitForReplyEditorProps) {
  return (
    <div className="space-y-4">
      <Alert className="border-cyan-500/30 bg-cyan-500/5">
        <MessageSquareReply className="h-4 w-4 text-cyan-500" />
        <AlertDescription className="text-xs font-poppins">
          Este bloco pausa o fluxo e aguarda uma resposta do lead no WhatsApp. 
          Se o lead responder, segue pelo caminho <strong>"Respondeu"</strong>. 
          Caso contrário, após o timeout, segue pelo caminho <strong>"Timeout"</strong>.
        </AlertDescription>
      </Alert>

      <div>
        <Label className="font-poppins text-sm font-medium">Tempo de timeout</Label>
        <Input
          type="number"
          min={1}
          className="mt-1.5"
          placeholder="24"
          value={config.timeout_amount || ""}
          onChange={(e) =>
            onChange({ ...config, timeout_amount: parseInt(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <Label className="font-poppins text-sm font-medium">Unidade</Label>
        <Select
          value={config.timeout_unit || "hours"}
          onValueChange={(v) => onChange({ ...config, timeout_unit: v })}
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

      <div className="pt-2 space-y-2">
        <p className="text-xs font-poppins font-medium text-muted-foreground uppercase tracking-wide">
          Saídas do bloco
        </p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
          <span className="text-sm font-poppins">Respondeu — lead enviou mensagem</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-poppins">Timeout — sem resposta no prazo</span>
        </div>
      </div>
    </div>
  );
}
