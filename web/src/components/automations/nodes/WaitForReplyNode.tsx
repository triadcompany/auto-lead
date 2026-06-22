import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquareReply } from "lucide-react";

const unitLabels: Record<string, string> = {
  minutes: "min",
  hours: "h",
  days: "dias",
};

export const WaitForReplyNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const timeoutLabel = config.timeout_amount
    ? `Timeout: ${config.timeout_amount}${unitLabels[config.timeout_unit] || config.timeout_unit}`
    : "Configurar timeout";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected ? "border-cyan-500 shadow-cyan-500/20" : "border-cyan-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-cyan-500/10">
          <MessageSquareReply className="h-4 w-4 text-cyan-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-cyan-500 uppercase tracking-wide">
          Esperar Resposta
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">{timeoutLabel}</p>

      <div className="flex justify-between mt-3 px-1">
        <div className="relative flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-cyan-600 mb-1">
            ✓ Respondeu
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="replied"
            style={{ left: 0, position: "relative" }}
            className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
        <div className="relative flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-red-500 mb-1">
            ⏰ Timeout
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            style={{ left: 0, position: "relative" }}
            className="!bg-red-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
      </div>
    </div>
  );
});

WaitForReplyNode.displayName = "WaitForReplyNode";
