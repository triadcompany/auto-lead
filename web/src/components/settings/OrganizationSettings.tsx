import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2, Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ImageCropDialog, fileToDataUrl } from '@/components/ui/image-crop-dialog';

interface OrgRow {
  id: string;
  name: string;
  cnpj: string | null;
  logo_url: string | null;
}

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function OrganizationSettings() {
  const { user, orgId, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [original, setOriginal] = useState<OrgRow | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orgId || !user?.id) return;
      setLoading(true);

      // Use SECURITY DEFINER RPC because RLS on `organizations` relies on
      // get_my_org_id() which is null in Clerk-authenticated sessions.
      const [{ data: rpcData, error: rpcErr }, { data: clerkOrg }] = await Promise.all([
        supabase.rpc('get_organization_details', {
          p_clerk_user_id: user.id,
          p_organization_id: orgId,
        } as any),
        supabase
          .from('clerk_organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (rpcErr) {
        toast({
          title: 'Erro ao carregar organização',
          description: rpcErr.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      const data: any = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const seedName = (data?.out_name && String(data.out_name).trim()) || clerkOrg?.name || '';
      const row: OrgRow = {
        id: orgId,
        name: seedName,
        cnpj: data?.out_cnpj ?? null,
        logo_url: data?.out_logo_url ?? null,
      };
      setOriginal(row);
      setName(row.name);
      setCnpj(row.cnpj ? formatCnpj(row.cnpj) : '');
      setLogoUrl(row.logo_url);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, user?.id, toast]);

  const handleLogoUpload = async (file: File) => {
    if (!orgId || !user?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O logo deve ter até 2MB.',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const fd = new FormData();
      fd.append('clerk_user_id', user.id);
      fd.append('organization_id', orgId);
      fd.append('file', file);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-org-logo`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json?.public_url) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setLogoUrl(json.public_url);
      toast({ title: 'Logo carregado', description: 'Clique em Salvar para confirmar.' });
    } catch (err: any) {
      toast({
        title: 'Falha no upload',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const cnpjDigits = cnpj.replace(/\D/g, '');
      const { data, error } = await supabase.rpc('update_organization_details', {
        p_clerk_user_id: user.id,
        p_name: name.trim(),
        p_cnpj: cnpjDigits || null,
        p_logo_url: logoUrl,
        p_organization_id: orgId,
      } as any);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      if (row) {
        setOriginal({
          id: row.out_id,
          name: row.out_name,
          cnpj: row.out_cnpj,
          logo_url: row.out_logo_url,
        });
        setName(row.out_name || '');
        setCnpj(row.out_cnpj ? formatCnpj(row.out_cnpj) : '');
        setLogoUrl(row.out_logo_url || null);
      }

      // Sync name + logo to Clerk (best-effort; do not block the success message)
      try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        await fetch(`${SUPABASE_URL}/functions/v1/update-clerk-org`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clerk_user_id: user.id,
            organization_id: orgId,
            name: name.trim(),
            logo_url: logoUrl,
          }),
        });
      } catch {
        // ignore — local DB is the source of truth for the UI
      }

      toast({ title: 'Organização atualizada' });
      // Refresh org switcher list and any org-aware queries
      await queryClient.invalidateQueries();
      // Notify the org switcher (which manages local state, not React Query)
      window.dispatchEvent(new CustomEvent('org-details-updated'));
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
  };

  const dirty =
    !!original &&
    (name.trim() !== (original.name || '') ||
      cnpj.replace(/\D/g, '') !== (original.cnpj || '') ||
      (logoUrl || null) !== (original.logo_url || null));

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="card-gradient border-0">
      <CardHeader>
        <CardTitle className="font-poppins flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Dados da Organização
        </CardTitle>
        <CardDescription className="font-poppins">
          Atualize o nome, CNPJ e logo exibidos para sua equipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Logo */}
            <div className="space-y-3">
              <Label className="font-poppins">Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo da organização"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      // SVG cannot be cropped on canvas reliably — upload as-is
                      if (f.type === 'image/svg+xml') {
                        handleLogoUpload(f);
                        return;
                      }
                      try {
                        const url = await fileToDataUrl(f);
                        setCropSrc(url);
                      } catch {
                        toast({ title: 'Erro ao ler imagem', variant: 'destructive' });
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="font-poppins"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {logoUrl ? 'Trocar logo' : 'Enviar logo'}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="font-poppins text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-poppins">
                    PNG, JPG, WEBP ou SVG. Máximo 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name" className="font-poppins">
                Nome da organização
              </Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Minha Empresa LTDA"
                className="font-poppins"
                maxLength={120}
              />
            </div>

            {/* CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="org-cnpj" className="font-poppins">
                CNPJ
              </Label>
              <Input
                id="org-cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="font-poppins"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground font-poppins">
                Opcional. Apenas números são armazenados.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={!dirty || saving || uploading}
                className="btn-gradient text-white font-poppins"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ImageCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc}
        aspect={1}
        cropShape="rect"
        outputSize={512}
        title="Ajustar logo da organização"
        description="Arraste, gire e use o zoom para enquadrar o logo."
        onCancel={() => setCropSrc(null)}
        onConfirm={async (cropped) => {
          await handleLogoUpload(cropped);
          setCropSrc(null);
        }}
      />
    </Card>
  );
}
