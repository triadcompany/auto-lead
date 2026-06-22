import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Calendar, 
  Edit, 
  User,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { KanbanColumn, Lead } from "@/hooks/useSupabaseLeads";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { motion, AnimatePresence } from "framer-motion";
import { formatPhoneDisplay } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface KanbanBoardProps {
  columns: KanbanColumn[];
  onMoveLead: (leadId: string, newStageId: string) => void;
  onEditLead: (lead: Lead) => void;
}

const getSourceBadgeColor = (source: string) => {
  const colors: Record<string, string> = {
    "Facebook Ads": "bg-blue-100 text-blue-700 border-blue-200",
    "Instagram": "bg-pink-100 text-pink-700 border-pink-200",
    "Google": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Indicação": "bg-purple-100 text-purple-700 border-purple-200",
    "Orgânico": "bg-gray-100 text-gray-700 border-gray-200",
    "Meta Ads": "bg-indigo-100 text-indigo-700 border-indigo-200",
    "Site": "bg-cyan-100 text-cyan-700 border-cyan-200",
    "Loja": "bg-amber-100 text-amber-700 border-amber-200",
  };
  return colors[source] || "bg-gray-100 text-gray-700 border-gray-200";
};

// Build a soft top→bottom gradient from the stage's own color (hex).
// Falls back to a neutral gradient when no color is provided.
const getColumnGradientStyle = (color?: string): React.CSSProperties => {
  if (!color) return { background: "linear-gradient(to bottom, hsl(var(--muted) / 0.3), transparent)" };
  return {
    background: `linear-gradient(to bottom, ${hexToRgba(color, 0.12)}, ${hexToRgba(color, 0)})`,
  };
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(148,163,184,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function KanbanBoard({ columns, onMoveLead, onEditLead }: KanbanBoardProps) {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const navigate = useNavigate();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, columns.length]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedLead && draggedLead.stage_id !== columnId) {
      onMoveLead(draggedLead.id, columnId);
    }
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleLeadClick = (lead: Lead) => {
    onEditLead(lead);
  };

  const openConversation = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, '');
    navigate(`/inbox?phone=${cleanPhone}`);
  };

  return (
    <div className="relative group/kanban">
      {/* Left scroll button */}
      <button
        type="button"
        aria-label="Rolar para esquerda"
        onClick={() => scrollByAmount("left")}
        disabled={!canScrollLeft}
        className={`hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur shadow-lg text-foreground hover:bg-background hover:scale-105 transition-all ${
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Right scroll button */}
      <button
        type="button"
        aria-label="Rolar para direita"
        onClick={() => scrollByAmount("right")}
        disabled={!canScrollRight}
        className={`hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur shadow-lg text-foreground hover:bg-background hover:scale-105 transition-all ${
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div ref={scrollRef} className="overflow-x-scroll overflow-y-hidden pb-4 scrollbar-always">
        <div className="flex gap-4" style={{ minWidth: "fit-content" }}>
        {columns.map((column, columnIndex) => (
          <motion.div 
            key={column.id} 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: columnIndex * 0.05 }}
            className="flex-shrink-0 w-80"
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <Card
              className={`h-full border-0 shadow-sm transition-all duration-300 ${
                dragOverColumn === column.id ? 'ring-2 ring-primary/50 shadow-lg' : ''
              }`}
              style={getColumnGradientStyle(column.color)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1 h-6 rounded-full"
                      style={{ backgroundColor: column.color || 'hsl(var(--muted-foreground))' }}
                    />
                    <CardTitle className="font-semibold text-sm">
                      {column.title}
                    </CardTitle>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className="bg-background/80 backdrop-blur-sm font-bold text-xs"
                  >
                    {column.count}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto min-h-[200px] px-3">
                <AnimatePresence mode="popLayout">
                  {column.leads.map((lead, leadIndex) => (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: leadIndex * 0.02 }}
                    >
                      <Card 
                        className="border border-border/50 hover:border-primary/30 bg-card hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden"
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onClick={() => handleLeadClick(lead)}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-sm text-foreground truncate">
                                    {lead.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {formatPhoneDisplay(lead.phone)}
                                  </p>
                                </div>
                              </div>
                              <Edit className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                            
                            {/* Source Badge */}
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getSourceBadgeColor(lead.source)}`}
                            >
                              {lead.source}
                            </Badge>

                            {/* Interest */}
                            {lead.interest && (
                              <div className="p-2 rounded-lg bg-muted/50">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Interesse:</span>{' '}
                                  {lead.interest}
                                </p>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 hover:bg-primary/10"
                                  onClick={(e) => openConversation(lead.phone, e)}
                                >
                                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                                <AddTaskModal 
                                  leadId={lead.id}
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 hover:bg-primary/10"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Calendar className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  }
                                />
                              </div>
                            </div>

                            {/* Seller */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">{lead.seller_name}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {column.leads.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 px-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <User className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum lead</p>
                    <p className="text-xs text-muted-foreground/75 mt-1">Arraste um lead para esta etapa</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        </div>
      </div>
    </div>
  );
}
