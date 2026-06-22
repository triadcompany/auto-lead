import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, Loader2, CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InvitationData {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "seller";
  organization_id: string;
  organization_name: string;
  expires_at: string | null;
}

type ValidationState =
  | { status: "loading" }
  | { status: "valid"; invitation: InvitationData }
  | { status: "invalid"; code: string; error: string; email?: string };

export default function Invite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [state, setState] = useState<ValidationState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid", code: "MISSING_TOKEN", error: "Link de convite inválido (token ausente)." });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("validate-invitation", {
          body: { token },
        });

        if (cancelled) return;

        if (error) {
          setState({
            status: "invalid",
            code: "ERROR",
            error: error.message || "Erro ao validar convite.",
          });
          return;
        }

        if (data?.ok && data?.invitation) {
          setState({ status: "valid", invitation: data.invitation });
        } else {
          setState({
            status: "invalid",
            code: data?.code || "ERROR",
            error: data?.error || "Convite inválido ou expirado.",
            email: data?.email,
          });
        }
      } catch (err: any) {
        if (cancelled) return;
        setState({
          status: "invalid",
          code: "ERROR",
          error: err?.message || "Erro ao validar convite.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const persistInviteContext = () => {
    if (state.status !== "valid" || !token) return;
    try {
      sessionStorage.setItem("pending_invitation_token", token);
      sessionStorage.setItem("pending_invitation_org_id", state.invitation.organization_id);
      sessionStorage.setItem("pending_invitation_role", state.invitation.role);
    } catch {
      /* sessionStorage unavailable */
    }
  };

  const handleAccept = () => {
    if (state.status !== "valid") return;
    persistInviteContext();
    // Redireciona ao /auth com email pré-preenchido + flag de signup
    const params = new URLSearchParams({
      signup: "true",
      invited: "true",
      email: state.invitation.email,
      ...(state.invitation.name ? { name: state.invitation.name } : {}),
      role: state.invitation.role,
      orgId: state.invitation.organization_id,
      orgName: state.invitation.organization_name,
      invitation_token: token || "",
    });
    navigate(`/auth?${params.toString()}`);
  };

  const handleSignIn = () => {
    if (state.status !== "valid") return;
    persistInviteContext();
    // Preserve token + org context so the user is auto-attached after login
    const params = new URLSearchParams({
      signup: "false",
      invited: "true",
      email: state.invitation.email,
      orgId: state.invitation.organization_id,
      orgName: state.invitation.organization_name,
      role: state.invitation.role,
      invitation_token: token || "",
    });
    navigate(`/auth?${params.toString()}`);
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 text-foreground">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        {state.status === "loading" && (
          <CardContent className="py-16 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground font-poppins">Validando seu convite...</p>
          </CardContent>
        )}

        {state.status === "valid" && (
          <>
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold font-poppins">
                  Você foi convidado!
                </CardTitle>
                <CardDescription className="mt-2 font-poppins">
                  Junte-se à equipe da{" "}
                  <span className="font-semibold text-foreground">
                    {state.invitation.organization_name}
                  </span>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-poppins">{state.invitation.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={state.invitation.role === "admin" ? "default" : "secondary"} className="font-poppins">
                    {state.invitation.role === "admin" ? "Administrador" : "Vendedor"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <Button onClick={handleAccept} className="w-full h-11 font-poppins">
                  Aceitar e criar conta
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button onClick={handleSignIn} variant="outline" className="w-full h-11 font-poppins">
                  Já tenho conta — fazer login
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center font-poppins">
                Após autenticar, você entrará automaticamente na organização.
              </p>
            </CardContent>
          </>
        )}

        {state.status === "invalid" && (
          <>
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center">
                {state.code === "EXPIRED" ? (
                  <Clock className="w-8 h-8 text-destructive" />
                ) : state.code === "ACCEPTED" ? (
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                ) : (
                  <XCircle className="w-8 h-8 text-destructive" />
                )}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold font-poppins">
                  {state.code === "EXPIRED"
                    ? "Convite expirado"
                    : state.code === "ACCEPTED"
                    ? "Convite já aceito"
                    : state.code === "REVOKED"
                    ? "Convite revogado"
                    : "Convite inválido"}
                </CardTitle>
                <CardDescription className="mt-2 font-poppins">
                  {state.error}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.code === "ACCEPTED" && state.email ? (
                <Button onClick={() => navigate(`/auth?email=${encodeURIComponent(state.email!)}`)} className="w-full font-poppins">
                  Fazer login
                </Button>
              ) : (
                <Button onClick={() => navigate("/auth")} variant="outline" className="w-full font-poppins">
                  Voltar para o login
                </Button>
              )}
              {(state.code === "EXPIRED" || state.code === "NOT_FOUND" || state.code === "REVOKED") && (
                <p className="text-xs text-muted-foreground text-center font-poppins pt-2">
                  Peça ao administrador da organização para enviar um novo convite.
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
