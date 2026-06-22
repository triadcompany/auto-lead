import React from "react";
import {
  Zap,
  MessageSquare,
  Clock,
  GitBranch,
  Cog,
  MessageSquareReply,
} from "lucide-react";

const blocks = [
  {
    category: "Gatilhos",
    items: [
      { type: "trigger", label: "Gatilho", icon: Zap, color: "text-amber-500 bg-amber-500/10" },
    ],
  },
  {
    category: "Ações",
    items: [
      { type: "message", label: "Mensagem", icon: MessageSquare, color: "text-blue-500 bg-blue-500/10" },
      { type: "delay", label: "Espera", icon: Clock, color: "text-purple-500 bg-purple-500/10" },
      { type: "wait_for_reply", label: "Esperar Resposta", icon: MessageSquareReply, color: "text-cyan-500 bg-cyan-500/10" },
      { type: "condition", label: "Condição", icon: GitBranch, color: "text-emerald-500 bg-emerald-500/10" },
      { type: "action", label: "Ação", icon: Cog, color: "text-orange-500 bg-orange-500/10" },
    ],
  },
];

export function BlocksSidebar() {
  const onDragStart = (event: React.DragEvent, type: string, label: string) => {
    event.dataTransfer.setData("application/reactflow-type", type);
    event.dataTransfer.setData("application/reactflow-label", label);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-56 border-r border-border bg-card p-4 space-y-6 overflow-y-auto">
      <h3 className="font-poppins font-semibold text-sm text-foreground">Blocos</h3>
      {blocks.map((cat) => (
        <div key={cat.category}>
          <p className="text-xs text-muted-foreground font-poppins font-medium uppercase tracking-wider mb-2">
            {cat.category}
          </p>
          <div className="space-y-2">
            {cat.items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type, item.label)}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className={`p-1.5 rounded-md ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-poppins font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
