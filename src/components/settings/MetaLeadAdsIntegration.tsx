import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Facebook, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMetaOAuth } from "@/hooks/useMetaOAuth";
import { useMetaIntegrations, CreateIntegrationData, MetaPage, MetaForm, MetaFormField } from "@/hooks/useMetaIntegrations";
import { usePipelines } from "@/hooks/usePipelines";

const CRM_FIELDS = [
  { value: "name", label: "Nome" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "interest", label: "Interesse" },
  { value: "observations", label: "Observações" },
];

const FIXED_MAPPINGS = ["full_name", "email", "phone_number"];

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
  if (status === "error") return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  if (status === "provisioning") return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Provisionando</Badge>;
  return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Inativo</Badge>;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export function MetaLeadAdsIntegration() {
  const { profile, orgId } = useAuth();
  const organizationId = profile?.organization_id || orgId;

  const { account, loading: oauthLoading, initiateOAuth, disconnectMeta } = useMetaOAuth();
  const {
    integrations,
    loading: intLoading,
    fetchPages,
    fetchForms,
    fetchFormFields,
    createIntegration,
    toggleIntegration,
    deleteIntegration,
  } = useMetaIntegrations();
  const { pipelines, stages } = usePipelines();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [forms, setForms] = useState<MetaForm[]>([]);
  const [formFields, setFormFields] = useState<MetaFormField[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  const [formData, setFormData] = useState<Partial<CreateIntegrationData & { metaPageName: string; metaFormName: string }>>({
    fieldMapping: {},
  });

  function resetModal() {
    setStep(1);
    setPages([]);
    setForms([]);
    setFormFields([]);
    setFormData({ fieldMapping: {} });
    setIsModalOpen(false);
  }

  async function openModal() {
    setIsModalOpen(true);
    if (!organizationId) return;
    setLoadingPages(true);
    try {
      const p = await fetchPages(organizationId);
      setPages(p);
    } catch {
      setPages([]);
    } finally {
      setLoadingPages(false);
    }
  }

  async function handlePageChange(pageId: string) {
    const page = pages.find((p) => p.id === pageId);
    setFormData((d) => ({ ...d, metaPageId: pageId, metaPageName: page?.name || "", metaFormId: undefined, metaFormName: undefined }));
    setForms([]);
    setFormFields([]);
    if (!organizationId) return;
    setLoadingForms(true);
    try {
      const f = await fetchForms(organizationId, pageId);
      setForms(f);
    } finally {
      setLoadingForms(false);
    }
  }

  async function handleFormChange(formId: string) {
    const form = forms.find((f) => f.id === formId);
    setFormData((d) => ({ ...d, metaFormId: formId, metaFormName: form?.name || "" }));
    setFormFields([]);
    if (!organizationId) return;
    setLoadingFields(true);
    try {
      const fields = await fetchFormFields(organizationId, formId);
      // Pre-populate fixed mappings
      const mapping: Record<string, string> = {
        full_name: "name",
        email: "email",
        phone_number: "phone",
      };
      setFormData((d) => ({ ...d, fieldMapping: mapping }));
      setFormFields(fields.filter((f) => !FIXED_MAPPINGS.includes(f.key)));
    } finally {
      setLoadingFields(false);
    }
  }

  function handlePipelineChange(pipelineId: string) {
    setFormData((d) => ({ ...d, pipelineId, stageId: undefined }));
  }

  const filteredStages = stages.filter((s) => (s as any).pipeline_id === formData.pipelineId);

  async function handleSave() {
    if (!account || !organizationId) return;
    const data = formData as CreateIntegrationData;
    setSaving(true);
    try {
      await createIntegration({ ...data, metaAccountId: account.id });
      resetModal();
    } finally {
      setSaving(false);
    }
  }

  const canProceedStep1 = formData.campaignName && formData.metaPageId && formData.metaFormId;
  const canProceedStep2 = formData.pipelineId && formData.stageId;

  if (oauthLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Meta Lead Ads</h3>
        <p className="text-sm text-muted-foreground">
          Capture leads de formulários de anúncio do Meta diretamente no CRM.
        </p>
      </div>

      {/* Meta Account Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Facebook className="w-5 h-5 text-blue-600" />
            Conta Meta
          </CardTitle>
          <CardDescription>
            Conecte sua conta do Facebook para acessar páginas e formulários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">{account.meta_user_name || "Conta conectada"}</span>
                {account.token_expires_at && (
                  <span className="text-xs text-muted-foreground">
                    (expira {new Date(account.token_expires_at).toLocaleDateString("pt-BR")})
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={disconnectMeta}>
                Desconectar
              </Button>
            </div>
          ) : (
            <Button onClick={initiateOAuth} className="gap-2">
              <Facebook className="w-4 h-4" />
              Conectar com Facebook
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Integrations List */}
      {account && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Integrações de Formulário</CardTitle>
              <CardDescription>Cada formulário de campanha gera um workflow automático no N8N.</CardDescription>
            </div>
            <Button size="sm" onClick={openModal} className="gap-1">
              <Plus className="w-4 h-4" />
              Nova integração
            </Button>
          </CardHeader>
          <CardContent>
            {intLoading ? (
              <div className="flex justify-center p-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma integração configurada ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Formulário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último lead</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">{integration.campaign_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {integration.meta_form_name || integration.meta_form_id}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={integration.status} />
                        {integration.status === "error" && integration.error_message && (
                          <p className="text-xs text-red-500 mt-1">{integration.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(integration.last_lead_at)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={integration.status === "active"}
                          disabled={integration.status === "provisioning" || !integration.n8n_workflow_id}
                          onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(integration.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Integration Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova integração — Meta Lead Ads</DialogTitle>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex gap-2 text-xs text-muted-foreground mb-2">
            {["Identificação", "Destino no CRM", "Mapeamento"].map((label, i) => (
              <span key={i} className={`flex-1 text-center py-1 rounded ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {i + 1}. {label}
              </span>
            ))}
          </div>

          {/* Step 1: Campaign + Page + Form */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Nome da campanha</Label>
                <Input
                  placeholder="Ex: Black Friday 2026"
                  value={formData.campaignName || ""}
                  onChange={(e) => setFormData((d) => ({ ...d, campaignName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Página do Facebook</Label>
                <Select onValueChange={handlePageChange} value={formData.metaPageId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPages ? "Carregando..." : "Selecione uma página"} />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Formulário</Label>
                <Select onValueChange={handleFormChange} value={formData.metaFormId} disabled={!formData.metaPageId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingForms ? "Carregando..." : "Selecione um formulário"} />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Pipeline + Stage + Seller */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Pipeline</Label>
                <Select onValueChange={handlePipelineChange} value={formData.pipelineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Coluna inicial</Label>
                <Select
                  onValueChange={(v) => setFormData((d) => ({ ...d, stageId: v }))}
                  value={formData.stageId}
                  disabled={!formData.pipelineId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendedor responsável <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Select
                  onValueChange={(v) => setFormData((d) => ({ ...d, sellerId: v === "auto" ? null : v }))}
                  value={formData.sellerId || "auto"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Distribuição automática</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Campos fixos (sempre mapeados): <strong>Nome, E-mail, Telefone</strong>
              </p>
              {loadingFields ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : formFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum campo customizado neste formulário.</p>
              ) : (
                <div className="space-y-3">
                  {formFields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3">
                      <span className="text-sm flex-1 bg-muted rounded px-2 py-1">{field.label || field.key}</span>
                      <span className="text-muted-foreground">→</span>
                      <Select
                        value={formData.fieldMapping?.[field.key] || "ignore"}
                        onValueChange={(v) =>
                          setFormData((d) => ({
                            ...d,
                            fieldMapping: { ...d.fieldMapping, ...(v !== "ignore" ? { [field.key]: v } : {}) },
                          }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Ignorar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Ignorar</SelectItem>
                          {CRM_FIELDS.filter((f) => !["name", "email", "phone"].includes(f.value)).map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : resetModal()}>
              {step === 1 ? "Cancelar" : "Voltar"}
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
              >
                Próximo
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ativando...</> : "Salvar e Ativar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover integração?</AlertDialogTitle>
            <AlertDialogDescription>
              O workflow no N8N será desativado e removido. Os leads já criados no CRM não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteId) {
                  await deleteIntegration(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
