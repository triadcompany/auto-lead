import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GitMerge } from "lucide-react";

interface ReplyRouterEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const unitOptions = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
];

function keywordsToString(kws: string[] | undefined): string {
  return (kws || []).join(", ");
}

function stringToKeywords(str: string): string[] {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ReplyRouterEditor({ config, onChange }: ReplyRouterEditorProps) {
  return (
    <div className="space-y-4">
      <Alert className="border-violet-500/30 bg-violet-500/5">
        <GitMerge className="h-4 w-4 text-violet-500" />
        <AlertDescription className="text-xs font-poppins">
          Este bloco aguarda a resposta do lead e direciona o fluxo com base no que ele escrever.
          Configure as palavras-chave para cada ramo (separadas por vírgula).
        </AlertDescription>
      </Alert>

      <div>
        <Label className="font-poppins text-sm font-medium">
          <span className="text-green-600 font-semibold">Sim</span> — palavras-chave
        </Label>
        <Input
          className="mt-1.5"
          placeholder="1, sim, quero, s"
          value={keywordsToString(config.yes_keywords)}
          onChange={(e) =>
            onChange({ ...config, yes_keywords: stringToKeywords(e.target.value) })
          }
        />
        <p className="text-[11px] text-muted-foreground mt-1 font-poppins">
          Separadas por vírgula. Ignora maiúsculas e acentos.
        </p>
      </div>

      <div>
        <Label className="font-poppins text-sm font-medium">
          <span className="text-red-500 font-semibold">Não</span> — palavras-chave
        </Label>
        <Input
          className="mt-1.5"
          placeholder="2, não, nao, agora não, n"
          value={keywordsToString(config.no_keywords)}
          onChange={(e) =>
            onChange({ ...config, no_keywords: stringToKeywords(e.target.value) })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="font-poppins text-sm font-medium">Timeout</Label>
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
      </div>

      <div className="pt-2 space-y-2">
        <p className="text-xs font-poppins font-medium text-muted-foreground uppercase tracking-wide">
          Saídas do bloco
        </p>
        {[
          { color: "bg-green-500", label: "Sim — resposta bateu com o ramo Sim" },
          { color: "bg-red-500", label: "Não — resposta bateu com o ramo Não" },
          { color: "bg-slate-400", label: "Outro — resposta não reconhecida" },
          { color: "bg-amber-500", label: "Timeout — sem resposta no prazo" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-sm font-poppins">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
