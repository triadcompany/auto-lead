import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Filter, 
  Search, 
  Workflow, 
  TrendingUp, 
  Users, 
  Target, 
  DollarSign,
  ArrowUpRight,
  Clock,
  Zap
} from "lucide-react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { AddLeadModal } from "@/components/modals/AddLeadModal";
import { EditLeadModal } from "@/components/modals/EditLeadModal";
import { EditObservationsModal } from "@/components/modals/EditObservationsModal";
import { useSupabaseLeads, Lead } from "@/hooks/useSupabaseLeads";
import { usePipelines } from "@/hooks/usePipelines";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadNotifications } from "@/hooks/useLeadNotifications";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileKanbanBoard } from "@/components/mobile/MobileKanbanBoard";
import { useNewLeadNotification } from "@/hooks/useNewLeadNotification";
import { NotificationPermissionPrompt } from "@/components/mobile/NotificationPermissionPrompt";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PageHeader } from "@/components/layout/PageHeader";
import { motion } from "framer-motion";

export function Oportunidades() {
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [isEditObservationsOpen, setIsEditObservationsOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const { pipelines, selectedPipeline, setSelectedPipeline, selectPipeline, ensuring } = usePipelines();
  const { kanbanColumns, moveLead, updateLead, addLead, deleteLead, loading, searchTerm, setSearchTerm, leads } = useSupabaseLeads(selectedPipeline?.id);
  const { isAdmin, profile } = useAuth();
  
  // Setup lead notifications (only for testing)
  const { testNotification } = useLeadNotifications();

  // Calculate stats
  const stats = useMemo(() => {
    if (!leads || !kanbanColumns) return { total: 0, new: 0, inProgress: 0, converted: 0 };
    
    const total = leads.length;
    const newLeads = kanbanColumns[0]?.leads?.length || 0;
    const converted = kanbanColumns[kanbanColumns.length - 1]?.leads?.length || 0;
    const inProgress = total - newLeads - converted;
    
    return { total, new: newLeads, inProgress: Math.max(0, inProgress), converted };
  }, [leads, kanbanColumns]);

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditLeadOpen(true);
  };

  const handleSaveLead = (leadId: string, updatedLead: Partial<Lead>) => {
    updateLead(leadId, updatedLead);
  };

  const handleAddLead = (newLead: Omit<Lead, 'id' | 'created_at' | 'created_by' | 'stage_id'>) => {
    addLead(newLead);
  };

  if (loading || ensuring) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 font-medium text-muted-foreground">
            {ensuring ? 'Configurando seu funil padrão…' : 'Carregando oportunidades...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="md:p-6 pb-16 md:pb-6 space-y-6">
      {/* Mobile Header */}
      <MobileHeader title="Oportunidades" onSearch={() => {}} />
      
      {/* Mobile Pipeline Selector */}
      <div className="md:hidden px-4 pb-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-medium">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                <span>{selectedPipeline?.name || 'Selecione um pipeline'}</span>
              </div>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[50vh]">
            <SheetHeader>
              <SheetTitle>Selecionar Pipeline</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {pipelines.map((pipeline) => (
                <Button
                  key={pipeline.id}
                  variant={selectedPipeline?.id === pipeline.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => selectPipeline(pipeline)}
                >
                  <Workflow className="h-4 w-4 mr-2" />
                  {pipeline.name}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Desktop Header */}
      <div className="hidden md:block px-0">
        <PageHeader 
          title="Oportunidades" 
          description="Acompanhe seus leads através do funil de vendas"
        >
          <div className="flex gap-3">
            <Button 
              onClick={() => setIsAddLeadOpen(true)}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </PageHeader>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:shadow-lg transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Leads</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{stats.total}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs text-emerald-500 font-medium">Ativos</span>
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-7 w-7 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:shadow-lg transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Novos</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats.new}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span className="text-xs text-amber-500 font-medium">Aguardando</span>
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-7 w-7 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent hover:shadow-lg transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Em Negociação</p>
                  <p className="text-3xl font-bold text-violet-600 mt-1">{stats.inProgress}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <ArrowUpRight className="h-3 w-3 text-violet-500" />
                    <span className="text-xs text-violet-500 font-medium">Progresso</span>
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-violet-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-7 w-7 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:shadow-lg transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Convertidos</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.converted}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <DollarSign className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs text-emerald-500 font-medium">Vendas</span>
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-7 w-7 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mobile FAB */}
      <Button 
        onClick={() => setIsAddLeadOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-primary to-primary/80"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Pipeline Selection & Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Card className="hidden md:block border-0 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Pipeline Selector */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Workflow className="h-4 w-4 text-primary" />
                </div>
                <Select 
                  value={selectedPipeline?.id || ''} 
                  onValueChange={(value) => {
                    const pipeline = pipelines.find(p => p.id === value);
                    selectPipeline(pipeline || null);
                  }}
                >
                  <SelectTrigger className="w-52 border-0 bg-muted/50 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Selecione um pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nome, interesse ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-0 bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>

              {/* Pipeline Info */}
              {selectedPipeline && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {kanbanColumns.length} etapas
                  </Badge>
                  <Badge variant="secondary" className="bg-muted">
                    {stats.total} leads
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Desktop Kanban Board */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="hidden md:block"
      >
        <KanbanBoard 
          columns={kanbanColumns}
          onMoveLead={moveLead}
          onEditLead={handleEditLead}
        />
      </motion.div>

      {/* Mobile Kanban Board */}
      <MobileKanbanBoard 
        stages={kanbanColumns}
        onMoveCard={moveLead}
        onCardClick={handleEditLead}
      />

      {/* Add Lead Modal */}
      <AddLeadModal 
        open={isAddLeadOpen} 
        onOpenChange={setIsAddLeadOpen}
        onSave={handleAddLead}
      />

      {/* Edit Lead Modal */}
      <EditLeadModal 
        open={isEditLeadOpen} 
        onOpenChange={setIsEditLeadOpen}
        lead={selectedLead}
        onSave={handleSaveLead}
        onDelete={isAdmin ? deleteLead : undefined}
      />
    </div>
  );
}
