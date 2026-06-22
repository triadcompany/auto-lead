import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";

const unitLabels: Record<string, string> = {
  minutes: "minutos",
  hours: "horas",
  days: "dias",
};

export const DelayNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const label = config.amount
    ? `${config.amount} ${unitLabels[config.unit] || config.unit}`
    : "Configurar espera";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected ? "border-purple-500 shadow-purple-500/20" : "border-purple-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-purple-500/10">
          <Clock className="h-4 w-4 text-purple-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-purple-500 uppercase tracking-wide">
          Espera
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">{label}</p>
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
});

DelayNode.displayName = "DelayNode";
