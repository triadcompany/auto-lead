import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, Plus, ArrowRightLeft, CheckCircle, UserPlus,
  StickyNote, Tag, MessageCircle, Activity as ActivityIcon,
} from "lucide-react";

const ICONS: Record<string, any> = {
  created: Plus,
  stage_changed: ArrowRightLeft,
  status_changed: CheckCircle,
  assigned: UserPlus,
  note: StickyNote,
  task: ActivityIcon,
  tag: Tag,
  message: MessageCircle,
  score_changed: ActivityIcon,
};

const COLORS: Record<string, string> = {
  created: "text-blue-500 bg-blue-500/10",
  stage_changed: "text-primary bg-primary/10",
  status_changed: "text-emerald-500 bg-emerald-500/10",
  assigned: "text-purple-500 bg-purple-500/10",
  note: "text-amber-500 bg-amber-500/10",
  tag: "text-cyan-500 bg-cyan-500/10",
  message: "text-indigo-500 bg-indigo-500/10",
};

export function LeadTimeline({ leadId }: { leadId: string }) {
  const api = useApi();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.leads.timeline(leadId);
        if (!cancelled) setItems(data || []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        <ActivityIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
        Nenhuma atividade registrada ainda.
      </div>
    );
  }

  return (
    <div className="relative pl-2">
      {items.map((it, i) => {
        const Icon = ICONS[it.type] || ActivityIcon;
        const color = COLORS[it.type] || "text-muted-foreground bg-muted";
        return (
          <div key={it.id} className="flex gap-3 pb-4 relative">
            {i < items.length - 1 && (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-sm text-foreground">{it.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(it.createdAt || it.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {it.performedByName ? ` · ${it.performedByName}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
