import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns the set of stage_ids considered "sale closed" across ALL pipelines
 * of the active organization. Used by Dashboard and Reports so metrics like
 * "vendas fechadas", "taxa de conversão" e "receita" cubram o funil completo,
 * não apenas o pipeline default.
 */
export function useSalesStageIds() {
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = authOrgId || profile?.organization_id;
  const [salesStageIds, setSalesStageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setSalesStageIds(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_org_sales_stage_ids", {
          p_org_id: orgId,
        });
        if (cancelled) return;
        if (error) {
          console.error("[useSalesStageIds] error:", error);
          setSalesStageIds(new Set());
        } else {
          const ids = new Set<string>(
            (data || []).map((r: any) => r.stage_id as string),
          );
          setSalesStageIds(ids);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { salesStageIds, loading };
}
