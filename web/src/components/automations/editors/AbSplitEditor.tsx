import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AbSplitEditorProps {
  config: any;
  onChange: (config: any) => void;
}

export function AbSplitEditor({ config, onChange }: AbSplitEditorProps) {
  const splitA = config.split_a ?? 50;
  const splitB = 100 - splitA;

  const handleChange = (val: string) => {
    const n = Math.min(99, Math.max(1, parseInt(val) || 50));
    onChange({ ...config, split_a: n });
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground font-poppins">
        O lead é enviado aleatoriamente para o caminho A ou B com as probabilidades definidas abaixo. Útil para testar variações de mensagem.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 text-center">
          <Label className="font-poppins text-xs font-bold text-blue-500 block mb-2">
            Caminho A
          </Label>
          <div className="flex items-center gap-1 justify-center">
            <Input
              type="number"
              min={1}
              max={99}
              className="h-9 text-center text-lg font-bold w-16"
              value={splitA}
              onChange={(e) => handleChange(e.target.value)}
            />
            <span className="text-lg font-bold text-muted-foreground">%</span>
          </div>
        </div>

        <div className="border border-purple-500/30 bg-purple-500/5 rounded-lg p-3 text-center">
          <Label className="font-poppins text-xs font-bold text-purple-500 block mb-2">
            Caminho B
          </Label>
          <div className="flex items-center gap-1 justify-center">
            <span className="text-lg font-bold text-foreground">{splitB}</span>
            <span className="text-lg font-bold text-muted-foreground">%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">calculado automaticamente</p>
        </div>
      </div>

      <div>
        <input
          type="range"
          min={1}
          max={99}
          value={splitA}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full accent-pink-500"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>1%</span>
          <span>50/50</span>
          <span>99%</span>
        </div>
      </div>
    </div>
  );
}
