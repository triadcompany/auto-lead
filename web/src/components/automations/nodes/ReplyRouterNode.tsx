import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitMerge } from "lucide-react";

const unitLabels: Record<string, string> = {
  minutes: "min",
  hours: "h",
  days: "dias",
};

export const ReplyRouterNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const yesKeywords = (config.yes_keywords || ["1", "sim"]).join(", ");
  const noKeywords = (config.no_keywords || ["2", "não"]).join(", ");
  const timeoutLabel = config.timeout_amount
    ? `Timeout: ${config.timeout_amount}${unitLabels[config.timeout_unit] || config.timeout_unit}`
    : "Timeout: 24h";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[240px] ${
        selected ? "border-violet-500 shadow-violet-500/20" : "border-violet-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-500 !w-3 !h-3 !border-2 !border-background"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-violet-500/10">
          <GitMerge className="h-4 w-4 text-violet-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-violet-500 uppercase tracking-wide">
          Rotear por Resposta
        </span>
      </div>

      <div className="space-y-1.5 mb-2">
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] font-poppins font-semibold text-green-600 mt-0.5 w-6 shrink-0">Sim:</span>
          <span className="text-[11px] font-poppins text-muted-foreground truncate">{yesKeywords}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] font-poppins font-semibold text-red-500 mt-0.5 w-6 shrink-0">Não:</span>
          <span className="text-[11px] font-poppins text-muted-foreground truncate">{noKeywords}</span>
        </div>
      </div>

      <p className="text-[10px] font-poppins text-muted-foreground">{timeoutLabel}</p>

      <div className="flex justify-between mt-3 px-1 gap-1">
        {[
          { id: "yes", label: "✓ Sim", color: "!bg-green-500", textColor: "text-green-600" },
          { id: "no", label: "✗ Não", color: "!bg-red-500", textColor: "text-red-500" },
          { id: "other", label: "? Outro", color: "!bg-slate-400", textColor: "text-slate-500" },
          { id: "timeout", label: "⏰ Timeout", color: "!bg-amber-500", textColor: "text-amber-600" },
        ].map((handle) => (
          <div key={handle.id} className="relative flex flex-col items-center">
            <span className={`text-[9px] font-poppins font-semibold ${handle.textColor} mb-1 whitespace-nowrap`}>
              {handle.label}
            </span>
            <Handle
              type="source"
              position={Position.Bottom}
              id={handle.id}
              style={{ left: 0, position: "relative" }}
              className={`${handle.color} !w-3 !h-3 !border-2 !border-background !relative !transform-none`}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

ReplyRouterNode.displayName = "ReplyRouterNode";
