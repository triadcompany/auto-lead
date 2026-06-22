import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  PlayCircle, 
  Plus, 
  Edit, 
  Trash2,
  Clock,
  MessageCircle,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FollowupCadence, FollowupCadenceStep, MessageChannel } from "@/types/followup";

const DEFAULT_CADENCES = [
  {
    name: 'Cadência Padrão',
    description: 'Sequência ideal para novos leads',
    steps: [
      { delay_hours: 2, channel: 'whatsapp' as MessageChannel },
      { delay_hours: 24, channel: 'whatsapp' as MessageChannel },
      { delay_hours: 72, channel: 'whatsapp' as MessageChannel },
      { delay_hours: 168, channel: 'whatsapp' as MessageChannel },
    ]
  },
  {
    name: 'Reativação',
    description: 'Para leads inativos há mais de 14 dias',
    steps: [
      { delay_hours: 0, channel: 'whatsapp' as MessageChannel },
      { delay_hours: 72, channel: 'whatsapp' as MessageChannel },
    ]
  }
];

export function FollowupCadencesManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [cadences, setCadences] = useState<FollowupCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCadence, setEditingCadence] = useState<FollowupCadence | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<FollowupCadenceStep[]>([{ delay_hours: 2, channel: 'whatsapp' }]);
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchCadences();
    }
  }, [profile?.organization_id]);

  const fetchCadences = async () => {
    if (!profile?.organization_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('followup_cadences')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      const parsedCadences = (data || []).map(c => ({
        ...c,
        steps: (c.steps as unknown as FollowupCadenceStep[]) || []
      }));
      
      setCadences(parsedCadences);
    } catch (error) {
      console.error('Error fetching cadences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (cadence?: FollowupCadence) => {
    if (cadence) {
      setEditingCadence(cadence);
      setName(cadence.name);
      setDescription(cadence.description || "");
      setSteps(cadence.steps);
      setIsDefault(cadence.is_default);
      setIsActive(cadence.is_active);
    } else {
      setEditingCadence(null);
      setName("");
      setDescription("");
      setSteps([{ delay_hours: 2, channel: 'whatsapp' }]);
      setIsDefault(false);
      setIsActive(true);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || steps.length === 0 || !profile?.organization_id) {
      toast({
        title: "Erro",
        description: "Preencha o nome e adicione pelo menos um passo",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingCadence) {
        const { error } = await supabase
          .from('followup_cadences')
          .update({
            name,
            description,
            steps: steps as unknown as any,
            is_default: isDefault,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCadence.id);

        if (error) throw error;
        toast({ title: "Cadência atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from('followup_cadences')
          .insert({
            organization_id: profile.organization_id,
            name,
            description,
            steps: steps as unknown as any,
            is_default: isDefault,
            is_active: isActive,
            created_by: profile.user_id,
          });

        if (error) throw error;
        toast({ title: "Cadência criada com sucesso" });
      }

      setDialogOpen(false);
      fetchCadences();
    } catch (error) {
      console.error('Error saving cadence:', error);
      toast({
        title: "Erro ao salvar cadência",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta cadência?')) return;

    try {
      const { error } = await supabase
        .from('followup_cadences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Cadência excluída" });
      fetchCadences();
    } catch (error) {
      console.error('Error deleting cadence:', error);
      toast({
        title: "Erro ao excluir cadência",
        variant: "destructive",
      });
    }
  };

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    const newDelay = lastStep ? lastStep.delay_hours + 24 : 2;
    setSteps([...steps, { delay_hours: newDelay, channel: 'whatsapp' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof FollowupCadenceStep, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const formatDelayHours = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `D+${days}`;
    return `D+${days} ${remainingHours}h`;
  };

  const createDefaultCadences = async () => {
    if (!profile?.organization_id) return;
    
    try {
      for (const cadence of DEFAULT_CADENCES) {
        const { error } = await supabase
          .from('followup_cadences')
          .insert({
            organization_id: profile.organization_id,
            name: cadence.name,
            description: cadence.description,
            steps: cadence.steps as unknown as any,
            is_default: cadence.name === 'Cadência Padrão',
            is_active: true,
            created_by: profile.user_id,
          });

        if (error) throw error;
      }
      
      toast({ title: "Cadências padrão criadas com sucesso" });
      fetchCadences();
    } catch (error) {
      console.error('Error creating default cadences:', error);
    }
  };

  return (
    <Card className="card-gradient border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Cadências de Follow-up
          </CardTitle>
          <div className="flex gap-2">
            {cadences.length === 0 && (
              <Button variant="outline" onClick={createDefaultCadences}>
                Criar Cadências Padrão
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} className="btn-gradient text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Cadência
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingCadence ? 'Editar Cadência' : 'Nova Cadência'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure uma sequência automática de follow-ups
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Cadência Padrão"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descrição breve"
                      />
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Passos da Cadência</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addStep}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Passo
                      </Button>
                    </div>
                    
                    {steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary">
                            {index + 1}
                          </span>
                        </div>
                        
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Atraso (horas)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={step.delay_hours}
                              onChange={(e) => updateStep(index, 'delay_hours', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                            <span className="text-xs text-muted-foreground">
                              = {formatDelayHours(step.delay_hours)}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Canal</Label>
                            <Select 
                              value={step.channel} 
                              onValueChange={(v: MessageChannel) => updateStep(index, 'channel', v)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="email">E-mail</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStep(index)}
                          disabled={steps.length <= 1}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                        <Label>Cadência padrão</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                        <Label>Ativa</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="btn-gradient text-white">
                      {saving ? "Salvando..." : "Salvar Cadência"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cadences.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <PlayCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma cadência cadastrada</p>
            <p className="text-sm">Crie cadências para automatizar seus follow-ups</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {cadences.map((cadence) => (
              <Card key={cadence.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{cadence.name}</h4>
                        {cadence.is_default && (
                          <Badge className="text-xs">Padrão</Badge>
                        )}
                        {!cadence.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativa</Badge>
                        )}
                      </div>
                      {cadence.description && (
                        <p className="text-sm text-muted-foreground">
                          {cadence.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3" />
                          {cadence.steps.length} mensagens
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {cadence.steps.map((s, i) => (
                            <span key={i}>
                              {i > 0 && " → "}
                              {formatDelayHours(s.delay_hours)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(cadence)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cadence.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
