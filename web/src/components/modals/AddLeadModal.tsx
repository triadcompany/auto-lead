import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Lead } from "@/hooks/useSupabaseLeads";
import { useSupabaseProfiles } from "@/hooks/useSupabaseProfiles";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadSources } from "@/hooks/useLeadSources";
import { supabase } from "@/integrations/supabase/client";
import { BRAZILIAN_STATES } from "@/lib/brazilian-states";

interface AddLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (newLead: Omit<Lead, 'id' | 'created_at' | 'created_by' | 'stage_id'> & { stage_id?: string }) => void;
}

interface PipelineOption {
  id: string;
  name: string;
  is_default: boolean;
}

interface StageOption {
  id: string;
  name: string;
  position: number;
}

// Função para formatar valor em moeda brasileira
const formatCurrency = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const amount = parseInt(numbers || '0', 10) / 100;
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Função para converter string formatada em número
const parseCurrency = (value: string): number => {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers || '0', 10) / 100;
};

export function AddLeadModal({ open, onOpenChange, onSave }: AddLeadModalProps) {
  const { profile, orgId } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    seller_id: "",
    source: "",
    interest: "",
    price: "",
    observations: "",
    valor_negocio: "",
    servico: "",
    cidade: "",
    estado: ""
  });

  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [loadingStages, setLoadingStages] = useState(false);
  
  const { profiles } = useSupabaseProfiles();
  const { leadSources } = useLeadSources();

  // Fetch pipelines on mount
  const fetchPipelines = useCallback(async () => {
    const targetOrgId = orgId || profile?.organization_id;
    if (!targetOrgId) return;
    const { data, error } = await supabase.rpc('get_org_pipelines', {
      p_org_id: targetOrgId,
    });
    if (error) {
      console.error('[AddLeadModal] get_org_pipelines error:', error);
      return;
    }
    const list = ((data || []) as any[]).map(p => ({
      id: p.id,
      name: p.name,
      is_default: p.is_default,
    }));
    setPipelines(list);

    // Auto-select default pipeline
    const defaultPipeline = list.find(p => p.is_default) || list[0];
    if (defaultPipeline) {
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [orgId, profile?.organization_id]);

  // Fetch stages when pipeline changes
  const fetchStages = useCallback(async (pipelineId: string) => {
    if (!pipelineId) {
      setStages([]);
      setSelectedStageId("");
      return;
    }
    setLoadingStages(true);
    const { data } = await supabase.rpc('get_pipeline_stages', {
      p_pipeline_id: pipelineId,
    });
    const stageList = ((data || []) as any[])
      .filter(s => s.is_active !== false)
      .map(s => ({ id: s.id, name: s.name, position: s.position }))
      .sort((a, b) => a.position - b.position);
    setStages(stageList);

    // Auto-select "Andamento" stage or first stage
    const andamentoStage = stageList.find(s => s.name.toLowerCase() === 'andamento');
    setSelectedStageId(andamentoStage?.id || stageList[0]?.id || "");
    setLoadingStages(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchPipelines();
      // Pré-seleciona o usuário logado como vendedor padrão (pode ser trocado)
      if (profile?.id) {
        setFormData(prev => prev.seller_id ? prev : { ...prev, seller_id: profile.id });
      }
    }
  }, [open, fetchPipelines, profile?.id]);

  useEffect(() => {
    if (selectedPipelineId) {
      fetchStages(selectedPipelineId);
    }
  }, [selectedPipelineId, fetchStages]);

  // Todos os perfis da organização ficam disponíveis no dropdown (admin e vendedor)
  const availableProfiles = profiles;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 AddLeadModal submit', { formData, selectedStageId, selectedPipelineId });

    if (!formData.name.trim()) { alert("Nome é obrigatório"); return; }
    if (!formData.phone.trim()) { alert("Telefone é obrigatório"); return; }
    if (!formData.seller_id.trim()) { alert("Vendedor responsável é obrigatório"); return; }
    if (!selectedStageId) { alert("Etapa do funil é obrigatória"); return; }

    const dataToSave = {
      ...formData,
      valor_negocio: formData.valor_negocio ? parseCurrency(formData.valor_negocio) : undefined,
      stage_id: selectedStageId,
    };

    try {
      await onSave(dataToSave as any);
      setFormData({
        name: "", email: "", phone: "", seller_id: "", source: "",
        interest: "", price: "", observations: "", valor_negocio: "",
        servico: "", cidade: "", estado: ""
      });
      onOpenChange(false);
    } catch (err) {
      console.error('❌ AddLeadModal submit failed:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'valor_negocio') {
      setFormData(prev => ({ ...prev, [field]: formatCurrency(value) }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto card-gradient">
        <DialogHeader>
          <DialogTitle className="font-poppins font-bold text-xl text-foreground">
            Cadastrar Novo Lead
          </DialogTitle>
          <DialogDescription className="font-poppins text-muted-foreground">
            Preencha as informações do cliente para adicionar ao funil de vendas
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção: Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-poppins font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              Informações Básicas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name" className="font-poppins font-medium">
                  Nome Completo *
                </Label>
                <Input 
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Ex: João Silva"
                  className="font-poppins"
                  required
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-poppins font-medium">
                  Telefone/WhatsApp *
                </Label>
                <PhoneInput
                  id="phone"
                  value={formData.phone}
                  onChange={(value) => handleInputChange("phone", value)}
                  placeholder="11999999999"
                  required
                />
              </div>

              {/* E-mail */}
              <div className="space-y-2">
                <Label htmlFor="email" className="font-poppins font-medium">
                  E-mail
                </Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="joao@email.com"
                  className="font-poppins"
                />
              </div>

              {/* Vendedor Responsável */}
              <div className="space-y-2">
                <Label htmlFor="seller" className="font-poppins font-medium">
                  Vendedor Responsável *
                </Label>
                <Select value={formData.seller_id} onValueChange={(value) => handleInputChange("seller_id", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origem */}
              <div className="space-y-2">
                <Label htmlFor="source" className="font-poppins font-medium">
                  Origem
                </Label>
                <Select value={formData.source} onValueChange={(value) => handleInputChange("source", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.length > 0 ? (
                      leadSources.map(source => (
                        <SelectItem key={source.id} value={source.name}>
                          {source.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty__" disabled>
                        Nenhuma origem cadastrada — vá em Configurações → Origens de Leads
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Interesse */}
              <div className="space-y-2">
                <Label htmlFor="interest" className="font-poppins font-medium">
                  Interesse / Detalhes
                </Label>
                <Input 
                  id="interest"
                  value={formData.interest}
                  onChange={(e) => handleInputChange("interest", e.target.value)}
                  placeholder="Descreva o interesse do lead"
                  className="font-poppins"
                />
              </div>
            </div>
          </div>

          {/* Seção: Pipeline e Etapa */}
          <div className="space-y-4">
            <h3 className="font-poppins font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Pipeline e Etapa do Funil
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pipeline */}
              <div className="space-y-2">
                <Label className="font-poppins font-medium">Pipeline *</Label>
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione a pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.is_default ? '(Principal)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Etapa */}
              <div className="space-y-2">
                <Label className="font-poppins font-medium">Etapa do Funil *</Label>
                <Select 
                  value={selectedStageId} 
                  onValueChange={setSelectedStageId}
                  disabled={loadingStages || stages.length === 0}
                >
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder={loadingStages ? "Carregando..." : "Selecione a etapa"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seção: Dados Financeiros */}
          <div className="space-y-4">
            <h3 className="font-poppins font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              Dados Financeiros
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor-negocio" className="font-poppins font-medium">
                  Valor do Negócio
                </Label>
                <Input 
                  id="valor-negocio"
                  value={formData.valor_negocio}
                  onChange={(e) => handleInputChange("valor_negocio", e.target.value)}
                  placeholder="R$ 0,00"
                  className="font-poppins"
                />
                <p className="text-xs text-muted-foreground">Valor estimado da venda</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="servico" className="font-poppins font-medium">
                  Serviço / Produto
                </Label>
                <Input 
                  id="servico"
                  value={formData.servico}
                  onChange={(e) => handleInputChange("servico", e.target.value)}
                  placeholder="Ex: Consultoria, Veículo, Serviço..."
                  className="font-poppins"
                />
              </div>
            </div>
          </div>

          {/* Seção: Localização */}
          <div className="space-y-4">
            <h3 className="font-poppins font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Localização
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade" className="font-poppins font-medium">Cidade</Label>
                <Input 
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => handleInputChange("cidade", e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="font-poppins"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado" className="font-poppins font-medium">Estado</Label>
                <Select value={formData.estado} onValueChange={(value) => handleInputChange("estado", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.value} - {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observations" className="font-poppins font-medium">Observações</Label>
            <Textarea 
              id="observations"
              value={formData.observations}
              onChange={(e) => handleInputChange("observations", e.target.value)}
              placeholder="Informações adicionais sobre o lead..."
              className="font-poppins min-h-[80px]"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="font-poppins font-medium"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              className="btn-gradient text-white font-poppins font-medium"
            >
              Cadastrar Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
