import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";

const triggerOptions: Record<string, string> = {
  lead_created: "Lead criado",
  lead_stage_changed: "Lead movido de etapa",
  lead_from_instagram: "Lead via Instagram",
  lead_from_whatsapp: "Lead via WhatsApp",
  tag_added: "Tag adicionada",
  form_submitted: "Formulário enviado",
};

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const triggerLabel = triggerOptions[config.triggerType] || "Selecionar gatilho";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected
          ? "border-amber-500 shadow-amber-500/20 ring-2 ring-amber-500/10"
          : "border-amber-500/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-amber-500/10">
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-amber-500 uppercase tracking-wide">
          Gatilho
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">{triggerLabel}</p>
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
});

TriggerNode.displayName = "TriggerNode";
