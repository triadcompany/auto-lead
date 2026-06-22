import React from 'react';
import { Building2, Check, ChevronsUpDown, Loader2, ShieldCheck, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useUserOrganizations } from '@/hooks/useUserOrganizations';
import { useAuth } from '@/contexts/AuthContext';

export function OrgSwitcher() {
  const { orgName: clerkOrgName, isAdmin } = useAuth();
  const { organizations, loading, switching, switchOrg } = useUserOrganizations();

  // Prefer the name from the active membership (matches AuthContext orgId)
  // over Clerk's live name, since soft-switching may not have updated Clerk yet.
  const currentOrg = organizations.find((o) => o.is_current);
  const orgName = currentOrg?.name || clerkOrgName || 'Organização';
  const currentRoleLabel = isAdmin ? 'Admin' : 'Vendedor';
  const hasMultiple = organizations.length > 1;
  const currentLogo = currentOrg?.logo_url || null;

  const trigger = (
    <button
      type="button"
      disabled={!hasMultiple || switching}
      className="group w-full flex items-center gap-2 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-colors px-2.5 py-2 text-left disabled:cursor-default disabled:hover:bg-card"
    >
      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {currentLogo ? (
          <img src={currentLogo} alt={orgName} className="w-full h-full object-cover" />
        ) : (
          <Building2 className="h-4 w-4 text-primary-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-poppins font-semibold text-foreground truncate leading-tight">
          {orgName || 'Organização'}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <ShieldCheck className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-poppins">
            {currentRoleLabel}
          </span>
        </div>
      </div>
      {hasMultiple && (
        switching ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
        )
      )}
    </button>
  );

  if (!hasMultiple) {
    return trigger;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-poppins text-xs text-muted-foreground uppercase tracking-wider">
          Suas organizações
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          organizations.map((org) => (
            <DropdownMenuItem
              key={org.organization_id}
              onSelect={(e) => {
                e.preventDefault();
                if (!org.is_current) switchOrg(org);
              }}
              className="flex items-center gap-2 py-2 cursor-pointer"
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
                  <span className="text-[11px] text-muted-foreground font-poppins capitalize">
                    {org.role === 'admin' ? 'Administrador' : 'Vendedor'}
                  </span>
                </div>
              </div>
              {org.is_current ? (
                <Badge variant="secondary" className="text-[10px] font-poppins gap-1 px-1.5 py-0">
                  <Check className="h-3 w-3" /> Ativa
                </Badge>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
