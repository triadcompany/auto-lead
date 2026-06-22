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
  MessageSquare, 
  Plus, 
  Edit, 
  Trash2,
  Copy,
  Variable
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FollowupTemplate } from "@/types/followup";

const TEMPLATE_CATEGORIES = [
  { value: 'primeiro_contato', label: 'Primeiro Contato' },
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'reativacao', label: 'Reativação' },
  { value: 'pos_venda', label: 'Pós-Venda' },
  { value: 'geral', label: 'Geral' },
];

const AVAILABLE_VARIABLES = [
  { key: '{nome}', description: 'Nome do lead' },
  { key: '{vendedor}', description: 'Nome do vendedor' },
  { key: '{empresa}', description: 'Nome da empresa' },
  { key: '{interesse}', description: 'Interesse do lead' },
  { key: '{servico}', description: 'Serviço/Produto' },
];

export function FollowupTemplatesManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<FollowupTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FollowupTemplate | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("geral");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchTemplates();
    }
  }, [profile?.organization_id]);

  const fetchTemplates = async () => {
    if (!profile?.organization_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('followup_templates')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('category', { ascending: true });

      if (error) throw error;
      
      // Extract variables from content
      const templatesWithVars = (data || []).map(t => ({
        ...t,
        variables: t.variables || extractVariables(t.content)
      }));
      
      setTemplates(templatesWithVars);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{[^}]+\}/g) || [];
    return [...new Set(matches)];
  };

  const handleOpenDialog = (template?: FollowupTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setName(template.name);
      setCategory(template.category);
      setContent(template.content);
      setIsActive(template.is_active);
    } else {
      setEditingTemplate(null);
      setName("");
      setCategory("geral");
      setContent("");
      setIsActive(true);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !content || !profile?.organization_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const variables = extractVariables(content);
      
      if (editingTemplate) {
        const { error } = await supabase
          .from('followup_templates')
          .update({
            name,
            category,
            content,
            variables,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast({ title: "Template atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from('followup_templates')
          .insert({
            organization_id: profile.organization_id,
            name,
            category,
            content,
            variables,
            is_active: isActive,
            created_by: profile.user_id,
          });

        if (error) throw error;
        toast({ title: "Template criado com sucesso" });
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Erro ao salvar template",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const { error } = await supabase
        .from('followup_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Template excluído" });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Erro ao excluir template",
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variable: string) => {
    setContent(prev => prev + variable);
  };

  const getCategoryLabel = (value: string) => {
    return TEMPLATE_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <Card className="card-gradient border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Templates de Mensagem
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="btn-gradient text-white">
                <Plus className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
                <DialogDescription>
                  Crie mensagens reutilizáveis com variáveis dinâmicas
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Boas-vindas"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Conteúdo da Mensagem *</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Olá {nome}, tudo bem? Aqui é {vendedor}..."
                    className="min-h-[150px]"
                  />
                </div>

                {/* Variables helper */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Variable className="h-4 w-4" />
                    Variáveis Disponíveis
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <Button
                        key={v.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(v.key)}
                        className="text-xs"
                      >
                        {v.key}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <Label>Template ativo</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="btn-gradient text-white">
                    {saving ? "Salvando..." : "Salvar Template"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum template cadastrado</p>
            <p className="text-sm">Crie templates para agilizar seus follow-ups</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{template.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(template.category)}
                        </Badge>
                        {!template.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.content}
                      </p>
                      {template.variables && template.variables.length > 0 && (
                        <div className="flex items-center gap-1 pt-1">
                          <Variable className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Variáveis: {template.variables.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
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
