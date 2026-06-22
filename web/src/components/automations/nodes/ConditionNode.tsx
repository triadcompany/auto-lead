import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

const conditionLabels: Record<string, string> = {
  responded: "Respondeu mensagem",
  not_responded: "Não respondeu",
  clicked_button: "Clicou em botão",
  in_stage: "Está na etapa",
  has_tag: "Possui tag",
  has_email: "Tem e-mail",
};

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const label = conditionLabels[config.conditionType] || "Configurar condição";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected ? "border-emerald-500 shadow-emerald-500/20" : "border-emerald-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-emerald-500/10">
          <GitBranch className="h-4 w-4 text-emerald-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-emerald-500 uppercase tracking-wide">
          Condição
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">{label}</p>
      {config.value && (
        <p className="text-xs text-muted-foreground font-poppins mt-0.5 truncate">
          Valor: {config.value}
        </p>
      )}

      <div className="flex justify-between mt-3 px-1">
        <div className="relative flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-emerald-600 mb-1">
            ✓ Verdadeiro
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: 0, position: "relative" }}
            className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
        <div className="relative flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-red-500 mb-1">
            ✗ Falso
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: 0, position: "relative" }}
            className="!bg-red-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
      </div>
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";
