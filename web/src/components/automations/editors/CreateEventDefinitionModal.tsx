import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  onCreated: (def: { id: string; name: string; meta_event_name: string }) => void;
}

export function CreateEventDefinitionModal({ open, onClose, organizationId, onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    meta_event_name: "",
    default_currency: "BRL",
    send_value: true,
    send_user_data: true,
    send_location: true,
    active: true,
  });

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.meta_event_name.trim()) {
      toast({ title: "Erro", description: "Preencha nome e nome do evento Meta.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("capi_event_definitions" as any)
      .insert({
        organization_id: organizationId,
        name: form.name.trim(),
        meta_event_name: form.meta_event_name.trim(),
        default_currency: form.default_currency || "BRL",
        send_value: form.send_value,
        send_user_data: form.send_user_data,
        send_location: form.send_location,
        active: form.active,
      })
      .select("id, name, meta_event_name")
      .single();
    setSaving(false);

    if (error) {
      const isDuplicate = error.message?.includes("uq_capi_event_def_org_meta_name") || error.code === "23505";
      toast({
        title: "Erro",
        description: isDuplicate
          ? "Já existe um evento com esse meta_event_name nesta organização."
          : error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Sucesso", description: "Evento criado com sucesso." });
    onCreated(data as any);
    setForm({
      name: "",
      meta_event_name: "",
      default_currency: "BRL",
      send_value: true,
      send_user_data: true,
      send_location: true,
      active: true,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-poppins">Criar Evento Personalizado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="font-poppins text-sm">Nome interno (exibido no CRM)</Label>
            <Input
              className="mt-1.5"
              placeholder="Ex: Lead Qualificado"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <Label className="font-poppins text-sm">Nome do evento Meta (event_name)</Label>
            <Input
              className="mt-1.5"
              placeholder="Ex: QualifiedLead"
              value={form.meta_event_name}
              onChange={(e) => update("meta_event_name", e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Este é o valor enviado como event_name na Conversions API.
            </p>
          </div>
          <div>
            <Label className="font-poppins text-sm">Moeda padrão</Label>
            <Input
              className="mt-1.5 w-32"
              placeholder="BRL"
              value={form.default_currency}
              onChange={(e) => update("default_currency", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="font-poppins text-sm">Enviar valor</Label>
            <Switch checked={form.send_value} onCheckedChange={(v) => update("send_value", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-poppins text-sm">Enviar dados do usuário (PII)</Label>
            <Switch checked={form.send_user_data} onCheckedChange={(v) => update("send_user_data", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-poppins text-sm">Enviar localização</Label>
            <Switch checked={form.send_location} onCheckedChange={(v) => update("send_location", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-poppins text-sm">Ativo</Label>
            <Switch checked={form.active} onCheckedChange={(v) => update("active", v)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
