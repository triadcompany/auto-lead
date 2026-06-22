import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Zap, Play, Pause, Copy, Trash2, ArrowLeft, Loader2,
  MessageSquare, AlertTriangle, RotateCw, FileText, Pencil, Check, X,
  Megaphone, UserPlus, GitBranch, Instagram, Phone, Radio, Tag, FormInput, Activity,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAutomations, Automation, AutomationFlow, AutomationRun, RunStats } from "@/hooks/useAutomations";
import { useAuth } from "@/contexts/AuthContext";
import { AutomationFlowEditor } from "@/components/automations/AutomationFlowEditor";
import { AutomationRunsPanel } from "@/components/automations/AutomationRunsPanel";
import { AutomationExecutionsPanel } from "@/components/automations/AutomationExecutionsPanel";
import { AutomationStatsCards } from "@/components/automations/AutomationStatsCards";
import { MetaCapiAutomations } from "@/components/automations/MetaCapiAutomations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Node, Edge } from "@xyflow/react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TRIGGER_OPTIONS = [
  { value: "first_message", label: "Primeira mensagem recebida", description: "Dispara quando um contato envia a primeira mensagem via WhatsApp ou Instagram", icon: MessageSquare },
  { value: "lead_created", label: "Lead criado", description: "Dispara quando um novo lead é cadastrado no CRM", icon: UserPlus },
  { value: "lead_stage_changed", label: "Lead movido de etapa", description: "Dispara quando um lead é movido para uma etapa específica do pipeline", icon: GitBranch },
  { value: "deal_stage_changed", label: "Mudança de etapa (Kanban)", description: "Dispara quando um lead é movido no Kanban para a etapa destino", icon: Activity },
  { value: "lead_from_whatsapp", label: "Lead via WhatsApp", description: "Dispara quando um lead chega pelo canal do WhatsApp", icon: Phone },
  { value: "lead_from_instagram", label: "Lead via Instagram", description: "Dispara quando um lead chega pelo canal do Instagram", icon: Instagram },
  { value: "broadcast_response", label: "Resposta a Campanha", description: "Dispara quando um contato responde a uma mensagem de campanha", icon: Radio },
  { value: "tag_added", label: "Tag adicionada", description: "Dispara quando uma tag específica é adicionada a um lead", icon: Tag },
];

