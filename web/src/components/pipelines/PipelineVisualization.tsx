import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  NodeChange,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PipelineStage } from '@/hooks/usePipelines';

interface Props {
  stages: PipelineStage[];
  onStagePositionUpdate?: (stages: PipelineStage[]) => void;
}

function FlowCanvas({ stages, onStagePositionUpdate }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const active = [...stages]
      .filter(s => s.isActive !== false)
      .sort((a, b) => a.position - b.position);

    const flowNodes: Node[] = active.map((stage, index) => ({
      id: stage.id,
      type: 'default',
      position: { x: index * 210, y: 60 },
      data: {
        label: (
          <div style={{ textAlign: 'center', padding: '2px 4px' }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: stage.color ?? '#F97316',
                margin: '0 auto 6px',
              }}
            />
            <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', lineHeight: 1.3 }}>
              {stage.name}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              Etapa {stage.position}
            </div>
          </div>
        ),
      },
      style: {
        background: '#1e293b',
        border: `2px solid ${stage.color ?? '#F97316'}`,
        borderRadius: 10,
        padding: '10px 8px',
        minWidth: 130,
        color: '#f1f5f9',
        boxShadow: `0 0 14px ${stage.color ?? '#F97316'}40`,
      },
    }));

    const flowEdges: Edge[] = flowNodes.slice(0, -1).map((node, index) => ({
      id: `e${index}`,
      source: node.id,
      target: flowNodes[index + 1].id,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#475569', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);

    // fitView after nodes are in the DOM
    setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 80);
  }, [stages, setNodes, setEdges, fitView]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const dropped = changes.filter(
        (c) => c.type === 'position' && (c as any).dragging === false
      );
      if (dropped.length > 0 && onStagePositionUpdate) {
        setNodes((nds) => {
          const sorted = [...nds].sort((a, b) => a.position.x - b.position.x);
          const updated = stages.map((stage) => {
            const idx = sorted.findIndex((n) => n.id === stage.id);
            return idx >= 0 ? { ...stage, position: idx + 1 } : stage;
          });
          onStagePositionUpdate(updated);
          return nds;
        });
      }
    },
    [onNodesChange, onStagePositionUpdate, stages, setNodes]
  );

  const activeCount = stages.filter(s => s.isActive !== false).length;

  if (activeCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">Nenhum estágio criado ainda.</p>
        <p className="text-xs opacity-60">Vá em "Gerenciar Estágios" para adicionar.</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      nodesDraggable={!!onStagePositionUpdate}
      nodesConnectable={false}
      elementsSelectable={true}
      colorMode="dark"
    >
      <Controls />
      <Background color="#334155" gap={20} size={1} />
      <MiniMap
        nodeStrokeColor="#475569"
        nodeColor="#1e293b"
        nodeBorderRadius={8}
        style={{ background: '#0f172a', border: '1px solid #1e293b' }}
      />
    </ReactFlow>
  );
}

export function PipelineVisualization({ stages, onStagePositionUpdate }: Props) {
  return (
    <div
      style={{
        height: 380,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #1e293b',
      }}
    >
      <ReactFlowProvider>
        <FlowCanvas stages={stages} onStagePositionUpdate={onStagePositionUpdate} />
      </ReactFlowProvider>
    </div>
  );
}
