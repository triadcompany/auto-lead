import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSupabaseProfiles } from "@/hooks/useSupabaseProfiles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUserInvites } from "@/hooks/useUserInvites";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Bell,
  User,
  Mail,
  UserPlus,
  Edit,
  Crown,
  UserCheck,
  Trash2,
  Clock,
  MapPin,
  Zap,
  Webhook,
  MessageSquare,
  Instagram,
  CreditCard,
  Building2,
} from "lucide-react";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { InstagramSettings } from "@/components/instagram/InstagramSettings";
import { UserProfile } from "@/components/settings/UserProfile";
import { EvolutionIntegration } from "@/components/settings/EvolutionIntegration";
import LeadDistribution from "@/components/settings/LeadDistribution";
import { LeadSourcesManagement } from "@/components/settings/LeadSourcesManagement";
import { TestLeadDistribution } from "@/components/settings/TestLeadDistribution";
import { N8nIntegration } from "@/components/settings/N8nIntegration";
import { WebhookIntegration } from "@/components/settings/WebhookIntegration";
import BillingSettings from "@/components/settings/BillingSettings";
import { MetaAdsSettings } from "@/components/settings/MetaAdsSettings";
import { MetaLeadAdsIntegration } from "@/components/settings/MetaLeadAdsIntegration";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ClerkSyncPanel } from "@/components/settings/ClerkSyncPanel";

import { PageHeader } from "@/components/layout/PageHeader";
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

type MenuItem = { id: string; icon: React.ComponentType<{ className?: string }>; label: string };
type MenuGroup = { id: string; label: string; items: MenuItem[] };

