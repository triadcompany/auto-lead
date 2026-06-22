import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgRole } from '@/hooks/useOrgRole';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  User, Shield, Wifi, WifiOff, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Play, Loader2
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────── */

type TestStatus = 'idle' | 'running' | 'pass' | 'fail' | 'error';

interface TestResult {
  name: string;
  description: string;
  expectedAdmin: boolean;
  expectedSeller: boolean;
  status: TestStatus;
  message?: string;
  timestamp?: string;
}

const StatusBadge = ({ status }: { status: TestStatus }) => {
  switch (status) {
    case 'pass':
      return <Badge className="bg-primary text-primary-foreground font-poppins gap-1"><CheckCircle2 className="h-3 w-3" /> PASS</Badge>;
    case 'fail':
      return <Badge variant="destructive" className="font-poppins gap-1"><XCircle className="h-3 w-3" /> FAIL</Badge>;
    case 'error':
      return <Badge variant="destructive" className="font-poppins gap-1"><AlertTriangle className="h-3 w-3" /> ERROR</Badge>;
    case 'running':
      return <Badge variant="secondary" className="font-poppins gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Rodando…</Badge>;
    default:
      return <Badge variant="outline" className="font-poppins">Pendente</Badge>;
  }
};

/* ── component ───────────────────────────────────────────────── */

