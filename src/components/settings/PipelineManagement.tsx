import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trash2,
  Edit,
  Plus,
  GripVertical,
  GitBranch,
  Target,
  Settings,
  Eye,
  Shield,
  Star,
} from 'lucide-react';
import { usePipelines, Pipeline, PipelineStage } from '@/hooks/usePipelines';
import { PipelineVisualization } from '@/components/pipelines/PipelineVisualization';
import { PipelinePermissionsModal } from '@/components/pipelines/PipelinePermissionsModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function PipelineForm({ 
  pipeline, 
  onSave, 
  onCancel 
}: { 
  pipeline?: Pipeline | null; 
  onSave: (data: { name: string; description?: string }) => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState(pipeline?.name || '');
  const [description, setDescription] = useState(pipeline?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pipelineName">Nome do Pipeline</Label>
        <Input
          id="pipelineName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Vendas B2B, Vendas B2C..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pipelineDescription">Descrição (opcional)</Label>
        <Textarea
          id="pipelineDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o propósito deste pipeline..."
          rows={3}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {pipeline ? 'Atualizar' : 'Criar'} Pipeline
        </Button>
      </div>
    </form>
  );
}

function StageForm({ 
  stage, 
  onSave, 
  onCancel 
}: { 
  stage?: PipelineStage | null; 
  onSave: (data: { name: string; color: string }) => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState(stage?.name || '');
  const [color, setColor] = useState(stage?.color || '#3B82F6');

  const presetColors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="stageName">Nome do Estágio</Label>
        <Input
          id="stageName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Prospecção, Qualificação..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="stageColor">Cor</Label>
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                type="button"
                className={`w-full h-8 rounded border-2 ${
                  color === presetColor ? 'border-foreground' : 'border-muted'
                }`}
                style={{ backgroundColor: presetColor }}
                onClick={() => setColor(presetColor)}
              />
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <Input
              id="stageColor"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-20 h-10"
            />
            <Badge style={{ backgroundColor: color, color: 'white' }}>
              {name || 'Preview'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {stage ? 'Atualizar' : 'Criar'} Estágio
        </Button>
      </div>
    </form>
  );
}

interface SortableStageItemProps {
  stage: PipelineStage;
  onEdit: (stage: PipelineStage) => void;
  onDelete: (stageId: string) => void;
}

function SortableStageItem({ stage, onEdit, onDelete }: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors bg-background"
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <Badge
            style={{ backgroundColor: stage.color, color: 'white' }}
            className="text-xs"
          >
            {stage.position}
          </Badge>
          <span className="font-medium">{stage.name}</span>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(stage)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(stage.id)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface StagesListProps {
  stages: PipelineStage[];
  onEditStage: (stage: PipelineStage) => void;
  onDeleteStage: (stageId: string) => void;
  onReorder: (updatedStages: PipelineStage[]) => Promise<void>;
}

function StagesList({ stages, onEditStage, onDeleteStage, onReorder }: StagesListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);

      const reorderedStages = arrayMove(stages, oldIndex, newIndex);
      
      await onReorder(reorderedStages);
    }
  };

  if (stages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum estágio criado ainda.
        <br />
        Clique em "Novo Estágio" para começar.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={stages.map(s => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {stages.map((stage) => (
            <SortableStageItem
              key={stage.id}
              stage={stage}
              onEdit={onEditStage}
              onDelete={onDeleteStage}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function PipelineManagement() {
  const {
    pipelines,
    selectedPipeline,
    setSelectedPipeline,
    preferredPipelineId,
    setPreferredPipeline,
    stages,
    loading,
    createPipeline,
    updatePipeline,
    deletePipeline,
    createStage,
    updateStage,
    deleteStage,
    updateStagePositions,
  } = usePipelines();

  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const { orgId, isAdmin } = useAuth();

  const handleSavePipeline = async (data: { name: string; description?: string }) => {
    let success = false;
    
    if (editingPipeline) {
      success = await updatePipeline(editingPipeline.id, data);
    } else {
      success = await createPipeline(data);
    }

    if (success) {
      setIsPipelineDialogOpen(false);
      setEditingPipeline(null);
    }
  };

  const handleSaveStage = async (data: { name: string; color: string }) => {
    let success = false;
    
    if (editingStage) {
      success = await updateStage(editingStage.id, data);
    } else {
      success = await createStage(data);
    }

    if (success) {
      setIsStageDialogOpen(false);
      setEditingStage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2">Carregando pipelines...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Selection Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-primary">Gerenciar Pipelines</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Configure os funis de vendas da sua organização (máximo 10)'
              : 'Visualize os funis de vendas aos quais você tem acesso'}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={isPipelineDialogOpen} onOpenChange={setIsPipelineDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setEditingPipeline(null)}
                disabled={pipelines.length >= 10}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPipeline ? 'Editar Pipeline' : 'Novo Pipeline'}
                </DialogTitle>
              </DialogHeader>
              <PipelineForm
                pipeline={editingPipeline}
                onSave={handleSavePipeline}
                onCancel={() => {
                  setIsPipelineDialogOpen(false);
                  setEditingPipeline(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Pipeline Selection */}
      {pipelines.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <CardTitle className="text-base text-primary">Selecionar Pipeline</CardTitle>
              </div>
              <Badge variant="secondary">{pipelines.length}/10</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Select 
                value={selectedPipeline?.id || ''} 
                onValueChange={(value) => {
                  const pipeline = pipelines.find(p => p.id === value);
                  setSelectedPipeline(pipeline || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        {pipeline.name}
                        {pipeline.id === preferredPipelineId && (
                          <Badge variant="default" className="text-xs">Meu padrão</Badge>
                        )}
                        {pipeline.is_default && pipeline.id !== preferredPipelineId && (
                          <Badge variant="outline" className="text-xs">Padrão org</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedPipeline && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedPipeline.id === preferredPipelineId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreferredPipeline(selectedPipeline.id)}
                    disabled={selectedPipeline.id === preferredPipelineId}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    {selectedPipeline.id === preferredPipelineId ? 'Meu padrão' : 'Definir como meu padrão'}
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPipeline(selectedPipeline);
                          setIsPipelineDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPermissionsOpen(true)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Permissões
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletePipeline(selectedPipeline.id)}
                        className="text-destructive hover:text-destructive"
                        disabled={pipelines.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Management Tabs */}
      {selectedPipeline && (
        <Tabs defaultValue="visualization" className="space-y-4">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="visualization" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visualização
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Gerenciar Estágios
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="visualization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <GitBranch className="h-5 w-5" />
                  {selectedPipeline.name}
                </CardTitle>
                {selectedPipeline.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedPipeline.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <PipelineVisualization 
                  stages={stages} 
                  onStagePositionUpdate={isAdmin ? updateStagePositions : undefined}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="stages" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-primary">Estágios do Pipeline</CardTitle>
                    <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setEditingStage(null)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Estágio
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {editingStage ? 'Editar Estágio' : 'Novo Estágio'}
                          </DialogTitle>
                        </DialogHeader>
                        <StageForm
                          stage={editingStage}
                          onSave={handleSaveStage}
                          onCancel={() => {
                            setIsStageDialogOpen(false);
                            setEditingStage(null);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <StagesList
                    stages={stages}
                    onEditStage={(stage) => {
                      setEditingStage(stage);
                      setIsStageDialogOpen(true);
                    }}
                    onDeleteStage={deleteStage}
                    onReorder={updateStagePositions}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Empty State */}
      {pipelines.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum Pipeline Disponível</h3>
            <p className="text-muted-foreground mb-4">
              {isAdmin
                ? 'Crie seu primeiro pipeline para começar a organizar seu funil de vendas.'
                : 'Você ainda não tem acesso a nenhum pipeline. Solicite acesso a um administrador.'}
            </p>
            {isAdmin && (
              <Button
                onClick={() => {
                  setEditingPipeline(null);
                  setIsPipelineDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Pipeline
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <PipelinePermissionsModal
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        pipelineId={selectedPipeline?.id ?? null}
        pipelineName={selectedPipeline?.name ?? ''}
        orgId={orgId}
      />
    </div>
  );
}