export default function Automacoes() {
  const { isAdmin, profile, loading: authLoading, orgId: authOrgId, needsOnboarding } = useAuth();
  const hasOrg = !!(profile?.organization_id || authOrgId);

  const {
    automations, loading, createAutomation, updateAutomation,
    deleteAutomation, duplicateAutomation, toggleActive,
    getFlow, saveFlow, createFromTemplate,
    listRuns, listLogs, getRunStats, triggerWorker,
  } = useAutomations();

  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [currentFlow, setCurrentFlow] = useState<AutomationFlow | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("");

  // Runs & stats state for detail view
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [stats, setStats] = useState<RunStats>({ total: 0, running: 0, completed: 0, failed: 0, waiting: 0 });
  const [workerRunning, setWorkerRunning] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Global stats for list view
  const [globalStats, setGlobalStats] = useState<RunStats>({ total: 0, running: 0, completed: 0, failed: 0, waiting: 0 });
  const [activeListTab, setActiveListTab] = useState("automations");

  // Load global stats on mount
  useEffect(() => {
    getRunStats().then(setGlobalStats);
  }, [automations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load flow + runs when editing automation changes
  useEffect(() => {
    if (!editingAutomation) {
      setCurrentFlow(null);
      setRuns([]);
      return;
    }
    let cancelled = false;
    setFlowLoading(true);
    setRunsLoading(true);

    Promise.all([
      getFlow(editingAutomation.id),
      listRuns(editingAutomation.id),
      getRunStats(editingAutomation.id),
    ]).then(([flow, runsList, runStats]) => {
      if (!cancelled) {
        setCurrentFlow(flow);
        setRuns(runsList);
        setStats(runStats);
        setFlowLoading(false);
        setRunsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [editingAutomation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createAutomation(newName, newDesc);
    if (result) {
      setCreateDialog(false);
      // Pre-populate a trigger node if the user selected a trigger type
      if (newTriggerType) {
        const triggerNode: Node = {
          id: `trigger-${Date.now()}`,
          type: "trigger",
          position: { x: 250, y: 120 },
          data: { config: { triggerType: newTriggerType } },
        };
        await saveFlow(result.id, [triggerNode], []);
      }
      setNewName("");
      setNewDesc("");
      setNewTriggerType("");
      setEditingAutomation(result);
    }
  };

  const handleSaveFlow = async (flow: { nodes: Node[]; edges: Edge[] }) => {
    if (!editingAutomation) return;
    const saved = await saveFlow(editingAutomation.id, flow.nodes, flow.edges);
    if (saved) setCurrentFlow(saved);
  };

  // Check if user can edit this automation
  const canEditAutomation = (automation: Automation) => {
    if (isAdmin) return true;
    if (automation.is_active && !isAdmin) return false; // Only admin can toggle active automations
    return automation.created_by === profile?.id;
  };

  const canDeleteAutomation = (automation: Automation) => {
    if (isAdmin) return true;
    return automation.created_by === profile?.id;
  };

  const handleToggle = async () => {
    if (!editingAutomation || !isAdmin) return;
    const success = await toggleActive(editingAutomation.id, editingAutomation.is_active);
    if (success) {
      setEditingAutomation({ ...editingAutomation, is_active: !editingAutomation.is_active });
    }
  };

  const handleWorker = async () => {
    setWorkerRunning(true);
    await triggerWorker();
    // Refresh runs after worker
    if (editingAutomation) {
      const [newRuns, newStats] = await Promise.all([
        listRuns(editingAutomation.id),
        getRunStats(editingAutomation.id),
      ]);
      setRuns(newRuns);
      setStats(newStats);
    }
    setWorkerRunning(false);
  };

  const refreshRuns = async () => {
    if (!editingAutomation) return;
    setRunsLoading(true);
    const [newRuns, newStats] = await Promise.all([
      listRuns(editingAutomation.id),
      getRunStats(editingAutomation.id),
    ]);
    setRuns(newRuns);
    setStats(newStats);
    setRunsLoading(false);
  };

  const hasTrigger = currentFlow
    ? (currentFlow.nodes as Node[]).some((n) => n.type === "trigger")
    : false;

  const navigate = useNavigate();

  // ─── Auth loading / no org guard ───
  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-poppins font-semibold">Nenhuma organização encontrada</h3>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Complete o onboarding para criar sua empresa e acessar as automações.
        </p>
        <Button onClick={() => navigate('/onboarding')} className="btn-gradient text-white">
          Ir para Onboarding
        </Button>
      </div>
    );
  }

  // ─── Detail view ───
  if (editingAutomation) {
    return (
      <div className="p-4 md:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setEditingAutomation(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="flex-1 min-w-0">
              {renaming ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="font-poppins font-bold h-8 text-lg"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (renameValue.trim() && renameValue !== editingAutomation.name) {
                          updateAutomation(editingAutomation.id, { name: renameValue.trim() });
                          setEditingAutomation({ ...editingAutomation, name: renameValue.trim() });
                        }
                        setRenaming(false);
                      } else if (e.key === "Escape") {
                        setRenaming(false);
                      }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    if (renameValue.trim() && renameValue !== editingAutomation.name) {
                      updateAutomation(editingAutomation.id, { name: renameValue.trim() });
                      setEditingAutomation({ ...editingAutomation, name: renameValue.trim() });
                    }
                    setRenaming(false);
                  }}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRenaming(false)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-lg font-poppins font-bold text-foreground">{editingAutomation.name}</h2>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setRenameValue(editingAutomation.name); setRenaming(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {editingAutomation.description && (
                <p className="text-sm text-muted-foreground font-poppins">{editingAutomation.description}</p>
              )}
            </div>
            <Badge variant={editingAutomation.is_active ? "default" : "secondary"}>
              {editingAutomation.is_active ? "Ativo" : "Inativo"}
            </Badge>
            <Badge variant="outline" className="font-poppins">
              <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
            </Badge>
            {currentFlow && (
              <Badge variant="outline" className="font-poppins text-xs">v{currentFlow.version}</Badge>
            )}
            {isAdmin && (
              <Button
                variant={editingAutomation.is_active ? "outline" : "default"}
                size="sm"
                onClick={handleToggle}
                disabled={!hasTrigger && !editingAutomation.is_active}
                className="font-poppins"
              >
                {editingAutomation.is_active ? (
                  <><Pause className="h-4 w-4 mr-1" /> Desativar</>
                ) : (
                  <><Play className="h-4 w-4 mr-1" /> Ativar</>
                )}
              </Button>
            )}
          </div>

          {!hasTrigger && !flowLoading && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-poppins">
                Automação sem gatilho — adicione um nó de Gatilho para poder ativá-la.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="flow" className="w-full">
            <TabsList className="font-poppins">
              <TabsTrigger value="flow">Fluxo</TabsTrigger>
              <TabsTrigger value="runs">
                Execuções
                {stats.total > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{stats.total}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="flow" className="mt-4">
              {flowLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <AutomationFlowEditor
                  flowDefinition={{
                    nodes: (currentFlow?.nodes as Node[]) || [],
                    edges: (currentFlow?.edges as Edge[]) || [],
                  }}
                  onSave={handleSaveFlow}
                  isActive={editingAutomation.is_active}
                  onToggleActive={handleToggle}
                />
              )}
            </TabsContent>

            <TabsContent value="runs" className="mt-4 space-y-4">
              <AutomationStatsCards stats={stats} />

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refreshRuns} className="font-poppins gap-1.5">
                  <RotateCw className="h-3.5 w-3.5" /> Atualizar
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline" size="sm" onClick={handleWorker}
                    disabled={workerRunning} className="font-poppins gap-1.5"
                  >
                    {workerRunning
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...</>
                      : <><Play className="h-3.5 w-3.5" /> Executar worker agora</>
                    }
                  </Button>
                )}
              </div>

              <AutomationRunsPanel
                runs={runs}
                loading={runsLoading}
                onLoadLogs={(runId) => listLogs(runId)}
              />
            </TabsContent>
          </Tabs>
        </div>
    );
  }

  // ─── List view ───
  return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          title="Automações"
          description="Crie fluxos automáticos de mensagens e ações para seus leads"
        >
          {isAdmin && (
            <Button
              variant="outline" size="sm" onClick={async () => {
                setWorkerRunning(true);
                await triggerWorker();
                getRunStats().then(setGlobalStats);
                setWorkerRunning(false);
              }}
              disabled={workerRunning} className="font-poppins gap-1.5"
            >
              {workerRunning
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Worker...</>
                : <><Play className="h-3.5 w-3.5" /> Executar worker</>
              }
            </Button>
          )}
          <Button
            variant="outline"
            className="font-poppins gap-2"
            onClick={async () => {
              const result = await createFromTemplate("keyword_lead");
              if (result) setEditingAutomation(result);
            }}
          >
            <Megaphone className="h-4 w-4" /> Template Palavra-chave
          </Button>
          <Button
            variant="outline"
            className="font-poppins gap-2"
            onClick={async () => {
              const result = await createFromTemplate();
              if (result) setEditingAutomation(result);
            }}
          >
            <FileText className="h-4 w-4" /> Template Follow-up
          </Button>
          <Button className="btn-gradient text-white font-poppins gap-2" onClick={() => setCreateDialog(true)}>
            <Plus className="h-4 w-4" /> Nova Automação
          </Button>
        </PageHeader>

        <Tabs value={activeListTab} onValueChange={setActiveListTab} className="w-full">
          <TabsList className="font-poppins">
            <TabsTrigger value="automations">Automações</TabsTrigger>
            <TabsTrigger value="executions">Execuções</TabsTrigger>
            <TabsTrigger value="meta-capi">Meta Ads (CAPI)</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="mt-4 space-y-4">
            {globalStats.total > 0 && <AutomationStatsCards stats={globalStats} />}

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : automations.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Zap className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-poppins font-semibold mb-2">Nenhuma automação criada</h3>
                  <p className="text-muted-foreground font-poppins text-sm mb-6 text-center max-w-md">
                    Crie fluxos automáticos para enviar mensagens, mover leads no pipeline e muito mais.
                  </p>
            <Button className="btn-gradient text-white font-poppins gap-2" onClick={() => setCreateDialog(true)}>
              <Plus className="h-4 w-4" /> Criar primeira automação
            </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {automations.map((automation) => (
                  <Card
                    key={automation.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setEditingAutomation(automation)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`p-2.5 rounded-xl ${automation.is_active ? "bg-primary/10" : "bg-muted"}`}>
                            <Zap className={`h-5 w-5 ${automation.is_active ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-poppins font-semibold text-foreground truncate">{automation.name}</h3>
                              <Badge variant={automation.is_active ? "default" : "secondary"} className="text-xs">
                                {automation.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                            {automation.description && (
                              <p className="text-sm text-muted-foreground font-poppins truncate">{automation.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground font-poppins mt-1">
                              Criada em {format(new Date(automation.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isAdmin && (
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => toggleActive(automation.id, automation.is_active)}
                              title={automation.is_active ? "Desativar" : "Ativar"}
                            >
                              {automation.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => duplicateAutomation(automation)}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {canDeleteAutomation(automation) && (
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => deleteAutomation(automation.id)}
                              className="text-destructive hover:text-destructive" title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="executions" className="mt-4">
            <AutomationExecutionsPanel organizationId={profile?.organization_id || authOrgId || undefined} />
          </TabsContent>

          <TabsContent value="meta-capi" className="mt-4">
            <MetaCapiAutomations />
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={createDialog} onOpenChange={(open) => {
          setCreateDialog(open);
          if (!open) { setNewName(""); setNewDesc(""); setNewTriggerType(""); }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-poppins text-lg">Nova Automação</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-1">
              <div className="space-y-1.5">
                <Label className="font-poppins font-medium">Nome <span className="text-destructive">*</span></Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Boas-vindas novo lead"
                  className="font-poppins"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-poppins font-medium">Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descreva o objetivo desta automação"
                  className="font-poppins resize-none"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-poppins font-medium">
                  Gatilho <span className="text-muted-foreground text-xs">(opcional — pode configurar depois)</span>
                </Label>
                <Select value={newTriggerType} onValueChange={setNewTriggerType}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione como a automação será disparada" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="font-poppins">
                        <div className="flex items-center gap-2">
                          <t.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>{t.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newTriggerType && (() => {
                  const opt = TRIGGER_OPTIONS.find(t => t.value === newTriggerType);
                  return opt ? (
                    <p className="text-xs text-muted-foreground font-poppins pl-1">{opt.description}</p>
                  ) : null;
                })()}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCreateDialog(false)} className="font-poppins">Cancelar</Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="btn-gradient text-white font-poppins"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Criar automação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
