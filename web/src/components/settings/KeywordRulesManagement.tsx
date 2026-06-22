import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, Save, X, Zap, ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface KeywordRule {
  id: string;
  name: string;
  keyword: string;
  match_type: string;
  create_lead: boolean;
  lead_source: string;
  pipeline_id: string | null;
  stage_id: string | null;
  tags: any[];
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
}

interface Stage {
  id: string;
  name: string;
  position: number;
}

const emptyForm = {
  name: '',
  keyword: '',
  match_type: 'contains',
  create_lead: true,
  lead_source: 'Meta Ads',
  pipeline_id: '' as string,
  stage_id: '' as string,
  priority: 0,
  is_active: true,
};

export function KeywordRulesManagement() {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);

  const orgId = profile?.organization_id;

  const loadRules = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from('automation_keyword_rules' as any)
      .select('*')
      .eq('organization_id', orgId)
      .order('priority', { ascending: false });
    setRules((data as any) || []);
    setLoading(false);
  }, [orgId]);

  const loadPipelines = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('pipelines')
      .select('id, name, is_default')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });
    setPipelines(data || []);
  }, [orgId]);

  const loadStages = useCallback(async (pipelineId: string) => {
    if (!pipelineId) { setStages([]); return; }
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, position')
      .eq('pipeline_id', pipelineId)
      .eq('is_active', true)
      .order('position');
    setStages(data || []);
  }, []);

  useEffect(() => { loadRules(); loadPipelines(); }, [loadRules, loadPipelines]);

  useEffect(() => {
    if (form.pipeline_id) loadStages(form.pipeline_id);
    else setStages([]);
  }, [form.pipeline_id, loadStages]);

  const openNew = () => {
    setEditingId(null);
    const defPipeline = pipelines.find(p => p.is_default);
    setForm({ ...emptyForm, pipeline_id: defPipeline?.id || '' });
    setDialogOpen(true);
  };

  const openEdit = (rule: KeywordRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      keyword: rule.keyword,
      match_type: rule.match_type,
      create_lead: rule.create_lead,
      lead_source: rule.lead_source,
      pipeline_id: rule.pipeline_id || '',
      stage_id: rule.stage_id || '',
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !isAdmin) return;
    if (!form.name.trim() || !form.keyword.trim()) {
      toast({ title: 'Erro', description: 'Nome e palavra-chave são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        name: form.name.trim(),
        keyword: form.keyword.trim().toLowerCase(),
        match_type: form.match_type,
        create_lead: form.create_lead,
        lead_source: form.lead_source,
        pipeline_id: form.pipeline_id || null,
        stage_id: form.stage_id || null,
        tags: [],
        priority: form.priority,
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          .from('automation_keyword_rules' as any)
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Regra atualizada' });
      } else {
        const { error } = await supabase
          .from('automation_keyword_rules' as any)
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Regra criada' });
      }
      setDialogOpen(false);
      loadRules();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao salvar regra', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: KeywordRule) => {
    await supabase
      .from('automation_keyword_rules' as any)
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    loadRules();
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;
    await supabase.from('automation_keyword_rules' as any).delete().eq('id', id);
    toast({ title: 'Regra excluída' });
    loadRules();
  };

  const matchTypeLabel: Record<string, string> = {
    contains: 'Contém',
    equals: 'Igual a',
    starts_with: 'Começa com',
  };

  if (!isAdmin) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground font-poppins">Apenas administradores podem gerenciar regras de captura.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-poppins font-semibold text-foreground">Captura automática de leads</h3>
          <p className="text-sm text-muted-foreground font-poppins">
            Regras de palavra-chave para criar leads automaticamente na primeira mensagem recebida.
          </p>
        </div>
        <Button onClick={openNew} className="btn-gradient text-white font-poppins">
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : rules.length === 0 ? (
        <Card className="card-gradient border-0">
          <CardContent className="p-8 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-poppins mb-4">
              Nenhuma regra de captura configurada. Crie uma para capturar leads automaticamente por palavra-chave.
            </p>
            <Button onClick={openNew} variant="outline" className="font-poppins">
              <Plus className="h-4 w-4 mr-2" /> Criar primeira regra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="card-gradient border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleActive(rule)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-poppins font-semibold text-foreground truncate">{rule.name}</h4>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'} className="shrink-0">
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        {rule.priority > 0 && (
                          <Badge variant="outline" className="shrink-0">
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            P{rule.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-poppins">
                        {matchTypeLabel[rule.match_type] || rule.match_type}: <code className="bg-muted px-1 rounded">{rule.keyword}</code>
                        {' → '}{rule.lead_source}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-poppins">{editingId ? 'Editar Regra' : 'Nova Regra de Captura'}</DialogTitle>
            <DialogDescription className="font-poppins">
              Configure a palavra-chave e o destino do lead criado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-poppins">Nome da regra</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Leads de anúncio Meta" className="font-poppins" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-poppins">Palavra-chave</Label>
                <Input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                  placeholder="anuncio" className="font-mono" />
              </div>
              <div>
                <Label className="font-poppins">Tipo de match</Label>
                <Select value={form.match_type} onValueChange={v => setForm(f => ({ ...f, match_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="equals">Igual a</SelectItem>
                    <SelectItem value="starts_with">Começa com</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-poppins">Origem do lead</Label>
              <Input value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}
                placeholder="Meta Ads" className="font-poppins" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-poppins">Pipeline</Label>
                <Select value={form.pipeline_id} onValueChange={v => setForm(f => ({ ...f, pipeline_id: v, stage_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar pipeline" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.is_default ? ' (Padrão)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-poppins">Etapa</Label>
                <Select value={form.stage_id} onValueChange={v => setForm(f => ({ ...f, stage_id: v }))} disabled={!form.pipeline_id}>
                  <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-poppins">Prioridade</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  min={0} className="font-poppins" />
                <p className="text-xs text-muted-foreground mt-1">Maior = executa primeiro</p>
              </div>
              <div className="flex items-end pb-7">
                <div className="flex items-center space-x-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label className="font-poppins">Ativa</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-poppins">
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="btn-gradient text-white font-poppins">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
