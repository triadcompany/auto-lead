import React, { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  ReactFlowInstance,
  NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Save, Play, Pause } from "lucide-react";
import { TriggerNode } from "./nodes/TriggerNode";
import { MessageNode } from "./nodes/MessageNode";
import { DelayNode } from "./nodes/DelayNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ActionNode } from "./nodes/ActionNode";
import { WaitForReplyNode } from "./nodes/WaitForReplyNode";
import { BlocksSidebar } from "./BlocksSidebar";
import { NodeInspector } from "./NodeInspector";
import { useToast } from "@/hooks/use-toast";

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  delay: DelayNode,
  condition: ConditionNode,
  action: ActionNode,
  wait_for_reply: WaitForReplyNode,
};

interface AutomationFlowEditorProps {
  flowDefinition: { nodes: Node[]; edges: Edge[] };
  onSave: (flow: { nodes: Node[]; edges: Edge[] }) => void;
  isActive: boolean;
  onToggleActive: () => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  problemNodeIds: string[];
}

function validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];
  const problemNodeIds: string[] = [];

  // Must have at least one trigger
  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) {
    errors.push("A automação precisa de pelo menos um Gatilho.");
  }

  // Trigger must be connected
  for (const trigger of triggers) {
    const hasOutgoing = edges.some((e) => e.source === trigger.id);
    if (!hasOutgoing) {
      errors.push("O gatilho não está conectado a nenhum nó.");
      problemNodeIds.push(trigger.id);
    }
    const cfg = (trigger.data as any).config || {};
    if (!cfg.triggerType) {
      errors.push("O gatilho não tem um tipo configurado.");
      problemNodeIds.push(trigger.id);
    }
  }

  // No loose non-trigger nodes
  const nonTriggerNodes = nodes.filter((n) => n.type !== "trigger");
  for (const node of nonTriggerNodes) {
    const hasIncoming = edges.some((e) => e.target === node.id);
    if (!hasIncoming) {
      const label = (node.data as any).label || node.type;
      errors.push(`O nó "${label}" está solto (sem conexão de entrada).`);
      problemNodeIds.push(node.id);
    }
  }

  // Validate node configs
  for (const node of nodes) {
    const cfg = (node.data as any).config || {};
    switch (node.type) {
      case "message":
        if (!cfg.text?.trim()) {
          errors.push("Há um bloco Mensagem sem texto configurado.");
          problemNodeIds.push(node.id);
        }
        break;
      case "delay":
        if (!cfg.amount || cfg.amount <= 0) {
          errors.push("Há um bloco Espera com tempo inválido.");
          problemNodeIds.push(node.id);
        }
        break;
      case "condition":
        if (!cfg.conditionType) {
          errors.push("Há um bloco Condição sem tipo configurado.");
          problemNodeIds.push(node.id);
        }
        break;
      case "action":
        if (!cfg.actionType) {
          errors.push("Há um bloco Ação sem tipo configurado.");
          problemNodeIds.push(node.id);
        }
        break;
      case "wait_for_reply":
        if (!cfg.timeout_amount || cfg.timeout_amount <= 0) {
          errors.push("Há um bloco 'Esperar Resposta' sem timeout definido.");
          problemNodeIds.push(node.id);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors, problemNodeIds };
}

export function AutomationFlowEditor({
  flowDefinition,
  onSave,
  isActive,
  onToggleActive,
}: AutomationFlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(flowDefinition.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowDefinition.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { toast } = useToast();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow-type");
      const label = event.dataTransfer.getData("application/reactflow-label");
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: { label, config: getDefaultConfig(type) },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, newConfig: any) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: newConfig } }
            : n
        )
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  const handleSave = () => {
    onSave({ nodes, edges });
    toast({ title: "Salvo", description: "Fluxo salvo com sucesso." });
  };

  const handleToggleActive = () => {
    if (!isActive) {
      const result = validateFlow(nodes, edges);
      if (!result.valid) {
        // Highlight problem nodes
        const problemNodeIds = result.problemNodeIds || [];
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            className: problemNodeIds.includes(n.id)
              ? "ring-2 ring-destructive ring-offset-2 rounded-lg"
              : "",
          }))
        );
        toast({
          title: "Não é possível ativar",
          description: result.errors.join(" • "),
          variant: "destructive",
        });
        return;
      }
      // Clear any previous highlights
      setNodes((nds) => nds.map((n) => ({ ...n, className: "" })));
    }
    // Save flow first, then toggle
    onSave({ nodes, edges });
    onToggleActive();
  };

  return (
    <div className="flex h-[calc(100vh-200px)] border border-border rounded-lg overflow-hidden">
      <BlocksSidebar />
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-background"
        >
          <Background color="hsl(var(--muted-foreground))" gap={20} size={1} />
          <Controls className="!bg-card !border-border !shadow-md" />
          <MiniMap
            className="!bg-card !border-border"
            nodeColor="hsl(var(--primary))"
            maskColor="hsl(var(--background) / 0.8)"
          />
          <Panel position="top-right" className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button
              size="sm"
              variant={isActive ? "destructive" : "default"}
              onClick={handleToggleActive}
              className="gap-2"
            >
              {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isActive ? "Desativar" : "Ativar"}
            </Button>
          </Panel>
        </ReactFlow>
      </div>
      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          onUpdate={handleUpdateNodeConfig}
          onDelete={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}

function getDefaultConfig(type: string) {
  switch (type) {
    case "trigger":
      return { triggerType: "lead_created" };
    case "first_message_trigger":
      return { triggerType: "first_message", useKeyword: false, keyword: "", matchType: "contains", channel: "all" };
    case "message":
      return { text: "", variables: [], buttons: [] };
    case "delay":
      return { amount: 1, unit: "hours" };
    case "condition":
      return { conditionType: "responded", value: "" };
    case "action":
      return { actionType: "update_lead", params: {} };
    case "wait_for_reply":
      return { timeout_amount: 24, timeout_unit: "hours" };
    default:
      return {};
  }
}
