import React, { useState, useCallback, useEffect } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useSupabaseProfiles } from "@/hooks/useSupabaseProfiles";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CreateLeadFromInboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string | null;
  contactPhone: string;
  onSave: (data: {
    name: string;
    phone: string;
    email?: string;
    seller_id: string;
    source?: string;
    interest?: string;
    observations?: string;
    valor_negocio?: number;
    servico?: string;
    cidade?: string;
    estado?: string;
    stage_id: string;
  }) => Promise<string | null>;
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

const formatCurrency = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const amount = parseInt(numbers || '0', 10) / 100;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseCurrency = (value: string): number => {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers || '0', 10) / 100;
};

export function CreateLeadFromInboxModal({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  onSave,
}: CreateLeadFromInboxModalProps) {
  const { profile, role, user } = useAuth();
  const { profiles } = useSupabaseProfiles();
  const { leadSources } = useLeadSources();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(contactName || "");
  const [phone, setPhone] = useState(contactPhone || "");
  const [email, setEmail] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [source, setSource] = useState("");
  const [interest, setInterest] = useState("");
  const [observations, setObservations] = useState("");
  const [valorNegocio, setValorNegocio] = useState("");
  const [servico, setServico] = useState("");

  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [loadingStages, setLoadingStages] = useState(false);

  const availableProfiles = React.useMemo(() => {
    if (role === 'seller' && user) return profiles.filter(p => p.id === user.id);
    return profiles;
  }, [profiles, role, user]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName(contactName || "");
      setPhone(contactPhone || "");
      setEmail("");
      setSellerId(profile?.id || "");
      setSource("");
      setInterest("");
      setObservations("");
      setValorNegocio("");
      setServico("");
      fetchPipelines();
    }
  }, [open]);

  const fetchPipelines = useCallback(async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase.rpc('get_org_pipelines', {
      p_org_id: profile.organization_id,
    });
    const list = ((data || []) as any[]).map(p => ({
      id: p.id, name: p.name, is_default: p.is_default,
    }));
    setPipelines(list);
    const def = list.find(p => p.is_default) || list[0];
    if (def) setSelectedPipelineId(def.id);
  }, [profile?.organization_id]);

  useEffect(() => {
    if (!selectedPipelineId) return;
    setLoadingStages(true);
    supabase.rpc('get_pipeline_stages', { p_pipeline_id: selectedPipelineId })
      .then(({ data }) => {
        const stageList = ((data || []) as any[])
          .filter(s => s.is_active !== false)
          .map(s => ({ id: s.id, name: s.name, position: s.position }))
          .sort((a, b) => a.position - b.position);
        setStages(stageList);
        const andamento = stageList.find(s => s.name.toLowerCase() === 'andamento');
        setSelectedStageId(andamento?.id || stageList[0]?.id || "");
        setLoadingStages(false);
      });
  }, [selectedPipelineId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !sellerId || !selectedStageId) return;

    setSaving(true);
    await onSave({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      seller_id: sellerId,
      source: source || undefined,
      interest: interest || undefined,
      observations: observations || undefined,
      valor_negocio: valorNegocio ? parseCurrency(valorNegocio) : undefined,
      servico: servico || undefined,
      stage_id: selectedStageId,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Criar Lead a partir da Conversa</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            O lead será vinculado automaticamente a esta conversa
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do contato" required />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <PhoneInput value={phone} onChange={setPhone} placeholder="11999999999" required />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Vendedor *</Label>
              <Select value={sellerId} onValueChange={setSellerId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {leadSources.length > 0 ? leadSources.map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  )) : (
                    <>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                      <SelectItem value="Orgânico">Orgânico</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Interesse</Label>
              <Input value={interest} onChange={e => setInterest(e.target.value)} placeholder="Descreva o interesse" />
            </div>
          </div>

          {/* Pipeline & Stage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pipeline *</Label>
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.is_default ? ' (Principal)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa *</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={loadingStages}>
                <SelectTrigger><SelectValue placeholder={loadingStages ? "Carregando..." : "Etapa"} /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor do Negócio</Label>
              <Input value={valorNegocio} onChange={e => setValorNegocio(formatCurrency(e.target.value))} placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label>Serviço / Produto</Label>
              <Input value={servico} onChange={e => setServico(e.target.value)} placeholder="Ex: Consultoria" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Informações adicionais..." className="min-h-[60px]" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !name.trim() || !sellerId || !selectedStageId}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : 'Criar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
