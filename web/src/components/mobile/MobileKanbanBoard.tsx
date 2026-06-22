import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Calendar, MoreVertical, Phone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Lead {
  id: string;
  name: string;
  phone: string;
  price?: string;
  stage_id: string;
  created_at: string;
}

interface Stage {
  id: string;
  title: string;
  color: string;
  leads: Lead[];
}

interface MobileKanbanBoardProps {
  stages: Stage[];
  onMoveCard: (leadId: string, newStageId: string) => void;
  onCardClick: (lead: Lead) => void;
}

export function MobileKanbanBoard({
  stages,
  onMoveCard,
  onCardClick,
}: MobileKanbanBoardProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const handleMoveClick = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleMove = (newStageId: string) => {
    if (selectedLead) {
      onMoveCard(selectedLead.id, newStageId);
      setSelectedLead(null);
    }
  };

  const getDaysInStage = (createdAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  return (
    <div className="md:hidden">
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-4 scrollbar-hide">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex-shrink-0 w-[85vw] snap-start"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-semibold text-sm">{stage.title}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {stage.leads.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {stage.leads.map((lead) => {
                const daysInStage = getDaysInStage(lead.created_at);
                return (
                  <div
                    key={lead.id}
                    className="bg-card border border-border rounded-lg p-3 active:scale-[0.98] transition-transform"
                    onClick={() => onCardClick(lead)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm line-clamp-1">
                        {lead.name}
                      </h4>
                      <Sheet>
                        <SheetTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 -mr-1"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-auto rounded-t-2xl">
                          <SheetHeader>
                            <SheetTitle>Ações</SheetTitle>
                          </SheetHeader>
                          <div className="mt-4 space-y-2">
                            <Button
                              variant="outline"
                              className="w-full justify-start h-12"
                              onClick={() => handleMoveClick(lead)}
                            >
                              Mover para outro estágio
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full justify-start h-12"
                              onClick={() => window.open(`https://wa.me/${lead.phone}`, '_blank')}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Enviar WhatsApp
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full justify-start h-12"
                              onClick={() => window.location.href = `tel:${lead.phone}`}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Ligar
                            </Button>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {lead.phone}
                    </p>

                    {lead.price && (
                      <p className="text-sm font-semibold text-primary mb-2">
                        {lead.price}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {daysInStage > 3 && (
                        <Badge variant="destructive" className="text-xs">
                          {daysInStage}d
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs ml-auto">
                        SLA OK
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {stage.leads.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum lead
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Move Stage Sheet */}
      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Mover para</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {stages.map((stage) => (
              <Button
                key={stage.id}
                variant="outline"
                className="w-full justify-start h-14"
                onClick={() => handleMove(stage.id)}
              >
                <div
                  className="w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.title}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
