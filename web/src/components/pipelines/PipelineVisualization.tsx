import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  onStagePositionUpdate?: (stages: PipelineStage[]) => void;
}

export function PipelineVisualization({ stages }: Props) {
  const activeStages = [...stages]
    .filter(s => s.is_active)
    .sort((a, b) => a.position - b.position);

  if (activeStages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
          <path d="M3 3h6l2 4-3 2a11 11 0 005 5l2-3 4 2v6a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>
        </svg>
        <p className="text-sm">Nenhum estágio criado ainda.</p>
        <p className="text-xs opacity-60">Vá em "Gerenciar Estágios" para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-stretch gap-0 min-w-max">
        {activeStages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            {/* Stage card */}
            <div className="flex flex-col items-center gap-2 w-36">
              {/* Position badge */}
              <div
                className="text-white text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: stage.color }}
              >
                {index + 1}
              </div>

              {/* Card */}
              <div
                className="w-full rounded-xl border-2 px-3 py-4 flex flex-col items-center gap-2 bg-card shadow-sm"
                style={{ borderColor: stage.color }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                >
                  {stage.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-center leading-tight text-foreground">
                  {stage.name}
                </span>
              </div>
            </div>

            {/* Arrow between stages */}
            {index < activeStages.length - 1 && (
              <div className="flex items-center self-center px-1 mt-6">
                <svg viewBox="0 0 24 8" width="32" height="12" fill="none">
                  <line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="1.5" className="text-border" />
                  <polyline points="13,1 18,4 13,7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" />
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-2">
        {activeStages.map((stage) => (
          <Badge
            key={stage.id}
            variant="outline"
            className="text-xs gap-1.5"
            style={{ borderColor: stage.color, color: stage.color }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            {stage.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
