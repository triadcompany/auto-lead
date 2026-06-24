import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Bell } from "lucide-react";

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  sms: "SMS",
};

export const FollowupNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const channel = channelLabels[config.channel] || "WhatsApp";
  const delay = config.delay_hours != null
    ? config.delay_hours === 0
      ? "Imediato"
      : `${config.delay_hours}h após`
    : "Configurar";
  const preview = config.message
    ? config.message.slice(0, 40) + (config.message.length > 40 ? "…" : "")
    : "Mensagem não configurada";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected ? "border-green-500 shadow-green-500/20" : "border-green-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-green-500/10">
          <Bell className="h-4 w-4 text-green-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-green-500 uppercase tracking-wide">
          Follow-up · {channel}
        </span>
      </div>
      <p className="text-xs font-poppins text-muted-foreground mb-1">{delay}</p>
      <p className="text-sm font-poppins text-foreground leading-snug">{preview}</p>
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
});

FollowupNode.displayName = "FollowupNode";
