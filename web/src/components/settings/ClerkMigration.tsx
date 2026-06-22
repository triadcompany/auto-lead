import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface MigrationResult {
  email: string;
  status: string;
  clerkId?: string;
}

interface MigrationResponse {
  success: boolean;
  message?: string;
  error?: string;
  migrated: number;
  skipped: number;
  failed: number;
  results?: MigrationResult[];
  note?: string;
}

export function ClerkMigration() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const checkPendingMigrations = async () => {
    setCheckingStatus(true);
    try {
      const { data, error, count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .is('clerk_user_id', null);

      if (error) {
        toast({
          title: "Erro ao verificar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setPendingCount(count || 0);
      toast({
        title: "Verificação concluída",
        description: `${count || 0} usuário(s) aguardando migração`,
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const runMigration = async () => {
    setLoading(true);
    setMigrationResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-users-to-clerk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result: MigrationResponse = await response.json();

      setMigrationResult(result);

      if (result.success) {
        toast({
          title: "Migração concluída!",
          description: `${result.migrated} usuário(s) migrado(s) com sucesso`,
        });
        // Atualizar contagem
        await checkPendingMigrations();
      } else {
        toast({
          title: "Erro na migração",
          description: result.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao executar migração",
        description: err.message,
        variant: "destructive",
      });
      setMigrationResult({
        success: false,
        error: err.message,
        migrated: 0,
        skipped: 0,
        failed: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins font-semibold flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Migração de Usuários para Clerk</span>
          </CardTitle>
          <CardDescription className="font-poppins">
            Migre usuários existentes do Supabase Auth para o Clerk para utilizar o novo sistema de autenticação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-poppins">Importante</AlertTitle>
            <AlertDescription className="font-poppins text-sm">
              Após a migração, os usuários precisarão usar a opção "Esqueci minha senha" para definir uma nova senha no Clerk.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={checkPendingMigrations}
              disabled={checkingStatus}
              className="font-poppins"
            >
              {checkingStatus ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verificar Pendentes
            </Button>

            {pendingCount !== null && (
              <Badge variant={pendingCount > 0 ? "secondary" : "outline"} className="font-poppins">
                {pendingCount} usuário(s) pendente(s)
              </Badge>
            )}
          </div>

          <div className="border-t pt-4">
            <Button
              onClick={runMigration}
              disabled={loading || pendingCount === 0}
              className="btn-gradient text-white font-poppins"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Executar Migração
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {migrationResult && (
        <Card className="card-gradient border-0">
          <CardHeader>
            <CardTitle className="font-poppins font-semibold flex items-center space-x-2">
              {migrationResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span>Resultado da Migração</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-500/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 font-poppins">
                  {migrationResult.migrated}
                </div>
                <div className="text-sm text-muted-foreground font-poppins">Migrados</div>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 font-poppins">
                  {migrationResult.skipped}
                </div>
                <div className="text-sm text-muted-foreground font-poppins">Pulados</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 font-poppins">
                  {migrationResult.failed}
                </div>
                <div className="text-sm text-muted-foreground font-poppins">Falhas</div>
              </div>
            </div>

            {migrationResult.note && (
              <Alert className="mb-4">
                <AlertDescription className="font-poppins text-sm">
                  {migrationResult.note}
                </AlertDescription>
              </Alert>
            )}

            {migrationResult.results && migrationResult.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-poppins font-semibold text-sm">Detalhes:</h4>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {migrationResult.results.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                    >
                      <span className="font-poppins">{result.email}</span>
                      <Badge
                        variant={result.status === 'migrated' ? 'default' : 'destructive'}
                        className="font-poppins"
                      >
                        {result.status === 'migrated' ? 'Migrado' : 'Falha'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {migrationResult.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="font-poppins">
                  {migrationResult.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
