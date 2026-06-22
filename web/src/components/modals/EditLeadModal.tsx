import React, { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneInput } from "@/components/ui/phone-input";
import { Lead } from "@/hooks/useSupabaseLeads";
import { useSupabaseProfiles } from "@/hooks/useSupabaseProfiles";
import { usePipelines } from "@/hooks/usePipelines";
import { useLeadSources } from "@/hooks/useLeadSources";
import { BRAZILIAN_STATES } from "@/lib/brazilian-states";
import { LeadFollowupTab } from "@/components/followups/LeadFollowupTab";
import { User, MessageCircle } from "lucide-react";

interface EditLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (leadId: string, updatedLead: Partial<Lead>) => void;
  onDelete?: (leadId: string) => void;
}

// Função para formatar valor em moeda brasileira
const formatCurrency = (value: string) => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  // Converte para número e divide por 100 para considerar centavos
  const amount = parseInt(numbers || '0', 10) / 100;
  // Formata como moeda brasileira
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

export function EditLeadModal({ open, onOpenChange, lead, onSave, onDelete }: EditLeadModalProps) {
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
    // Novos campos financeiros e de localização
    valor_negocio: "",
    servico: "",
    cidade: "",
    estado: ""
  });
  
  const { profiles } = useSupabaseProfiles();
  const { stages } = usePipelines();
  const { leadSources } = useLeadSources();

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
        // Novos campos
        valor_negocio: lead.valor_negocio ? formatCurrency((lead.valor_negocio * 100).toString()) : "",
        servico: lead.servico || "",
        cidade: lead.cidade || "",
        estado: lead.estado || ""
      });
    }
  }, [lead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lead) {
      // Preparar dados para salvar, convertendo valor_negocio para número
      const dataToSave = {
        ...formData,
        valor_negocio: formData.valor_negocio ? parseCurrency(formData.valor_negocio) : null,
      };
      onSave(lead.id, dataToSave);
      onOpenChange(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'valor_negocio') {
      // Formatar como moeda
      setFormData(prev => ({ ...prev, [field]: formatCurrency(value) }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto card-gradient">
        <DialogHeader>
          <DialogTitle className="font-poppins font-bold text-xl text-foreground">
            Editar Lead
          </DialogTitle>
          <DialogDescription className="font-poppins text-muted-foreground">
            Atualize as informações do cliente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Lead
            </TabsTrigger>
            <TabsTrigger value="followup" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Follow-up
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
              {/* Nome */}
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

              {/* Telefone */}
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

              {/* E-mail */}
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

              {/* Vendedor Responsável */}
              <div className="space-y-2">
                <Label htmlFor="edit-seller" className="font-poppins font-medium">
                  Vendedor Responsável *
                </Label>
                <Select value={formData.seller_id} onValueChange={(value) => handleInputChange("seller_id", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origem */}
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

              {/* Etapa do Lead */}
              <div className="space-y-2">
                <Label htmlFor="edit-stage" className="font-poppins font-medium">
                  Etapa do Lead *
                </Label>
                <Select value={formData.stage_id} onValueChange={(value) => handleInputChange("stage_id", value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Selecione a etapa" />
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
              {/* Valor do Negócio */}
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

              {/* Serviço/Interesse */}
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

              {/* Interesse (campo legado) */}
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
              {/* Cidade */}
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

              {/* Estado */}
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
                    onOpenChange(false);
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
                onClick={() => onOpenChange(false)}
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}