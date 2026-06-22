import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

interface MessageEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const VARIABLES = [
  { key: "{{lead.name}}", label: "Nome do lead" },
  { key: "{{lead.phone}}", label: "Telefone" },
  { key: "{{lead.email}}", label: "E-mail" },
  { key: "{{lead.source}}", label: "Origem" },
  { key: "{{org.name}}", label: "Nome da empresa" },
];

export function MessageEditor({ config, onChange }: MessageEditorProps) {
  const buttons: Array<{ label: string; payload: string }> = config.buttons || [];

  const insertVariable = (variable: string) => {
    const text = (config.text || "") + " " + variable;
    onChange({ ...config, text: text.trim() });
  };

  const addButton = () => {
    onChange({
      ...config,
      buttons: [...buttons, { label: "", payload: "" }],
    });
  };

  const updateButton = (index: number, field: "label" | "payload", value: string) => {
    const updated = buttons.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    );
    onChange({ ...config, buttons: updated });
  };

  const removeButton = (index: number) => {
    onChange({ ...config, buttons: buttons.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-poppins text-sm font-medium">Texto da mensagem</Label>
        <Textarea
          className="mt-1.5 min-h-[120px] font-poppins text-sm"
          placeholder="Digite a mensagem que será enviada..."
          value={config.text || ""}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
        />
      </div>

      <div>
        <Label className="font-poppins text-xs text-muted-foreground">
          Variáveis disponíveis
        </Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {VARIABLES.map((v) => (
            <Badge
              key={v.key}
              variant="outline"
              className="cursor-pointer hover:bg-accent text-xs font-poppins"
              onClick={() => insertVariable(v.key)}
            >
              {v.key}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="font-poppins text-sm font-medium">
            Botões (opcional)
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addButton}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </div>
        {buttons.length > 0 && (
          <div className="space-y-2 mt-2">
            {buttons.map((btn, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input
                    placeholder="Texto do botão"
                    className="h-8 text-xs"
                    value={btn.label}
                    onChange={(e) => updateButton(i, "label", e.target.value)}
                  />
                  <Input
                    placeholder="Payload (ex: sim, nao)"
                    className="h-8 text-xs"
                    value={btn.payload}
                    onChange={(e) => updateButton(i, "payload", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => removeButton(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
