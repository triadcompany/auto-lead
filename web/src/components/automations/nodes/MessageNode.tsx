import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquare } from "lucide-react";

export const MessageNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const preview = config.text
    ? config.text.substring(0, 60) + (config.text.length > 60 ? "..." : "")
    : "Configurar mensagem";
  const buttons: Array<{ label: string; payload: string }> = config.buttons || [];

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] max-w-[280px] ${
        selected ? "border-blue-500 shadow-blue-500/20" : "border-blue-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-blue-500/10">
          <MessageSquare className="h-4 w-4 text-blue-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-blue-500 uppercase tracking-wide">
          Mensagem
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">{preview}</p>

      {buttons.length > 0 && (
        <div className="mt-2 space-y-1">
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="relative flex items-center justify-between text-xs bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-md font-poppins"
            >
              <span className="truncate">{typeof btn === "string" ? btn : btn.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`button:${typeof btn === "string" ? btn : btn.payload || btn.label}`}
                className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-background !right-[-14px]"
              />
            </div>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
});

MessageNode.displayName = "MessageNode";
