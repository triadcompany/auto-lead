import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '@/components/ui/card';

interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_active: boolean;
  pipeline_id: string;
}

interface Props {
  stages: PipelineStage[];
  onStagePositionUpdate: (stages: PipelineStage[]) => void;
}

export function PipelineVisualization({ stages, onStagePositionUpdate }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert stages to ReactFlow nodes
  useEffect(() => {
    const flowNodes: Node[] = stages
      .filter(stage => stage.is_active)
      .sort((a, b) => a.position - b.position)
      .map((stage, index) => ({
        id: stage.id,
        type: 'default',
        position: { x: index * 200, y: 100 },
        data: { 
          label: (
            <div className="text-center">
              <div 
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: stage.color }}
              />
              <div className="font-medium text-sm text-slate-900">{stage.name}</div>
              <div className="text-xs text-slate-500">Posição {stage.position}</div>
            </div>
          )
        },
        style: {
          background: '#ffffff',
          border: `2px solid ${stage.color}`,
          borderRadius: '8px',
          padding: '10px',
          minWidth: '120px',
          color: '#0f172a',
        },
      }));

    const flowEdges: Edge[] = flowNodes.slice(0, -1).map((node, index) => ({
      id: `e${node.id}-${flowNodes[index + 1].id}`,
      source: node.id,
      target: flowNodes[index + 1].id,
      type: 'smoothstep',
      style: { stroke: '#cbd5e1', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed' as any,
        color: '#cbd5e1',
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [stages, setNodes, setEdges]);

  // Handle node position changes to update stage order
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    
    // Check if any node positions changed
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.dragging === false
    );
    
    if (positionChanges.length > 0) {
      // Sort nodes by x position and update stage positions
      const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);
      const updatedStages = stages.map(stage => {
        const nodeIndex = sortedNodes.findIndex(node => node.id === stage.id);
        return nodeIndex >= 0 ? { ...stage, position: nodeIndex + 1 } : stage;
      });
      
      onStagePositionUpdate(updatedStages);
    }
  }, [nodes, stages, onStagePositionUpdate, onNodesChange]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (stages.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-muted-foreground">
          Nenhum estágio criado ainda. Adicione estágios para visualizar o pipeline.
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-96 p-4">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        className="bg-muted/30"
      >
        <Controls />
        <Background gap={20} size={1} />
        <MiniMap 
          nodeStrokeColor="#cbd5e1"
          nodeColor="#f8fafc"
          nodeBorderRadius={8}
          className="bg-background border"
        />
      </ReactFlow>
    </Card>
  );
}