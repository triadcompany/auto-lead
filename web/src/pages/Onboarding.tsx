import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

export default function Onboarding() {
  const { user } = useUser();
  const { setActive } = useClerk();
  const { refreshProfile, retryBootstrap } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // NOTE: No guard/redirect here. AppGate handles all routing decisions.

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !companyName.trim() || isCreating) return;

    setIsCreating(true);

    try {
      const clerkUserId = user.id;
      const email = user.primaryEmailAddress?.emailAddress || "";
      const name = user.fullName || user.firstName || email.split("@")[0] || "Usuário";
      const avatarUrl = user.imageUrl || undefined;

      console.log("🏢 Creating organization via bootstrap-org:", companyName);

      // 1. Call bootstrap-org edge function (creates Clerk org + Supabase mirror)
      const bootstrapRes = await fetch(`${SUPABASE_URL}/functions/v1/bootstrap-org`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          clerk_user_id: clerkUserId,
          email,
          full_name: name,
          avatar_url: avatarUrl,
          org_name: companyName.trim(),
        }),
      });

      const bootstrapData = await bootstrapRes.json();

      if (!bootstrapRes.ok || !bootstrapData.ok) {
        throw new Error(bootstrapData.error || "Erro ao criar organização");
      }

      console.log("✅ Organization bootstrapped:", bootstrapData);

      // 2. Set the newly created org as active in Clerk
      const clerkOrgId = bootstrapData.clerk_org_id;
      const supabaseOrgId = bootstrapData.org_id; // UUID from clerk_organizations
      if (clerkOrgId) {
        console.log("🔄 Setting active org in Clerk:", clerkOrgId);
        try {
          await setActive({ organization: clerkOrgId });
          console.log("✅ Active org set in Clerk");
        } catch (setActiveErr) {
          console.warn("⚠️ setActive failed (non-critical):", setActiveErr);
        }
      }

      // 3. Upsert legacy organizations table with same UUID for consistency
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .upsert({
          id: supabaseOrgId, // use the clerk_organizations UUID
          name: companyName.trim(),
          cnpj: cnpj.trim() || null,
          is_active: true,
        }, { onConflict: 'id' })
        .select("id")
        .single();

      const finalOrgId = newOrg?.id || supabaseOrgId;

      if (orgError) {
        console.warn("⚠️ Legacy org upsert error (non-critical):", orgError.message);
      }

      // 4. Upsert profile with the org UUID
      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({
          clerk_user_id: clerkUserId,
          email,
          name,
          avatar_url: avatarUrl,
          organization_id: finalOrgId,
          onboarding_completed: true,
        }, { onConflict: 'clerk_user_id' });

      if (profileErr) {
        console.warn("⚠️ Profile upsert error (non-critical):", profileErr.message);
      }

      // 5. Insert admin role (best effort)
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({
          clerk_user_id: clerkUserId,
          organization_id: finalOrgId,
          role: "admin",
        });

      if (roleErr) {
        console.warn("⚠️ user_roles insert warning:", roleErr.message);
      }
      // 6. Seed defaults (non-blocking) using finalOrgId
      const defaultSources = [
        { name: "Meta Ads", sort_order: 10 },
        { name: "Indicação", sort_order: 20 },
        { name: "Site", sort_order: 30 },
        { name: "Instagram Orgânico", sort_order: 40 },
        { name: "WhatsApp", sort_order: 50 },
      ];
      supabase.from("lead_sources").insert(
        defaultSources.map((s) => ({
          name: s.name,
          sort_order: s.sort_order,
          organization_id: finalOrgId,
          created_by: clerkUserId,
          is_active: true,
        }))
      ).then(({ error }) => {
        if (error) console.warn("⚠️ Lead sources seed error:", error);
      });

      supabase.rpc('seed_default_pipeline', {
        p_org_id: finalOrgId,
        p_created_by: clerkUserId,
      }).then(({ error }) => {
        if (error) console.warn("⚠️ Pipeline seed error:", error);
      });

      // Default automation (fire and forget)
      fetch(`${SUPABASE_URL}/functions/v1/automations-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          action: "create",
          organization_id: finalOrgId,
          name: "Boas-vindas Lead",
          description: "Envia mensagem de boas-vindas automaticamente para novos leads",
          created_by: clerkUserId,
          channel: "whatsapp",
        }),
      }).then(async (res) => {
        try {
          const d = await res.json();
          if (d.ok && d.automation) {
            const nodes = [
              { id: "trigger_1", type: "trigger", position: { x: 250, y: 50 }, data: { label: "Novo Lead", config: { triggerType: "lead_created" } } },
              { id: "delay_1", type: "delay", position: { x: 250, y: 200 }, data: { label: "Esperar 1 min", config: { amount: 1, unit: "minutes" } } },
              { id: "message_1", type: "message", position: { x: 250, y: 350 }, data: { label: "Boas-vindas", config: { text: "Olá {{lead.name}}, vi seu interesse. Posso te ajudar?" } } },
            ];
            const edges = [
              { id: "e_trigger_delay", source: "trigger_1", target: "delay_1" },
              { id: "e_delay_message", source: "delay_1", target: "message_1" },
            ];
            fetch(`${SUPABASE_URL}/functions/v1/automations-api`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}` },
              body: JSON.stringify({ action: "save_flow", automation_id: d.automation.id, organization_id: finalOrgId, nodes, edges }),
            });
          }
        } catch {}
      }).catch(() => {});

      toast.success("Empresa criada! Redirecionando…", {
        description: `Bem-vindo ao AutoLead, ${name}!`,
      });

      // 7. Refresh auth state so AppGate sees the new org
      console.log("🔄 Refreshing auth state...");
      try {
        await retryBootstrap();
        await refreshProfile();
      } catch (refreshErr) {
        console.warn("⚠️ Refresh error (non-critical):", refreshErr);
      }

      // 8. Navigate to dashboard — AppGate will allow it since orgId now exists
      console.log("🚀 Navigating to /dashboard...");
      navigate("/dashboard", { replace: true });

      // Fallback: if still on onboarding after 1.5s, force reload
      setTimeout(() => {
        if (window.location.pathname.includes('onboarding')) {
          console.log("⚠️ Still on onboarding, forcing page reload...");
          window.location.href = "/dashboard";
        }
      }, 1500);

    } catch (error) {
      console.error("❌ Error creating organization:", error);
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
            <CardTitle className="text-2xl font-bold">
              Bem-vindo ao AutoLead!
            </CardTitle>
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