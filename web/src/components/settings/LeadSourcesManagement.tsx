import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadSources } from "@/hooks/useLeadSources";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, MapPin, Target, Shield, Pencil } from "lucide-react";

export function LeadSourcesManagement() {
  const { isAdmin } = useAuth();
  const { leadSources, loading, createSource, updateSource, deleteSource } = useLeadSources();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<{ id: string; name: string; description: string | null; sort_order: number } | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");

  const openCreate = () => {
    setEditingSource(null);
    setFormName("");
    setFormDescription("");
    setFormSortOrder("0");
    setDialogOpen(true);
  };

  const openEdit = (source: { id: string; name: string; description: string | null; sort_order: number }) => {
    setEditingSource(source);
    setFormName(source.name);
    setFormDescription(source.description || "");
    setFormSortOrder(String(source.sort_order));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingSource) {
      await updateSource.mutateAsync({
        id: editingSource.id,
        name: formName,
        description: formDescription || null,
        sort_order: Number(formSortOrder) || 0,
      });
    } else {
      await createSource.mutateAsync({
        name: formName,
        description: formDescription || undefined,
        sort_order: Number(formSortOrder) || 0,
      });
    }
    setDialogOpen(false);
  };

  if (!isAdmin) {
    return null;
  }

  const isSaving = createSource.isPending || updateSource.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-poppins font-semibold text-foreground">Origens de Leads</h3>
          <p className="text-sm text-muted-foreground font-poppins">Gerencie as origens dos seus leads (ex: Site, WhatsApp, Indicação, etc.)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient text-white font-poppins" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nova Origem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-poppins">{editingSource ? "Editar Origem" : "Criar Nova Origem"}</DialogTitle>
              <DialogDescription className="font-poppins">
                {editingSource ? "Altere os dados da origem." : "Adicione uma nova origem para classificar seus leads."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sourceName" className="font-poppins">Nome da Origem</Label>
                <Input id="sourceName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Site, WhatsApp, Indicação" className="font-poppins" />
              </div>
              <div>
                <Label htmlFor="sourceDescription" className="font-poppins">Descrição (opcional)</Label>
                <Textarea id="sourceDescription" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição adicional" className="font-poppins" rows={3} />
              </div>
              <div>
                <Label htmlFor="sortOrder" className="font-poppins">Ordem de exibição</Label>
                <Input id="sortOrder" type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(e.target.value)} className="font-poppins" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-poppins">Cancelar</Button>
                <Button onClick={handleSave} className="btn-gradient text-white font-poppins" disabled={isSaving || !formName.trim()}>
                  {isSaving ? "Salvando..." : editingSource ? "Salvar" : "Criar Origem"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-2 font-poppins text-muted-foreground text-sm">Carregando origens...</p>
          </div>
        ) : leadSources.length === 0 ? (
          <Card className="card-gradient border-0">
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-poppins font-semibold mb-2">Nenhuma origem cadastrada</h4>
              <p className="text-muted-foreground font-poppins mb-4">Crie origens para classificar e organizar melhor seus leads.</p>
            </CardContent>
          </Card>
        ) : (
          leadSources.map((source) => (
            <Card key={source.id} className="card-gradient border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-poppins font-semibold text-foreground">{source.name}</h4>
                      {source.description && <p className="text-sm text-muted-foreground font-poppins">{source.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="font-poppins">Ativo</Badge>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(source)} className="font-poppins">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="font-poppins text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-poppins">Remover origem de lead</AlertDialogTitle>
                          <AlertDialogDescription className="font-poppins">
                            Tem certeza que deseja remover a origem "{source.name}"? Leads existentes não serão afetados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="font-poppins">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSource.mutate(source.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-poppins">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
