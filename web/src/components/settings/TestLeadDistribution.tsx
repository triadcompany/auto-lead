import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Play, Users, Megaphone, MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function TestLeadDistribution() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<'traffic' | 'non_traffic'>('traffic');
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [filterBucket, setFilterBucket] = useState<string>('all');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<{ user: string; bucket: string; mode: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, threadsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, user_id, clerk_user_id')
          .eq('organization_id', profile?.organization_id),
        supabase
          .from('whatsapp_threads')
          .select('id, assigned_user_id, routing_bucket, created_at')
          .eq('organization_id', profile?.organization_id)
          .not('assigned_user_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setProfiles(profilesRes.data || []);
      setRecentAssignments(threadsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateLead = async () => {
    setTesting(true);
    setLastResult(null);
    try {
      // Read bucket settings
      const { data: bucketSettings } = await supabase
        .from('whatsapp_routing_bucket_settings')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('bucket', selectedBucket)
        .maybeSingle();

      if (!bucketSettings || !bucketSettings.enabled) {
        toast.error(`Bucket "${selectedBucket === 'traffic' ? 'Tráfego' : 'Não-tráfego'}" está desabilitado`);
        return;
      }

      const mode = bucketSettings.mode as string;
      let assignedUserId: string | null = null;

      if (mode === 'fixed_user') {
        assignedUserId = bucketSettings.fixed_user_id;
      } else {
        // Round-robin simulation
        const userIds = (bucketSettings.auto_assign_user_ids as string[]) || [];
        if (userIds.length === 0) {
          toast.error('Nenhum usuário configurado para round-robin neste bucket');
          return;
        }

        // Get current state
        const { data: stateData } = await supabase
          .from('whatsapp_routing_state')
          .select('last_assigned_user_id')
          .eq('organization_id', profile?.organization_id)
          .eq('bucket', selectedBucket)
          .maybeSingle();

        let nextIdx = 0;
        if (stateData?.last_assigned_user_id) {
          const lastIdx = userIds.indexOf(stateData.last_assigned_user_id);
          nextIdx = (lastIdx + 1) % userIds.length;
        }
        assignedUserId = userIds[nextIdx];
      }

      if (!assignedUserId) {
        toast.error('Nenhum usuário encontrado para atribuição');
        return;
      }

      // Resolve Clerk user ID to profile user_id (UUID) if needed
      let resolvedUserId = assignedUserId;
      if (assignedUserId.startsWith('user_')) {
        const matchedProfile = profiles.find(p => p.clerk_user_id === assignedUserId || p.user_id === assignedUserId);
        if (matchedProfile) {
          resolvedUserId = matchedProfile.id;
        } else {
          toast.error('Perfil não encontrado para o usuário selecionado');
          return;
        }
      }

      // Create a real test thread
      const testPhone = `test_${Date.now()}`;
      const { error: threadError } = await supabase
        .from('whatsapp_threads')
        .insert({
          organization_id: profile?.organization_id!,
          contact_phone_e164: testPhone,
          contact_name: `Teste Distribuição (${selectedBucket})`,
          assigned_user_id: resolvedUserId,
          routing_bucket: selectedBucket,
          instance_name: 'test-simulation',
        });

      if (threadError) {
        console.error('Erro ao criar thread de teste:', threadError);
        toast.error(`Erro ao criar thread: ${threadError.message}`);
        return;
      }

      // Update routing state for round-robin
      if (mode !== 'fixed_user') {
        // Check if state row exists
        const { data: existingState } = await supabase
          .from('whatsapp_routing_state')
          .select('id')
          .eq('organization_id', profile?.organization_id)
          .eq('bucket', selectedBucket)
          .maybeSingle();

        if (existingState) {
          await supabase
            .from('whatsapp_routing_state')
            .update({ last_assigned_user_id: assignedUserId })
            .eq('id', existingState.id);
        } else {
          await supabase
            .from('whatsapp_routing_state')
            .insert({
              organization_id: profile?.organization_id!,
              bucket: selectedBucket,
              last_assigned_user_id: assignedUserId,
            });
        }
      }

      const userName = getUserName(assignedUserId);
      const bucketLabel = selectedBucket === 'traffic' ? 'Tráfego' : 'Não-tráfego';
      const modeLabel = mode === 'fixed_user' ? 'Usuário único' : 'Round-robin';

      setLastResult({ user: userName, bucket: bucketLabel, mode: modeLabel });
      toast.success(`Lead de teste criado e atribuído a ${userName} (${bucketLabel}, ${modeLabel})`);

      // Reload assignments
      await loadData();
    } catch (error: any) {
      console.error('Erro ao simular:', error);
      toast.error(error.message || 'Erro ao simular');
    } finally {
      setTesting(false);
    }
  };

  const getUserName = (userId: string) => {
    const user = profiles.find(p => p.clerk_user_id === userId || p.user_id === userId || p.id === userId);
    return user?.name || 'Usuário desconhecido';
  };

  const filteredAssignments = filterBucket === 'all'
    ? recentAssignments
    : recentAssignments.filter(a => a.routing_bucket === filterBucket);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Testar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Testar Distribuição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Simule a distribuição de um lead para validar as filas por bucket.
          </p>

          <div className="space-y-2">
            <Label className="text-sm">Bucket para simulação</Label>
            <Select value={selectedBucket} onValueChange={(v) => setSelectedBucket(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="traffic">
                  <span className="flex items-center gap-2">
                    <Megaphone className="h-3.5 w-3.5" /> Tráfego (Ads)
                  </span>
                </SelectItem>
                <SelectItem value="non_traffic">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5" /> Não-tráfego (Orgânico)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedBucket === 'traffic'
                ? 'Simula primeira mensagem contendo "anuncio"'
                : 'Simula primeira mensagem comum (sem marcador de anúncio)'}
            </p>
          </div>

          <Button onClick={simulateLead} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Simular Lead
          </Button>

          {lastResult && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Resultado da simulação:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">{lastResult.user}</Badge>
                <Badge variant="outline">{lastResult.bucket}</Badge>
                <Badge variant="secondary">{lastResult.mode}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas atribuições */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Últimas Atribuições
            </CardTitle>
            <Select value={filterBucket} onValueChange={setFilterBucket}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="traffic">Tráfego</SelectItem>
                <SelectItem value="non_traffic">Não-tráfego</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atribuição encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredAssignments.map((a, idx) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <div>
                      <p className="font-medium text-sm">{getUserName(a.assigned_user_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={a.routing_bucket === 'traffic' ? 'default' : 'secondary'}>
                    {a.routing_bucket === 'traffic' ? 'Tráfego' : 'Orgânico'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
