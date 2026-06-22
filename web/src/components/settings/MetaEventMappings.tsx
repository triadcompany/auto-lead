import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, AlertTriangle, Pencil } from "lucide-react";

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  position: number;
}

interface Mapping {
  id: string;
  pipeline_id: string;
  stage_id: string;
  meta_event_name: string;
  priority: number;
  is_active: boolean;
  dedupe_enabled: boolean;
  dedupe_window_hours: number;
  created_at: string;
}

const META_EVENT_OPTIONS = [
  "Lead",
  "QualifiedLead",
  "Schedule",
  "Contact",
  "SubmitApplication",
  "Purchase",
];

export function MetaEventMappings() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formPipelineId, setFormPipelineId] = useState("");
  const [formStageId, setFormStageId] = useState("");
  const [formEventName, setFormEventName] = useState("Lead");
  const [formCustomEvent, setFormCustomEvent] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formDedupeEnabled, setFormDedupeEnabled] = useState(true);
  const [formDedupeHours, setFormDedupeHours] = useState(24);
  const [formActive, setFormActive] = useState(true);

  const [loadingStages, setLoadingStages] = useState(false);

  // Pipeline name cache for display
  const [pipelineNames, setPipelineNames] = useState<Record<string, string>>({});
  const [stageNames, setStageNames] = useState<Record<string, string>>({});

  const loadMappings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("meta_event_mappings")
        .select("*")
        .eq("organization_id", orgId)
        .order("priority", { ascending: false });
      if (error) throw error;
      setMappings(data || []);

      // Load all unique pipeline/stage names
      const pipelineIds = [...new Set((data || []).map((m: Mapping) => m.pipeline_id))] as string[];
      const stageIds = [...new Set((data || []).map((m: Mapping) => m.stage_id))] as string[];

      if (pipelineIds.length > 0) {
        const { data: pData } = await supabase
          .from("pipelines")
          .select("id, name")
          .in("id", pipelineIds);
        const names: Record<string, string> = {};
        (pData || []).forEach((p: any) => { names[p.id] = p.name; });
        setPipelineNames(names);
      }

      if (stageIds.length > 0) {
        const { data: sData } = await supabase
          .from("pipeline_stages")
          .select("id, name")
          .in("id", stageIds);
        const names: Record<string, string> = {};
        (sData || []).forEach((s: any) => { names[s.id] = s.name; });
        setStageNames(names);
      }
    } catch (err: any) {
      console.error("Error loading mappings:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadPipelines = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.rpc("get_org_pipelines", { p_org_id: orgId });
    setPipelines(
      (data || []).filter((p: any) => p.is_active).map((p: any) => ({ id: p.id, name: p.name }))
    );
  }, [orgId]);

  const loadStagesForPipeline = async (pipelineId: string) => {
    setLoadingStages(true);
    const { data } = await supabase.rpc("get_pipeline_stages", { p_pipeline_id: pipelineId });
    setStages(
      (data || [])
        .filter((s: any) => s.is_active)
        .map((s: any) => ({ id: s.id, name: s.name, position: s.position }))
        .sort((a: Stage, b: Stage) => a.position - b.position)
    );
    setLoadingStages(false);
  };

  useEffect(() => {
    loadMappings();
    loadPipelines();
  }, [loadMappings, loadPipelines]);

  useEffect(() => {
    if (formPipelineId) {
      loadStagesForPipeline(formPipelineId);
    } else {
      setStages([]);
    }
  }, [formPipelineId]);

  const resetForm = () => {
    setFormPipelineId("");
    setFormStageId("");
    setFormEventName("Lead");
    setFormCustomEvent("");
    setFormPriority(0);
    setFormDedupeEnabled(true);
    setFormDedupeHours(24);
    setFormActive(true);
    setEditingMapping(null);
  };

  const openNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (m: Mapping) => {
    setEditingMapping(m);
    setFormPipelineId(m.pipeline_id);
    setFormStageId(m.stage_id);
    const isStandard = META_EVENT_OPTIONS.includes(m.meta_event_name);
    setFormEventName(isStandard ? m.meta_event_name : "Custom");
    setFormCustomEvent(isStandard ? "" : m.meta_event_name);
    setFormPriority(m.priority);
    setFormDedupeEnabled(m.dedupe_enabled);
    setFormDedupeHours(m.dedupe_window_hours);
    setFormActive(m.is_active);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!orgId || !formPipelineId || !formStageId) {
      toast.error("Pipeline e etapa são obrigatórios");
      return;
    }

    const eventName = formEventName === "Custom" ? formCustomEvent : formEventName;
    if (!eventName) {
      toast.error("Nome do evento é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        pipeline_id: formPipelineId,
        stage_id: formStageId,
        meta_event_name: eventName,
        priority: formPriority,
        is_active: formActive,
        dedupe_enabled: formDedupeEnabled,
        dedupe_window_hours: formDedupeHours,
        updated_at: new Date().toISOString(),
      };

      if (editingMapping) {
        const { error } = await (supabase as any)
          .from("meta_event_mappings")
          .update(payload)
          .eq("id", editingMapping.id);
        if (error) throw error;
        toast.success("Regra atualizada");
      } else {
        const { error } = await (supabase as any)
          .from("meta_event_mappings")
          .insert(payload);
        if (error) throw error;
        toast.success("Regra criada");
      }

      setShowDialog(false);
      resetForm();
      loadMappings();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await (supabase as any).from("meta_event_mappings").delete().eq("id", id);
      toast.success("Regra removida");
      loadMappings();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await (supabase as any)
      .from("meta_event_mappings")
      .update({ is_active: !isActive })
      .eq("id", id);
    loadMappings();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mapeamento de Eventos</CardTitle>
              <CardDescription>
                Configure quais eventos Meta são enviados ao mover um lead para cada etapa
              </CardDescription>
            </div>
            <Button onClick={openNew} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma regra criada. Clique em "Nova Regra" para começar.
            </p>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {mappings.map((m) => {
                  const pName = pipelineNames[m.pipeline_id];
                  const sName = stageNames[m.stage_id];
                  const isInvalid = !pName || !sName;

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isInvalid ? "border-destructive/50 bg-destructive/5" : ""
                      } ${!m.is_active ? "opacity-60" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isInvalid && (
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <span className="text-sm font-medium">
                            {pName || "Pipeline inválido"}
                          </span>
                          <span className="text-muted-foreground text-xs">→</span>
                          <span className="text-sm font-medium">
                            {sName || "Etapa inválida"}
                          </span>
                          <span className="text-muted-foreground text-xs">→</span>
                          <Badge variant="secondary" className="text-xs">
                            {m.meta_event_name}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Prioridade: {m.priority}
                          {m.dedupe_enabled && ` · Dedup: ${m.dedupe_window_hours}h`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={() => handleToggle(m.id, m.is_active)}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMapping ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pipeline</Label>
              <Select value={formPipelineId} onValueChange={(v) => { setFormPipelineId(v); setFormStageId(""); }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Etapa destino</Label>
              {!formPipelineId ? (
                <p className="text-xs text-muted-foreground mt-1.5">Selecione um pipeline primeiro</p>
              ) : loadingStages ? (
                <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <Select value={formStageId} onValueChange={setFormStageId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Evento Meta</Label>
              <Select value={formEventName} onValueChange={setFormEventName}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {META_EVENT_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom (texto livre)</SelectItem>
                </SelectContent>
              </Select>
              {formEventName === "Custom" && (
                <Input
                  className="mt-2"
                  placeholder="Nome do evento personalizado"
                  value={formCustomEvent}
                  onChange={(e) => setFormCustomEvent(e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Janela dedup (horas)</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={formDedupeHours}
                  onChange={(e) => setFormDedupeHours(parseInt(e.target.value) || 24)}
                  disabled={!formDedupeEnabled}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Deduplicação</Label>
              <Switch checked={formDedupeEnabled} onCheckedChange={setFormDedupeEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formPipelineId || !formStageId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMapping ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
