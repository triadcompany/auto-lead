import React, { useState, useEffect } from "react";
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
import { Link, useSearchParams } from "react-router-dom";
import {
  Users,
  GitBranch,
  Bell,
  Shield,
  Mail,
  UserPlus,
  Edit,
  Crown,
  UserCheck,
  Trash2,
  Clock,
  ExternalLink,
  MessageSquare,
  CreditCard,
  Inbox,
  Zap,
  BarChart3,
} from "lucide-react";
import { WhatsAppLeadNotifications } from "@/components/settings/WhatsAppLeadNotifications";
import { KeywordAutomationSettings } from "@/components/settings/KeywordAutomationSettings";

import { EvolutionIntegration } from "@/components/settings/EvolutionIntegration";
import { MetaIntegration } from "@/components/settings/MetaIntegration";
import { InboxRoutingSettings } from "@/components/settings/InboxRoutingSettings";
import BillingSettings from "@/components/settings/BillingSettings";
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

export function Settings() {
  const { profiles, invitations, updateProfile, deleteProfile, deleteInvitation, loading, refreshProfiles } = useSupabaseProfiles();
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const { inviteUser, loading: inviteLoading } = useUserInvites();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('tab') || "billing";
  const [selectedSection, setSelectedSectionState] = useState(initialSection);

  const setSelectedSection = (section: string) => {
    setSelectedSectionState(section);
    setSearchParams({ tab: section }, { replace: true });
  };

  // Sync from URL on mount/back-nav
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== selectedSection) {
      setSelectedSectionState(tab);
    }
  }, [searchParams]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "seller">("seller");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-poppins font-bold text-foreground mb-2">
            Acesso Restrito
          </h2>
          <p className="text-muted-foreground font-poppins">
            Apenas administradores podem acessar as configurações.
          </p>
        </div>
      </div>
    );
  }

  const handleRoleUpdate = async (profileId: string, newRole: "admin" | "seller") => {
    await updateProfile(profileId, { role: newRole });
    setEditingProfile(null);
  };

  const menuItems = [
    { id: "billing", label: "Planos e Cobrança", icon: CreditCard },
    { id: "usuarios", label: "Usuários", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: GitBranch },
    { id: "keyword-automation", label: "Automação Palavra-chave", icon: Bell },
    { id: "meta-ads", label: "Meta Ads (CAPI)", icon: BarChart3 },
    { id: "whatsapp-evolution", label: "WhatsApp (Evolution)", icon: MessageSquare },
    { id: "inbox-routing", label: "Inbox (Distribuição)", icon: Inbox },
    { id: "whatsapp-notifications", label: "Notificações WhatsApp", icon: Bell },
    { id: "notifications", label: "Notificações", icon: Bell },
  ];

  const renderUsuariosSection = () => (
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
                Um email de convite será enviado para o endereço informado. O usuário terá 7 dias para aceitar.
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
                <Select value={newUserRole} onValueChange={(value: "admin" | "seller") => setNewUserRole(value)}>
                  <SelectTrigger className="font-poppins">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">Vendedor</SelectItem>
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
                    console.log('🎯 Button clicked! Form data:', { newUserEmail, newUserName, newUserRole });
                    if (!newUserEmail || !newUserName) {
                      console.error('❌ Missing form data');
                      toast({
                        title: "Erro",
                        description: "Preencha todos os campos",
                        variant: "destructive",
                      });
                      return;
                    }

                    console.log('📝 Form validation passed, calling inviteUser...');

                    const result = await inviteUser({
                      email: newUserEmail,
                      name: newUserName,
                      role: newUserRole,
                    });

                    console.log('📊 InviteUser result:', result);

                    if (result.success) {
                      console.log('✅ User created successfully!');
                      setNewUserEmail('');
                      setNewUserName('');
                      setNewUserRole('seller');
                      setDialogOpen(false);
                      refreshProfiles();
                    }
                  }}
                  className="btn-gradient text-white font-poppins"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? 'Enviando...' : 'Enviar Convite'}
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
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {userProfile.role === 'admin' ? (
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
                        {userProfile.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </Badge>
                      {editingProfile === userProfile.id ? (
                        <div className="flex items-center space-x-1">
                          <Select
                            value={userProfile.role}
                            onValueChange={(value: "admin" | "seller") => handleRoleUpdate(userProfile.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seller">Vendedor</SelectItem>
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
            
            {invitations.map((invitation) => (
              <Card key={invitation.id} className="card-gradient border-0 border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-poppins font-semibold text-foreground">
                          {invitation.name}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground font-poppins">
                            {invitation.email}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="font-poppins text-orange-600 border-orange-200">
                        Aguardando Cadastro
                      </Badge>
                      <Badge 
                        variant={invitation.role === 'admin' ? 'default' : 'secondary'}
                        className="font-poppins"
                      >
                        {invitation.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvitation(invitation.id)}
                        className="font-poppins text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const renderPipelineSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-poppins font-semibold text-foreground">
          Configurar Pipeline
        </h3>
        <p className="text-sm text-muted-foreground font-poppins">
          Personalize as etapas do funil de vendas
        </p>
      </div>
      
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 text-primary mx-auto mb-4" />
            <h4 className="text-lg font-poppins font-semibold mb-2">
              Gerenciamento de Pipeline
            </h4>
            <p className="text-muted-foreground font-poppins mb-4">
              Configure os estágios do funil de vendas da sua organização na página dedicada de pipelines.
            </p>
            <Button asChild className="btn-gradient text-white font-poppins">
              <Link to="/pipelines" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Acessar Gerenciamento de Pipelines
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-poppins font-semibold text-foreground">
          Notificações
        </h3>
        <p className="text-sm text-muted-foreground font-poppins">
          Configure as notificações do sistema
        </p>
      </div>
      
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-poppins font-semibold mb-2">
              Configurações de Notificação
            </h4>
            <p className="text-muted-foreground font-poppins mb-4">
              Funcionalidade em desenvolvimento. Em breve você poderá configurar notificações.
            </p>
            <Button disabled className="font-poppins">
              Configurar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (selectedSection) {
      case "billing":
        return <BillingSettings />;
      case "usuarios":
        return renderUsuariosSection();
      case "pipeline":
        return renderPipelineSection();
      case "keyword-automation":
        return <KeywordAutomationSettings />;
      case "meta-ads":
        return <MetaIntegration />;


      case "whatsapp-evolution":
        return <EvolutionIntegration />;
      case "inbox-routing":
        return <InboxRoutingSettings />;
      case "whatsapp-notifications":
        return <WhatsAppLeadNotifications />;
      case "notifications":
        return renderNotificationsSection();
      default:
        return <BillingSettings />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold text-foreground mb-2">
          Configurações
        </h1>
        <p className="text-muted-foreground font-poppins">
          Gerencie usuários, pipeline e configurações do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar de navegação */}
        <div className="lg:col-span-1">
          <Card className="card-gradient border-0">
            <CardHeader>
              <CardTitle className="font-poppins text-sm">Menu</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedSection(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 text-left font-poppins text-sm transition-colors
                      ${selectedSection === item.id
                        ? 'bg-primary/10 text-primary border-r-2 border-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Conteúdo principal */}
        <div className="lg:col-span-3">
          <Card className="card-gradient border-0">
            <CardContent className="p-6">
              {renderContent()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}