export function Settings() {
  const { profiles, invitations, updateProfile, deleteProfile, deleteInvitation, loading, refreshProfiles } = useSupabaseProfiles();
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const { inviteUser, resendInvitation, revokeInvitation, loading: inviteLoading } = useUserInvites();
  const [searchParams, setSearchParams] = useSearchParams();

  // Build groups based on role — sellers only see "Minha Conta"
  const groups: MenuGroup[] = useMemo(() => {
    const base: MenuGroup[] = [
      {
        id: "account",
        label: "Minha Conta",
        items: [
          { id: "profile", icon: User, label: "Meu Perfil" },
          { id: "notifications", icon: Bell, label: "Notificações" },
        ],
      },
    ];
    if (isAdmin) {
      base.push(
        {
          id: "team",
          label: "Equipe",
          items: [
            { id: "vendors", icon: Users, label: "Usuários" },
            { id: "distribution", icon: Users, label: "Distribuição de Leads" },
          ],
        },
        {
          id: "integrations",
          label: "Integrações",
          items: [
            { id: "whatsapp-evolution", icon: MessageSquare, label: "WhatsApp (Evolution)" },
            { id: "instagram", icon: Instagram, label: "Instagram" },
            { id: "webhooks", icon: Webhook, label: "Webhooks" },
            { id: "sources", icon: MapPin, label: "Origens de Leads" },
            { id: "meta-ads", icon: Zap, label: "Meta Ads" },
            { id: "meta-lead-ads", icon: Zap, label: "Meta Lead Ads" },
          ],
        },
        {
          id: "plan",
          label: "Plano",
          items: [
            { id: "billing", icon: CreditCard, label: "Planos e Cobrança" },
            { id: "organization", icon: Building2, label: "Organização" },
          ],
        },
      );
    }
    return base;
  }, [isAdmin]);

  const allowedTabs = useMemo(
    () => new Set(groups.flatMap((g) => g.items.map((i) => i.id))),
    [groups],
  );

  const requestedTab = searchParams.get("tab") || "profile";
  const initialTab = allowedTabs.has(requestedTab) ? requestedTab : "profile";
  const [activeTab, setActiveTabState] = useState(initialTab);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // If URL contains a tab the current role can't access, silently fall back to profile
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && !allowedTabs.has(tab)) {
      setActiveTabState("profile");
      setSearchParams({ tab: "profile" }, { replace: true });
      return;
    }
    if (tab && tab !== activeTab) {
      setActiveTabState(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allowedTabs]);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "seller" | "pre_sales">("seller");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRoleUpdate = async (profileId: string, newRole: "admin" | "seller" | "pre_sales") => {
    await updateProfile(profileId, { role: newRole });
    setEditingProfile(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "billing":
        return <BillingSettings />;
      case "profile":
        return <UserProfile />;
      case "organization":
        return <OrganizationSettings />;
      case "vendors":
        return renderVendorsContent();
      case "whatsapp-evolution":
        return <EvolutionIntegration />;
      case "instagram":
        return <InstagramSettings />;
      case "webhooks":
        return (
          <div className="space-y-8">
            <WebhookIntegration />
            <Separator />
            <N8nIntegration />
          </div>
        );
      case "distribution":
        return (
          <div className="space-y-8">
            <LeadDistribution />
            <Separator />
            <TestLeadDistribution />
          </div>
        );
      case "sources":
        return <LeadSourcesManagement />;
      case "meta-ads":
        return <MetaAdsSettings />;
      case "meta-lead-ads":
        return <MetaLeadAdsIntegration />;
      case "notifications":
        return <NotificationSettings />;
      default:
        return <UserProfile />;
    }
  };

  const renderVendorsContent = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-poppins font-semibold text-foreground">
              Gerenciar Usuários
            </h3>
            <p className="text-sm text-muted-foreground font-poppins">
              Adicione e gerencie vendedores e administradores do sistema
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient text-white font-poppins">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-poppins">Convidar Usuário</DialogTitle>
                <DialogDescription className="font-poppins">
                  O usuário receberá um email com um link para se cadastrar e entrar automaticamente nesta organização.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="userName" className="font-poppins">Nome (para identificação)</Label>
                  <Input
                    id="userName"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Nome do usuário"
                    className="font-poppins"
                  />
                  <p className="text-xs text-muted-foreground font-poppins mt-1">
                    Usado apenas para identificar o convite. Não altera o nome da conta do usuário.
                  </p>
                </div>
                <div>
                  <Label htmlFor="userEmail" className="font-poppins">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    className="font-poppins"
                  />
                </div>
                <div>
                  <Label htmlFor="userRole" className="font-poppins">Função</Label>
                  <Select value={newUserRole} onValueChange={(value: "admin" | "seller" | "pre_sales") => setNewUserRole(value)}>
                    <SelectTrigger className="font-poppins">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Vendedor</SelectItem>
                      <SelectItem value="pre_sales">Pré-vendas</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-poppins">
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!newUserEmail || !newUserName) {
                        toast({
                          title: "Erro",
                          description: "Preencha todos os campos",
                          variant: "destructive",
                        });
                        return;
                      }

                      const submit = async (forceResend = false) => {
                        const result = await inviteUser({
                          email: newUserEmail,
                          name: newUserName,
                          role: newUserRole,
                          forceResend,
                        });

                        if (result.success) {
                          if (result.inviteUrl) {
                            try {
                              await navigator.clipboard.writeText(result.inviteUrl);
                              toast({
                                title: "✅ Link copiado",
                                description: "O link de convite foi copiado para sua área de transferência.",
                              });
                            } catch {
                              /* clipboard pode falhar em http; ignorar */
                            }
                          }
                          setNewUserEmail("");
                          setNewUserName("");
                          setNewUserRole("seller");
                          setDialogOpen(false);
                          refreshProfiles();
                          return;
                        }

                        if (result.code === "ALREADY_MEMBER") {
                          toast({
                            title: "Usuário já é membro",
                            description: "Este email já pertence a um membro desta organização.",
                            variant: "destructive",
                          });
                          return;
                        }

                        if (result.code === "INVITE_PENDING") {
                          const ok = window.confirm(
                            "Já existe um convite pendente para este email. Deseja reenviar com um novo link?"
                          );
                          if (ok) {
                            await submit(true);
                          }
                          return;
                        }

                        toast({
                          title: "Erro ao enviar convite",
                          description: result.error || "Tente novamente.",
                          variant: "destructive",
                        });
                      };

                      await submit(false);
                    }}
                    className="btn-gradient text-white font-poppins"
                    disabled={inviteLoading}
                  >
                    {inviteLoading ? "Enviando..." : "Enviar Convite"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-2 font-poppins text-muted-foreground text-sm">Carregando usuários...</p>
            </div>
          ) : (
            <>
              {profiles.map((userProfile) => (
                <Card key={userProfile.id} className="card-gradient border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {userProfile.avatar_url ? (
                            <img
                              src={userProfile.avatar_url}
                              alt={userProfile.name}
                              className="w-full h-full object-cover"
                            />
                          ) : userProfile.role === 'admin' ? (
                            <Crown className="h-5 w-5 text-primary" />
                          ) : (
                            <UserCheck className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-poppins font-semibold text-foreground">
                            {userProfile.name}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground font-poppins">
                              {userProfile.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={userProfile.role === 'admin' ? 'default' : 'secondary'}
                          className="font-poppins"
                        >
                          {userProfile.role === 'admin' ? 'Administrador' : userProfile.role === 'pre_sales' ? 'Pré-vendas' : 'Vendedor'}
                        </Badge>
                        {editingProfile === userProfile.id ? (
                          <div className="flex items-center space-x-1">
                            <Select
                              value={userProfile.role}
                              onValueChange={(value: "admin" | "seller" | "pre_sales") => handleRoleUpdate(userProfile.id, value)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="seller">Vendedor</SelectItem>
                                <SelectItem value="pre_sales">Pré-vendas</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingProfile(userProfile.id)}
                              className="font-poppins"
                              disabled={userProfile.id === profile?.id}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {userProfile.id !== profile?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteProfile(userProfile.id, userProfile.clerk_user_id || userProfile.user_id)}
                                className="font-poppins text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {invitations.map((invitation) => {
                const isExpired =
                  invitation.expires_at && new Date(invitation.expires_at) < new Date();
                const isRevoked = invitation.status === "revoked";
                const isAccepted = invitation.status === "accepted";
                if (isAccepted) return null;

                return (
                  <Card
                    key={invitation.id}
                    className={`card-gradient border-0 border-l-4 ${
                      isRevoked
                        ? "border-l-muted-foreground"
                        : isExpired
                        ? "border-l-destructive"
                        : "border-l-orange-500"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isRevoked
                                ? "bg-muted"
                                : isExpired
                                ? "bg-destructive/10"
                                : "bg-orange-500/10"
                            }`}
                          >
                            <Clock
                              className={`h-5 w-5 ${
                                isRevoked
                                  ? "text-muted-foreground"
                                  : isExpired
                                  ? "text-destructive"
                                  : "text-orange-500"
                              }`}
                            />
                          </div>
                          <div>
                            <h4 className="font-poppins font-semibold text-foreground">
                              {invitation.name || invitation.email}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground font-poppins">
                                {invitation.email}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                          {isRevoked ? (
                            <Badge variant="outline" className="font-poppins text-muted-foreground">
                              Revogado
                            </Badge>
                          ) : isExpired ? (
                            <Badge
                              variant="outline"
                              className="font-poppins text-destructive border-destructive/40"
                            >
                              Expirado
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="font-poppins text-orange-600 border-orange-200"
                            >
                              Aguardando
                            </Badge>
                          )}
                          <Badge
                            variant={invitation.role === "admin" ? "default" : "secondary"}
                            className="font-poppins"
                          >
                            {invitation.role === "admin" ? "Administrador" : "Vendedor"}
                          </Badge>
                          {!isRevoked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={inviteLoading}
                              onClick={async () => {
                                const result = await resendInvitation(invitation.id);
                                if (result.success) {
                                  if (result.inviteUrl) {
                                    try {
                                      await navigator.clipboard.writeText(result.inviteUrl);
                                    } catch {
                                      /* noop */
                                    }
                                  }
                                  refreshProfiles();
                                }
                              }}
                              className="font-poppins"
                              title="Reenviar convite"
                            >
                              Reenviar
                            </Button>
                          )}
                          {!isRevoked && !isExpired && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={inviteLoading}
                              onClick={async () => {
                                if (!window.confirm("Revogar este convite? O link deixará de funcionar.")) return;
                                const result = await revokeInvitation(invitation.id);
                                if (result.success) refreshProfiles();
                              }}
                              className="font-poppins text-destructive hover:text-destructive"
                              title="Revogar convite"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          {(isRevoked || isExpired) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteInvitation(invitation.id)}
                              className="font-poppins text-destructive hover:text-destructive"
                              title="Remover registro"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        <Separator />
        <ClerkSyncPanel />
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações do seu CRM e personalize sua experiência"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar de configurações — agrupada por seção */}
        <div className="space-y-2">
          <Card className="card-gradient border-0">
            <CardContent className="p-4 space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <div className="px-3 pt-1 pb-2 text-xs font-poppins font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                        activeTab === item.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-poppins text-sm">{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Conteúdo principal */}
        <div className="col-span-2 space-y-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
