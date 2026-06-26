import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";

export const BusinessHoursNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected ? "border-teal-500 shadow-teal-500/20" : "border-teal-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-teal-500/10">
          <Clock className="h-4 w-4 text-teal-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-teal-500 uppercase tracking-wide">
          Horário
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">Horário Comercial</p>

      <div className="flex justify-between mt-3 px-2">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-teal-500 mb-1">Dentro</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="within"
            style={{ left: 0, position: "relative" }}
            className="!bg-teal-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-orange-500 mb-1">Fora</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="outside"
            style={{ left: 0, position: "relative" }}
            className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
      </div>
    </div>
  );
});

BusinessHoursNode.displayName = "BusinessHoursNode";
