import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";

const SALE_STAGE_KEYWORDS = ["venda", "fechado", "concluido", "ganho", "won", "closed", "sale"];

export function useSalesStageIds() {
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = authOrgId || profile?.organization_id;
  const [salesStageIds, setSalesStageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    if (!orgId) {
      setSalesStageIds(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pipelines = await api.pipelines.list() as any[];
        if (cancelled) return;
        const ids = new Set<string>();
        for (const pipeline of pipelines) {
          const stages = pipeline.stages || [];
          for (const stage of stages) {
            const name = (stage.name || '').toLowerCase();
            if (SALE_STAGE_KEYWORDS.some(k => name.includes(k))) {
              ids.add(stage.id);
            }
          }
        }
        setSalesStageIds(ids);
      } catch (err) {
        console.error("[useSalesStageIds] error:", err);
        setSalesStageIds(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, api]);

  return { salesStageIds, loading };
}
