import { useAuth } from '@/contexts/AuthContext';
import { useUser, useOrganization as useClerkOrganization } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bug } from 'lucide-react';

export function DebugPanel() {
  const { user } = useUser();
  const { organization: clerkOrg } = useClerkOrganization();
  const { profile, role, orgId, clerkOrgId, loading, needsOnboarding } = useAuth();

  const syncStatus = (() => {
    if (loading) return { label: 'Carregando…', variant: 'secondary' as const };
    if (!profile) return { label: 'Sem profile', variant: 'destructive' as const };
    if (!orgId) return { label: 'Sem org', variant: 'destructive' as const };
    return { label: 'OK', variant: 'default' as const };
  })();

  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Bug className="h-4 w-4" />
          Debug (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 text-xs font-mono">
          <Row label="clerk_user_id" value={user?.id} />
          <Row label="activeOrgId (Clerk)" value={clerkOrg?.id || '—'} />
          <Row label="orgId (Supabase)" value={orgId || '—'} />
          <Row label="clerkOrgId (context)" value={clerkOrgId || '—'} />
          <Row label="profile.organization_id" value={profile?.organization_id || '—'} />
          <Row label="role" value={role || '—'} />
          <Row label="needsOnboarding" value={String(needsOnboarding)} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">sync status</span>
            <Badge variant={syncStatus.variant} className="text-[10px] px-1.5 py-0">
              {syncStatus.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <span className="truncate text-foreground max-w-[200px]" title={value || '—'}>
        {value || '—'}
      </span>
    </div>
  );
}
