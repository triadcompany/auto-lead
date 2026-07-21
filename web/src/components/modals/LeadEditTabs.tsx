import React, { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneInput } from "@/components/ui/phone-input";
import { Lead } from "@/hooks/useSupabaseLeads";
import { useSupabaseProfiles } from "@/hooks/useSupabaseProfiles";
import { usePipelines, PipelineStage } from "@/hooks/usePipelines";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useApi } from "@/hooks/useApi";
import { BRAZILIAN_STATES } from "@/lib/brazilian-states";
import { LeadFollowupTab } from "@/components/followups/LeadFollowupTab";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { User, MessageCircle, Megaphone, History, ExternalLink } from "lucide-react";

function AdInfoRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-poppins text-muted-foreground mb-1">{label}</p>
      {link ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-poppins text-primary hover:underline break-all inline-flex items-center gap-1"
        >
          {value}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <p className="text-sm font-poppins break-all">{value}</p>
      )}
    </div>
  );
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

const parseCurrency = (value: string): number => {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers || '0', 10) / 100;
};

interface LeadEditTabsProps {
  lead: Lead | null;
  onSave: (leadId: string, updatedLead: Partial<Lead>) => void;
  onDelete?: (leadId: string) => void;
  onClose: () => void;
}

export function LeadEditTabs({ lead, onSave, onDelete, onClose }: LeadEditTabsProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    seller_id: "",
    source: "",
    interest: "",
    price: "",
    observations: "",
    stage_id: "",
    valor_negocio: "",
    servico: "",
    cidade: "",
    estado: "",
    meta_campaign_name: "",
    meta_adset_name: "",
    meta_ad_name: "",
  });

  const { profiles } = useSupabaseProfiles();
  const { pipelines } = usePipelines();
  const { leadSources } = useLeadSources();
  const api = useApi();

  // Etapas de TODAS as pipelines, não só a "selecionada" por padrão — o lead
  // pode pertencer a uma pipeline diferente da que abre por padrão, e nesse
  // caso a etapa certa não estaria na lista pra bater com o valor do lead
  // (o Select ficava mostrando vazio mesmo o lead tendo etapa definida).
  const [stages, setStages] = useState<PipelineStage[]>([]);
  useEffect(() => {
    if (pipelines.length === 0) return;
    let cancelled = false;
    Promise.all(pipelines.map((p) => api.pipelines.stages(p.id).catch(() => [] as PipelineStage[])))
      .then((lists) => {
        if (!cancelled) setStages(lists.flat());
      });
    return () => { cancelled = true; };
  }, [pipelines, api]);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone,
        seller_id: lead.seller_id,
        source: lead.source || "",
        interest: lead.interest || "",
        price: lead.price || "",
        observations: lead.observations || "",
        stage_id: lead.stage_id,
        valor_negocio: lead.valor_negocio ? formatCurrency((lead.valor_negocio * 100).toString()) : "",
        servico: lead.servico || "",
        cidade: lead.cidade || "",
        estado: lead.estado || "",
        meta_campaign_name: lead.meta_campaign_name || "",
        meta_adset_name: lead.meta_adset_name || "",
        meta_ad_name: lead.meta_ad_name || "",
      });
    }
  }, [lead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lead) {
      const dataToSave = {
        ...formData,
        valor_negocio: formData.valor_negocio ? parseCurrency(formData.valor_negocio) : null,
      };
      onSave(lead.id, dataToSave);
      onClose();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'valor_negocio') {
      setFormData(prev => ({ ...prev, [field]: formatCurrency(value) }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const hasAdInfo = Boolean(
    lead?.meta_ad_id || lead?.meta_campaign_id || lead?.ctwa_click_id || lead?.ad_source_url
  );

  return (
    <Tabs defaultValue="dados" className="w-full">
      <TabsList className={`grid w-full ${hasAdInfo ? "grid-cols-4" : "grid-cols-3"}`}>
        <TabsTrigger value="dados" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Dados do Lead
        </TabsTrigger>
        <TabsTrigger value="followup" className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Follow-up
        </TabsTrigger>
        {hasAdInfo && (
          <TabsTrigger value="anuncio" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Anúncio
          </TabsTrigger>
        )}
        <TabsTrigger value="historico" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dados" className="mt-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção: Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-poppins font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              Informações Básicas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="font-poppins font-medium">
                  Nome Completo *
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Ex: João Silva"
                  className="font-poppins"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="font-poppins font-medium">
                  Telefone/WhatsApp *
                </Label>
                <PhoneInput
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(value) => handleInputChange("phone", value)}
                  placeholder="11999999999"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email" className="font-poppins font-medium">
                  E-mail
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="joao@email.com"
                  className="font-poppins"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-seller" className="font-poppins font-medium">
                  Vendedor Responsável *
                </Label>
                <Select value={formData.seller_id} onValueChange={(value) => handleInputChange("seller_id", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione o vendedor">
                      {profiles.find((p) => p.id === formData.seller_id)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-red-500 break-all">
                  DEBUG seller: formData.seller_id="{formData.seller_id}" | profiles={profiles.length} | match={profiles.find((p) => p.id === formData.seller_id)?.name ?? "NENHUM"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-source" className="font-poppins font-medium">
                  Origem *
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
                      <>
                        <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="Indicação">Indicação</SelectItem>
                        <SelectItem value="Orgânico">Orgânico</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stage" className="font-poppins font-medium">
                  Etapa do Lead *
                </Label>
                <Select value={formData.stage_id} onValueChange={(value) => handleInputChange("stage_id", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione a etapa">
                      {stages.find((s) => s.id === formData.stage_id)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-red-500 break-all">
                  DEBUG stage: formData.stage_id="{formData.stage_id}" | stages={stages.length} | match={stages.find((s) => s.id === formData.stage_id)?.name ?? "NENHUM"}
                </p>
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
                <Label htmlFor="edit-valor-negocio" className="font-poppins font-medium">
                  Valor do Negócio
                </Label>
                <Input
                  id="edit-valor-negocio"
                  value={formData.valor_negocio}
                  onChange={(e) => handleInputChange("valor_negocio", e.target.value)}
                  placeholder="R$ 0,00"
                  className="font-poppins"
                />
                <p className="text-xs text-muted-foreground">
                  Valor estimado da venda
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-servico" className="font-poppins font-medium">
                  Serviço / Produto
                </Label>
                <Input
                  id="edit-servico"
                  value={formData.servico}
                  onChange={(e) => handleInputChange("servico", e.target.value)}
                  placeholder="Ex: Consultoria, Veículo, Serviço..."
                  className="font-poppins"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-interest" className="font-poppins font-medium">
                  Interesse / Detalhes
                </Label>
                <Input
                  id="edit-interest"
                  value={formData.interest}
                  onChange={(e) => handleInputChange("interest", e.target.value)}
                  placeholder="Descreva o interesse do lead"
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
                <Label htmlFor="edit-cidade" className="font-poppins font-medium">
                  Cidade
                </Label>
                <Input
                  id="edit-cidade"
                  value={formData.cidade}
                  onChange={(e) => handleInputChange("cidade", e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="font-poppins"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-estado" className="font-poppins font-medium">
                  Estado
                </Label>
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
            <Label htmlFor="edit-observations" className="font-poppins font-medium">
              Observações
            </Label>
            <Textarea
              id="edit-observations"
              value={formData.observations}
              onChange={(e) => handleInputChange("observations", e.target.value)}
              placeholder="Informações adicionais sobre o lead..."
              className="font-poppins min-h-[80px]"
            />
          </div>

          {/* Status do Lead */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="font-poppins font-medium text-sm mb-2">Informações do Lead</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-poppins font-medium text-muted-foreground">ID:</span>
                <p className="font-poppins text-xs truncate">{lead?.id}</p>
              </div>
              <div>
                <span className="font-poppins font-medium text-muted-foreground">Criado em:</span>
                <p className="font-poppins">{lead ? new Date(lead.created_at).toLocaleDateString() : ''}</p>
              </div>
              <div>
                <span className="font-poppins font-medium text-muted-foreground">Etapa atual:</span>
                <p className="font-poppins capitalize">{lead?.stage_name}</p>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-between pt-4">
            {onDelete && lead && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.')) {
                    onDelete(lead.id);
                    onClose();
                  }
                }}
                className="font-poppins font-medium"
              >
                Excluir Lead
              </Button>
            )}
            <div className="flex space-x-3 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="font-poppins font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="btn-gradient text-white font-poppins font-medium"
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="followup" className="mt-4">
        {lead && (
          <LeadFollowupTab
            leadId={lead.id}
            leadName={lead.name}
            leadPhone={lead.phone}
            sellerId={lead.seller_id}
          />
        )}
      </TabsContent>

      {hasAdInfo && (
        <TabsContent value="anuncio" className="mt-4">
          {lead && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-poppins font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Informações de Anúncios
                </h3>
                <p className="text-xs text-muted-foreground font-poppins">
                  Campos relacionados ao anúncio que originou este contato
                </p>
              </div>
              <div className="rounded-lg border divide-y">
                {lead.meta_campaign_name && <AdInfoRow label="Campanha" value={lead.meta_campaign_name} />}
                {lead.meta_adset_name && <AdInfoRow label="Conjunto de anúncios" value={lead.meta_adset_name} />}
                {lead.meta_ad_name && <AdInfoRow label="Anúncio" value={lead.meta_ad_name} />}
                {lead.ctwa_click_id && <AdInfoRow label="CTWA Click ID" value={lead.ctwa_click_id} />}
                {lead.ad_source_url && <AdInfoRow label="URL de origem" value={lead.ad_source_url} link />}
                {lead.ad_source_id && <AdInfoRow label="ID de origem" value={lead.ad_source_id} />}
                {lead.ad_media_url && <AdInfoRow label="URL da mídia" value={lead.ad_media_url} link />}
                {lead.ad_thumbnail_url && (
                  <div className="px-4 py-3">
                    <p className="text-xs font-poppins text-muted-foreground mb-2">URL da miniatura</p>
                    <a href={lead.ad_thumbnail_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={lead.ad_thumbnail_url}
                        alt="Miniatura do anúncio"
                        className="max-w-[220px] rounded-lg border"
                      />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      )}

      <TabsContent value="historico" className="mt-4">
        {lead && <LeadTimeline leadId={lead.id} />}
      </TabsContent>
    </Tabs>
  );
}
