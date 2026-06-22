import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Phone, ArrowRight, CheckCircle2, XCircle, Send, Users, ArrowRightLeft, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WhatsAppIntegration {
  id: string;
  phone_number: string;
  evolution_instance_id: string;
  evolution_api_key: string;
  n8n_webhook_evolution_notify: string;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  whatsapp_e164: string | null;
}

interface AuditLog {
  id: string;
  event: string;
  data: any;
  created_at: string;
}

export function WhatsAppLeadNotifications() {
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingCompany, setTestingCompany] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testingUsers, setTestingUsers] = useState<Record<string, boolean>>({});
  const [userStatus, setUserStatus] = useState<Record<string, 'success' | 'error' | 'untested'>>({});
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile?.organization_id]);

  const fetchData = async () => {
    try {
      // Fetch WhatsApp integration
      const { data: integrationData, error: integrationError } = await supabase
        .from('whatsapp_integrations')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .maybeSingle();

      if (integrationError && integrationError.code !== 'PGRST116') {
        throw integrationError;
      }

      setIntegration(integrationData);

      // Fetch all users from organization
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, whatsapp_e164')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (profilesError) throw profilesError;

      setUsers(profilesData || []);

      // Initialize user status
      const initialStatus: Record<string, 'success' | 'error' | 'untested'> = {};
      (profilesData || []).forEach(user => {
        initialStatus[user.id] = user.whatsapp_e164 ? 'untested' : 'error';
      });
      setUserStatus(initialStatus);

    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_distribution_audit')
        .select('*')
        .or('event.eq.lead.assigned_notify,event.eq.test_notification')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar logs",
        variant: "destructive",
      });
    }
  };

  const testCompanyWhatsApp = async () => {
    if (!integration?.phone_number) {
      toast({
        title: "Erro",
        description: "WhatsApp da empresa não configurado",
        variant: "destructive",
      });
      return;
    }

    setTestingCompany(true);
    try {
      const { error } = await supabase.functions.invoke('test-whatsapp-notification', {
        body: {
          to: integration.phone_number,
          message: "✅ Mensagem de teste do sistema AutoLead CRM. Sua integração Evolution está funcionando corretamente!"
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Mensagem de teste enviada para o WhatsApp da empresa",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem de teste",
        variant: "destructive",
      });
    } finally {
      setTestingCompany(false);
    }
  };

  const testUserWhatsApp = async (userId: string, whatsappNumber: string, userName: string) => {
    if (!whatsappNumber) {
      toast({
        title: "Erro",
        description: "WhatsApp não cadastrado para este usuário",
        variant: "destructive",
      });
      return;
    }

    setTestingUsers(prev => ({ ...prev, [userId]: true }));
    try {
      const { error } = await supabase.functions.invoke('test-whatsapp-notification', {
        body: {
          to: whatsappNumber,
          message: `🚀 Teste de notificação: seu número está corretamente configurado para receber leads, ${userName}!`
        }
      });

      if (error) throw error;

      setUserStatus(prev => ({ ...prev, [userId]: 'success' }));
      toast({
        title: "Sucesso",
        description: `Mensagem de teste enviada para ${userName}`,
      });
    } catch (error: any) {
      setUserStatus(prev => ({ ...prev, [userId]: 'error' }));
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem de teste",
        variant: "destructive",
      });
    } finally {
      setTestingUsers(prev => ({ ...prev, [userId]: false }));
    }
  };

  const testAllUsers = async () => {
    const usersWithWhatsApp = users.filter(u => u.whatsapp_e164);
    
    if (usersWithWhatsApp.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum usuário com WhatsApp configurado",
        variant: "destructive",
      });
      return;
    }

    setTestingAll(true);
    
    for (const user of usersWithWhatsApp) {
      await testUserWhatsApp(user.id, user.whatsapp_e164!, user.name);
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setTestingAll(false);
    toast({
      title: "Concluído",
      description: `Teste enviado para ${usersWithWhatsApp.length} usuário(s)`,
    });
  };

  const updateUserWhatsApp = async (userId: string, whatsappNumber: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ whatsapp_e164: whatsappNumber || null })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, whatsapp_e164: whatsappNumber || null } : u)
      );

      setUserStatus(prev => ({
        ...prev,
        [userId]: whatsappNumber ? 'untested' : 'error'
      }));

      toast({
        title: "Sucesso",
        description: "WhatsApp atualizado",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar WhatsApp",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem configurar notificações WhatsApp.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* CARD 1 - WhatsApp da Empresa */}
      <Card className="card-gradient border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 font-poppins text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>📱 WhatsApp da Empresa (Remetente)</span>
          </CardTitle>
          <CardDescription className="font-poppins">
            O número abaixo é usado para enviar todas as notificações de leads para os usuários.
            Este é o número conectado à sua instância do Evolution API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium font-poppins text-muted-foreground">Número</label>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-mono text-lg font-semibold">{integration?.phone_number || 'Não configurado'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium font-poppins text-muted-foreground">Instance ID</label>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm">
                  {integration?.evolution_instance_id || 'Não configurado'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium font-poppins">Status:</span>
            {integration?.is_active && integration?.evolution_instance_id ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                🟢 Conectado
              </Badge>
            ) : (
              <Badge variant="destructive">
                🔴 Desconectado
              </Badge>
            )}
          </div>

          <Button
            onClick={testCompanyWhatsApp}
            disabled={testingCompany || !integration?.phone_number}
            className="btn-gradient text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            {testingCompany ? 'Enviando...' : '🔄 Testar envio de mensagem'}
          </Button>

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertDescription className="text-blue-900 dark:text-blue-100 font-poppins">
              🔔 Todas as notificações serão enviadas através deste número de WhatsApp da empresa.
            </AlertDescription>
          </Alert>

          {!integration && (
            <Alert>
              <AlertDescription>
                Configure a integração WhatsApp Evolution na aba "Integração WhatsApp" primeiro.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* CARD 2 - WhatsApp dos Usuários */}
      <Card className="card-gradient border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 font-poppins text-lg font-semibold">
            <Users className="h-5 w-5 text-primary" />
            <span>👥 WhatsApp dos Usuários (Destinatários)</span>
          </CardTitle>
          <CardDescription className="font-poppins">
            Cada usuário deve ter seu número de WhatsApp cadastrado para receber as notificações de leads atribuídos.
            As mensagens serão enviadas pelo WhatsApp da empresa para o número configurado aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-poppins font-semibold">Usuário</TableHead>
                  <TableHead className="font-poppins font-semibold">E-mail</TableHead>
                  <TableHead className="font-poppins font-semibold">WhatsApp (E.164)</TableHead>
                  <TableHead className="font-poppins font-semibold">Status</TableHead>
                  <TableHead className="font-poppins font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        placeholder="+5547999999999"
                        defaultValue={user.whatsapp_e164 || ''}
                        onBlur={(e) => {
                          if (e.target.value !== user.whatsapp_e164) {
                            updateUserWhatsApp(user.id, e.target.value);
                          }
                        }}
                        className="font-mono max-w-[180px]"
                      />
                    </TableCell>
                    <TableCell>
                      {userStatus[user.id] === 'success' ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          ✅ Ativo
                        </Badge>
                      ) : userStatus[user.id] === 'untested' ? (
                        <Badge variant="secondary">
                          ⚠️ Não testado
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          ❌ Não configurado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testUserWhatsApp(user.id, user.whatsapp_e164 || '', user.name)}
                        disabled={!user.whatsapp_e164 || testingUsers[user.id]}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {testingUsers[user.id] ? 'Enviando...' : '🔔 Testar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Alert>
            <AlertDescription className="font-poppins">
              💬 Cadastre aqui o WhatsApp de cada usuário que deve receber notificações de novos leads
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* CARD 3 - Fluxo Visual */}
      <Card className="card-gradient border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 font-poppins text-lg font-semibold">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <span>🔄 Fluxo de Envio de Notificação</span>
          </CardTitle>
          <CardDescription className="font-poppins">
            O sistema envia automaticamente os dados do lead pelo WhatsApp da empresa para o número de cada usuário que receber um novo lead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
              <p className="font-semibold font-poppins text-sm">📱 WhatsApp da Empresa</p>
              <p className="text-xs text-muted-foreground">(Evolution API)</p>
            </div>

            <ArrowRight className="h-8 w-8 text-primary hidden md:block" />
            <div className="md:hidden">↓</div>

            <div className="text-center space-y-2">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <ArrowRightLeft className="h-10 w-10 text-white" />
              </div>
              <p className="font-semibold font-poppins text-sm">🌐 n8n Webhook</p>
              <p className="text-xs text-muted-foreground">(Automação)</p>
            </div>

            <ArrowRight className="h-8 w-8 text-primary hidden md:block" />
            <div className="md:hidden">↓</div>

            <div className="text-center space-y-2">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <Phone className="h-10 w-10 text-white" />
              </div>
              <p className="font-semibold font-poppins text-sm">💬 WhatsApp do Usuário</p>
              <p className="text-xs text-muted-foreground">(Recebe notificação)</p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-primary">
            <p className="font-semibold font-poppins mb-2">Exemplo da mensagem recebida:</p>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 font-mono text-sm shadow-inner">
              <p className="font-bold text-green-600">🚀 Novo lead atribuído a você!</p>
              <p className="mt-2"><span className="text-muted-foreground">Nome:</span> João Martins</p>
              <p><span className="text-muted-foreground">Telefone:</span> +55 47 98888-9999</p>
              <p><span className="text-muted-foreground">Interesse:</span> Energia solar residencial</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões Globais */}
      <Card className="card-gradient border-0 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={testAllUsers}
              disabled={testingAll || users.filter(u => u.whatsapp_e164).length === 0}
              className="btn-gradient text-white flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {testingAll ? 'Enviando...' : '🔔 Enviar teste global'}
            </Button>

            <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  onClick={fetchLogs}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  📋 Ver logs de notificações
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="font-poppins">Logs de Notificações WhatsApp</DialogTitle>
                  <DialogDescription className="font-poppins">
                    Últimos 50 eventos de notificação de leads
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[500px] w-full pr-4">
                  <div className="space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={log.event === 'test_notification' ? 'secondary' : 'default'}>
                              {log.event}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <pre className="text-xs font-mono bg-background p-2 rounded overflow-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