export default function AdminDiagnostico() {
  const { user, profile } = useAuth();
  const { orgId, role, isAdmin, isSeller, loading } = useOrgRole();
  const { organization } = useOrganization();

  /* WhatsApp state */
  const [waStatus, setWaStatus] = useState<{ instance?: string; status?: string; updated?: string } | null>(null);
  const [waLoading, setWaLoading] = useState(false);

  const fetchWhatsApp = useCallback(async () => {
    if (!orgId) return;
    setWaLoading(true);
    try {
      const { data } = await supabase
        .from('whatsapp_routing_settings')
        .select('enabled, mode, updated_at')
        .eq('organization_id', orgId)
        .limit(1)
        .maybeSingle();
      setWaStatus(data ? { instance: data.mode || '—', status: data.enabled ? 'connected' : 'disconnected', updated: data.updated_at } : { status: 'Nenhuma configuração' });
    } catch { setWaStatus({ status: 'Erro ao buscar' }); }
    setWaLoading(false);
  }, [orgId]);

  /* RLS tests */
  const initialTests: TestResult[] = [
    { name: 'Update configuração sensível', description: 'UPDATE em lead_distribution_settings (campo updated_at)', expectedAdmin: true, expectedSeller: false, status: 'idle' },
    { name: 'Criar automação', description: 'INSERT em automations (dummy)', expectedAdmin: true, expectedSeller: true, status: 'idle' },
    { name: 'Atualizar valor de venda', description: 'UPDATE amount em opportunities', expectedAdmin: true, expectedSeller: true, status: 'idle' },
    { name: 'Criar evento CAPI', description: 'INSERT em capi_event_definitions (dummy)', expectedAdmin: true, expectedSeller: false, status: 'idle' },
  ];

  const [tests, setTests] = useState<TestResult[]>(initialTests);
  const [allRunning, setAllRunning] = useState(false);

  const updateTest = (idx: number, patch: Partial<TestResult>) => {
    setTests(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const runTest = async (idx: number) => {
    updateTest(idx, { status: 'running', message: undefined });
    const test = tests[idx];
    const expected = isAdmin ? test.expectedAdmin : test.expectedSeller;
    const ts = new Date().toISOString();

    try {
      let succeeded = false;

      switch (idx) {
        case 0: { // update sensitive setting
          const { error } = await supabase
            .from('lead_distribution_settings')
            .update({ updated_at: new Date().toISOString() })
            .eq('organization_id', orgId!);
          succeeded = !error;
          if (error) updateTest(idx, { message: error.message });
          break;
        }
        case 1: { // create automation
          const dummyName = `Teste Permissão - ${Date.now()}`;
          const { data, error } = await supabase
            .from('automations')
            .insert({ name: dummyName, organization_id: orgId!, created_by: user?.id || 'diag', channel: 'whatsapp' })
            .select('id')
            .single();
          succeeded = !error && !!data;
          if (error) updateTest(idx, { message: error.message });
          // cleanup
          if (data?.id) await supabase.from('automations').delete().eq('id', data.id);
          break;
        }
        case 2: { // update sale value
          const { data: opp } = await supabase
            .from('opportunities')
            .select('id, value')
            .eq('organization_id', orgId!)
            .limit(1)
            .maybeSingle();
          if (!opp) {
            updateTest(idx, { status: 'error', message: 'Nenhuma oportunidade encontrada para testar', timestamp: ts });
            return;
          }
          const { error } = await supabase
            .from('opportunities')
            .update({ value: opp.value ?? 0 })
            .eq('id', opp.id);
          succeeded = !error;
          if (error) updateTest(idx, { message: error.message });
          break;
        }
        case 3: { // create CAPI event
          const { data, error } = await supabase
            .from('capi_event_definitions')
            .insert({ name: 'TesteDiagnostico', meta_event_name: 'Lead', organization_id: orgId! })
            .select('id')
            .single();
          succeeded = !error && !!data;
          if (error) updateTest(idx, { message: error.message });
          // cleanup
          if (data?.id) await supabase.from('capi_event_definitions').delete().eq('id', data.id);
          break;
        }
      }

      const pass = succeeded === expected;
      updateTest(idx, { status: pass ? 'pass' : 'fail', timestamp: ts, message: tests[idx].message || (succeeded ? 'Operação teve sucesso' : 'Operação bloqueada pelo RLS') });
    } catch (err: any) {
      const pass = !expected; // if we expected failure and got an exception, that's a pass
      updateTest(idx, { status: pass ? 'pass' : 'error', message: err.message, timestamp: ts });
    }
  };

  const runAllTests = async () => {
    setAllRunning(true);
    for (let i = 0; i < tests.length; i++) {
      await runTest(i);
    }
    setAllRunning(false);
  };

  /* Permissions matrix */
  const permMatrix = [
    { name: 'Configurações (visualizar)', admin: true, seller: true },
    { name: 'Configurações (editar)', admin: true, seller: false },
    { name: 'Editar valor de venda', admin: true, seller: true },
    { name: 'Automações (criar/editar)', admin: true, seller: true },
    { name: 'Lead routing / webhooks', admin: true, seller: false },
    { name: 'Criar evento CAPI', admin: true, seller: false },
    { name: 'Relatórios (visualizar)', admin: true, seller: true },
    { name: 'Gerenciar usuários', admin: true, seller: false },
  ];

  const env = import.meta.env.MODE || 'production';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnóstico de Permissões"
        description="Validação de identidade, roles e RLS em tempo real"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Card 1: Identidade ─────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-poppins">
              <User className="h-4 w-4" /> Identidade do Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-poppins">
            <Row label="User ID (Clerk)" value={user?.id} />
            <Row label="Email" value={user?.email || profile?.email} />
            <Row label="Role" value={role}>
              <Badge variant={isAdmin ? 'default' : 'secondary'} className="ml-2">
                {isAdmin ? 'admin' : role || '—'}
              </Badge>
            </Row>
            <Row label="isAdmin" value={String(isAdmin)} />
            <Row label="isSeller" value={String(isSeller)} />
            <Row label="Organization ID" value={orgId} />
            <Row label="Organization Name" value={organization?.name} />
            <Row label="Ambiente" value={env} />
          </CardContent>
        </Card>

        {/* ── Card 2: WhatsApp ───────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-poppins">
              {waStatus?.status === 'connected' ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
              Estado do WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-poppins">
            {waStatus ? (
              <>
                <Row label="Instância" value={waStatus.instance || '—'} />
                <Row label="Status" value={waStatus.status || '—'}>
                  <Badge variant={waStatus.status === 'connected' ? 'default' : 'outline'} className="ml-2">
                    {waStatus.status === 'connected' ? 'Connected' : waStatus.status || 'Unknown'}
                  </Badge>
                </Row>
                <Row label="Última atualização" value={waStatus.updated ? new Date(waStatus.updated).toLocaleString('pt-BR') : '—'} />
              </>
            ) : (
              <p className="text-muted-foreground">Clique em "Revalidar" para buscar.</p>
            )}
            <Button size="sm" variant="outline" onClick={fetchWhatsApp} disabled={waLoading} className="mt-2 font-poppins">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${waLoading ? 'animate-spin' : ''}`} /> Revalidar status
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Card 3: Matriz de Permissões ─────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-poppins">
            <Shield className="h-4 w-4" /> Matriz de Permissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-poppins">Permissão</TableHead>
                <TableHead className="font-poppins text-center">Admin</TableHead>
                <TableHead className="font-poppins text-center">Seller</TableHead>
                <TableHead className="font-poppins text-center">Você ({role || '…'})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permMatrix.map((p) => {
                const currentAllowed = isAdmin ? p.admin : p.seller;
                return (
                  <TableRow key={p.name}>
                    <TableCell className="font-poppins">{p.name}</TableCell>
                    <TableCell className="text-center">{p.admin ? '✅' : '❌'}</TableCell>
                    <TableCell className="text-center">{p.seller ? '✅' : '❌'}</TableCell>
                    <TableCell className="text-center">{currentAllowed ? '✅' : '❌'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Card 4: Testes reais de RLS ──────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-poppins">
            <AlertTriangle className="h-4 w-4" /> Prova no Banco (RLS)
          </CardTitle>
          <Button size="sm" onClick={runAllTests} disabled={allRunning} className="font-poppins">
            {allRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
            Rodar todos os testes
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {tests.map((t, idx) => (
            <div key={t.name} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-poppins font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-poppins">{t.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <Button size="sm" variant="outline" onClick={() => runTest(idx)} disabled={t.status === 'running' || allRunning} className="font-poppins text-xs">
                    Rodar
                  </Button>
                </div>
              </div>
              <div className="flex gap-4 text-xs font-poppins text-muted-foreground">
                <span>Esperado Admin: {t.expectedAdmin ? '✅' : '❌'}</span>
                <span>Esperado Seller: {t.expectedSeller ? '✅' : '❌'}</span>
              </div>
              {t.message && (
                <p className={`text-xs font-mono px-2 py-1 rounded ${t.status === 'pass' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
                  {t.message}
                </p>
              )}
              {t.timestamp && <p className="text-[10px] text-muted-foreground font-poppins">Executado: {new Date(t.timestamp).toLocaleString('pt-BR')}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Card 5: ReadOnly UI ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-poppins">
            <Shield className="h-4 w-4" /> Sinalização ReadOnly no UI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-poppins">
          <Row label="ReadOnlyBanner ativo" value={isSeller ? 'Sim (seller)' : 'Não (admin)'}>
            <Badge variant={isSeller ? 'default' : 'outline'} className="ml-2">
              {isSeller ? 'Ativo' : 'Inativo'}
            </Badge>
          </Row>
          <p className="text-xs text-muted-foreground">
            O banner aparece automaticamente em /settings e sub-abas de configuração para usuários com role = seller.
            O seller pode navegar normalmente mas inputs e botões ficam desabilitados (pointer-events-none).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── tiny helper ─────────────────────────────────────────────── */
function Row({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center">
        <span className="font-medium text-foreground truncate max-w-[280px]">{value || '—'}</span>
        {children}
      </div>
    </div>
  );
}
