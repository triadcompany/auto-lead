import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export function KeywordAutomationSettings() {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  useEffect(() => {
    if (selectedPipeline) {
      loadStages(selectedPipeline);
    } else {
      setStages([]);
      setSelectedStage('');
    }
  }, [selectedPipeline]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load pipelines
      const { data: pipelinesData } = await supabase
        .from('pipelines')
        .select('id, name, is_default')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      setPipelines(pipelinesData || []);

      // Load current settings
      const { data: settings } = await supabase
        .from('organization_automation_settings' as any)
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (settings) {
        setEnabled((settings as any).meta_ads_keyword_enabled ?? true);
        const pipeId = (settings as any).meta_ads_pipeline_id || '';
        setSelectedPipeline(pipeId);
        if (pipeId) {
          const stagesData = await fetchStages(pipeId);
          setStages(stagesData);
          setSelectedStage((settings as any).meta_ads_stage_id || '');
        }
      } else {
        // Default to the default pipeline
        const defaultPipe = pipelinesData?.find(p => p.is_default);
        if (defaultPipe) {
          setSelectedPipeline(defaultPipe.id);
        }
      }
    } catch (err) {
      console.error('Error loading keyword automation settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStages = async (pipelineId: string): Promise<Stage[]> => {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, position')
      .eq('pipeline_id', pipelineId)
      .eq('is_active', true)
      .order('position');
    return data || [];
  };

  const loadStages = async (pipelineId: string) => {
    const stagesData = await fetchStages(pipelineId);
    setStages(stagesData);
    // Auto-select first stage if current selection is invalid
    if (stagesData.length > 0 && !stagesData.find(s => s.id === selectedStage)) {
      const novoLead = stagesData.find(s => s.name.toLowerCase().includes('novo'));
      setSelectedStage(novoLead?.id || stagesData[0].id);
    }
  };

  const handleSave = async () => {
    if (!orgId || !isAdmin) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        meta_ads_keyword_enabled: enabled,
        meta_ads_pipeline_id: selectedPipeline || null,
        meta_ads_stage_id: selectedStage || null,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from('organization_automation_settings' as any)
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('organization_automation_settings' as any)
          .update(payload)
          .eq('organization_id', orgId);
      } else {
        await supabase
          .from('organization_automation_settings' as any)
          .insert(payload);
      }

      toast({ title: 'Sucesso', description: 'Configuração de automação salva' });
    } catch (err) {
      console.error('Error saving keyword automation settings:', err);
      toast({ title: 'Erro', description: 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultPipeline = pipelines.find(p => p.is_default);
  const defaultLabel = defaultPipeline ? `Padrão: ${defaultPipeline.name} → Novo Lead` : 'Pipeline Padrão → Novo Lead';

  return (
    <Card className="card-gradient border-0">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 font-poppins">
          <Zap className="h-5 w-5 text-primary" />
          <span>Leads automáticos por palavra-chave</span>
        </CardTitle>
        <CardDescription className="font-poppins">
          Quando a primeira mensagem de WhatsApp contém a palavra "anuncio", um lead é criado automaticamente com origem "Meta Ads".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="keyword-enabled" />
          <Label htmlFor="keyword-enabled" className="font-poppins">Ativar automação</Label>
        </div>

        <div className="space-y-2">
          <Label className="font-poppins font-medium">Palavra-chave</Label>
          <Input value="anuncio" readOnly disabled className="font-mono bg-muted/50" />
          <p className="text-xs text-muted-foreground font-poppins">
            Case-insensitive, sem acento. Detecta "anuncio", "ANUNCIO", "Anuncio", etc.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-poppins font-medium">Pipeline destino</Label>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="font-poppins">
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-poppins">
                    {p.name} {p.is_default ? '(Padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-poppins font-medium">Etapa destino</Label>
            <Select value={selectedStage} onValueChange={setSelectedStage} disabled={!selectedPipeline}>
              <SelectTrigger className="font-poppins">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map(s => (
                  <SelectItem key={s.id} value={s.id} className="font-poppins">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground font-poppins">
          Se não configurado, usa: <strong>{defaultLabel}</strong>
        </p>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="btn-gradient text-white font-poppins">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
