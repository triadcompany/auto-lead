import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown, Loader2, LogOut, Settings, ShieldCheck, User, Crown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useUserOrganizations } from '@/hooks/useUserOrganizations';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useUser } from '@clerk/clerk-react';

interface UserOrgMenuProps {
  onLogout: () => void;
}

export function UserOrgMenu({ onLogout }: UserOrgMenuProps) {
  const navigate = useNavigate();
  const { profile, userName, isAdmin, orgName: clerkOrgName } = useAuth();
  const { user: clerkUser } = useUser();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { organizations, loading, switching, switchOrg } = useUserOrganizations();
  const avatarUrl = clerkUser?.imageUrl || profile?.avatar_url;

  const displayName = userName || profile?.name || 'Usuário';
  const initials = displayName.split(' ').map((n) => n[0]).join('').substring(0, 2);
  const currentRoleLabel = isAdmin ? 'Admin' : 'Vendedor';

  // Prefer the active membership's name (matches AuthContext orgId) over Clerk's
  // live name, since soft-switching may not have updated Clerk's active org yet.
  const currentOrg = organizations.find((o) => o.is_current);
  const orgName = currentOrg?.name || clerkOrgName;

  const planLabel = subscriptionLoading
    ? '...'
    : !subscription?.subscribed || !subscription.plan
    ? 'Free'
    : subscription.plan === 'start'
    ? 'Start'
    : 'Scale';

  const planColor = !subscription?.subscribed || !subscription.plan
    ? 'text-muted-foreground'
    : subscription.plan === 'scale'
    ? 'text-amber-500'
    : 'text-primary';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-lg p-2 hover:bg-accent/40 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-primary flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-xs font-poppins">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-poppins font-semibold text-foreground truncate leading-tight">
              {displayName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground font-poppins truncate">
                {orgName || 'Organização'}
              </span>
            </div>
          </div>
          {switching ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-72 p-0">
        {/* Header — current user info */}
        <div className="p-3 flex items-center gap-3 bg-muted/30 border-b">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-sm font-poppins">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-poppins font-semibold text-foreground truncate">{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-poppins">{currentRoleLabel}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className={`text-xs font-poppins font-medium flex items-center gap-0.5 ${planColor}`}>
                {subscription?.plan === 'scale' && <Crown className="h-3 w-3" />}
                {planLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Organizations list */}
        <div className="p-2">
          <p className="text-[11px] text-muted-foreground font-poppins uppercase tracking-wider px-2 py-1.5">
            Suas organizações
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-xs text-muted-foreground font-poppins px-2 py-2">
              Nenhuma organização encontrada.
            </p>
          ) : (
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.organization_id}
                  type="button"
                  disabled={org.is_current || switching}
                  onClick={() => {
                    if (!org.is_current) switchOrg(org);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent/50 transition-colors disabled:hover:bg-transparent disabled:cursor-default text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-poppins font-medium text-foreground truncate">
                      {org.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground font-poppins">
                        {org.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </div>
                  </div>
                  {org.is_current && (
                    <Badge variant="secondary" className="text-[10px] font-poppins gap-1 px-1.5 py-0 flex-shrink-0">
                      <Check className="h-3 w-3" /> Ativa
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-2 space-y-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="w-full justify-start font-poppins text-sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start font-poppins text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
