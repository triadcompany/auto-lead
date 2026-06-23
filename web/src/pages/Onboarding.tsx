import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, useSession } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

export default function Onboarding() {
  const { user } = useUser();
  const { session } = useSession();
  const { refreshProfile, retryBootstrap } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const token = session ? await session.getToken() : null;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const email = user.primaryEmailAddress?.emailAddress || "";
      const name = user.fullName || user.firstName || email.split("@")[0] || "Usuário";

      const res = await fetch(`${API_URL}/organizations/bootstrap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clerk_user_id: user.id,
          org_name: companyName.trim(),
          user_name: name,
          email,
          cnpj: cnpj.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar organização");

      toast.success("Empresa criada!", { description: `Bem-vindo ao AutoLead, ${name}!` });

      await retryBootstrap();
      await refreshProfile();
      navigate("/dashboard", { replace: true });

      setTimeout(() => {
        if (window.location.pathname.includes("onboarding")) {
          window.location.href = "/dashboard";
        }
      }, 1500);
    } catch (error) {
      console.error("Erro ao criar organização:", error);
      toast.error("Falha ao criar empresa", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 text-foreground">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Bem-vindo ao AutoLead!</CardTitle>
            <CardDescription className="mt-2">
              Para começar, informe o nome da sua empresa ou negócio.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrganization} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="company-name" className="text-sm font-medium">
                Nome da Empresa
              </Label>
              <Input
                id="company-name"
                type="text"
                placeholder="Ex: Minha Empresa LTDA"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isCreating}
                className="h-12"
                autoFocus
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj" className="text-sm font-medium">
                CNPJ <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="cnpj"
                type="text"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                disabled={isCreating}
                className="h-12"
                maxLength={18}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Você poderá alterar isso depois nas configurações.
            </p>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={isCreating || !companyName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  Começar a usar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
