import React from "react";
import { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Zap, MessageSquare, Clock, GitBranch, Cog, Trash2, MessageSquareReply } from "lucide-react";
import { TriggerEditor } from "./editors/TriggerEditor";
import { DelayEditor } from "./editors/DelayEditor";
import { MessageEditor } from "./editors/MessageEditor";
import { ConditionEditor } from "./editors/ConditionEditor";
import { ActionEditor } from "./editors/ActionEditor";
import { WaitForReplyEditor } from "./editors/WaitForReplyEditor";

interface NodeInspectorProps {
  node: Node | null;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

const nodeTypeInfo: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  trigger: { label: "Gatilho", icon: Zap, color: "text-amber-500" },
  message: { label: "Mensagem", icon: MessageSquare, color: "text-blue-500" },
  delay: { label: "Espera", icon: Clock, color: "text-purple-500" },
  condition: { label: "Condição", icon: GitBranch, color: "text-emerald-500" },
  action: { label: "Ação", icon: Cog, color: "text-orange-500" },
  wait_for_reply: { label: "Esperar Resposta", icon: MessageSquareReply, color: "text-cyan-500" },
};

export function NodeInspector({ node, onUpdate, onDelete, onClose }: NodeInspectorProps) {
  if (!node) return null;

  const info = nodeTypeInfo[node.type || ""] || { label: "Bloco", icon: Cog, color: "text-foreground" };
  const Icon = info.icon;
  const config = (node.data as any).config || {};

  const handleConfigChange = (newConfig: any) => {
    onUpdate(node.id, newConfig);
  };

  const renderEditor = () => {
    switch (node.type) {
      case "trigger":
        return <TriggerEditor config={config} onChange={handleConfigChange} />;
      case "delay":
        return <DelayEditor config={config} onChange={handleConfigChange} />;
      case "message":
        return <MessageEditor config={config} onChange={handleConfigChange} />;
      case "condition":
        return <ConditionEditor config={config} onChange={handleConfigChange} />;
      case "action":
        return <ActionEditor config={config} onChange={handleConfigChange} />;
      case "wait_for_reply":
        return <WaitForReplyEditor config={config} onChange={handleConfigChange} />;
      default:
        return <p className="text-sm text-muted-foreground font-poppins">Editor não disponível</p>;
    }
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${info.color}`} />
          <h3 className="font-poppins font-semibold text-sm">{info.label}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">{renderEditor()}</div>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="p-3 flex justify-between items-center">
        <p className="text-[10px] text-muted-foreground font-poppins truncate max-w-[160px]">
          ID: {node.id}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 text-xs gap-1"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="h-3 w-3" />
          Excluir
        </Button>
      </div>
    </div>
  );
}
